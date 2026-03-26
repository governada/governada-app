'use client';

import { useEffect, useRef, useState } from 'react';

interface HudA11yProps {
  urgencyLevel: 'calm' | 'active' | 'critical';
  pendingActions: number;
  ghiScore: number | null;
  treasuryLabel: string | null;
  epochNumber: number;
}

const urgencyDescriptions: Record<HudA11yProps['urgencyLevel'], string> = {
  calm: 'Governance is calm.',
  active: 'Governance is active.',
  critical: 'Urgent governance activity.',
};

function composeSummary({
  urgencyLevel,
  pendingActions,
  ghiScore,
  treasuryLabel,
  epochNumber,
}: HudA11yProps): string {
  const parts: string[] = [];

  parts.push(`Epoch ${epochNumber}.`);

  if (pendingActions > 0) {
    parts.push(`${pendingActions} action${pendingActions === 1 ? '' : 's'} pending.`);
  }

  if (ghiScore !== null) {
    parts.push(`Governance health index: ${ghiScore}.`);
  }

  if (treasuryLabel) {
    parts.push(`Treasury: ${treasuryLabel}.`);
  }

  parts.push(urgencyDescriptions[urgencyLevel]);

  return parts.join(' ');
}

export function HudA11y(props: HudA11yProps) {
  const [summary, setSummary] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { urgencyLevel, pendingActions, ghiScore, treasuryLabel, epochNumber } = props;

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      setSummary(
        composeSummary({
          urgencyLevel,
          pendingActions,
          ghiScore,
          treasuryLabel,
          epochNumber,
        }),
      );
    }, 2000);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [urgencyLevel, pendingActions, ghiScore, treasuryLabel, epochNumber]);

  return (
    <div className="sr-only" aria-live="polite" role="status">
      {summary}
    </div>
  );
}
