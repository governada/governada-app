import { CheckCircle2, XCircle, Scale, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getVerdict, type VerdictType } from './proposal-theme';
import { getVotingBodies } from '@/lib/governance/votingBodies';

const VERDICT_ICONS: Record<VerdictType, typeof CheckCircle2> = {
  passing: CheckCircle2,
  failing: XCircle,
  contested: Scale,
  passed: CheckCircle2,
  rejected: XCircle,
  expired: Clock,
};

const BODY_LABEL: Record<string, string> = { drep: 'DRep', spo: 'SPO', cc: 'CC' };

interface ProposalVerdictProps {
  status: string;
  triBody?: {
    drep: { yes: number; no: number; abstain: number };
    spo: { yes: number; no: number; abstain: number };
    cc: { yes: number; no: number; abstain: number };
  } | null;
  proposalType?: string;
  paramChanges?: Record<string, unknown> | null;
  accentColor?: string;
}

export function ProposalVerdict({
  status,
  triBody,
  proposalType,
  paramChanges,
  accentColor,
}: ProposalVerdictProps) {
  const verdict = getVerdict(status, triBody);
  const Icon = VERDICT_ICONS[verdict.type];
  const eligibleBodies = proposalType
    ? getVotingBodies(proposalType, paramChanges)
    : (['drep', 'spo', 'cc'] as const);

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
          {eligibleBodies.map((body) => {
            const data = triBody[body];
            const total = data.yes + data.no + data.abstain;
            if (total === 0) return null;
            const yesPct = Math.round((data.yes / total) * 100);
            const color =
              yesPct >= 60 ? 'text-emerald-400' : yesPct >= 40 ? 'text-amber-400' : 'text-red-400';
            return (
              <span key={body} className="text-xs tabular-nums">
                <span className="text-muted-foreground">{BODY_LABEL[body]}</span>{' '}
                <span className={cn('font-semibold', color)}>{yesPct}%</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
