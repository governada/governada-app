'use client';

/**
 * useAdaptiveBottomSlot — Context-adaptive bottom bar slot.
 *
 * One bottom bar slot becomes context-adaptive based on temporal
 * mode + user state. Transitions with subtle crossfade.
 *
 * | Persona                    | Fixed 1 | Fixed 2    | Adaptive 3              |
 * | DRep (voting period)       | Home    | Governance | Vote (with count badge) |
 * | DRep (calm period)         | Home    | Governance | You                     |
 * | Citizen (undelegated)      | Home    | Governance | Match                   |
 * | Citizen (delegated, alert) | Home    | Governance | You (with alert badge)  |
 * | Citizen (delegated, calm)  | Home    | Governance | You                     |
 */

import { Vote, User, Compass } from 'lucide-react';
import type { UserSegment } from '@/components/providers/SegmentProvider';
import type { GovernanceMode } from '@/hooks/useGovernanceMode';
import type { GovernanceDepth } from '@/lib/governanceTuner';
import type { NavItem } from '@/lib/nav/config';

interface AdaptiveSlotInput {
  segment: UserSegment;
  mode: GovernanceMode;
  isUrgent: boolean;
  depth?: GovernanceDepth;
}

/**
 * Returns the adaptive NavItem for the last bottom bar slot,
 * or null if no adaptation is needed (use default).
 */
export function useAdaptiveSlot({
  segment,
  mode,
  isUrgent,
  depth,
}: AdaptiveSlotInput): NavItem | null {
  // DRep: Vote slot during urgent/active, You during calm
  if (segment === 'drep') {
    if (isUrgent || mode === 'active') {
      return {
        href: '/workspace',
        label: 'Vote',
        icon: Vote,
        badge: 'actions',
      };
    }
    return {
      href: '/you',
      label: 'You',
      icon: User,
      badge: 'unread',
    };
  }

  // Citizen: depends on delegation status
  if (segment === 'citizen') {
    const isDelegated = depth === 'hands_off' || depth === 'informed' || depth === 'engaged';

    if (!isDelegated) {
      // Undelegated citizens always see Match
      return {
        href: '/match',
        label: 'Match',
        icon: Compass,
      };
    }

    // Delegated citizens: You with alert during urgent, plain You otherwise
    if (isUrgent) {
      return {
        href: '/you',
        label: 'You',
        icon: User,
        badge: 'unread',
      };
    }
    return {
      href: '/you',
      label: 'You',
      icon: User,
    };
  }

  // SPO: same pattern as DRep
  if (segment === 'spo') {
    if (isUrgent || mode === 'active') {
      return {
        href: '/workspace',
        label: 'Workspace',
        icon: Vote,
      };
    }
    return {
      href: '/you',
      label: 'You',
      icon: User,
      badge: 'unread',
    };
  }

  // CC and anonymous: no adaptation
  return null;
}
