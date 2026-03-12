'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BookOpen, ChevronRight, Users, Vote, Shield, Scale, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { GOV_TERMS, type GovTermDef } from '@/lib/microcopy';
import { useSegment } from '@/components/providers/SegmentProvider';

const GETTING_STARTED = [
  {
    title: 'What is Cardano governance?',
    description:
      'Cardano uses on-chain governance where ADA holders can vote on protocol changes, treasury spending, and constitutional amendments through elected representatives.',
    icon: Scale,
    color: 'text-violet-400 bg-violet-500/10',
    link: '/governance',
    linkLabel: 'Explore representatives',
  },
  {
    title: 'How delegation works',
    description:
      "You delegate your ADA's voting power to a DRep (Delegated Representative) who votes on your behalf. Your ADA never leaves your wallet — you're lending governance weight, not money.",
    icon: Users,
    color: 'text-emerald-400 bg-emerald-500/10',
    link: '/match',
    linkLabel: 'Find your DRep',
  },
  {
    title: 'Understanding proposals',
    description:
      'Governance actions include treasury withdrawals, parameter changes, hard forks, and constitutional updates. Each requires approval from DReps, stake pools, and the Constitutional Committee.',
    icon: Vote,
    color: 'text-sky-400 bg-sky-500/10',
    link: '/governance/proposals',
    linkLabel: 'Browse proposals',
  },
  {
    title: 'The three governance bodies',
    description:
      'Cardano governance has three pillars: DReps (citizen representatives), SPOs (stake pool operators), and the Constitutional Committee. Major decisions need approval from multiple bodies.',
    icon: Shield,
    color: 'text-amber-400 bg-amber-500/10',
    link: '/governance/committee',
    linkLabel: 'View the Committee',
  },
];

function getWhyItMatters(term: GovTermDef, segment: string): string {
  if (segment in term.whyItMatters) {
    return (term.whyItMatters as Record<string, string>)[segment];
  }
  return term.whyItMatters.default;
}

export function LearnClient() {
  const [search, setSearch] = useState('');
  const { segment } = useSegment();

  const termEntries = Object.entries(GOV_TERMS);
  const filteredTerms = search.trim()
    ? termEntries.filter(
        ([key, term]) =>
          term.label.toLowerCase().includes(search.toLowerCase()) ||
          term.definition.toLowerCase().includes(search.toLowerCase()) ||
          key.toLowerCase().includes(search.toLowerCase()),
      )
    : termEntries;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Help</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Everything you need to understand Cardano governance — from delegation to treasury.
        </p>
      </div>

      {/* Getting Started */}
      <section data-discovery="help-getting-started">
        <h2 className="text-lg font-semibold mb-4">Getting Started</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {GETTING_STARTED.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-5 space-y-3"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'w-9 h-9 rounded-full flex items-center justify-center shrink-0',
                      item.color,
                    )}
                  >
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <h3 className="text-sm font-semibold">{item.title}</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
                <Link
                  href={item.link}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                >
                  {item.linkLabel} <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* Governance Glossary */}
      <section data-discovery="help-methodology">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Governance Glossary</h2>
          <span className="text-xs text-muted-foreground">{filteredTerms.length} terms</span>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search terms…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="rounded-xl border border-border divide-y divide-border/50 overflow-hidden">
          {filteredTerms.map(([key, term]) => (
            <div key={key} className="px-5 py-4 space-y-1">
              <h3 className="text-sm font-semibold text-foreground">{term.label}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{term.definition}</p>
              <p className="text-xs text-primary/80 leading-relaxed">
                {getWhyItMatters(term, segment)}
              </p>
            </div>
          ))}
          {filteredTerms.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              No terms match your search.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
