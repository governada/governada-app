'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useGovernanceInsights } from '@/hooks/queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { fadeInUp, staggerContainer } from '@/lib/animations';
import {
  Lightbulb,
  Vote,
  Landmark,
  Users,
  TrendingUp,
  TrendingDown,
  Minus,
  Share2,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Activity,
} from 'lucide-react';
import type { GovernanceInsight } from '@/lib/proposalIntelligence';

const CATEGORY_ICONS: Record<string, typeof Vote> = {
  voting: Vote,
  treasury: Landmark,
  behavior: Users,
  participation: Activity,
};

const TREND_ICONS = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
  new: Lightbulb,
};

interface CrossProposalInsightsProps {
  maxInsights?: number;
  showHighlight?: boolean;
}

export function CrossProposalInsights({
  maxInsights,
  showHighlight = true,
}: CrossProposalInsightsProps) {
  const { data: rawData } = useGovernanceInsights();
  const insights = (rawData as GovernanceInsight[]) ?? [];

  if (insights.length === 0) return null;

  const displayed = maxInsights ? insights.slice(0, maxInsights) : insights;
  const highlight = showHighlight && displayed.length > 0 ? displayed[0] : null;
  const rest = showHighlight ? displayed.slice(1) : displayed;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-amber-500" />
          Governance Insights
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Patterns emerging from {insights.length} analyses of how DReps vote, reason, and govern.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {highlight && <InsightHighlight insight={highlight} />}

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {rest.map((insight) => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
        </motion.div>
      </CardContent>
    </Card>
  );
}

function InsightHighlight({ insight }: { insight: GovernanceInsight }) {
  const Icon = CATEGORY_ICONS[insight.category] || Lightbulb;

  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className="rounded-lg border-2 border-amber-500/30 bg-amber-500/5 p-5 space-y-3"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20">
            <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <span className="text-xs font-semibold text-amber-500 uppercase tracking-wider">
            Insight of the Week
          </span>
        </div>
        <InsightShareButton insight={insight} />
      </div>

      <div className="flex items-baseline gap-3">
        <span className="text-4xl font-bold tabular-nums">{insight.stat}</span>
        {insight.trendDirection && (
          <TrendIndicator direction={insight.trendDirection} trend={insight.trend} />
        )}
      </div>

      <p className="text-base font-semibold">{insight.headline}</p>
      <p className="text-sm text-muted-foreground leading-relaxed">{insight.description}</p>

      {insight.methodology && <InsightMethodology text={insight.methodology} />}
    </motion.div>
  );
}

function InsightCard({ insight }: { insight: GovernanceInsight }) {
  const Icon = CATEGORY_ICONS[insight.category] || Lightbulb;

  return (
    <motion.div variants={fadeInUp} className="rounded-lg border bg-card/50 p-4 space-y-2 group">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {insight.category}
          </span>
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <InsightShareButton insight={insight} size="sm" />
        </div>
      </div>

      <div className="flex items-baseline gap-2">
        <p className="text-3xl font-bold tabular-nums">{insight.stat}</p>
        {insight.trendDirection && (
          <TrendIndicator direction={insight.trendDirection} trend={insight.trend} size="sm" />
        )}
      </div>

      <p className="text-sm font-semibold">{insight.headline}</p>
      <p className="text-xs text-muted-foreground leading-relaxed">{insight.description}</p>

      {insight.methodology && <InsightMethodology text={insight.methodology} />}
    </motion.div>
  );
}

function TrendIndicator({
  direction,
  trend,
  size = 'default',
}: {
  direction: string;
  trend?: string;
  size?: 'sm' | 'default';
}) {
  const TrendIcon = TREND_ICONS[direction as keyof typeof TREND_ICONS] || Minus;
  const colorClass =
    direction === 'up'
      ? 'text-green-500'
      : direction === 'down'
        ? 'text-red-500'
        : 'text-muted-foreground';
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5';

  return (
    <div className={`flex items-center gap-1 ${colorClass}`}>
      <TrendIcon className={iconSize} />
      {trend && (
        <span className={`${size === 'sm' ? 'text-[10px]' : 'text-xs'} font-medium tabular-nums`}>
          {trend}
        </span>
      )}
    </div>
  );
}

function InsightShareButton({
  insight,
  size = 'default',
}: {
  insight: GovernanceInsight;
  size?: 'sm' | 'default';
}) {
  const [copied, setCopied] = useState(false);

  const copyShareText = useCallback(() => {
    const text = insight.shareText || `${insight.headline}: ${insight.stat} — via DRepScore`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [insight]);

  return (
    <Button
      variant="ghost"
      size="sm"
      className={`${size === 'sm' ? 'h-6 w-6 p-0' : 'h-7 px-2 gap-1 text-xs'}`}
      onClick={copyShareText}
      title="Copy share text"
    >
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
      {size !== 'sm' && (copied ? 'Copied' : 'Share')}
    </Button>
  );
}

function InsightMethodology({ text }: { text: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        Methodology
      </button>
      {open && (
        <p className="text-[10px] text-muted-foreground mt-1 pl-4 border-l border-border">{text}</p>
      )}
    </div>
  );
}
