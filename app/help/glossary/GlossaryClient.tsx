'use client';

import { useState, useMemo, useRef } from 'react';
import { BookOpen, Search, X, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { GLOSSARY, CATEGORY_ORDER, type GlossaryCategory } from '@/lib/glossary';
import { cn } from '@/lib/utils';

const CATEGORY_DESCRIPTIONS: Record<GlossaryCategory, string> = {
  'The Basics': 'Core concepts you need to know before anything else.',
  'People & Roles': 'Who does what in Cardano governance.',
  'Your Participation': 'What you can do as an ADA holder.',
  'How Decisions Work': 'The process of proposing, voting, and passing changes.',
  'Money & Treasury': "How Cardano's community fund works.",
  'Scores & Quality': 'How Governada measures representative quality.',
  Technical: 'Deeper concepts — feel free to skip these for now.',
};

const CATEGORY_COLORS: Record<GlossaryCategory, string> = {
  'The Basics': 'text-violet-400 border-violet-500/30',
  'People & Roles': 'text-emerald-400 border-emerald-500/30',
  'Your Participation': 'text-sky-400 border-sky-500/30',
  'How Decisions Work': 'text-amber-400 border-amber-500/30',
  'Money & Treasury': 'text-rose-400 border-rose-500/30',
  'Scores & Quality': 'text-teal-400 border-teal-500/30',
  Technical: 'text-zinc-400 border-zinc-500/30',
};

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export function GlossaryClient() {
  const [search, setSearch] = useState('');
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const grouped = useMemo(() => {
    const lower = search.trim().toLowerCase();
    return CATEGORY_ORDER.map((cat) => {
      const all = GLOSSARY.filter((e) => e.category === cat);
      const filtered = lower
        ? all.filter(
            (e) =>
              e.term.toLowerCase().includes(lower) || e.definition.toLowerCase().includes(lower),
          )
        : all;
      return { category: cat, entries: filtered };
    }).filter((g) => g.entries.length > 0);
  }, [search]);

  const totalMatches = grouped.reduce((sum, g) => sum + g.entries.length, 0);

  function scrollToCategory(cat: GlossaryCategory) {
    const el = sectionRefs.current[cat];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Governance Glossary</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Plain-English definitions for every governance term you&apos;ll encounter on Governada. No
          technical background needed.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search for a term…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-10"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Category quick-nav (hidden when searching) */}
      {!search && (
        <nav className="flex flex-wrap gap-2">
          {CATEGORY_ORDER.map((cat) => (
            <button
              key={cat}
              onClick={() => scrollToCategory(cat)}
              className={cn(
                'text-xs font-medium px-3 py-1.5 rounded-full border transition-colors',
                'hover:bg-muted/50',
                CATEGORY_COLORS[cat],
              )}
            >
              {cat}
            </button>
          ))}
        </nav>
      )}

      {/* Results count when searching */}
      {search && (
        <p className="text-xs text-muted-foreground">
          {totalMatches} {totalMatches === 1 ? 'term' : 'terms'} matching &ldquo;{search}&rdquo;
        </p>
      )}

      {/* Term groups */}
      <div className="space-y-8">
        {grouped.map(({ category, entries }) => (
          <section
            key={category}
            ref={(el) => {
              sectionRefs.current[category] = el;
            }}
            id={slugify(category)}
            className="scroll-mt-20"
          >
            <div className="mb-3">
              <h2
                className={cn('text-base font-semibold', CATEGORY_COLORS[category]?.split(' ')[0])}
              >
                {category}
              </h2>
              {!search && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {CATEGORY_DESCRIPTIONS[category]}
                </p>
              )}
            </div>

            <div className="rounded-xl border border-border/50 divide-y divide-border/30 overflow-hidden">
              {entries.map((entry) => (
                <div key={entry.term} className="px-5 py-4">
                  <h3 className="text-sm font-semibold text-foreground">{entry.term}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                    {entry.definition}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Empty state */}
      {grouped.length === 0 && (
        <div className="text-center py-12 space-y-2">
          <p className="text-sm text-muted-foreground">No terms match your search.</p>
          <button
            onClick={() => setSearch('')}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
          >
            Clear search <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Footer hint */}
      {!search && (
        <p className="text-xs text-muted-foreground text-center pb-4">
          See a term you don&apos;t understand elsewhere on Governada? Look for the{' '}
          <span className="border-b border-dotted border-primary/50 text-foreground">
            dotted underline
          </span>{' '}
          — tap or hover for an instant definition.
        </p>
      )}
    </div>
  );
}
