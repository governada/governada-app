'use client';

import { useState, useEffect } from 'react';

/**
 * Full-screen branded loading screen shown once per session.
 *
 * Three-act animation:
 * 1. ASSEMBLY (0-2s)  — G constellation assembles node-by-node via animated mask
 * 2. DISSOLVE (2.3s)  — Filled arcs fade away, leaving bright node stars
 * 3. BIG BANG (2.5-3.8s) — Nodes disperse outward with parallax, fading into void
 *
 * Uses exact SVG paths from logo.svg for pixel-perfect shape fidelity.
 */
export function BrandedLoader() {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const seen = sessionStorage.getItem('governada-intro-seen');
    if (seen) return;

    setVisible(true);
    sessionStorage.setItem('governada-intro-seen', '1');

    const fadeTimer = setTimeout(() => setFading(true), 3800);
    const hideTimer = setTimeout(() => setVisible(false), 4500);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  // ── Node data ────────────────────────────────────────────────────
  // cx/cy: viewBox position  |  d: assembly delay
  // dx/dy: dispersal vector (2.5× offset from center)  |  ring: wave delay
  const nodes = [
    { cx: 454, cy: 459, d: 0, dx: 0, dy: -130, ring: 0 },
    { cx: 505, cy: 395, d: 0.25, dx: 128, dy: -160, ring: 1 },
    { cx: 493, cy: 548, d: 0.25, dx: 98, dy: 223, ring: 1 },
    { cx: 596, cy: 484, d: 0.5, dx: 355, dy: 63, ring: 1 },
    { cx: 454, cy: 241, d: 0.55, dx: 0, dy: -545, ring: 2 },
    { cx: 285, cy: 344, d: 0.8, dx: -423, dy: -288, ring: 2 },
    { cx: 233, cy: 497, d: 0.8, dx: -553, dy: 95, ring: 2 },
    { cx: 609, cy: 280, d: 0.95, dx: 388, dy: -448, ring: 2 },
    { cx: 285, cy: 613, d: 1.1, dx: -423, dy: 385, ring: 3 },
    { cx: 467, cy: 677, d: 1.1, dx: 33, dy: 545, ring: 3 },
    { cx: 557, cy: 638, d: 1.25, dx: 258, dy: 448, ring: 3 },
  ];

  return (
    <div
      className="force-dark fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-[#080a12]"
      style={{
        opacity: fading ? 0 : 1,
        pointerEvents: fading ? 'none' : 'auto',
        transition: 'opacity 700ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}
      aria-hidden
    >
      <style>{`
        @keyframes gl-emerge {
          0%   { transform: scale(0.86); filter: drop-shadow(0 0 0 rgba(92,222,183,0)); }
          50%  { transform: scale(0.97); filter: drop-shadow(0 0 40px rgba(92,222,183,0.5)); }
          100% { transform: scale(1);    filter: drop-shadow(0 0 8px rgba(92,222,183,0.15)); }
        }
        @keyframes gl-text {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes gl-text-out {
          from { opacity: 1; transform: translateY(0); }
          to   { opacity: 0; transform: translateY(-6px); }
        }
        .gl-emerge {
          transform: scale(0.86);
          animation: gl-emerge 2.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      <div className="gl-emerge mb-8">
        <svg
          viewBox="207 215 519 513"
          width={160}
          height={160}
          overflow="visible"
          style={{ display: 'block' }}
        >
          <defs>
            <linearGradient
              id="gl-g0"
              gradientUnits="userSpaceOnUse"
              x1="557.28"
              y1="526.01"
              x2="272.22"
              y2="318.82"
            >
              <stop offset="0" stopColor="#5CDEB7" />
              <stop offset="1" stopColor="#ACFFE4" />
            </linearGradient>
            <linearGradient
              id="gl-g1"
              gradientUnits="userSpaceOnUse"
              x1="668.38"
              y1="681.33"
              x2="421.57"
              y2="481.17"
            >
              <stop offset="0" stopColor="#3AC39A" />
              <stop offset="1" stopColor="#7AEFCB" />
            </linearGradient>
            <filter id="gl-soft" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="18" />
            </filter>
            <mask id="gl-reveal">
              {nodes.map((n, i) => (
                <circle key={`r${i}`} cx={n.cx} cy={n.cy} r={0} fill="white" filter="url(#gl-soft)">
                  <animate
                    attributeName="r"
                    from="0"
                    to="120"
                    dur="1s"
                    begin={`${n.d}s`}
                    fill="freeze"
                    calcMode="spline"
                    keyTimes="0;1"
                    keySplines="0.16 1 0.3 1"
                  />
                </circle>
              ))}
            </mask>
          </defs>

          {/* ── ACT 1: Logo revealed by mask, then fades in ACT 2 ── */}
          <g mask="url(#gl-reveal)">
            <animate
              attributeName="opacity"
              from="1"
              to="0"
              dur="0.5s"
              begin="2.3s"
              fill="freeze"
            />
            <g transform="matrix(0.973958 0 0 0.973958 0 0)">
              <path
                fill="url(#gl-g0)"
                d="M450.327 242.569C458.829 233.593 465.896 228.159 478.677 226.723C489.301 225.631 499.925 228.793 508.224 235.516C518.994 244.279 522.785 255.343 524.23 268.68C551.259 276.117 591.996 294.044 615.467 309.29C625.861 297.616 638.758 292.306 654.42 295.361C664.816 297.352 673.974 303.44 679.832 312.255C686.128 321.572 688.43 333.022 686.221 344.048C677.796 384.835 623.959 388.343 608.051 351.12C604.464 342.728 604.275 334.754 606.253 325.854C590.025 315.713 570.668 306.572 552.931 299.283C542.106 294.834 530.558 291.204 519.945 286.239C509.775 307.074 485.226 316.469 464.408 305.442C456.73 314.951 446.625 325.546 438.197 334.554C424.425 349.037 410.786 363.648 397.284 378.384C397.963 379.538 398.607 380.713 399.213 381.908C403.165 389.911 403.798 399.151 400.973 407.618C398.092 415.996 391.994 422.881 384.026 426.753C375.77 430.752 367.269 431.043 358.648 428.05C350.163 425.148 343.206 418.949 339.348 410.853C335.474 402.765 335.062 393.448 338.206 385.049C341.296 376.523 347.711 369.614 355.984 365.9C365.072 361.901 373.393 362.851 382.378 366.347C404.682 341.943 427.162 317.701 449.817 293.623C442.611 282.329 441.733 276.4 441.839 263.401C415.195 270.061 393.753 276.042 369.758 290.587C361.292 295.718 354.191 301.164 346.05 306.389C347.221 311.857 347.568 317.572 346.418 323.073C344.647 331.549 339.571 338.969 332.315 343.694C324.004 349.103 315.766 349.8 306.319 347.744C301.6 356.813 294.533 367.316 289.334 377.133C275.658 402.958 270.118 423.764 263.83 451.762C286.619 456.724 302.266 472.574 300.752 497.523C300.415 503.066 298.111 508.167 295.716 513.118C316.24 530.876 336.37 551.172 356.828 569.658C365.683 564.836 373.71 562.856 383.676 565.791C392.109 568.318 399.178 574.122 403.298 581.902C407.704 589.981 408.717 599.481 406.112 608.306C400.701 626.251 381.606 635.275 364.002 629.674C355.612 626.959 348.658 620.998 344.692 613.122C339.867 603.518 340.498 594.024 343.725 584.104C323.841 564.916 303.485 546.397 283.558 527.324C277.998 531.928 271.777 533.403 264.867 534.598C267.036 541.124 268.65 549.538 271.092 556.869C280.278 584.45 291.199 604.08 308.878 626.669C307.053 626.564 306.974 626.686 305.274 627.198C304.318 629.075 305.273 629.572 303.908 631.621C301.942 631.468 301.261 631.195 299.562 632.193C296.762 635.567 298.479 641.051 299.383 645.021C295.297 641.166 288.82 632.561 285.374 627.886C263.554 598.291 252.602 568.003 245.242 532.374C235.456 527.696 228.609 523.161 223.264 513.27C217.943 503.263 216.868 491.538 220.279 480.731C224.442 467.411 232.404 460.464 244.219 454.181C251.435 410.81 264.208 374.111 290.221 338.473C262.963 308.772 301.415 264.093 335.609 290.841C360.77 270.595 393.472 255.828 424.607 247.522C432.945 245.297 441.741 244.703 449.795 242.705L450.327 242.569Z"
              />
              <path
                fill="url(#gl-g1)"
                d="M661.351 480.346C666.241 468.446 671.484 460.153 683.955 454.922C694.357 450.512 706.101 450.497 716.514 454.882C726.404 458.962 734.239 467.283 738.097 477.162C747.06 500.115 735.625 523.554 713.169 532.125C709.811 569.487 684.369 621.244 659.97 649.265C666.661 658.025 669.703 665.284 668.339 676.653C667.346 684.933 661.756 693.531 655.082 698.471C647.987 703.703 639.082 705.853 630.381 704.435C621.251 702.983 616.144 698.712 610.051 692.276C588.75 707.486 559.623 717.601 534.261 723.258C528.648 724.51 521.599 725.4 515.801 726.35C499.674 745.128 474.51 749.132 455.279 732.402C453.11 730.478 451.114 728.369 449.313 726.097C401.802 720.814 352.106 695.762 317.117 663.429C312.936 659.565 302.371 649.666 299.383 645.021C298.479 641.051 296.762 635.567 299.562 632.193C301.261 631.195 301.942 631.468 303.908 631.621C305.273 629.572 304.318 629.075 305.274 627.198C306.974 626.686 307.053 626.564 308.878 626.669C335.836 658.249 368.102 681.9 407.382 696.188C418.255 700.143 430.664 703.259 441.932 705.924C440.653 695.686 443.824 684.33 450.203 676.179C456.95 667.673 466.784 662.176 477.565 660.887C487.14 659.778 494.725 662.081 503.153 666.312C521.208 645.707 540.417 625.972 559.299 606.103C549.014 587.544 552.419 567.321 571.917 556.838C579.106 552.886 587.592 552.031 595.425 554.468C613.427 559.978 624.406 579.031 618.673 597.175C615.934 605.851 609.802 613.051 601.672 617.135C593.41 621.384 585.185 621.676 576.444 618.822C575.371 618.479 574.309 618.099 573.262 617.683C568.759 623.942 556.628 637.187 550.973 643.114C540.037 654.575 528.072 668.546 516.987 679.466C522.881 689.274 524.097 695.075 523.469 706.474C551.589 700.751 578.484 690.129 602.926 675.092C602.32 664.945 604.469 656.78 611.375 649.014C616.911 642.685 624.789 638.887 633.189 638.497C636.882 638.344 640.576 638.73 644.158 639.642C670.504 604.453 684.919 576.781 693.881 533.668C673.923 527.767 664.308 519.274 660.286 498.775L569.967 498.963L537.813 498.939C532.276 498.913 524.224 499.04 518.825 498.578C514.695 509.034 509.665 516.226 498.953 520.857C489.969 524.805 479.778 524.985 470.66 521.357C461.856 517.836 454.869 510.876 451.315 502.085C447.528 492.835 447.591 482.456 451.492 473.253C455.121 464.568 462.119 457.727 470.884 454.296C479.893 450.812 489.917 451.048 498.752 454.952C509.7 459.849 516.008 469.179 519.371 480.407C566.697 479.981 614.025 479.96 661.351 480.346Z"
              />
              <path
                fill="#47C4A0"
                d="M524.651 651.762L525.118 652.188C525.963 654.618 527.093 658.89 526.983 661.451C526.14 660.304 524.308 653.127 524.651 651.762Z"
              />
            </g>
          </g>

          {/* ── Node stars: flash → brighten → disperse ── */}
          {nodes.map((n, i) => {
            const disperseBegin = 2.5 + n.ring * 0.04;
            return (
              <circle key={`f${i}`} cx={n.cx} cy={n.cy} r={0} fill="#ACFFE4" opacity={0}>
                {/* ACT 1: Flash during assembly */}
                <animate
                  attributeName="r"
                  values="0;10;4"
                  dur="0.8s"
                  begin={`${n.d}s`}
                  fill="freeze"
                  calcMode="spline"
                  keyTimes="0;0.3;1"
                  keySplines="0.16 1 0.3 1;0.4 0 0.6 1"
                />
                <animate
                  attributeName="opacity"
                  values="0;0.4;0.05"
                  dur="0.8s"
                  begin={`${n.d}s`}
                  fill="freeze"
                  calcMode="spline"
                  keyTimes="0;0.3;1"
                  keySplines="0.16 1 0.3 1;0.4 0 0.6 1"
                />
                {/* ACT 2: Brighten as arcs dissolve */}
                <animate attributeName="r" values="4;7" dur="0.3s" begin="2.3s" fill="freeze" />
                <animate
                  attributeName="opacity"
                  values="0.05;0.6"
                  dur="0.3s"
                  begin="2.3s"
                  fill="freeze"
                />
                {/* ACT 3: Disperse outward (big bang) */}
                <animateTransform
                  attributeName="transform"
                  type="translate"
                  from="0 0"
                  to={`${n.dx} ${n.dy}`}
                  dur="1.3s"
                  begin={`${disperseBegin}s`}
                  fill="freeze"
                  calcMode="spline"
                  keyTimes="0;1"
                  keySplines="0.1 0.8 0.3 1"
                />
                <animate
                  attributeName="opacity"
                  values="0.6;0"
                  dur="1.3s"
                  begin={`${disperseBegin}s`}
                  fill="freeze"
                  calcMode="spline"
                  keyTimes="0;1"
                  keySplines="0.3 0 0.7 1"
                />
                <animate
                  attributeName="r"
                  values="7;2"
                  dur="1.3s"
                  begin={`${disperseBegin}s`}
                  fill="freeze"
                />
              </circle>
            );
          })}
        </svg>
      </div>

      {/* ── Brand text ── */}
      <div className="text-center">
        <p
          className="text-[1.6rem] font-semibold tracking-tight"
          style={{
            color: '#ACFFE4',
            opacity: 0,
            animation:
              'gl-text 600ms ease-out 1800ms forwards, gl-text-out 500ms ease-in 2.3s forwards',
            fontFamily: 'var(--font-fraunces, serif)',
          }}
        >
          Governada
        </p>
        <p
          className="text-[0.78rem] mt-1.5 tracking-[0.09em] font-light"
          style={{
            color: 'rgba(172, 255, 228, 0.4)',
            opacity: 0,
            animation:
              'gl-text 600ms ease-out 2100ms forwards, gl-text-out 500ms ease-in 2.3s forwards',
          }}
        >
          Governance Intelligence for Cardano
        </p>
      </div>
    </div>
  );
}
