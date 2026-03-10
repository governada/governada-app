'use client';

import { Search, Sparkles } from 'lucide-react';
import { HubCard } from './HubCard';

/**
 * DiscoveryCard — Contextual suggestions for anonymous/undelegated users.
 *
 * Lowest priority card. Guides new users toward action.
 * Two variants: Match (find a DRep) and Explore (browse governance).
 */

export function DiscoveryMatchCard() {
  return (
    <HubCard href="/match" urgency="default" label="Find a DRep who shares your values">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-xs font-medium uppercase tracking-wider text-primary">
            Quick Match
          </span>
        </div>
        <p className="text-base font-semibold text-foreground">Find your representative</p>
        <p className="text-sm text-muted-foreground">
          Answer 3 questions, get matched to DReps who think like you.
        </p>
      </div>
    </HubCard>
  );
}

export function DiscoveryExploreCard() {
  return (
    <HubCard href="/governance" urgency="default" label="Explore Cardano governance">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Explore
          </span>
        </div>
        <p className="text-base font-semibold text-foreground">Browse governance</p>
        <p className="text-sm text-muted-foreground">
          See who&apos;s representing ADA holders and how they vote.
        </p>
      </div>
    </HubCard>
  );
}
