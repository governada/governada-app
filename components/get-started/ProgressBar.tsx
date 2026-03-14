'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GovernancePassport } from '@/lib/passport';

const STAGES = [
  { num: 1, label: 'Discover' },
  { num: 2, label: 'Prepare' },
  { num: 3, label: 'Connect' },
  { num: 4, label: 'Delegate' },
] as const;

interface ProgressBarProps {
  currentStage: GovernancePassport['stage'];
  onStageClick?: (stage: 1 | 2 | 3 | 4) => void;
}

function stageNumber(stage: GovernancePassport['stage']): number {
  return stage === 'complete' ? 5 : stage;
}

export function ProgressBar({ currentStage, onStageClick }: ProgressBarProps) {
  const current = stageNumber(currentStage);

  return (
    <nav aria-label="Onboarding progress" className="w-full">
      <ol className="flex items-center justify-between gap-2">
        {STAGES.map(({ num, label }, idx) => {
          const isComplete = current > num;
          const isCurrent = current === num;
          const isClickable = isComplete && onStageClick;

          return (
            <li key={num} className="flex flex-1 items-center">
              <button
                type="button"
                disabled={!isClickable}
                onClick={() => isClickable && onStageClick(num as 1 | 2 | 3 | 4)}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-left transition-all duration-300 w-full',
                  isComplete && 'bg-emerald-500/10 hover:bg-emerald-500/15 cursor-pointer',
                  isCurrent && 'bg-primary/10',
                  !isComplete && !isCurrent && 'opacity-40',
                )}
                aria-current={isCurrent ? 'step' : undefined}
              >
                <div
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all duration-300',
                    isComplete && 'bg-emerald-500/20 text-emerald-400',
                    isCurrent &&
                      'bg-primary/20 text-primary ring-2 ring-primary/30 shadow-[0_0_12px_rgba(99,102,241,0.2)]',
                    !isComplete && !isCurrent && 'bg-muted/40 text-muted-foreground/50',
                  )}
                >
                  {isComplete ? <Check className="h-3.5 w-3.5" /> : num}
                </div>
                <span
                  className={cn(
                    'text-xs font-medium hidden sm:inline transition-colors duration-300',
                    isComplete && 'text-emerald-400',
                    isCurrent && 'text-foreground',
                    !isComplete && !isCurrent && 'text-muted-foreground/50',
                  )}
                >
                  {label}
                </span>
              </button>

              {idx < STAGES.length - 1 && (
                <div
                  className={cn(
                    'mx-1 h-px flex-1 transition-colors duration-500 hidden sm:block',
                    current > num + 1
                      ? 'bg-emerald-500/40'
                      : current > num
                        ? 'bg-primary/30'
                        : 'bg-muted/30',
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
