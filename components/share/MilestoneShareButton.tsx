'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Share2 } from 'lucide-react';
import { CITIZEN_MILESTONES } from '@/lib/citizenMilestones';
import { buildCitizenMilestoneUrl, buildCitizenMilestoneOgUrl, trackShare } from '@/lib/share';
import { ProfileShareCard } from './ProfileShareCard';

interface MilestoneShareButtonProps {
  stakeAddress: string;
  milestoneKey: string;
  /** Button variant */
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  /** Button size */
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

/**
 * Share button for citizen milestones.
 * Shows a preview of the milestone OG image with share options.
 */
export function MilestoneShareButton({
  stakeAddress,
  milestoneKey,
  variant = 'outline',
  size = 'sm',
  className,
}: MilestoneShareButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const milestone = CITIZEN_MILESTONES.find((m) => m.key === milestoneKey);

  const handleOpen = useCallback(() => {
    trackShare('milestone-card', 'dialog-open', { milestoneKey }, 'initiated');
    setDialogOpen(true);
  }, [milestoneKey]);

  if (!milestone) return null;

  const shareUrl = buildCitizenMilestoneUrl(stakeAddress, milestoneKey);
  const ogImageUrl = buildCitizenMilestoneOgUrl(stakeAddress, milestoneKey);
  const shareText = `${milestone.shareText} #Cardano #Governance @governada_io`;

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={handleOpen}
        aria-label={`Share ${milestone.label} milestone`}
      >
        <Share2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
        Share
      </Button>

      <ProfileShareCard
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        ogImageUrl={ogImageUrl}
        shareText={shareText}
        shareUrl={shareUrl}
        title={`Share: ${milestone.label}`}
        surface="milestone-card"
        downloadFilename={`governada-milestone-${milestoneKey}`}
      />
    </>
  );
}
