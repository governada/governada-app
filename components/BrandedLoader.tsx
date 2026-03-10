'use client';

/* eslint-disable react-hooks/set-state-in-effect -- async/external state sync in useEffect is standard React pattern */
import { useState, useEffect } from 'react';

/**
 * Full-screen branded loading screen shown once on first visit.
 * Constellation-inspired: glowing nodes connect on a deep dark canvas.
 * Self-dismisses after ~1.8s. SessionStorage prevents repeat shows.
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

    const fadeTimer = setTimeout(() => setFading(true), 1400);
    const hideTimer = setTimeout(() => setVisible(false), 2000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-[#0a0b14] transition-opacity duration-500 ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      aria-hidden
    >
      {/* Constellation-inspired SVG animation */}
      <svg viewBox="0 0 200 200" width={160} height={160} className="mb-6">
        <defs>
          <filter id="loader-glow">
            <feGaussianBlur stdDeviation="3" />
            <feComposite in2="SourceGraphic" operator="over" />
          </filter>
        </defs>

        {/* Central node */}
        <circle cx="100" cy="100" r="4" fill="#06b6d4" filter="url(#loader-glow)">
          <animate attributeName="r" values="2;5;2" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" repeatCount="indefinite" />
        </circle>

        {/* Orbiting nodes — 6 dimensions */}
        {[
          { cx: 55, cy: 50, color: '#dc2626', delay: '0s' },
          { cx: 145, cy: 50, color: '#10b981', delay: '0.15s' },
          { cx: 160, cy: 110, color: '#a855f7', delay: '0.3s' },
          { cx: 130, cy: 160, color: '#f59e0b', delay: '0.45s' },
          { cx: 70, cy: 160, color: '#06b6d4', delay: '0.6s' },
          { cx: 40, cy: 110, color: '#3b82f6', delay: '0.75s' },
        ].map(({ cx, cy, color, delay }, i) => (
          <g key={i}>
            {/* Connection line to center */}
            <line
              x1="100"
              y1="100"
              x2={cx}
              y2={cy}
              stroke={color}
              strokeWidth="0.5"
              strokeOpacity="0.3"
            >
              <animate
                attributeName="stroke-opacity"
                values="0;0.4;0.2"
                dur="1.2s"
                begin={delay}
                fill="freeze"
              />
            </line>
            {/* Node */}
            <circle cx={cx} cy={cy} r="0" fill={color} filter="url(#loader-glow)">
              <animate attributeName="r" values="0;3;2.5" dur="0.8s" begin={delay} fill="freeze" />
              <animate
                attributeName="opacity"
                values="0;1;0.8"
                dur="0.8s"
                begin={delay}
                fill="freeze"
              />
            </circle>
          </g>
        ))}

        {/* Connection lines between adjacent nodes */}
        {[
          { x1: 55, y1: 50, x2: 145, y2: 50 },
          { x1: 145, y1: 50, x2: 160, y2: 110 },
          { x1: 160, y1: 110, x2: 130, y2: 160 },
          { x1: 130, y1: 160, x2: 70, y2: 160 },
          { x1: 70, y1: 160, x2: 40, y2: 110 },
          { x1: 40, y1: 110, x2: 55, y2: 50 },
        ].map(({ x1, y1, x2, y2 }, i) => (
          <line
            key={`edge-${i}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="0.5"
          >
            <animate
              attributeName="stroke-opacity"
              values="0;0.12;0.06"
              dur="1.5s"
              begin={`${0.6 + i * 0.1}s`}
              fill="freeze"
            />
          </line>
        ))}
      </svg>

      {/* Brand text */}
      <div className="text-center animate-fade-in-up">
        <p className="text-2xl font-bold text-primary tracking-tight font-sans">Governada</p>
        <p className="text-sm text-muted-foreground mt-1 tracking-wide">
          Governance Intelligence for Cardano
        </p>
      </div>
    </div>
  );
}
