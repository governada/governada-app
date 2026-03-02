'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShareActions } from '@/components/ShareActions';
import { spring, fadeInUp, staggerContainer } from '@/lib/animations';
import { Lightbulb, Vote, Landmark, Users } from 'lucide-react';
import type { GovernanceInsight } from '@/lib/proposalInsights';

const CATEGORY_ICONS: Record<string, typeof Vote> = {
  voting: Vote,
  treasury: Landmark,
  behavior: Users,
};

export function CrossProposalInsights() {
  const [insights, setInsights] = useState<GovernanceInsight[]>([]);

  useEffect(() => {
    fetch('/api/governance/insights')
      .then(r => r.ok ? r.json() : [])
      .then(setInsights)
      .catch(() => {});
  }, []);

  if (insights.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-amber-500" />
          Governance Insights
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Patterns emerging from how DReps vote, reason, and govern.
        </p>
      </CardHeader>
      <CardContent>
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          {insights.map(insight => {
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
                <p className="text-3xl font-bold tabular-nums">{insight.stat}</p>
                <p className="text-sm font-semibold">{insight.headline}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{insight.description}</p>
              </motion.div>
            );
          })}
        </motion.div>
      </CardContent>
    </Card>
  );
}
