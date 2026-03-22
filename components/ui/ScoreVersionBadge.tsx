import Link from 'next/link';
import type { ScoredEntityType } from '@/lib/scoring/versioning';

interface ScoreVersionBadgeProps {
  version: string;
  entityType: ScoredEntityType;
}

/**
 * ScoreVersionBadge — Small mono badge showing the scoring methodology version.
 * Links to the methodology page anchored to the relevant entity section.
 */
export function ScoreVersionBadge({ version, entityType }: ScoreVersionBadgeProps) {
  return (
    <Link
      href={`/help/methodology#${entityType}-scoring`}
      className="inline-flex items-center text-[10px] font-mono text-muted-foreground/60 border border-border/30 rounded px-1.5 py-0.5 hover:text-muted-foreground transition-colors"
      title={`Scoring methodology V${version} — click to learn more`}
    >
      V{version}
    </Link>
  );
}
