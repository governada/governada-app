'use client';

import { useEffect, useRef, useState } from 'react';

interface Step {
  title: string;
  svg: (animate: boolean) => React.ReactNode;
}

const steps: Step[] = [
  {
    title: 'Your ADA stays in your wallet.',
    svg: (animate) => (
      <svg viewBox="0 0 80 80" className="w-16 h-16 sm:w-20 sm:h-20">
        {/* Wallet body */}
        <rect
          x="15"
          y="24"
          width="50"
          height="36"
          rx="6"
          className="fill-card stroke-primary"
          strokeWidth="2"
        />
        {/* ADA symbol */}
        <text
          x="40"
          y="47"
          textAnchor="middle"
          className="fill-primary text-sm font-bold"
          fontSize="16"
        >
          ₳
        </text>
        {/* Shield */}
        <path
          d="M40 12 L52 20 L52 34 C52 42 46 48 40 50 C34 48 28 42 28 34 L28 20 Z"
          className={`fill-primary/20 stroke-primary transition-all duration-700 ${animate ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}
          strokeWidth="1.5"
          style={{ transformOrigin: '40px 30px' }}
        />
      </svg>
    ),
  },
  {
    title: 'Pick a DRep who shares your values.',
    svg: (animate) => (
      <svg viewBox="0 0 80 80" className="w-16 h-16 sm:w-20 sm:h-20">
        {/* Constellation nodes */}
        {[
          [40, 20],
          [60, 35],
          [55, 58],
          [25, 58],
          [20, 35],
        ].map(([cx, cy], i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={i === 0 ? 6 : 4}
            className={`transition-all duration-500 ${
              i === 0
                ? animate
                  ? 'fill-primary stroke-primary/50'
                  : 'fill-muted stroke-muted'
                : 'fill-muted-foreground/30 stroke-muted-foreground/20'
            }`}
            strokeWidth="1.5"
            style={{ transitionDelay: `${i * 80}ms` }}
          />
        ))}
        {/* Connection line to "you" */}
        <line
          x1="40"
          y1="20"
          x2="40"
          y2="70"
          className={`stroke-primary transition-all duration-700 ${animate ? 'opacity-100' : 'opacity-0'}`}
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />
        {/* You dot */}
        <circle
          cx="40"
          cy="70"
          r="3"
          className={`fill-foreground transition-all duration-500 ${animate ? 'opacity-100' : 'opacity-0'}`}
          style={{ transitionDelay: '400ms' }}
        />
        <text
          x="48"
          y="73"
          className={`fill-muted-foreground text-[8px] transition-opacity duration-300 ${animate ? 'opacity-100' : 'opacity-0'}`}
          style={{ transitionDelay: '500ms' }}
        >
          you
        </text>
      </svg>
    ),
  },
  {
    title: 'Track how they represent you.',
    svg: (animate) => (
      <svg viewBox="0 0 80 80" className="w-16 h-16 sm:w-20 sm:h-20">
        {/* Score ring background */}
        <circle cx="40" cy="40" r="28" fill="none" className="stroke-muted" strokeWidth="5" />
        {/* Score ring progress */}
        <circle
          cx="40"
          cy="40"
          r="28"
          fill="none"
          className="stroke-primary transition-all duration-1000"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${2 * Math.PI * 28}`}
          strokeDashoffset={animate ? 2 * Math.PI * 28 * 0.24 : 2 * Math.PI * 28}
          style={{ transform: 'rotate(-90deg)', transformOrigin: '40px 40px' }}
        />
        {/* Checkmark */}
        <path
          d="M30 40 L37 47 L50 34"
          fill="none"
          className={`stroke-primary transition-all duration-300 ${animate ? 'opacity-100' : 'opacity-0'}`}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transitionDelay: '600ms' }}
        />
      </svg>
    ),
  },
];

export function HowItWorksV2() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setAnimated(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={containerRef} className="py-12 px-4">
      <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10 max-w-3xl mx-auto">
        {steps.map((step, i) => (
          <div key={i} className="flex flex-col items-center gap-3 text-center flex-1">
            {step.svg(animated)}
            <p className="text-sm font-medium text-foreground max-w-[160px]">{step.title}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
