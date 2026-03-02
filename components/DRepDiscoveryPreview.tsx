import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { extractAlignments, getDominantDimension, getIdentityColor } from '@/lib/drepIdentity';

interface PreviewDRep {
  drepId: string;
  name: string | null;
  ticker: string | null;
  handle: string | null;
  drepScore: number;
  sizeTier: string;
  effectiveParticipation: number;
  alignmentTreasuryConservative?: number | null;
  alignmentTreasuryGrowth?: number | null;
  alignmentDecentralization?: number | null;
  alignmentSecurity?: number | null;
  alignmentInnovation?: number | null;
  alignmentTransparency?: number | null;
}

function ScoreRing({ score, size = 48 }: { score: number; size?: number }) {
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const color = score >= 80 ? 'text-green-500' : score >= 60 ? 'text-blue-500' : score >= 40 ? 'text-amber-500' : 'text-red-500';

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 36 36" className={`w-full h-full -rotate-90`}>
        <circle cx="18" cy="18" r={radius} fill="none" stroke="currentColor" className="text-muted/20" strokeWidth="3" />
        <circle
          cx="18" cy="18" r={radius} fill="none" stroke="currentColor"
          className={color}
          strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">{score}</span>
    </div>
  );
}

function DRepCard({ drep }: { drep: PreviewDRep }) {
  const displayName = drep.name || drep.ticker || drep.handle || `${drep.drepId.slice(0, 10)}...`;
  const tierColors: Record<string, string> = {
    whale: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
    large: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    medium: 'bg-green-500/10 text-green-600 border-green-500/20',
    small: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    micro: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
  };

  const alignments = extractAlignments(drep);
  const dominant = getDominantDimension(alignments);
  const identityColor = getIdentityColor(dominant);

  return (
    <Link
      href={`/drep/${drep.drepId}`}
      className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border/60 hover:border-primary/30 hover:shadow-md transition-all group relative overflow-hidden"
    >
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
        style={{ backgroundColor: identityColor.hex }}
      />
      <ScoreRing score={drep.drepScore} />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">{displayName}</p>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${tierColors[drep.sizeTier] || ''}`}>
            {drep.sizeTier}
          </Badge>
          <span className="text-[10px] text-muted-foreground">
            {drep.effectiveParticipation}% participation
          </span>
        </div>
      </div>
    </Link>
  );
}

export function DRepDiscoveryPreview({ dreps }: { dreps: PreviewDRep[] }) {
  return (
    <section id="discover-preview" className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Top DReps</h2>
          <p className="text-sm text-muted-foreground">Highest-scoring governance representatives</p>
        </div>
        <Link
          href="/discover"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          View all
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {dreps.map((drep) => (
          <DRepCard key={drep.drepId} drep={drep} />
        ))}
      </div>
    </section>
  );
}
