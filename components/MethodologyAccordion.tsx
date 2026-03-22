'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import Link from 'next/link';

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
              Score = (Engagement Quality × 0.40) + (Effective Participation × 0.25) + (Reliability
              × 0.25) + (Governance Identity × 0.10)
            </code>
            <p>
              Engagement Quality is weighted highest because explaining votes with quality reasoning
              is the strongest signal of governance accountability.
            </p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="engagement">
          <AccordionTrigger className="text-xs py-2">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              Engagement Quality (40%)
            </span>
          </AccordionTrigger>
          <AccordionContent className="text-xs text-muted-foreground space-y-2">
            <p>
              Three layers measuring depth of governance engagement: rationale provision,
              AI-assessed rationale quality, and deliberation signals.
            </p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>
                <strong>Provision Rate (40%)</strong>: Importance-weighted % of votes with rationale
              </li>
              <li>
                <strong>Rationale Quality (40%)</strong>: AI-scored reasoning quality. Outcome-blind
                &mdash; same quality earns the same score regardless of vote direction
              </li>
              <li>
                <strong>Deliberation Signal (20%)</strong>: Rationale diversity (60%) + coverage
                breadth (40%)
              </li>
            </ul>
            <p>
              DReps who vote against the majority with quality rationale (score 60+) receive a 1.2x
              quality bonus. Copy-paste rationales are detected and penalized.
            </p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="participation">
          <AccordionTrigger className="text-xs py-2">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Effective Participation (25%)
            </span>
          </AccordionTrigger>
          <AccordionContent className="text-xs text-muted-foreground space-y-2">
            <p>
              Importance-weighted voting coverage with temporal decay. Critical proposals (hard
              forks, constitutional changes) count 3x; important proposals 2x.
            </p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Close-margin proposals (decided by &lt;20% margin) receive a 1.5x bonus</li>
              <li>Older votes decay over time &mdash; current engagement matters most</li>
            </ul>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="reliability">
          <AccordionTrigger className="text-xs py-2">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              Reliability (25%)
            </span>
          </AccordionTrigger>
          <AccordionContent className="text-xs text-muted-foreground space-y-2">
            <p>
              Tracks the pattern of engagement over time &mdash; can you count on this DRep to show
              up?
            </p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>
                <strong>Active Streak (35%)</strong>: Consecutive proposal-active epochs with votes
              </li>
              <li>
                <strong>Recency (30%)</strong>: Exponential decay since last vote
              </li>
              <li>
                <strong>Gap Penalty (25%)</strong>: Penalizes longest inactivity stretch
              </li>
              <li>
                <strong>Tenure (10%)</strong>: Time since first vote (log curve)
              </li>
            </ul>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="identity">
          <AccordionTrigger className="text-xs py-2">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-violet-500" />
              Governance Identity (10%)
            </span>
          </AccordionTrigger>
          <AccordionContent className="text-xs text-muted-foreground space-y-2">
            <p>
              Rewards DReps who provide meaningful identity information and maintain healthy
              delegation relationships.
            </p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>
                <strong>Profile Quality (60%)</strong>: CIP-119 metadata completeness with staleness
                decay for outdated profiles
              </li>
              <li>
                <strong>Delegation Health (40%)</strong>: Retention, diversity, and organic growth
                signals
              </li>
            </ul>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      <Link
        href="/help/methodology"
        className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
      >
        See full methodology &rarr;
      </Link>
    </div>
  );
}
