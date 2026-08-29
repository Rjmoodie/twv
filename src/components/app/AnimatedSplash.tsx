import { useEffect, useState } from 'react';
import Logo from '@/components/app/Logo';

interface AnimatedSplashProps { onComplete: () => void }

const TIMING = { exit: 760, complete: 1040 };
const REDUCED_TIMING = { exit: 80, complete: 180 };

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (!window.matchMedia) return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);
    const handleChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);
  return reduced;
}

export default function AnimatedSplash({ onComplete }: AnimatedSplashProps) {
  const reduced = usePrefersReducedMotion();
  const [phase, setPhase] = useState<'intro' | 'exit'>('intro');

  useEffect(() => {
    const timing = reduced ? REDUCED_TIMING : TIMING;
    const exitTimer = window.setTimeout(() => setPhase('exit'), timing.exit);
    const completeTimer = window.setTimeout(onComplete, timing.complete);
    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(completeTimer);
    };
  }, [onComplete, reduced]);

  return (
    <div
      role="img"
      aria-label="TW Ventures — Acquire, Build, Manage"
      className="tw-splash"
      data-phase={phase}
      data-reduced={reduced ? 'true' : 'false'}
    >
      <style>{`
        .tw-splash {
          position: fixed; inset: 0; z-index: 9999; isolation: isolate;
          display: grid; place-items: center; overflow: hidden;
          padding: calc(24px + env(safe-area-inset-top)) 24px calc(24px + env(safe-area-inset-bottom));
          background: radial-gradient(ellipse at 50% 44%, rgba(56,91,132,.42), transparent 42%),
            linear-gradient(145deg, #020812, #07182c 52%, #020711);
          opacity: 1; transition: opacity 260ms ease, filter 260ms ease;
        }
        .tw-splash::before {
          content: ''; position: absolute; inset: 0; z-index: -2; opacity: .2;
          background-image: linear-gradient(rgba(255,255,255,.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.04) 1px, transparent 1px);
          background-size: 72px 72px;
          mask-image: radial-gradient(circle at center, #000, transparent 72%);
        }
        .tw-splash::after {
          content: ''; position: absolute; z-index: -1; width: min(82vw,720px); aspect-ratio: 1.5;
          border-radius: 50%; background: rgba(72,110,155,.2); filter: blur(74px);
          opacity: 0; transform: scale(.75); animation: tw-ambient 700ms cubic-bezier(.22,.61,.36,1) forwards;
        }
        .tw-splash[data-phase='exit'] { opacity: 0; filter: blur(5px); pointer-events: none; }
        .tw-splash-card {
          width: min(72vw,320px); opacity: 0; transform: translateY(16px) scale(.975);
          animation: tw-card-in 480ms cubic-bezier(.16,1,.3,1) 60ms forwards;
        }
        .tw-splash-frame {
          position: relative; overflow: hidden; aspect-ratio: 1; border-radius: clamp(28px,6vw,46px);
          background: #fff; border: 1px solid rgba(255,255,255,.8);
          box-shadow: 0 36px 100px rgba(0,0,0,.52), 0 0 0 1px rgba(94,126,165,.22);
          display: grid; place-items: center;
        }
        .tw-splash-logo {
          width: 82% !important; height: 82% !important;
          font-size: clamp(48px,14vw,94px) !important;
        }
        .tw-splash-sheen {
          position: absolute; inset: 0; pointer-events: none;
          background: linear-gradient(110deg,transparent 30%,rgba(255,255,255,.62) 48%,transparent 66%);
          transform: translateX(-115%); animation: tw-sheen 540ms ease-in-out 280ms forwards;
        }
        .tw-splash-status {
          display: flex; align-items: center; justify-content: center; gap: 12px; margin-top: 22px;
          color: rgba(222,231,243,.74); font: 600 10px/1 Inter,-apple-system,BlinkMacSystemFont,sans-serif;
          letter-spacing: .24em; text-transform: uppercase; opacity: 0;
          animation: tw-status-in 260ms ease 360ms forwards;
        }
        .tw-splash-status::before, .tw-splash-status::after {
          content: ''; width: 34px; height: 1px;
          background: linear-gradient(90deg,transparent,rgba(222,231,243,.52));
        }
        .tw-splash-status::after { transform: rotate(180deg); }
        .tw-splash-progress {
          width: min(46vw,210px); height: 2px; margin: 15px auto 0; overflow: hidden;
          border-radius: 999px; background: rgba(255,255,255,.1);
        }
        .tw-splash-progress::after {
          content: ''; display: block; width: 100%; height: 100%; transform: scaleX(0); transform-origin: left;
          background: linear-gradient(90deg,#55779e,#f2f5f9,#55779e);
          animation: tw-progress 620ms cubic-bezier(.22,.61,.36,1) 180ms forwards;
        }
        @keyframes tw-card-in { to { opacity: 1; transform: none; } }
        @keyframes tw-ambient { to { opacity: 1; transform: scale(1); } }
        @keyframes tw-sheen { to { transform: translateX(115%); } }
        @keyframes tw-status-in { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: none; } }
        @keyframes tw-progress { to { transform: scaleX(1); } }
        .tw-splash[data-reduced='true']::after,
        .tw-splash[data-reduced='true'] .tw-splash-card,
        .tw-splash[data-reduced='true'] .tw-splash-status { animation: none; opacity: 1; transform: none; }
        .tw-splash[data-reduced='true'] .tw-splash-sheen { display: none; }
        .tw-splash[data-reduced='true'] .tw-splash-progress::after { animation: none; transform: scaleX(1); }
        @media (max-width: 520px) {
          .tw-splash-card { width: min(70vw,280px); }
          .tw-splash-status { margin-top: 18px; font-size: 9px; }
        }
      `}</style>

      <div className="tw-splash-card">
        <div className="tw-splash-frame">
          <Logo
            className="tw-splash-logo"
            width={240}
            height={240}
          />
          <span className="tw-splash-sheen" aria-hidden="true" />
        </div>
        <div className="tw-splash-status">Real Estate Operations</div>
        <div className="tw-splash-progress" aria-hidden="true" />
      </div>
    </div>
  );
}
