'use client';

import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fadeInUp } from '@/lib/animations';

interface CCKeyFindingProps {
  finding: string;
  severity: 'info' | 'noteworthy' | 'concern' | 'critical';
}

const SEVERITY_STYLES: Record<CCKeyFindingProps['severity'], { border: string; bg: string }> = {
  critical: { border: 'border-l-rose-500', bg: 'bg-rose-500/5' },
  concern: { border: 'border-l-amber-500', bg: 'bg-amber-500/5' },
  noteworthy: { border: 'border-l-sky-500', bg: 'bg-sky-500/5' },
  info: { border: 'border-l-border', bg: 'bg-card/30' },
};

export function CCKeyFinding({ finding, severity }: CCKeyFindingProps) {
  if (!finding) return null;

  const style = SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.info;

  return (
    <motion.div
      variants={fadeInUp}
      className={cn(
        'rounded-xl border border-border/60 border-l-4 px-4 py-3.5',
        style.border,
        style.bg,
      )}
    >
      <p className="text-sm font-medium leading-relaxed">{finding}</p>
      <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
        <Sparkles className="h-3 w-3" />
        Based on AI analysis
      </p>
    </motion.div>
  );
}
