'use client';

/**
 * IntelligenceBlocks — AI-generated intelligence cards for the ReviewBrief.
 *
 * Three independently-loading blocks:
 * 1. Constitutional Summary — checks proposal against the Cardano Constitution
 * 2. Similar Proposals — finds historical precedents via research-precedent skill
 * 3. Perspective Diversity — placeholder for Agent C's perspective clusters
 *
 * Each block loads independently with skeleton states and caches results.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ShieldCheck, ShieldAlert, ShieldX, History, Users, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { ProvenanceBadge } from '@/components/workspace/shared/ProvenanceBadge';
import { useAISkill } from '@/hooks/useAISkill';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IntelligenceBlocksProps {
  txHash: string;
  index: number;
  title: string;
  abstract: string | null;
  proposalType: string;
}

interface ConstitutionalFlag {
  article: string;
  section?: string;
  concern: string;
  severity: 'info' | 'warning' | 'critical';
}

interface ConstitutionalCheckOutput {
  flags: ConstitutionalFlag[];
  score: 'pass' | 'warning' | 'fail';
}

interface SimilarProposal {
  txHash: string;
  title: string;
  proposalType: string;
  status: string;
  comparison: string;
}

interface ResearchPrecedentOutput {
  similarProposals: SimilarProposal[];
  precedentSummary: string;
  questionsToConsider: string[];
}

// ---------------------------------------------------------------------------
// Block skeleton
// ---------------------------------------------------------------------------

function BlockSkeleton() {
  return (
    <Card>
      <CardContent className="pt-4 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// 1. Constitutional Summary Block
// ---------------------------------------------------------------------------

function ConstitutionalSummaryBlock({
  title,
  abstract,
  proposalType,
  txHash,
  index,
}: IntelligenceBlocksProps) {
  const skill = useAISkill<ConstitutionalCheckOutput>();
  const [result, setResult] = useState<ConstitutionalCheckOutput | null>(null);
  const [provenance, setProvenance] = useState<{
    model: string;
    keySource: 'platform' | 'byok';
  } | null>(null);
  const invokedRef = useRef(false);

  const invoke = useCallback(() => {
    if (invokedRef.current || !abstract) return;
    invokedRef.current = true;
    skill.mutate(
      {
        skill: 'constitutional-check',
        input: { title, abstract, proposalType },
        proposalTxHash: txHash,
        proposalIndex: index,
      },
      {
        onSuccess: (data) => {
          setResult(data.output);
          setProvenance({ model: data.provenance.model, keySource: data.provenance.keySource });
        },
      },
    );
  }, [title, abstract, proposalType, txHash, index, skill]);

  useEffect(() => {
    invoke();
  }, [invoke]);

  if (!abstract) {
    return (
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4" />
            <span>Constitutional check unavailable (no abstract)</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (skill.isPending || !result) return <BlockSkeleton />;

  if (skill.isError) {
    return (
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span>Constitutional check unavailable</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const ScoreIcon =
    result.score === 'pass' ? ShieldCheck : result.score === 'warning' ? ShieldAlert : ShieldX;

  const scoreColor =
    result.score === 'pass'
      ? 'text-emerald-500'
      : result.score === 'warning'
        ? 'text-amber-500'
        : 'text-rose-500';

  const scoreBg =
    result.score === 'pass'
      ? 'bg-emerald-500/10'
      : result.score === 'warning'
        ? 'bg-amber-500/10'
        : 'bg-rose-500/10';

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ScoreIcon className={cn('h-4 w-4', scoreColor)} />
            <span className="text-sm font-medium">Constitutional Check</span>
            <Badge variant="outline" className={cn('text-xs capitalize', scoreBg, scoreColor)}>
              {result.score}
            </Badge>
          </div>
          {provenance && (
            <ProvenanceBadge
              model={provenance.model}
              keySource={provenance.keySource}
              skillName="constitutional-check"
            />
          )}
        </div>

        {result.flags.length > 0 && (
          <Accordion type="single" collapsible>
            <AccordionItem value="flags" className="border-0">
              <AccordionTrigger className="py-2 text-xs text-muted-foreground hover:no-underline">
                {result.flags.length} flag{result.flags.length !== 1 ? 's' : ''} found
              </AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-2">
                  {result.flags.map((flag, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs">
                      <span
                        className={cn(
                          'mt-0.5 h-2 w-2 rounded-full shrink-0',
                          flag.severity === 'critical'
                            ? 'bg-rose-500'
                            : flag.severity === 'warning'
                              ? 'bg-amber-500'
                              : 'bg-blue-400',
                        )}
                      />
                      <div>
                        <span className="font-medium text-foreground/80">
                          Art. {flag.article}
                          {flag.section ? `, S.${flag.section}` : ''}
                        </span>
                        <span className="text-muted-foreground"> — {flag.concern}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

        {result.flags.length === 0 && (
          <p className="text-xs text-muted-foreground">No constitutional concerns identified.</p>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// 2. Similar Proposals Block
// ---------------------------------------------------------------------------

function SimilarProposalsBlock({
  title,
  abstract,
  proposalType,
  txHash,
  index,
}: IntelligenceBlocksProps) {
  const skill = useAISkill<ResearchPrecedentOutput>();
  const [result, setResult] = useState<ResearchPrecedentOutput | null>(null);
  const [provenance, setProvenance] = useState<{
    model: string;
    keySource: 'platform' | 'byok';
  } | null>(null);
  const invokedRef = useRef(false);

  const invoke = useCallback(() => {
    if (invokedRef.current) return;
    invokedRef.current = true;
    skill.mutate(
      {
        skill: 'research-precedent',
        input: {
          proposalTitle: title,
          proposalAbstract: abstract ?? undefined,
          proposalType,
        },
        proposalTxHash: txHash,
        proposalIndex: index,
      },
      {
        onSuccess: (data) => {
          setResult(data.output);
          setProvenance({ model: data.provenance.model, keySource: data.provenance.keySource });
        },
      },
    );
  }, [title, abstract, proposalType, txHash, index, skill]);

  useEffect(() => {
    invoke();
  }, [invoke]);

  if (skill.isPending || !result) return <BlockSkeleton />;

  if (skill.isError) {
    return (
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span>Precedent research unavailable</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const topProposals = result.similarProposals.slice(0, 3);

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-medium">Similar Proposals</span>
            {topProposals.length > 0 && (
              <span className="text-xs text-muted-foreground">({topProposals.length} found)</span>
            )}
          </div>
          {provenance && (
            <ProvenanceBadge
              model={provenance.model}
              keySource={provenance.keySource}
              skillName="research-precedent"
            />
          )}
        </div>

        {topProposals.length === 0 ? (
          <p className="text-xs text-muted-foreground">No similar past proposals found.</p>
        ) : (
          <ul className="space-y-2">
            {topProposals.map((p, i) => (
              <li
                key={p.txHash || i}
                className="rounded-md border border-border/40 bg-muted/10 px-3 py-2 space-y-0.5"
              >
                <p className="text-xs font-medium text-foreground/90 line-clamp-1">{p.title}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">{p.comparison}</p>
              </li>
            ))}
          </ul>
        )}

        {result.precedentSummary && (
          <p className="text-xs text-muted-foreground/80 leading-relaxed">
            {result.precedentSummary}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// 3. Perspective Diversity Block (placeholder)
// ---------------------------------------------------------------------------

function PerspectiveDiversityBlock() {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-violet-400" />
          <span className="text-sm font-medium">Perspective Diversity</span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Perspectives loading... Community viewpoints will appear here once enough rationales are
          collected for this proposal.
        </p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function IntelligenceBlocks(props: IntelligenceBlocksProps) {
  return (
    <div className="space-y-3">
      <ConstitutionalSummaryBlock {...props} />
      <SimilarProposalsBlock {...props} />
      <PerspectiveDiversityBlock />
    </div>
  );
}
