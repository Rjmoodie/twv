/**
 * SessionTimeoutWarning — D7 idle-session management.
 *
 * Audit requirement: "Session idle timeout with 2-minute warning before
 * automatic sign-out. Institutional users expect explicit session controls."
 *
 * Logic:
 *   - Reset idle timer on any user interaction (mouse, key, touch, scroll).
 *   - After IDLE_MS of inactivity, show the warning dialog with a countdown.
 *   - If the user clicks "Stay signed in", reset the timer.
 *   - If WARN_MS elapses without response, call signOut().
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Progress } from '@/components/ui/progress';
import { Clock } from 'lucide-react';

// ─── Timings ─────────────────────────────────────────────────────────────────

/** Inactivity before the warning dialog appears (60 minutes) */
const IDLE_MS = 60 * 60 * 1000;

/** How long the countdown in the dialog lasts before auto sign-out (2 minutes) */
const WARN_MS = 2 * 60 * 1000;

/** Tick interval for the countdown display */
const TICK_MS = 1000;

// ─── User-interaction events that reset the idle timer ───────────────────────

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
  'click',
];

// ─── Props ───────────────────────────────────────────────────────────────────

interface SessionTimeoutWarningProps {
  /** Called when the session should be terminated */
  onSignOut: () => void;
  /** Override idle timeout (ms) — useful for testing */
  idleMs?: number;
  /** Override warning window (ms) — useful for testing */
  warnMs?: number;
}

// ─── Component ───────────────────────────────────────────────────────────────

const SessionTimeoutWarning: React.FC<SessionTimeoutWarningProps> = ({
  onSignOut,
  idleMs = IDLE_MS,
  warnMs = WARN_MS,
}) => {
  const [isWarning, setIsWarning] = useState(false);
  const [remainingMs, setRemainingMs] = useState(warnMs);

  const idleTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickTimer    = useRef<ReturnType<typeof setInterval> | null>(null);
  // Ref mirror of isWarning so resetIdle can read it without being a dep of the main effect.
  // Without this, setIsWarning(true) would cause resetIdle to change → effect cleanup fires
  // → clearAllTimers() kills warnTimer/tickTimer → countdown freezes and never auto-signs-out.
  const isWarningRef = useRef(false);

  const clearAllTimers = () => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (warnTimer.current) clearTimeout(warnTimer.current);
    if (tickTimer.current) clearInterval(tickTimer.current);
  };

  const startCountdown = useCallback(() => {
    isWarningRef.current = true;
    setIsWarning(true);
    setRemainingMs(warnMs);

    warnTimer.current = setTimeout(() => {
      clearAllTimers();
      onSignOut();
    }, warnMs);

    const start = Date.now();
    tickTimer.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, warnMs - elapsed);
      setRemainingMs(remaining);
    }, TICK_MS);
  }, [warnMs, onSignOut]);

  const resetIdle = useCallback(() => {
    if (isWarningRef.current) return; // don't reset while warning is showing
    clearAllTimers();
    idleTimer.current = setTimeout(startCountdown, idleMs);
  }, [idleMs, startCountdown]); // isWarning intentionally omitted — read via ref above

  // Wire up activity listeners
  useEffect(() => {
    ACTIVITY_EVENTS.forEach((ev) =>
      window.addEventListener(ev, resetIdle, { passive: true })
    );
    // Kick off initial idle timer
    idleTimer.current = setTimeout(startCountdown, idleMs);

    return () => {
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, resetIdle));
      clearAllTimers();
    };
  }, [resetIdle, startCountdown, idleMs]);

  const handleStaySignedIn = () => {
    clearAllTimers();
    isWarningRef.current = false;
    setIsWarning(false);
    idleTimer.current = setTimeout(startCountdown, idleMs);
  };

  const handleSignOut = () => {
    clearAllTimers();
    isWarningRef.current = false;
    setIsWarning(false);
    onSignOut();
  };

  const progressPct = ((warnMs - remainingMs) / warnMs) * 100;
  const remainingSecs = Math.ceil(remainingMs / 1000);

  return (
    <AlertDialog open={isWarning}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-warning" aria-hidden="true" />
            Session About to Expire
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <span className="block">
              Your session will expire in{' '}
              <strong className="tabular-nums">
                {Math.floor(remainingSecs / 60)}:
                {String(remainingSecs % 60).padStart(2, '0')}
              </strong>{' '}
              due to inactivity.
            </span>
            <Progress
              value={progressPct}
              className="h-1.5"
              aria-label={`${remainingSecs} seconds remaining`}
            />
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleSignOut}>
            Sign out now
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleStaySignedIn}>
            Stay signed in
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default SessionTimeoutWarning;
