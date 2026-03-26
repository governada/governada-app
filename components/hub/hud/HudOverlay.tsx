'use client';

import { AnimatePresence } from 'framer-motion';

interface HudOverlayProps {
  urgencyLevel: 'calm' | 'active' | 'critical';
  children: React.ReactNode;
  className?: string;
}

export function HudOverlay({ urgencyLevel, children, className }: HudOverlayProps) {
  return (
    <div
      className={`absolute inset-0 z-10 pointer-events-none [&>*]:pointer-events-auto ${className ?? ''}`}
    >
      {urgencyLevel === 'critical' && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at center, transparent 50%, oklch(0.75 0.15 85 / 0.05) 100%)',
          }}
          aria-hidden
        />
      )}
      <AnimatePresence>{children}</AnimatePresence>
    </div>
  );
}
