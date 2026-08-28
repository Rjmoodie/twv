import { useState, useEffect } from 'react';
import { Cookie, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const CONSENT_KEY = 'somatech-cookie-consent';
const CONSENT_VERSION = '1'; // bump when policy changes to re-prompt

type ConsentState = 'accepted' | 'declined' | null;

function getStoredConsent(): ConsentState {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.version !== CONSENT_VERSION) return null;
    return parsed.state as ConsentState;
  } catch {
    return null;
  }
}

function storeConsent(state: ConsentState) {
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({ state, version: CONSENT_VERSION, ts: Date.now() }));
  } catch { /* storage full */ }
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    // Small delay so it doesn't flash on first paint
    const t = setTimeout(() => {
      if (!getStoredConsent()) setVisible(true);
    }, 800);
    return () => clearTimeout(t);
  }, []);

  const accept = () => {
    storeConsent('accepted');
    setVisible(false);
  };

  const decline = () => {
    storeConsent('declined');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className={cn(
        'fixed bottom-0 inset-x-0 z-[100] lg:bottom-4 lg:left-4 lg:right-auto lg:max-w-sm',
        'bg-card border border-border/60 shadow-elev-3 rounded-t-2xl lg:rounded-2xl',
        'p-4 transition-all duration-300'
      )}
      style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      role="dialog"
      aria-label="Cookie consent"
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center mt-0.5">
          <Cookie className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">We use cookies</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            We use essential cookies to keep you signed in and remember your preferences.
          </p>

          {expanded && (
            <div className="mt-3 space-y-2 text-xs text-muted-foreground">
              <div className="rounded-xl bg-muted/50 p-3 space-y-1.5">
                <p className="font-medium text-foreground">Essential (always on)</p>
                <p>Authentication session, theme preference, and app state. Cannot be disabled.</p>
              </div>
              <div className="rounded-xl bg-muted/50 p-3 space-y-1.5">
                <p className="font-medium text-foreground">Analytics (optional)</p>
                <p>Anonymous usage patterns to improve the app. No personal data shared with third parties.</p>
              </div>
            </div>
          )}

          <button
            onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-1 text-xs text-primary mt-1.5 hover:underline"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? 'Show less' : 'Learn more'}
          </button>
        </div>
        <button
          onClick={decline}
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex gap-2 mt-4">
        <Button variant="outline" size="sm" className="flex-1" onClick={decline}>
          Essential only
        </Button>
        <Button size="sm" className="flex-1" onClick={accept}>
          Accept all
        </Button>
      </div>
    </div>
  );
}

export function useCookieConsent() {
  return getStoredConsent();
}
