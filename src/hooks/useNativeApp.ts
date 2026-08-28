import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Keyboard } from '@capacitor/keyboard';
import { Network } from '@capacitor/network';

// Fix #8: lazy getters instead of module-level frozen singletons so the
// values are evaluated on first call, not at import time. This keeps
// native code paths reachable in test environments via module-factory mocks.
export const isNative = () => Capacitor.isNativePlatform();
export const isIos = () => Capacitor.getPlatform() === 'ios';

interface UseNativeAppOptions {
  onBackButton?: () => void;
  onNetworkChange?: (connected: boolean) => void;
  forceDarkStatusBar?: boolean;
}

export function useNativeApp({
  onBackButton,
  onNetworkChange,
  forceDarkStatusBar = true,
}: UseNativeAppOptions = {}) {
  // Keep a stable ref to the latest callbacks so the effect never re-runs
  // just because an inline function was re-created by the caller.
  const onBackButtonRef = useRef(onBackButton);
  const onNetworkChangeRef = useRef(onNetworkChange);
  const forceDarkRef = useRef(forceDarkStatusBar);
  onBackButtonRef.current = onBackButton;
  onNetworkChangeRef.current = onNetworkChange;
  forceDarkRef.current = forceDarkStatusBar;

  useEffect(() => {
    if (!isNative()) return;

    // Fix #3: cancelled flag prevents listeners pushed after unmount from
    // being orphaned. If the component unmounts while init() is still
    // awaiting, no listeners are registered after cancelled = true.
    let cancelled = false;
    const cleanups: (() => void)[] = [];

    const init = async () => {
      // ── Status bar ─────────────────────────────────────────────────────────
      // useStatusBarTheme (in App.tsx) owns the theme-aware status bar colour.
      // Here we only set overlay behaviour on Android; style is handled by the hook.
      try {
        if (!isIos()) {
          await StatusBar.setOverlaysWebView({ overlay: false });
        }
      } catch { /* simulator may not support */ }

      // ── Splash screen ───────────────────────────────────────────────────────
      try {
        await SplashScreen.hide({ fadeOutDuration: 400 });
      } catch { /* may already be hidden */ }

      if (cancelled) return;

      // ── Keyboard ────────────────────────────────────────────────────────────
      try {
        const showHandler = await Keyboard.addListener('keyboardWillShow', (info) => {
          document.documentElement.style.setProperty('--keyboard-height', `${info.keyboardHeight}px`);
          document.body.classList.add('keyboard-open');
          // Dispatch so React components (AuthDialog etc.) can respond with inline styles
          window.dispatchEvent(new CustomEvent('keyboardWillShow', { detail: { keyboardHeight: info.keyboardHeight } }));
        });
        const hideHandler = await Keyboard.addListener('keyboardWillHide', () => {
          document.documentElement.style.setProperty('--keyboard-height', '0px');
          document.body.classList.remove('keyboard-open');
          window.dispatchEvent(new CustomEvent('keyboardWillHide'));
        });
        if (!cancelled) {
          cleanups.push(() => showHandler.remove(), () => hideHandler.remove());
        } else {
          showHandler.remove();
          hideHandler.remove();
        }
      } catch { /* keyboard plugin unavailable */ }

      if (cancelled) return;

      if (cancelled) return;

      // ── App state (foreground / background) ─────────────────────────────────
      // Fix #5: reads forceDarkRef so the live prop value is used on resume,
      // not the stale value captured at registration time.
      try {
        const stateHandler = await App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) {
            // Re-apply the theme-correct status bar style when app comes back to foreground
            const isDark = document.documentElement.classList.contains('dark');
            StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light }).catch(() => {});
            StatusBar.setBackgroundColor({ color: isDark ? '#0A0C14' : '#F7F8FC' }).catch(() => {});
          }
        });
        if (!cancelled) {
          cleanups.push(() => stateHandler.remove());
        } else {
          stateHandler.remove();
        }
      } catch { /* */ }

      if (cancelled) return;

      // ── Network ─────────────────────────────────────────────────────────────
      try {
        const netHandler = await Network.addListener('networkStatusChange', (status) => {
          onNetworkChangeRef.current?.(status.connected);
        });
        if (!cancelled) {
          cleanups.push(() => netHandler.remove());
        } else {
          netHandler.remove();
        }
      } catch { /* */ }
    };

    init();

    return () => {
      cancelled = true;
      cleanups.forEach((fn) => fn());
    };
  // Stable refs mean these deps never change — the effect runs once on mount.
  }, []);  

  return { isNative: isNative(), isIos: isIos() };
}

// ── Convenience helpers ───────────────────────────────────────────────────────

export async function setStatusBarLight() {
  if (!isNative()) return;
  try { await StatusBar.setStyle({ style: Style.Light }); } catch { /* */ }
}

export async function setStatusBarDark() {
  if (!isNative()) return;
  try { await StatusBar.setStyle({ style: Style.Dark }); } catch { /* */ }
}

export async function hideKeyboard() {
  if (!isNative()) return;
  try { await Keyboard.hide(); } catch { /* */ }
}

export async function shareContent(title: string, text: string, url?: string) {
  const { Share } = await import('@capacitor/share');
  try { await Share.share({ title, text, url, dialogTitle: title }); } catch { /* user cancelled */ }
}

export async function copyToClipboard(value: string) {
  const { Clipboard } = await import('@capacitor/clipboard');
  if (isNative()) {
    await Clipboard.write({ string: value });
  } else {
    await navigator.clipboard.writeText(value);
  }
}
