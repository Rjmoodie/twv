import { useEffect, useState } from 'react';

interface AnimatedSplashProps {
  onComplete: () => void;
}

const SPLASH_EXIT_MS = 560;
const SPLASH_COMPLETE_MS = 760;
const REDUCED_MOTION_EXIT_MS = 80;
const REDUCED_MOTION_COMPLETE_MS = 180;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);

    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    mq.addEventListener('change', onChange);

    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

export default function AnimatedSplash({ onComplete }: AnimatedSplashProps) {
  const reduced = usePrefersReducedMotion();
  const [phase, setPhase] = useState<'intro' | 'exit'>('intro');

  useEffect(() => {
    const exitTimer = window.setTimeout(
      () => setPhase('exit'),
      reduced ? REDUCED_MOTION_EXIT_MS : SPLASH_EXIT_MS,
    );
    const completeTimer = window.setTimeout(
      onComplete,
      reduced ? REDUCED_MOTION_COMPLETE_MS : SPLASH_COMPLETE_MS,
    );

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(completeTimer);
    };
  }, [onComplete, reduced]);

  return (
    <div
      role="img"
      aria-label="SomaTech — Financial Intelligence"
      data-rm={reduced ? '1' : '0'}
      data-phase={phase}
      className="splash-root"
    >
      <style>{`
        .splash-root {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: env(safe-area-inset-top) 24px env(safe-area-inset-bottom);
          overflow: hidden;
          isolation: isolate;
          background:
            radial-gradient(circle at 50% 38%, rgba(4,170,132,0.14) 0%, rgba(4,170,132,0.04) 32%, transparent 56%),
            radial-gradient(circle at 34% 28%, rgba(8,140,200,0.18) 0%, transparent 34%),
            radial-gradient(circle at 72% 68%, rgba(236,168,60,0.12) 0%, transparent 34%),
            linear-gradient(145deg, #080A12 0%, #0A0C14 48%, #06070D 100%);
          opacity: 1;
          transform: scale(1);
          transition:
            opacity 200ms ease,
            transform 200ms ease,
            filter 200ms ease;
          font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .splash-root[data-phase="exit"] {
          opacity: 0;
          transform: scale(1.015);
          filter: blur(4px);
        }

        .splash-noise {
          position: absolute;
          inset: -20%;
          z-index: -4;
          opacity: 0.08;
          background-image:
            linear-gradient(rgba(255,255,255,0.16) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.14) 1px, transparent 1px);
          background-size: 42px 42px;
          mask-image: radial-gradient(circle at center, black 0%, transparent 70%);
        }

        .splash-orb {
          position: absolute;
          width: min(72vw, 560px);
          aspect-ratio: 1;
          border-radius: 999px;
          z-index: -3;
          background:
            conic-gradient(
              from 180deg,
              rgba(8,140,200,0),
              rgba(8,140,200,0.26),
              rgba(4,170,132,0.22),
              rgba(236,168,60,0.16),
              rgba(8,140,200,0)
            );
          filter: blur(28px);
          opacity: 0;
          transform: scale(0.86) rotate(-14deg);
          animation: splash-orb 420ms cubic-bezier(.22,.61,.36,1) 40ms forwards;
        }

        .splash-ring,
        .splash-ring::before,
        .splash-ring::after {
          position: absolute;
          content: '';
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.08);
          pointer-events: none;
        }

        .splash-ring {
          width: 222px;
          height: 222px;
          opacity: 0;
          transform: scale(.84);
          animation: ring-in 300ms cubic-bezier(.22,.61,.36,1) 60ms forwards;
        }

        .splash-ring::before {
          inset: -22px;
          border-color: rgba(4,170,132,0.09);
        }

        .splash-ring::after {
          inset: 24px;
          border-color: rgba(8,140,200,0.12);
        }

        .splash-card {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 24px;
          padding: 34px 34px 30px;
          border-radius: 34px;
          background: linear-gradient(180deg, rgba(255,255,255,0.075), rgba(255,255,255,0.025));
          border: 1px solid rgba(255,255,255,0.10);
          box-shadow:
            0 28px 90px rgba(0,0,0,0.42),
            inset 0 1px 0 rgba(255,255,255,0.10);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          opacity: 0;
          transform: translateY(10px) scale(.985);
          animation: card-in 260ms cubic-bezier(.22,.61,.36,1) 20ms forwards;
        }

        .splash-logo-stage {
          position: relative;
          width: 118px;
          height: 118px;
          display: grid;
          place-items: center;
          border-radius: 30px;
          background:
            radial-gradient(circle at 35% 20%, rgba(255,255,255,0.18), transparent 28%),
            linear-gradient(145deg, rgba(255,255,255,0.09), rgba(255,255,255,0.025));
          border: 1px solid rgba(255,255,255,0.11);
          box-shadow:
            0 18px 48px rgba(0,0,0,0.38),
            0 0 52px rgba(4,170,132,0.12),
            inset 0 1px 0 rgba(255,255,255,0.12);
        }

        .splash-logo-stage::after {
          content: '';
          position: absolute;
          inset: -1px;
          border-radius: inherit;
          background: linear-gradient(135deg, rgba(8,140,200,0.32), transparent 38%, rgba(4,170,132,0.28));
          opacity: .55;
          mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          padding: 1px;
          mask-composite: exclude;
          -webkit-mask-composite: xor;
          pointer-events: none;
        }

        .splash-logo {
          width: 94px;
          height: 94px;
          overflow: visible;
          filter: drop-shadow(0 16px 28px rgba(0,0,0,0.22));
        }

        @keyframes logo-blue {
          from { opacity: 0; transform: translate(-14px,-10px) scale(.94); }
          to { opacity: 1; transform: translate(0,0) scale(1); }
        }

        @keyframes logo-teal {
          from { opacity: 0; transform: translate(14px,10px) scale(.94); }
          to { opacity: 1; transform: translate(0,0) scale(1); }
        }

        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes glow-blue {
          from { filter: drop-shadow(0 0 0 rgba(8,140,200,0)); }
          to { filter: drop-shadow(0 0 16px rgba(8,140,200,.46)); }
        }

        @keyframes glow-teal {
          from { filter: drop-shadow(0 0 0 rgba(4,170,132,0)); }
          to { filter: drop-shadow(0 0 16px rgba(4,170,132,.46)); }
        }

        @keyframes spark-pop {
          0% { opacity: 0; transform: scale(.26) rotate(-20deg); }
          48% { opacity: 1; transform: scale(1.35) rotate(7deg); }
          78% { opacity: .94; transform: scale(.96) rotate(0deg); }
          100% { opacity: .92; transform: scale(1) rotate(0deg); }
        }

        @keyframes word-reveal {
          from { clip-path: inset(0 100% 0 0); opacity: .82; }
          to { clip-path: inset(0 0 0 0); opacity: 1; }
        }

        @keyframes shimmer {
          from { transform: translateX(-145%) skewX(-16deg); opacity: 0; }
          18% { opacity: 1; }
          82% { opacity: 1; }
          to { transform: translateX(145%) skewX(-16deg); opacity: 0; }
        }

        @keyframes subtitle-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes progress-fill {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }

        @keyframes splash-orb {
          to { opacity: 1; transform: scale(1) rotate(0deg); }
        }

        @keyframes ring-in {
          to { opacity: 1; transform: scale(1); }
        }

        @keyframes card-in {
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .sa-blue {
          opacity: 0;
          transform-box: fill-box;
          transform-origin: center;
          animation:
            logo-blue 220ms cubic-bezier(.22,.61,.36,1) 40ms forwards,
            glow-blue 160ms ease-out 220ms forwards;
        }

        .sa-neg {
          opacity: 0;
          animation: fade-in 140ms ease-out 70ms forwards;
        }

        .sa-teal {
          opacity: 0;
          transform-box: fill-box;
          transform-origin: center;
          animation:
            logo-teal 220ms cubic-bezier(.22,.61,.36,1) 90ms forwards,
            glow-teal 160ms ease-out 270ms forwards;
        }

        .sa-details {
          opacity: 0;
          animation: fade-in 140ms ease-out 260ms forwards;
        }

        .sa-spark {
          opacity: 0;
          transform-box: fill-box;
          transform-origin: center;
          animation: spark-pop 180ms cubic-bezier(.34,1.56,.64,1) 250ms forwards;
        }

        .wordmark-wrap {
          position: relative;
          display: inline-block;
          overflow: hidden;
        }

        .wordmark {
          display: block;
          font-size: clamp(31px, 7vw, 38px);
          font-weight: 760;
          letter-spacing: -0.045em;
          line-height: .95;
          clip-path: inset(0 100% 0 0);
          animation: word-reveal 200ms cubic-bezier(.22,.61,.36,1) 250ms forwards;
        }

        .wordmark-shimmer {
          position: absolute;
          top: -10%;
          bottom: -10%;
          left: 0;
          width: 42%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.42), transparent);
          transform: translateX(-145%) skewX(-16deg);
          animation: shimmer 220ms ease-in-out 360ms forwards;
          pointer-events: none;
        }

        .subtitle {
          margin: 11px 0 0;
          font-size: 11px;
          font-weight: 650;
          letter-spacing: .22em;
          text-transform: uppercase;
          color: rgba(205,213,235,.66);
          opacity: 0;
          animation: subtitle-in 180ms ease-out 320ms forwards;
        }

        .progress-track {
          width: 132px;
          height: 3px;
          margin-top: 18px;
          border-radius: 999px;
          overflow: hidden;
          background: rgba(255,255,255,.09);
          opacity: 0;
          animation: fade-in 120ms ease-out 370ms forwards;
        }

        .progress-fill {
          width: 100%;
          height: 100%;
          border-radius: inherit;
          transform-origin: left center;
          transform: scaleX(0);
          background: linear-gradient(90deg, #088cc8, #04aa84, #eca83c);
          animation: progress-fill 180ms cubic-bezier(.22,.61,.36,1) 390ms forwards;
        }

        [data-rm="1"] .splash-root,
        [data-rm="1"].splash-root {
          transition: opacity 100ms ease;
        }

        [data-rm="1"] .splash-orb,
        [data-rm="1"] .splash-ring,
        [data-rm="1"] .splash-card,
        [data-rm="1"] .sa-blue,
        [data-rm="1"] .sa-neg,
        [data-rm="1"] .sa-teal,
        [data-rm="1"] .sa-details,
        [data-rm="1"] .sa-spark,
        [data-rm="1"] .wordmark,
        [data-rm="1"] .subtitle,
        [data-rm="1"] .progress-track {
          transform: none !important;
          clip-path: none !important;
          animation: fade-in 80ms ease-out forwards !important;
        }

        [data-rm="1"] .wordmark-shimmer {
          display: none !important;
        }

        [data-rm="1"] .progress-fill {
          transform: scaleX(1) !important;
          animation: none !important;
        }
      `}</style>

      <div className="splash-noise" />
      <div className="splash-orb" />
      <div className="splash-ring" />

      <div className="splash-card">
        <div className="splash-logo-stage">
          <svg
            className="splash-logo"
            viewBox="0 0 400 400"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              className="sa-blue"
              d="M175.295 125.430 C 170.804 125.955,166.250 127.774,162.520 130.533 C 160.529 132.005,132.659 157.893,127.911 162.680 C 119.966 170.689,117.968 183.146,122.973 193.461 C 124.765 197.152,125.964 198.394,139.400 210.467 C 155.235 224.696,157.147 226.011,163.871 227.297 C 166.462 227.793,214.375 227.997,214.334 227.512 C 214.322 227.380,212.564 225.753,210.426 223.897 C 205.293 219.438,181.908 199.259,174.641 193.017 C 171.483 190.304,167.872 187.172,166.617 186.055 C 163.315 183.121,162.547 180.748,164.035 178.079 C 164.961 176.418,176.194 165.829,178.016 164.899 C 180.632 163.564,181.069 163.525,195.375 163.328 L 209.410 163.134 211.521 162.323 C 215.766 160.694,214.992 161.331,230.456 146.730 C 234.636 142.783,241.372 136.430,245.424 132.613 C 249.476 128.795,252.836 125.537,252.892 125.372 C 253.017 125.001,178.491 125.056,175.295 125.430"
              fill="#088cc8"
              fillRule="evenodd"
            />

            <path
              className="sa-neg"
              d="M0.000 200.000 L 0.000 400.000 200.000 400.000 L 400.000 400.000 400.000 200.000 L 400.000 0.000 200.000 0.000 L 0.000 0.000 0.000 200.000 M265.024 93.317 C 265.537 95.765,266.367 98.983,266.869 100.470 L 267.783 103.172 271.081 104.227 C 272.894 104.808,276.052 105.612,278.098 106.014 L 281.818 106.745 279.904 107.129 C 274.991 108.115,272.064 108.845,269.937 109.615 L 267.624 110.452 266.857 112.881 C 266.435 114.218,265.708 117.105,265.241 119.298 C 264.773 121.491,264.310 123.644,264.211 124.083 C 264.086 124.634,263.799 123.748,263.280 121.212 C 262.559 117.687,261.334 113.061,260.647 111.265 C 260.239 110.201,255.497 108.565,249.597 107.455 L 245.806 106.741 250.096 105.895 C 254.537 105.020,259.533 103.542,260.178 102.913 C 260.754 102.350,262.127 97.640,263.077 92.966 C 263.553 90.628,263.976 88.750,264.017 88.791 C 264.059 88.833,264.512 90.870,265.024 93.317 M253.216 125.322 C 252.975 125.963,216.988 159.640,215.460 160.655 C 214.547 161.261,212.740 162.141,211.445 162.610 L 209.091 163.463 195.056 163.630 L 181.021 163.796 178.628 164.965 C 176.621 165.946,175.314 167.012,170.498 171.594 C 160.545 181.062,160.473 180.670,174.322 192.518 C 178.182 195.820,181.992 199.106,182.789 199.819 C 183.586 200.533,186.098 202.715,188.371 204.669 C 211.234 224.319,214.673 227.343,214.673 227.797 C 214.673 228.176,168.319 228.128,165.313 227.746 C 159.056 226.953,155.558 225.066,148.254 218.546 C 127.062 199.626,125.969 198.609,124.547 196.469 C 118.266 187.021,118.669 173.977,125.519 165.006 C 127.275 162.707,160.448 131.686,163.103 129.862 C 165.614 128.135,169.914 126.284,172.851 125.664 C 175.885 125.024,253.453 124.694,253.216 125.322 M252.440 193.951 C 259.168 194.924,261.116 196.313,274.525 209.702 C 285.128 220.288,285.449 220.645,286.727 223.285 C 290.500 231.077,290.127 240.252,285.735 247.675 C 284.175 250.311,283.506 250.992,271.915 261.729 C 266.994 266.287,258.339 274.322,252.682 279.585 C 241.900 289.615,239.375 291.594,235.420 293.115 C 231.005 294.813,232.434 294.770,183.477 294.670 L 137.766 294.577 142.815 289.793 C 174.718 259.559,175.264 259.078,179.558 257.340 C 181.334 256.621,181.413 256.618,203.349 256.459 L 225.359 256.298 227.113 255.571 C 230.250 254.270,230.856 253.809,237.070 248.000 C 246.469 239.212,246.018 239.716,246.868 237.070 C 247.782 234.228,247.646 232.001,246.405 229.465 C 245.647 227.915,243.643 226.066,226.307 210.921 C 215.716 201.669,207.043 193.991,207.034 193.860 C 207.009 193.495,249.879 193.581,252.440 193.951"
              fill="#0A0C14"
              fillRule="evenodd"
            />

            <path
              className="sa-teal"
              d="M207.667 194.378 C 208.041 194.730,235.634 218.826,243.564 225.725 C 248.581 230.091,249.035 237.585,244.512 241.378 C 243.978 241.826,240.765 244.788,237.372 247.959 C 227.502 257.186,231.113 256.261,204.147 256.464 C 175.791 256.678,179.466 255.466,164.546 269.526 C 159.247 274.520,152.317 281.051,149.146 284.040 C 145.975 287.028,142.161 290.656,140.670 292.102 L 137.959 294.730 183.892 294.651 L 229.825 294.572 232.376 293.850 C 238.077 292.236,240.626 290.575,248.166 283.558 C 251.236 280.700,259.633 272.903,266.826 266.231 C 274.019 259.559,281.005 252.991,282.350 251.635 C 289.673 244.259,291.235 231.198,285.893 222.012 C 284.632 219.842,265.951 200.968,262.404 198.280 C 260.153 196.573,256.716 194.985,254.058 194.422 C 250.848 193.742,206.946 193.701,207.667 194.378"
              fill="#04aa84"
              fillRule="evenodd"
            />

            <path
              className="sa-details"
              d="M175.837 125.260 C 176.144 125.340,176.647 125.340,176.954 125.260 C 177.261 125.180,177.010 125.114,176.396 125.114 C 175.781 125.114,175.530 125.180,175.837 125.260 M181.579 125.272 C 182.237 125.341,183.313 125.341,183.971 125.272 C 184.629 125.203,184.091 125.147,182.775 125.147 C 181.459 125.147,180.921 125.203,181.579 125.272 M198.485 125.268 C 198.967 125.341,199.757 125.341,200.239 125.268 C 200.722 125.195,200.327 125.135,199.362 125.135 C 198.397 125.135,198.002 125.195,198.485 125.268 M223.370 125.269 C 223.854 125.342,224.572 125.340,224.965 125.264 C 225.357 125.189,224.960 125.129,224.083 125.131 C 223.206 125.133,222.885 125.195,223.370 125.269 M244.258 125.265 C 244.653 125.341,245.299 125.341,245.694 125.265 C 246.089 125.189,245.766 125.127,244.976 125.127 C 244.187 125.127,243.864 125.189,244.258 125.265"
              fill="#9bd2ea"
              fillRule="evenodd"
            />

            <path
              className="sa-spark"
              d="M263.077 92.966 C 262.127 97.640,260.754 102.350,260.178 102.913 C 259.533 103.542,254.537 105.020,250.096 105.895 L 245.806 106.741 249.597 107.455 C 255.497 108.565,260.239 110.201,260.647 111.265 C 261.334 113.061,262.559 117.687,263.280 121.212 C 263.799 123.748,264.086 124.634,264.211 124.083 C 264.310 123.644,264.773 121.491,265.241 119.298 C 265.708 117.105,266.435 114.218,266.857 112.881 L 267.624 110.452 269.937 109.615 C 272.064 108.845,274.991 108.115,279.904 107.129 L 281.818 106.745 278.098 106.014 C 276.052 105.612,272.894 104.808,271.081 104.227 L 267.783 103.172 266.869 100.470 C 266.367 98.983,265.537 95.765,265.024 93.317 C 264.512 90.870,264.059 88.833,264.017 88.791 C 263.976 88.750,263.553 90.628,263.077 92.966"
              fill="#eca83c"
              fillRule="evenodd"
            />
          </svg>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div className="wordmark-wrap">
            <span className="wordmark">
              <span style={{ color: '#F5F7FB' }}>Soma</span>
              <span style={{ color: '#04aa84' }}>Tech</span>
            </span>
            <span className="wordmark-shimmer" aria-hidden="true" />
          </div>

          <p className="subtitle">Financial Intelligence</p>

          <div className="progress-track" aria-hidden="true">
            <div className="progress-fill" />
          </div>
        </div>
      </div>
    </div>
  );
}
