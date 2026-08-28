import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

// Fix #8: lazy getter — evaluated on each call, not frozen at import time.
// This keeps the native branch reachable in test environments.
const native = () => Capacitor.isNativePlatform();

// Web vibration fallback — silent no-op on iOS Safari (unsupported by Apple on web)
const vibe = (pattern: number | number[]) => {
  if (!native() && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
};

const safeHaptic = async (fn: () => Promise<void>) => {
  try {
    await fn();
  } catch {
    // Plugin unavailable (simulator without haptic engine) — silent fail
  }
};

export function useHaptics() {
  return {
    // Light tap — tab switch, toggle, expand, any UI interaction
    tap: () => {
      if (native()) safeHaptic(() => Haptics.impact({ style: ImpactStyle.Light }));
      else vibe(8);
    },

    // Very short tick — slider step, incremental change
    tick: () => {
      if (native()) safeHaptic(() => Haptics.impact({ style: ImpactStyle.Light }));
      else vibe(4);
    },

    // Medium impact — button press, card selection
    medium: () => {
      if (native()) safeHaptic(() => Haptics.impact({ style: ImpactStyle.Medium }));
      else vibe(12);
    },

    // Heavy impact — modal open, drag complete, destructive confirm
    heavy: () => {
      if (native()) safeHaptic(() => Haptics.impact({ style: ImpactStyle.Heavy }));
      else vibe([20, 50, 30, 50, 15]);
    },

    // Success — form submit, milestone, trade placed
    success: () => {
      if (native()) safeHaptic(() => Haptics.notification({ type: NotificationType.Success }));
      else vibe([12, 40, 20]);
    },

    // Warning — validation error, risky action, low runway alert
    warning: () => {
      if (native()) safeHaptic(() => Haptics.notification({ type: NotificationType.Warning }));
      else vibe([10, 30, 10, 30]);
    },

    // Error — failed action, network error, auth failure
    error: () => {
      if (native()) safeHaptic(() => Haptics.notification({ type: NotificationType.Error }));
      else vibe([20, 40, 20, 40, 20]);
    },

    // Selection feedback — picker scroll, segment switch
    selection: () => {
      if (native()) safeHaptic(() => Haptics.selectionStart());
      else vibe(4);
    },

    selectionChanged: () => {
      if (native()) safeHaptic(() => Haptics.selectionChanged());
      else vibe(3);
    },

    selectionEnd: () => {
      if (native()) safeHaptic(() => Haptics.selectionEnd());
    },

    // Raw vibration — Android only, no-op on iOS
    vibrate: (duration = 300) => {
      if (native()) safeHaptic(() => Haptics.vibrate({ duration }));
      else vibe(duration);
    },
  };
}
