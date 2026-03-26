'use client';

import { motion } from 'framer-motion';
import { Vault, Activity, FileText } from 'lucide-react';

interface HudGaugesProps {
  treasury: { label: string; trend: 'up' | 'down' | 'flat' } | null;
  ghi: { score: number; label: string } | null;
  activeProposals: { count: number; critical: number } | null;
  className?: string;
}

const TREND_ARROWS: Record<'up' | 'down' | 'flat', { char: string; color: string }> = {
  up: { char: '\u2191', color: 'text-[oklch(0.72_0.12_192)]' },
  down: { char: '\u2193', color: 'text-red-400' },
  flat: { char: '\u2014', color: 'text-gray-400' },
};

function ghiColor(score: number): string {
  if (score >= 70) return 'bg-[oklch(0.72_0.12_192)]';
  if (score >= 40) return 'bg-amber-400';
  return 'bg-red-400';
}

export function HudGauges({ treasury, ghi, activeProposals, className }: HudGaugesProps) {
  const gauges = [
    treasury
      ? {
          key: 'treasury',
          icon: <Vault className="size-3.5 shrink-0 text-foreground/60" />,
          content: (
            <>
              <span className="truncate">{treasury.label}</span>
              <span className={TREND_ARROWS[treasury.trend].color}>
                {TREND_ARROWS[treasury.trend].char}
              </span>
            </>
          ),
        }
      : null,
    ghi
      ? {
          key: 'ghi',
          icon: <Activity className="size-3.5 shrink-0 text-foreground/60" />,
          content: (
            <>
              <span>{ghi.score.toFixed(1)}</span>
              <span className={`inline-block size-2 rounded-full ${ghiColor(ghi.score)}`} />
              <span className="text-muted-foreground">{ghi.label}</span>
            </>
          ),
        }
      : null,
    activeProposals
      ? {
          key: 'proposals',
          icon: <FileText className="size-3.5 shrink-0 text-foreground/60" />,
          content: (
            <>
              <span>{activeProposals.count} active</span>
              {activeProposals.critical > 0 && (
                <span className="inline-flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold min-w-[16px] h-4 px-1">
                  {activeProposals.critical}
                </span>
              )}
            </>
          ),
        }
      : null,
  ].filter(Boolean) as Array<{
    key: string;
    icon: React.ReactNode;
    content: React.ReactNode;
  }>;

  if (gauges.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.8 }}
      className={`flex flex-col gap-2 ${className ?? ''}`}
    >
      {gauges.map((gauge, i) => (
        <motion.div
          key={gauge.key}
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, delay: 0.8 + i * 0.1 }}
          className="bg-[oklch(0.15_0.01_260/0.6)] backdrop-blur-xl border border-white/[0.08] rounded-xl px-3 py-2 flex items-center gap-2 text-xs text-foreground/80 font-mono"
        >
          {gauge.icon}
          {gauge.content}
        </motion.div>
      ))}
    </motion.div>
  );
}
