import { lazy, type ComponentType } from 'react';

/**
 * Vite emits content-hashed chunks (`/js/FinancialCoach-B1FBkfwE.js`). After a
 * redeploy the old hashes are gone, so a tab still running the previous build —
 * or one served a cached `index.html` — 404s the moment it lazy-loads a module
 * it has not touched yet, and the route renders as a blank error boundary.
 *
 * Retry once (covers a transient network blip), then reload the page once to
 * pick up the current `index.html` and its chunk graph. The sessionStorage flag
 * makes the reload single-shot, so a genuinely missing chunk surfaces as a real
 * error instead of an infinite refresh loop.
 */

const RELOAD_STATE_KEY = 'somatech:chunk-reload';
const RELOAD_GUARD_MS = 60_000;

export const isChunkLoadError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return (
    /Failed to fetch dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /Unable to preload CSS/i.test(message) ||
    /Loading (?:CSS )?chunk [\w-]+ failed/i.test(message) ||
    /Expected a JavaScript-or-Wasm module script/i.test(message) ||
    /MIME type (?:of )?["']text\/html["']/i.test(message) ||
    (error instanceof Error &&
      (error.name === 'ChunkLoadError' ||
        error.name === 'CSS_CHUNK_LOAD_FAILED' ||
        (error.name === 'TypeError' && /^Load failed$/i.test(message))))
  );
};

const errorSignature = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  const asset = message.match(/https?:\/\/[^\s)'"`]+/i)?.[0];
  return asset ?? message.slice(0, 500);
};

const shouldReload = (error: unknown): boolean => {
  try {
    if (window.navigator.onLine === false) return false;

    const previous = JSON.parse(window.sessionStorage.getItem(RELOAD_STATE_KEY) ?? 'null') as {
      signature?: string;
      attemptedAt?: number;
    } | null;
    const signature = errorSignature(error);
    const now = Date.now();

    if (
      previous?.signature === signature &&
      typeof previous.attemptedAt === 'number' &&
      now - previous.attemptedAt < RELOAD_GUARD_MS
    ) {
      return false;
    }

    window.sessionStorage.setItem(RELOAD_STATE_KEY, JSON.stringify({ signature, attemptedAt: now }));
    return true;
  } catch {
    return false; // Storage blocked: never reload automatically and risk a loop.
  }
};

export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (error) {
      if (!isChunkLoadError(error)) throw error;

      try {
        return await factory();
      } catch (retryError) {
        if (isChunkLoadError(retryError) && shouldReload(retryError)) {
          window.location.reload();
          // Hold the promise open so React does not flash an error before reload.
          return new Promise<{ default: T }>(() => {});
        }
        throw retryError;
      }
    }
  });
}
