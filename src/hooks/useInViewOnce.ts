import { useEffect, useRef, useState } from 'react';

/**
 * Latches true the first time the element approaches the viewport, so heavy
 * below-the-fold work — mapbox-gl is ~200KB gzipped — stays off the critical
 * path of a marketing page without ever unmounting once it has loaded.
 *
 * Falls back to visible when IntersectionObserver is unavailable, since a map
 * that always loads beats a map that never appears.
 */
export function useInViewOnce<T extends HTMLElement>(rootMargin = '300px') {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (inView || !ref.current) return;
    if (typeof IntersectionObserver === 'undefined') { setInView(true); return; }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setInView(true);
    }, { rootMargin });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [inView, rootMargin]);

  return [ref, inView] as const;
}
