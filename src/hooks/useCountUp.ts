import { useState, useEffect, useRef, useCallback } from 'react';

interface CountUpOptions {
  duration?: number;       // ms — defaults to 700
  easing?: (t: number) => number;
  formatFn?: (value: number) => string;
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Animates from 0 → target whenever target transitions from null → number.
 * Subsequent target changes animate from the current displayed value → new target.
 *
 * Respects prefers-reduced-motion — skips animation and shows final value immediately.
 * Re-mount guard: if the same value is seen a second time (tab switch back), animation
 * is skipped and the final value is shown directly.
 */
export function useCountUp(
  target: number | null,
  { duration = 700, easing = easeOut, formatFn = (v) => String(Math.round(v)) }: CountUpOptions = {},
): string {
  const prefersReduced = useRef(
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );

  // Track last seen target so re-mounts don't re-animate the same value
  const seenTargets = useRef<Set<number>>(new Set());

  const [display, setDisplay] = useState<string>(
    target !== null ? formatFn(target) : '—',
  );

  const rafRef    = useRef<number | null>(null);
  const fromRef   = useRef<number>(0);
  const startRef  = useRef<number | null>(null);

  const cancel = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (target === null) {
      setDisplay('—');
      return;
    }

    // Skip animation if reduced motion or value already animated once this session
    if (prefersReduced.current || seenTargets.current.has(target)) {
      setDisplay(formatFn(target));
      seenTargets.current.add(target);
      return;
    }

    seenTargets.current.add(target);
    cancel();

    const from = fromRef.current;
    startRef.current = null;

    const tick = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easing(progress);
      const current = from + (target - from) * eased;
      fromRef.current = current;
      setDisplay(formatFn(current));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
        setDisplay(formatFn(target));
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return cancel;
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps

  return display;
}
