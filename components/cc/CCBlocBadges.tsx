'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { fadeInUp } from '@/lib/animations';
import type { CCBloc } from '@/hooks/queries';

// ---------------------------------------------------------------------------
// Bloc color palette
// ---------------------------------------------------------------------------

const BLOC_COLORS = [
  { dot: 'bg-sky-500', border: 'border-sky-500/30', bg: 'bg-sky-500/10' },
  { dot: 'bg-violet-500', border: 'border-violet-500/30', bg: 'bg-violet-500/10' },
  { dot: 'bg-amber-500', border: 'border-amber-500/30', bg: 'bg-amber-500/10' },
  { dot: 'bg-emerald-500', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10' },
] as const;

const INDEPENDENT_STYLE = {
  dot: 'bg-muted-foreground/50',
  border: 'border-border/40',
  bg: 'bg-muted/30',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface CCBlocBadgesProps {
  blocs: CCBloc[];
}

export function CCBlocBadges({ blocs }: CCBlocBadgesProps) {
  if (!blocs || blocs.length === 0) {
    return (
      <motion.div variants={fadeInUp}>
        <p className="text-sm text-muted-foreground">
          No clear voting blocs — independent reasoning patterns
        </p>
      </motion.div>
    );
  }

  // Check if all blocs are independent
  const allIndependent = blocs.every((b) => b.label.toLowerCase() === 'independent');
  if (allIndependent) {
    return (
      <motion.div variants={fadeInUp}>
        <p className="text-sm text-muted-foreground">
          No clear voting blocs — independent reasoning patterns
        </p>
      </motion.div>
    );
  }

  // Separate named blocs from independents
  const namedBlocs = blocs.filter((b) => b.label.toLowerCase() !== 'independent');
  const independentBloc = blocs.find((b) => b.label.toLowerCase() === 'independent');

  return (
    <motion.div variants={fadeInUp} className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground">Reasoning Blocs</h3>

      <div className="flex flex-wrap gap-3">
        {namedBlocs.map((bloc, idx) => {
          const color = BLOC_COLORS[idx % BLOC_COLORS.length];
          return (
            <div
              key={bloc.label}
              className={cn('rounded-xl border px-4 py-2.5 space-y-1', color.border, color.bg)}
            >
              <div className="flex items-center gap-2">
                <div className={cn('h-2.5 w-2.5 rounded-full', color.dot)} />
                <span className="text-sm font-medium">{bloc.label}</span>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  ({bloc.internalAgreementPct}% aligned)
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {bloc.members.map((m, mIdx) => (
                  <span key={m.ccHotId}>
                    {mIdx > 0 && ', '}
                    <Link
                      href={`/governance/committee/${encodeURIComponent(m.ccHotId)}`}
                      className="hover:text-foreground transition-colors"
                    >
                      {m.name || `${m.ccHotId.slice(0, 8)}...`}
                    </Link>
                  </span>
                ))}
              </div>
            </div>
          );
        })}

        {/* Independent bloc — muted style */}
        {independentBloc && independentBloc.members.length > 0 && (
          <div
            className={cn(
              'rounded-xl border px-4 py-2.5 space-y-1',
              INDEPENDENT_STYLE.border,
              INDEPENDENT_STYLE.bg,
            )}
          >
            <div className="flex items-center gap-2">
              <div className={cn('h-2.5 w-2.5 rounded-full', INDEPENDENT_STYLE.dot)} />
              <span className="text-sm font-medium text-muted-foreground">Independent</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {independentBloc.members.map((m, mIdx) => (
                <span key={m.ccHotId}>
                  {mIdx > 0 && ', '}
                  <Link
                    href={`/governance/committee/${encodeURIComponent(m.ccHotId)}`}
                    className="hover:text-foreground transition-colors"
                  >
                    {m.name || `${m.ccHotId.slice(0, 8)}...`}
                  </Link>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
