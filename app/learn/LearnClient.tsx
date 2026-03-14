'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  ChevronRight,
  Users,
  Vote,
  Shield,
  Scale,
  Search,
  X,
  Rocket,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { GOV_TERMS, type GovTermDef } from '@/lib/microcopy';
import { useSegment } from '@/components/providers/SegmentProvider';

const GETTING_STARTED = [
  {
    title: 'What is Cardano governance?',
    description:
      'Cardano lets ADA holders vote on how the network is run \u2014 things like spending community funds, changing rules, and approving upgrades. You participate by choosing a representative who votes for you.',
    icon: Scale,
    color: 'text-violet-400 bg-violet-500/10',
    link: '/governance',
    linkLabel: 'Explore representatives',
  },
  {
    title: 'How choosing a representative works',
    description:
      'You pick someone who votes on Cardano decisions for you. Your ADA never leaves your wallet \u2014 you\u2019re just choosing who speaks on your behalf. You can switch anytime.',
    icon: Users,
    color: 'text-emerald-400 bg-emerald-500/10',
    link: '/match',
    linkLabel: 'Find your representative',
  },
  {
    title: 'What decisions are being made?',
    description:
      'Proposals cover spending community funds, changing network rules, approving major upgrades, and more. Each decision needs approval from representatives, staking pools, and a constitutional committee.',
    icon: Vote,
    color: 'text-sky-400 bg-sky-500/10',
    link: '/governance/proposals',
    linkLabel: 'Browse decisions',
  },
  {
    title: 'Who makes the decisions?',
    description:
      'Three groups share the power: representatives (who vote on your behalf), staking pool operators (who run the network), and a constitutional committee (who make sure the rules are followed).',
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
          Everything you need to understand how Cardano is governed.
        </p>
      </div>

      {/* Guided onboarding banner */}
      <Link
        href="/get-started"
        className="group flex items-center gap-4 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors p-5"
      >
        <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
          <Rocket className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">New to Cardano governance?</p>
          <p className="text-xs text-muted-foreground">
            Follow our step-by-step guide to understand governance, connect your wallet, and choose
            your representative.
          </p>
        </div>
        <ArrowRight className="h-4 w-4 text-primary shrink-0 group-hover:translate-x-0.5 transition-transform" />
      </Link>

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
