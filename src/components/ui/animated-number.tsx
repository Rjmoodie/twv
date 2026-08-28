import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

export function useAnimatedNumber(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(0);

  useEffect(() => {
    fromRef.current = value;
    startRef.current = null;
    cancelAnimationFrame(rafRef.current);

    function tick(ts: number) {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      setValue(fromRef.current + (target - fromRef.current) * easeOutQuart(progress));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return value;
}

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}

export function AnimatedNumber({ value, duration = 900, format, className }: AnimatedNumberProps) {
  const animated = useAnimatedNumber(value, duration);
  const display = format
    ? format(animated)
    : animated.toLocaleString("en-US", { maximumFractionDigits: 0 });

  return <span className={cn("tabular-nums", className)}>{display}</span>;
}
