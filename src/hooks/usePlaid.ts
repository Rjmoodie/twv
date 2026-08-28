import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/somatech/AuthProvider';
import { FunctionsHttpError } from '@supabase/supabase-js';

// Extracts the real error message from a Supabase FunctionsHttpError —
// otherwise invoke() only surfaces the generic HTTP status phrase.
async function extractFnError(err: unknown): Promise<string> {
  if (err instanceof FunctionsHttpError) {
    try {
      const body = await err.context.json();
      if (body?.error) return body.error;
    } catch {
      // Body wasn't JSON — fall through to the generic message.
    }
    return err.message;
  }
  return err instanceof Error ? err.message : String(err);
}

export interface PlaidAccount {
  id:      string;
  name:    string;
  mask:    string;
  type:    string;
  subtype: string;
}

export interface PlaidConnection {
  item_id:          string;
  institution_name: string;
  institution_id:   string | null;
  accounts:         PlaidAccount[];
  last_synced_at:   string | null;
}

export interface UsePlaidReturn {
  connection:          PlaidConnection | null;  // most recently synced — backwards compat
  connections:         PlaidConnection[];       // all connected institutions
  isLoading:           boolean;
  isSyncing:           boolean;
  isConnecting:        boolean;
  syncResult:          { totals: { totalIncome: number; totalExpenses: number; netWorth: number } } | null;
  error:               string | null;
  openPlaidLink:       () => void;
  sync:                () => Promise<void>;
  disconnect:          () => Promise<void>;
  disconnectByItemId:  (itemId: string) => Promise<void>;
}

const parsePlaidAccounts = (value: unknown): PlaidAccount[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap(account => {
    if (typeof account !== 'object' || account == null) return [];
    const row = account as Record<string, unknown>;
    if (typeof row.id !== 'string' || typeof row.name !== 'string') return [];
    return [{
      id: row.id,
      name: row.name,
      mask: typeof row.mask === 'string' ? row.mask : '',
      type: typeof row.type === 'string' ? row.type : 'unknown',
      subtype: typeof row.subtype === 'string' ? row.subtype : 'unknown',
    }];
  });
};

const PLAID_SCRIPT_ID  = 'plaid-link-sdk';
const PLAID_SCRIPT_SRC = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';

// Module-level promise so the script is fetched exactly once regardless of how
// many times usePlaid mounts or remounts.
let plaidScriptPromise: Promise<void> | null = null;

function loadPlaidScript(): Promise<void> {
  if (plaidScriptPromise) return plaidScriptPromise;
  if ((window as any).Plaid) return (plaidScriptPromise = Promise.resolve());
  if (document.getElementById(PLAID_SCRIPT_ID)) {
    // Script tag exists but Plaid object not yet set — wait for load event
    plaidScriptPromise = new Promise(resolve => {
      const existing = document.getElementById(PLAID_SCRIPT_ID) as HTMLScriptElement;
      existing.addEventListener('load', () => resolve(), { once: true });
    });
    return plaidScriptPromise;
  }
  plaidScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id    = PLAID_SCRIPT_ID;
    script.src   = PLAID_SCRIPT_SRC;
    script.async = true;
    script.onload  = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Plaid SDK'));
    document.head.appendChild(script);
  });
  return plaidScriptPromise;
}

function usePlaidScript(): boolean {
  const [loaded, setLoaded] = useState(() => !!(window as any).Plaid);
  useEffect(() => {
    if (loaded) return;
    loadPlaidScript().then(() => setLoaded(true)).catch(() => {});
  }, [loaded]);
  return loaded;
}

export function usePlaid(onSyncComplete?: () => void): UsePlaidReturn {
  const { user } = useAuth();
  const plaidReady    = usePlaidScript();
  const [connections,  setConnections]  = useState<PlaidConnection[]>([]);
  const [isLoading,    setIsLoading]    = useState(true);
  const [isSyncing,    setIsSyncing]    = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [syncResult,   setSyncResult]   = useState<UsePlaidReturn['syncResult']>(null);
  const [error,        setError]        = useState<string | null>(null);
  const [dataUserId,   setDataUserId]   = useState<string | null>(null);
  const handlerRef = useRef<any>(null);
  const activeUserIdRef = useRef<string | null>(user?.id ?? null);

  // Most recently synced connection — backwards compat with existing consumers
  const ownsData = Boolean(user?.id && dataUserId === user.id);
  const visibleConnections = ownsData ? connections : [];
  const connection = visibleConnections[0] ?? null;

  // Load all connections from DB, most recently synced first
  useEffect(() => {
    const userId = user?.id ?? null;
    activeUserIdRef.current = userId;
    setConnections([]);
    setSyncResult(null);
    setError(null);
    setDataUserId(null);
    setIsSyncing(false);
    setIsConnecting(false);
    if (!userId) { setIsLoading(false); return; }
    let cancelled = false;
    setIsLoading(true);

    supabase.from('plaid_connections')
      .select('item_id, institution_name, institution_id, accounts, last_synced_at')
      .eq('user_id', userId)
      .order('last_synced_at', { ascending: false, nullsFirst: false })
      .then(({ data, error: loadError }) => {
        if (!cancelled) {
          setConnections(loadError ? [] : (data ?? []).map(row => ({
            item_id: row.item_id,
            institution_name: row.institution_name ?? 'Connected institution',
            institution_id: row.institution_id,
            accounts: parsePlaidAccounts(row.accounts),
            last_synced_at: row.last_synced_at,
          })));
          setError(loadError?.message ?? null);
          setDataUserId(userId);
          setIsLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [user]);

  const getSession = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');
    return session;
  }, []);

  // Full sync: pull balances + transactions from Plaid → write to DB
  const sync = useCallback(async () => {
    if (!user || isSyncing) return;
    const requestedUserId = user.id;
    setIsSyncing(true);
    setError(null);
    try {
      const session = await getSession();
      const { data, error: fnErr } = await supabase.functions.invoke('plaid-sync', {
        body: {},
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (fnErr) throw new Error(await extractFnError(fnErr));
      if (activeUserIdRef.current !== requestedUserId) return;
      setSyncResult(data);
      // Update last_synced_at on the synced connection without a full reload
      setConnections(prev => prev.map((c, i) => i === 0 ? { ...c, last_synced_at: data.last_synced_at } : c));
      onSyncComplete?.();
    } catch (err) {
      if (activeUserIdRef.current === requestedUserId) {
        setError(err instanceof Error ? err.message : 'Sync failed');
      }
    } finally {
      if (activeUserIdRef.current === requestedUserId) setIsSyncing(false);
    }
  }, [user, isSyncing, getSession, onSyncComplete]);

  // Open Plaid Link widget
  const openPlaidLink = useCallback(async () => {
    if (!plaidReady || isConnecting) return;
    setIsConnecting(true);
    setError(null);

    try {
      const session = await getSession();

      // 1. Get link token from our edge function
      const { data: linkData, error: linkErr } = await supabase.functions.invoke('plaid-link', {
        body: { action: 'create_link_token' },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (linkErr) throw new Error(await extractFnError(linkErr));

      // 2. Open Plaid Link widget
      await new Promise<void>((resolve, reject) => {
        const handler = (window as any).Plaid.create({
          token: linkData.link_token,
          onSuccess: async (publicToken: string) => {
            try {
              // 3. Exchange public token
              const { data: exchData, error: exchErr } = await supabase.functions.invoke('plaid-link', {
                body: { action: 'exchange_token', public_token: publicToken },
                headers: { Authorization: `Bearer ${session.access_token}` },
              });
              if (exchErr) throw new Error(await extractFnError(exchErr));
                      const newConn: PlaidConnection = {
                item_id:          exchData.item_id ?? '',
                institution_name: exchData.institution_name,
                institution_id:   exchData.institution_id ?? null,
                accounts:         exchData.accounts ?? [],
                last_synced_at:   null,
              };
              setConnections(prev => [newConn, ...prev.filter(c => c.item_id !== newConn.item_id)]);
              resolve();
            } catch (err) { reject(err); }
          },
          onExit: (err: any) => {
            if (err) reject(new Error(err.display_message ?? 'Plaid Link closed'));
            else     resolve(); // user closed without error
          },
        });
        handlerRef.current = handler;
        handler.open();
      });

      // 4. Auto-sync immediately after connecting
      await sync();
    } catch (err) {
      if (err instanceof Error && err.message !== 'Plaid Link closed') {
        setError(err.message);
      }
    } finally {
      setIsConnecting(false);
    }
  }, [plaidReady, isConnecting, getSession, sync]);

  // Disconnect all connections for this user
  const disconnect = useCallback(async () => {
    if (!user) return;
    await supabase.from('plaid_connections').delete().eq('user_id', user.id);
    setConnections([]);
    setSyncResult(null);
  }, [user]);

  // Disconnect a specific connection by item_id
  const disconnectByItemId = useCallback(async (itemId: string) => {
    if (!user) return;
    await supabase.from('plaid_connections').delete().eq('user_id', user.id).eq('item_id', itemId);
    setConnections(prev => prev.filter(c => c.item_id !== itemId));
  }, [user]);

  return {
    connection,
    connections: visibleConnections,
    isLoading: Boolean(user) && (!ownsData || isLoading),
    isSyncing: ownsData && isSyncing,
    isConnecting: Boolean(user) && isConnecting,
    syncResult: ownsData ? syncResult : null,
    error: ownsData ? error : null,
    openPlaidLink, sync, disconnect, disconnectByItemId,
  };
}
