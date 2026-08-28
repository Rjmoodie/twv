import { useCallback } from "react";
import confetti from "canvas-confetti";

const BRAND_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4"];

export function useConfetti() {
  const fire = useCallback((options?: confetti.Options) => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: BRAND_COLORS,
      ...options,
    });
  }, []);

  // Two-burst side-cannon pattern — used for milestone celebrations
  const fireMilestone = useCallback(() => {
    const burst = (x: number, angle: number) =>
      confetti({
        particleCount: 55,
        angle,
        spread: 55,
        origin: { x, y: 0.65 },
        colors: BRAND_COLORS,
        gravity: 1.2,
      });

    burst(0.22, 115);
    setTimeout(() => burst(0.78, 65), 150);
  }, []);

  return { fire, fireMilestone };
}
