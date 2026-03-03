import { GovernancePulseHero, type PulseData } from '@/components/GovernancePulseHero';
import { HowItWorks } from '@/components/HowItWorks';
import { DashboardPreview } from '@/components/DashboardPreview';
import { DRepDiscoveryPreview } from '@/components/DRepDiscoveryPreview';
import { Users } from 'lucide-react';

interface PreviewDRep {
  drepId: string;
  name: string | null;
  ticker: string | null;
  handle: string | null;
  drepScore: number;
  sizeTier: string;
  effectiveParticipation: number;
}

interface HomepageUnauthProps {
  pulseData: PulseData;
  topDReps: PreviewDRep[];
}

export function HomepageUnauth({ pulseData, topDReps }: HomepageUnauthProps) {
  return (
    <div className="space-y-12">
      <GovernancePulseHero data={pulseData} />
      <HowItWorks />
      <DashboardPreview />
      <DRepDiscoveryPreview dreps={topDReps} />

      {pulseData.claimedDReps > 0 && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-4">
          <Users className="h-4 w-4" />
          <span>
            <strong className="text-foreground">{pulseData.claimedDReps}</strong> DReps have claimed
            their profile on DRepScore
          </span>
        </div>
      )}
    </div>
  );
}
