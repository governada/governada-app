'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Users } from 'lucide-react';
import { getStoredSession } from '@/lib/supabaseAuth';
import { posthog } from '@/lib/posthog';

interface CohortData {
  userCohort: string;
  cohortStats: {
    memberCount: number;
    label: string;
    description: string;
  };
}

const COHORT_ACCENTS: Record<string, string> = {
  'Treasury Skeptic': 'border-l-red-500/60',
  'Treasury Advocate': 'border-l-emerald-500/60',
  'Balanced Voter': 'border-l-blue-500/60',
};

export function CohortIdentity() {
  const [cohort, setCohort] = useState<CohortData | null>(null);
  const [loading, setLoading] = useState(true);
  const [insufficient, setInsufficient] = useState(false);

  useEffect(() => {
    async function fetchCohort() {
      const token = getStoredSession();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch('/api/governance/cohorts', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          setLoading(false);
          return;
        }
        const json = await res.json();
        if (!json.cohort) {
          setInsufficient(true);
        } else {
          setCohort(json.cohort);
          posthog.capture('cohort_identity_viewed', { cohort: json.cohort.userCohort });
        }
      } catch {
        // silent fail
      } finally {
        setLoading(false);
      }
    }
    fetchCohort();
  }, []);

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="p-4">
          <div className="h-4 bg-muted rounded w-3/4" />
        </CardContent>
      </Card>
    );
  }

  if (insufficient || !cohort) {
    return (
      <Card className="border-l-4 border-l-muted">
        <CardContent className="p-4 flex items-center gap-3 text-sm text-muted-foreground">
          <Users className="h-4 w-4 shrink-0" />
          Not enough community data yet — vote in more polls to unlock cohort identity.
        </CardContent>
      </Card>
    );
  }

  const accent = COHORT_ACCENTS[cohort.userCohort] || COHORT_ACCENTS['Balanced Voter'];

  return (
    <Card className={`border-l-4 ${accent}`}>
      <CardContent className="p-4 flex items-start gap-3">
        <Users className="h-5 w-5 mt-0.5 shrink-0 text-muted-foreground" />
        <div className="text-sm">
          <span className="font-medium">{cohort.cohortStats.label}</span>
          <p className="text-muted-foreground mt-0.5">
            You and {cohort.cohortStats.memberCount.toLocaleString()} other delegators{' '}
            {cohort.cohortStats.description}. Together you represent the{' '}
            <span className="font-medium">{cohort.userCohort}</span> voice in governance.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
