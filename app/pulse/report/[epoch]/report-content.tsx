'use client';

import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollReveal } from '@/components/ScrollReveal';
import { MarkdownContent } from '@/components/MarkdownContent';
import { GHI_BAND_COLORS, type GHIBand } from '@/lib/ghi';
import {
  Lightbulb,
  ScrollText,
  TrendingUp,
  TrendingDown,
  Landmark,
  Vote,
  Users,
  Sparkles,
} from 'lucide-react';
import type { ReportData } from '@/lib/stateOfGovernance';
import { staggerContainer, fadeInUp } from '@/lib/animations';

const CATEGORY_ICONS: Record<string, typeof Vote> = {
  voting: Vote,
  treasury: Landmark,
  behavior: Users,
  participation: TrendingUp,
};

const OUTCOME_COLORS: Record<string, string> = {
  enacted: 'text-green-500 bg-green-500/10',
  ratified: 'text-emerald-500 bg-emerald-500/10',
  dropped: 'text-red-500 bg-red-500/10',
  expired: 'text-amber-500 bg-amber-500/10',
  open: 'text-blue-500 bg-blue-500/10',
};

export function StateOfGovernanceContent({
  data,
  narrative,
}: {
  data: ReportData;
  narrative: string | null;
}) {
  const color = GHI_BAND_COLORS[data.ghi.band as GHIBand];

  return (
    <div className="space-y-12">
      {/* GHI Component Breakdown */}
      <ScrollReveal>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Health Index Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.ghi.components.map((comp) => (
                <div key={comp.name} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{comp.name}</span>
                    <span className="font-medium tabular-nums">{comp.value}/100</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: color }}
                      initial={{ width: 0 }}
                      whileInView={{ width: `${Math.min(100, comp.value)}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.6, delay: 0.1 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </ScrollReveal>

      {/* Key Insights */}
      {data.insights.length > 0 && (
        <ScrollReveal>
          <div className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-amber-500" />
              Key Insights
            </h2>
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {data.insights.map((insight) => {
                const Icon = CATEGORY_ICONS[insight.category] || Lightbulb;
                return (
                  <motion.div
                    key={insight.id}
                    variants={fadeInUp}
                    className="rounded-lg border bg-card/50 p-4 space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        {insight.category}
                      </span>
                    </div>
                    <p className="text-2xl font-bold tabular-nums">{insight.stat}</p>
                    <p className="text-sm font-semibold">{insight.headline}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {insight.description}
                    </p>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </ScrollReveal>
      )}

      {/* Proposal Outcomes */}
      {data.proposals.length > 0 && (
        <ScrollReveal>
          <div className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <ScrollText className="h-5 w-5 text-primary" />
              Proposal Outcomes
            </h2>
            <div className="space-y-2">
              {data.proposals.map((p) => (
                <div
                  key={`${p.txHash}-${p.index}`}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.title || 'Untitled Proposal'}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.type.replace(/([A-Z])/g, ' $1').trim()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    {p.withdrawalAda && (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {p.withdrawalAda.toLocaleString()} ADA
                      </span>
                    )}
                    <Badge variant="secondary" className={OUTCOME_COLORS[p.outcome] || ''}>
                      {p.outcome}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ScrollReveal>
      )}

      {/* DRep Movers */}
      {(data.movers.gainers.length > 0 || data.movers.losers.length > 0) && (
        <ScrollReveal>
          <div className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              DRep Movers
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {data.movers.gainers.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-green-500 flex items-center gap-1.5">
                      <TrendingUp className="h-4 w-4" /> Top Gainers
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {data.movers.gainers.map((m) => (
                      <div key={m.drepId} className="flex items-center justify-between text-sm">
                        <span className="truncate mr-2">{m.name}</span>
                        <span className="text-green-500 font-medium tabular-nums">
                          +{m.delta} → {m.score}
                        </span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
              {data.movers.losers.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-red-500 flex items-center gap-1.5">
                      <TrendingDown className="h-4 w-4" /> Biggest Drops
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {data.movers.losers.map((m) => (
                      <div key={m.drepId} className="flex items-center justify-between text-sm">
                        <span className="truncate mr-2">{m.name}</span>
                        <span className="text-red-500 font-medium tabular-nums">
                          {m.delta} → {m.score}
                        </span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </ScrollReveal>
      )}

      {/* Treasury */}
      {data.treasuryBalance && data.treasuryBalance !== 'N/A' && (
        <ScrollReveal>
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <Landmark className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Treasury Balance</p>
                <p className="text-2xl font-bold tabular-nums">{data.treasuryBalance} ADA</p>
              </div>
            </CardContent>
          </Card>
        </ScrollReveal>
      )}

      {/* AI Editorial Narrative */}
      {narrative && (
        <ScrollReveal>
          <div className="space-y-3">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Editorial Analysis
            </h2>
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-6">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {narrative
                  .split('\n\n')
                  .filter(Boolean)
                  .map((paragraph, i) => (
                    <p key={i} className="text-sm leading-relaxed text-foreground/90">
                      {paragraph}
                    </p>
                  ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-4">
                AI-assisted editorial — all statistics are computed from on-chain data
              </p>
            </div>
          </div>
        </ScrollReveal>
      )}
    </div>
  );
}
