'use client';

import { motion } from 'framer-motion';
import { GovernanceRings } from '@/components/ui/GovernanceRings';

interface MobileHudProps {
  rings: { participation: number; deliberation: number; impact: number };
  epochProgress: number;
  epochNumber: number;
  urgencyLevel: 'calm' | 'active' | 'critical';
  className?: string;
}

const urgencyColors: Record<MobileHudProps['urgencyLevel'], string> = {
  calm: 'bg-compass-sage',
  active: 'bg-compass-gold',
  critical: 'bg-compass-ember',
};

export function MobileHud({
  rings,
  epochProgress,
  epochNumber,
  urgencyLevel,
  className,
}: MobileHudProps) {
  const clampedProgress = Math.max(0, Math.min(1, epochProgress));

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className={`fixed top-16 left-4 right-4 z-[12] rounded-xl bg-[oklch(0.15_0.01_260/0.6)] backdrop-blur-xl p-2 flex items-center gap-3 ${className ?? ''}`}
    >
      {/* Governance Rings */}
      <GovernanceRings data={rings} size="badge" />

      {/* Epoch label */}
      <span className="font-mono text-xs text-foreground/60 shrink-0">E{epochNumber}</span>

      {/* Epoch progress bar */}
      <div className="relative h-0.5 w-16 rounded-full bg-foreground/10 overflow-hidden shrink-0">
        <div
          className={`absolute inset-y-0 left-0 rounded-full ${urgencyColors[urgencyLevel]}`}
          style={{ width: `${clampedProgress * 100}%` }}
        />
      </div>

      {/* Urgency dot */}
      <div
        className={`h-1.5 w-1.5 rounded-full shrink-0 ${urgencyColors[urgencyLevel]}`}
        aria-hidden="true"
      />
    </motion.div>
  );
}
