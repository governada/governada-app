import { CheckCircle2, XCircle, Scale, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getVerdict, type VerdictType } from './proposal-theme';

const VERDICT_ICONS: Record<VerdictType, typeof CheckCircle2> = {
  passing: CheckCircle2,
  failing: XCircle,
  contested: Scale,
  passed: CheckCircle2,
  rejected: XCircle,
  expired: Clock,
};

interface ProposalVerdictProps {
  status: string;
  triBody?: {
    drep: { yes: number; no: number; abstain: number };
    spo: { yes: number; no: number; abstain: number };
    cc: { yes: number; no: number; abstain: number };
  } | null;
  accentColor?: string;
}

export function ProposalVerdict({ status, triBody, accentColor }: ProposalVerdictProps) {
  const verdict = getVerdict(status, triBody);
  const Icon = VERDICT_ICONS[verdict.type];

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border px-4 py-3',
        verdict.bgColor,
        verdict.borderColor,
      )}
      style={accentColor ? { borderLeftWidth: '3px', borderLeftColor: accentColor } : undefined}
    >
      <Icon className={cn('h-5 w-5 shrink-0', verdict.color)} />
      <span className={cn('text-sm font-semibold', verdict.color)}>{verdict.label}</span>

      {triBody && (
        <div className="flex items-center gap-3 ml-auto">
          {(
            [
              { label: 'DRep', data: triBody.drep },
              { label: 'SPO', data: triBody.spo },
              { label: 'CC', data: triBody.cc },
            ] as const
          ).map(({ label, data }) => {
            const total = data.yes + data.no + data.abstain;
            if (total === 0) return null;
            const yesPct = Math.round((data.yes / total) * 100);
            const color =
              yesPct >= 60 ? 'text-emerald-400' : yesPct >= 40 ? 'text-amber-400' : 'text-red-400';
            return (
              <span key={label} className="text-xs tabular-nums">
                <span className="text-muted-foreground">{label}</span>{' '}
                <span className={cn('font-semibold', color)}>{yesPct}%</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
