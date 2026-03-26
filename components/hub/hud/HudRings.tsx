'use client';

import { motion } from 'framer-motion';
import { GovernanceRings } from '@/components/ui/GovernanceRings';

interface HudRingsProps {
  participation: number;
  deliberation: number;
  impact: number;
  epochProgress: number;
  epochNumber: number;
  className?: string;
}

export function HudRings({
  participation,
  deliberation,
  impact,
  epochProgress,
  epochNumber,
  className,
}: HudRingsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.6 }}
      className={`bg-[oklch(0.15_0.01_260/0.6)] backdrop-blur-xl border border-white/[0.08] rounded-xl p-3 inline-flex flex-col items-center gap-2 ${className ?? ''}`}
    >
      <GovernanceRings
        data={{ participation, deliberation, impact }}
        size="card"
        entrance="bloom"
        animate
      />

      {/* Epoch progress bar */}
      <div className="w-full">
        <div className="h-1 w-full rounded-full bg-white/[0.05]">
          <div
            className="h-1 rounded-full bg-gradient-to-r from-[oklch(0.72_0.12_192)] to-[oklch(0.72_0.12_192)] transition-[width] duration-700 ease-out"
            style={{ width: `${Math.min(epochProgress * 100, 100)}%` }}
          />
        </div>
        <p className="text-[10px] text-muted-foreground font-mono mt-1 text-center">
          Epoch {epochNumber}
        </p>
      </div>
    </motion.div>
  );
}
