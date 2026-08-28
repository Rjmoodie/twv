export interface PendingAction {
  type: string;
  payload?: Record<string, unknown>;
  returnTo?: string;
  message?: string;
}

const KEY = 'somatech-pending-action';

// localStorage survives email-confirmation redirects (new tab → back to app).
// sessionStorage was previously used but lost intent across tabs/redirects.
export function savePendingAction(action: PendingAction): void {
  try { localStorage.setItem(KEY, JSON.stringify(action)); } catch { /* ignore */ }
}

export function loadPendingAction(): PendingAction | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PendingAction) : null;
  } catch { return null; }
}

export function clearPendingAction(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
