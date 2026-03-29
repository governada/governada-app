'use client';

import { Badge } from '@/components/ui/badge';
import type { ConstitutionalRiskLevel } from '@/lib/workspace/types';

const RISK_CONFIG: Record<ConstitutionalRiskLevel, { label: string; className: string }> = {
  NONE: { label: 'None', className: 'border-border text-muted-foreground' },
  LOW: { label: 'Low', className: 'border-emerald-500/40 text-emerald-400' },
  MEDIUM: { label: 'Medium', className: 'border-amber-500/40 text-amber-400' },
  HIGH: { label: 'High', className: 'border-red-500/40 text-red-400' },
};

export function ConstitutionalRiskCell({ risk }: { risk: ConstitutionalRiskLevel | null }) {
  if (!risk) {
    return <span className="text-xs text-muted-foreground/40">—</span>;
  }

  const config = RISK_CONFIG[risk];
  return (
    <Badge variant="outline" className={`text-xs font-normal ${config.className}`}>
      {config.label}
    </Badge>
  );
}
