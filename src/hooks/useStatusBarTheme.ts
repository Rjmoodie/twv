import { useEffect } from 'react';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

const LIGHT_BG = '#F7F8FC'; // hsl(220 40% 98%)
const DARK_BG  = '#0A0C14'; // hsl(228 33% 6%)

function isDark(): boolean {
  return document.documentElement.classList.contains('dark');
}

async function applyStatusBar(dark: boolean) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
    await StatusBar.setBackgroundColor({ color: dark ? DARK_BG : LIGHT_BG });
  } catch {
    // Silently ignore — StatusBar plugin may not be available in all contexts
  }
}

export function useStatusBarTheme() {
  useEffect(() => {
    // Apply immediately on mount
    applyStatusBar(isDark());

    // Watch for class changes on <html> (DarkModeToggle adds/removes 'dark')
    const observer = new MutationObserver(() => applyStatusBar(isDark()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    // Also watch system preference changes
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystemChange = () => applyStatusBar(isDark());
    mq.addEventListener('change', onSystemChange);

    // Listen for explicit theme toggle events dispatched by ProfileDropdown
    const onThemeChange = () => applyStatusBar(isDark());
    window.addEventListener('themechange', onThemeChange);

    return () => {
      observer.disconnect();
      mq.removeEventListener('change', onSystemChange);
      window.removeEventListener('themechange', onThemeChange);
    };
  }, []);
}
