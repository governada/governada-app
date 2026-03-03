'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export function MethodologyAccordion() {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        How is this scored?
      </p>
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="formula">
          <AccordionTrigger className="text-xs py-2">Overall Formula</AccordionTrigger>
          <AccordionContent className="text-xs text-muted-foreground space-y-2">
            <code className="block bg-muted p-2 rounded text-[11px]">
              Score = (Participation × 0.30) + (Rationale × 0.35) + (Reliability × 0.20) + (Profile
              × 0.15)
            </code>
            <p>
              Rationale is weighted highest because explaining votes is the best signal of
              accountability.
            </p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="participation">
          <AccordionTrigger className="text-xs py-2">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              Effective Participation (30%)
            </span>
          </AccordionTrigger>
          <AccordionContent className="text-xs text-muted-foreground space-y-2">
            <p>
              Raw participation rate adjusted by a Deliberation Modifier that penalizes uniform
              voting patterns.
            </p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>&gt;95% same direction: 30% penalty</li>
              <li>&gt;90% same direction: 15% penalty</li>
              <li>≤85% same direction: no penalty</li>
            </ul>
            <p>
              Rubber-stamping is penalized — thoughtful DReps engage with each proposal
              individually.
            </p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="rationale">
          <AccordionTrigger className="text-xs py-2">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              Rationale Quality (35%)
            </span>
          </AccordionTrigger>
          <AccordionContent className="text-xs text-muted-foreground space-y-2">
            <p>
              Measures how often meaningful on-chain rationale is provided, weighted by proposal
              importance.
            </p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>
                <strong>Critical (3×)</strong>: Hard forks, no confidence, committee changes
              </li>
              <li>
                <strong>Important (2×)</strong>: Treasury withdrawals &gt;1M, parameter changes
              </li>
              <li>
                <strong>Standard (1×)</strong>: Routine treasury withdrawals
              </li>
            </ul>
            <p>
              A forgiving curve rewards initial effort. Min 50 characters to count as rationale.
            </p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="reliability">
          <AccordionTrigger className="text-xs py-2">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-purple-500" />
              Reliability (20%)
            </span>
          </AccordionTrigger>
          <AccordionContent className="text-xs text-muted-foreground space-y-2">
            <p>
              Tracks the pattern of engagement over time — can you count on this DRep to show up?
            </p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>
                <strong>Active Streak (35%)</strong>: Consecutive epochs with votes
              </li>
              <li>
                <strong>Recency (30%)</strong>: Exponential decay since last vote
              </li>
              <li>
                <strong>Gap Penalty (20%)</strong>: Penalizes longest inactivity stretch
              </li>
              <li>
                <strong>Tenure (15%)</strong>: Time since first vote (log curve)
              </li>
            </ul>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="profile">
          <AccordionTrigger className="text-xs py-2">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-cyan-500" />
              Profile Completeness (15%)
            </span>
          </AccordionTrigger>
          <AccordionContent className="text-xs text-muted-foreground space-y-2">
            <p>Rewards DReps who provide useful identity and intent information:</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Name, bio/description, social links</li>
              <li>Objectives, motivations, qualifications (CIP-119)</li>
              <li>Payment address for accountability</li>
            </ul>
            <p>
              Well-documented profiles score higher since delegators can make informed decisions.
            </p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
