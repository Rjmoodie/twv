import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';
import type { Tables } from '@/integrations/supabase/types';
import { disablePushDeviceLocally } from './PWAUtils';
import { CONSENT_KEY } from './CookieConsent';
import { SubscriptionService } from '@/services/subscription';
import { UserProfile } from '@/types/subscription';

export type OrganizationRole = 'owner' | 'admin' | 'project_manager' | 'investor' | 'viewer';
export type ProjectRole = 'project_manager' | 'investor' | 'client' | 'viewer';
export type PortalPersona = 'admin' | 'project_manager' | 'investor' | 'client';

export interface OrganizationAccess {
  organization_id: string;
  role: OrganizationRole;
}

export interface ProjectAccess {
  project_id: string;
  organization_id: string;
  role: ProjectRole;
}

export interface UserAccess {
  organizations: OrganizationAccess[];
  projects: ProjectAccess[];
  personas: PortalPersona[];
}

interface AccessQueryResult { data: unknown[] | null; error: { message: string } | null }
interface AccessQuery extends PromiseLike<AccessQueryResult> { eq(column: string, value: string): AccessQuery }
interface AccessTable { select(columns: string): AccessQuery }

interface AuthContextType {
  user: User | null;
  loading: boolean;
  sendLoginCode: (email: string) => Promise<{ error: Error | null }>;
  verifyLoginCode: (email: string, token: string) => Promise<{ error: Error | null }>;
  signInWithOAuth: (provider: 'google') => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  profile: Tables<'user_profiles'> | null;
  userProfile: UserProfile | null;
  access: UserAccess;
  accessLoading: boolean;
  refreshAccess: () => Promise<void>;
  hasPersona: (persona: PortalPersona) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

const AuthProviderComponent: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Tables<'user_profiles'> | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [access, setAccess] = useState<UserAccess>({ organizations: [], projects: [], personas: [] });
  const [accessLoading, setAccessLoading] = useState(false);
  const activeUserIdRef = useRef<string | null>(null);
  const nullSessionHandledRef = useRef(false);

  /**
   * Authentication can disappear without going through the Account screen
   * (expiry, another tab, OAuth replacement, administrative revocation). Keep
   * the cleanup at the provider boundary so every loss path has the same
   * privacy guarantees as the explicit Sign out button.
   */
  const clearSignedOutClientState = useCallback(() => {
    if (nullSessionHandledRef.current) return;
    nullSessionHandledRef.current = true;

    // React Query can otherwise retain user-scoped rows until their gcTime.
    queryClient.clear();

    if (typeof window === 'undefined') return;
    try {
      // An invitation opened before OAuth must survive the anonymous session
      // cleanup so the callback can return to the same project-scoped grant.
      const pendingProjectInvite = window.sessionStorage.getItem('tw-pending-project-invite');
      window.sessionStorage.clear();
      if (pendingProjectInvite) window.sessionStorage.setItem('tw-pending-project-invite', pendingProjectInvite);

      const anonymousSafeKeys = new Set<string>(['theme', CONSENT_KEY]);
      const keysToRemove: string[] = [];
      for (let index = 0; index < window.localStorage.length; index++) {
        const key = window.localStorage.key(index);
        if (key && !anonymousSafeKeys.has(key)) keysToRemove.push(key);
      }
      keysToRemove.forEach((key) => window.localStorage.removeItem(key));
    } catch (error) {
      // Restricted browsing contexts can deny storage access. The in-memory
      // resets below still run, and individual providers also key state by user.
      console.warn('Could not clear signed-out browser state:', error);
    }

    window.dispatchEvent(new CustomEvent('tw:signed-out'));
  }, [queryClient]);

  const loadProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Profile loading error:', error);
        return;
      }

      if (activeUserIdRef.current === userId) setProfile(data);
    } catch (error) {
      console.error('Profile loading failed:', error);
    }
  }, []);

  const loadUserProfile = useCallback(async (userId: string) => {
    try {
      const profile = await SubscriptionService.getUserProfile(userId);
      if (activeUserIdRef.current === userId) setUserProfile(profile);
    } catch (error) {
      console.error('User profile loading failed:', error);
    }
  }, []);

  const loadAccess = useCallback(async (userId: string) => {
    setAccessLoading(true);
    try {
      // Generated types intentionally lag the new local migrations until a TW
      // hosted project exists. Keep this narrow facade next to the two queries.
      const database = supabase as unknown as { from(table: string): AccessTable };
      const [organizationResult, projectResult] = await Promise.all([
        database.from('organization_members').select('organization_id, role').eq('user_id', userId),
        database.from('project_members').select('project_id, organization_id, role').eq('user_id', userId),
      ]);
      if (organizationResult.error) throw new Error(organizationResult.error.message);
      if (projectResult.error) throw new Error(projectResult.error.message);

      const organizations = (organizationResult.data ?? []) as OrganizationAccess[];
      const projects = (projectResult.data ?? []) as ProjectAccess[];
      const personaSet = new Set<PortalPersona>();
      if (organizations.some(item => item.role === 'owner' || item.role === 'admin')) personaSet.add('admin');
      if (organizations.some(item => item.role === 'project_manager') || projects.some(item => item.role === 'project_manager')) personaSet.add('project_manager');
      if (organizations.some(item => item.role === 'investor') || projects.some(item => item.role === 'investor')) personaSet.add('investor');
      if (projects.some(item => item.role === 'client')) personaSet.add('client');
      if (activeUserIdRef.current === userId) {
        setAccess({ organizations, projects, personas: [...personaSet] });
      }
    } catch (error) {
      console.error('Project access loading failed:', error);
      if (activeUserIdRef.current === userId) setAccess({ organizations: [], projects: [], personas: [] });
    } finally {
      if (activeUserIdRef.current === userId) setAccessLoading(false);
    }
  }, []);

  const refreshAccess = useCallback(async () => {
    const userId = activeUserIdRef.current;
    if (userId) await loadAccess(userId);
  }, [loadAccess]);

  const hasPersona = useCallback((persona: PortalPersona) => access.personas.includes(persona), [access.personas]);

  useEffect(() => {
    let mounted = true;
    let profileTimeout: ReturnType<typeof setTimeout> | undefined;

    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Session error:', error);
          if (mounted) {
            activeUserIdRef.current = null;
            setUser(null);
            setProfile(null);
            setUserProfile(null);
            setAccess({ organizations: [], projects: [], personas: [] });
            void disablePushDeviceLocally();
            clearSignedOutClientState();
            setLoading(false);
          }
          return;
        }

        if (mounted) {
          const nextUser = session?.user ?? null;
          activeUserIdRef.current = nextUser?.id ?? null;
          nullSessionHandledRef.current = false;
          setUser(nextUser);
          if (session?.user) {
            setAccessLoading(true);
            profileTimeout = setTimeout(() => {
              loadProfile(session.user.id);
              loadUserProfile(session.user.id);
              loadAccess(session.user.id);
            }, 100);
          } else {
            void disablePushDeviceLocally();
            clearSignedOutClientState();
          }
          setLoading(false);
        }
      } catch (error) {
        console.error('Initial session error:', error);
        if (mounted) {
          activeUserIdRef.current = null;
          setUser(null);
          setProfile(null);
          setUserProfile(null);
          setAccess({ organizations: [], projects: [], personas: [] });
          void disablePushDeviceLocally();
          clearSignedOutClientState();
          setLoading(false);
        }
      }
    };

    getInitialSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;

        if (profileTimeout) clearTimeout(profileTimeout);

        const previousUserId = activeUserIdRef.current;
        const nextUser = session?.user ?? null;
        const nextUserId = nextUser?.id ?? null;

        // A direct account replacement is unusual but supported by Supabase.
        // Clear cached query rows before loading the replacement account. Do
        // not clear localStorage here: it already contains the new auth token.
        if (previousUserId && nextUserId && previousUserId !== nextUserId) {
          void disablePushDeviceLocally();
          queryClient.clear();
          setProfile(null);
          setUserProfile(null);
          setAccess({ organizations: [], projects: [], personas: [] });
        }

        activeUserIdRef.current = nextUserId;
        if (nextUserId) nullSessionHandledRef.current = false;
        setUser(nextUser);

        if (nextUser) {
          setAccessLoading(true);
          profileTimeout = setTimeout(() => {
            loadProfile(nextUser.id);
            loadUserProfile(nextUser.id);
            loadAccess(nextUser.id);
          }, 150);
        } else {
          setProfile(null);
          setUserProfile(null);
          setAccess({ organizations: [], projects: [], personas: [] });
          void disablePushDeviceLocally(previousUserId);
          clearSignedOutClientState();
        }

        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      if (profileTimeout) clearTimeout(profileTimeout);
      subscription.unsubscribe();
    };
  }, [clearSignedOutClientState, loadAccess, loadProfile, loadUserProfile, queryClient]);

  /**
   * Email is a one-time code, not a password.
   *
   * A confirmation link mailed to a mistyped address is a working credential
   * sitting in a stranger's inbox -- which is exactly what happened when an
   * account was created against `servjces@wv-llc.com`, a real domain with live
   * MX that nobody here controls. A six-digit code is useless to whoever
   * receives it by accident, because it only completes a session already
   * started on this device.
   *
   * One call covers both cases: shouldCreateUser means a first-time address
   * gets an account, and a known one simply signs in.
   */
  const sendLoginCode = useCallback(async (email: string) => {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  }, []);

  const verifyLoginCode = useCallback(async (email: string, token: string) => {
    try {
      const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  }, []);

  const signInWithOAuth = useCallback(async (provider: 'google') => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  }, []);

  const signOut = useCallback(async () => {
    const signingOutUserId = activeUserIdRef.current;
    try {
      await disablePushDeviceLocally(signingOutUserId);
      const { error } = await supabase.auth.signOut();
      if (error) console.error('Remote sign out error:', error);
    } catch (error) {
      console.error('Remote sign out failed:', error);
    } finally {
      // Privacy is fail-closed: a network failure may prevent remote token
      // revocation, but it must never leave this device showing account data.
      setUser(null);
      setProfile(null);
      setUserProfile(null);
      setAccess({ organizations: [], projects: [], personas: [] });
      setAccessLoading(false);
      activeUserIdRef.current = null;
      // onAuthStateChange normally performs this synchronously. This defensive
      // call covers mocked/native clients that resolve signOut without emitting.
      clearSignedOutClientState();
    }
  }, [clearSignedOutClientState]);

  const value: AuthContextType = {
    user,
    loading,
    sendLoginCode,
    verifyLoginCode,
    signInWithOAuth,
    signOut,
    profile,
    userProfile,
    access,
    accessLoading,
    refreshAccess,
    hasPersona,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const AuthProvider = AuthProviderComponent;
export default AuthProviderComponent;
