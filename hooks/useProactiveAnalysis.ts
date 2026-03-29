'use client';

/**
 * useProactiveAnalysis — debounced hook that calls the proactive-analysis
 * skill 30s after the last content change and returns actionable insights.
 *
 * Deduplicates against previously shown insight IDs.
 * Merges new insights with existing (doesn't replace).
 * Max 5 tracked, max 3 displayed simultaneously.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAISkill } from '@/hooks/useAISkill';
import type { ProactiveAnalysisOutput, ProactiveInsight } from '@/lib/ai/skills/proactive-analysis';

interface UseProactiveAnalysisOptions {
  proposalContent: {
    title: string;
    abstract: string;
    motivation: string;
    rationale: string;
  };
  proposalType: string;
  constitutionalScore?: 'pass' | 'warning' | 'fail';
  enabled: boolean;
}

interface UseProactiveAnalysisReturn {
  insights: ProactiveInsight[];
  isAnalyzing: boolean;
  dismissInsight: (id: string) => void;
}

const DEBOUNCE_MS = 30_000;
const MAX_TRACKED = 5;
const MAX_DISPLAYED = 3;

export function useProactiveAnalysis({
  proposalContent,
  proposalType,
  constitutionalScore,
  enabled,
}: UseProactiveAnalysisOptions): UseProactiveAnalysisReturn {
  const [insights, setInsights] = useState<ProactiveInsight[]>([]);
  const dismissedIdsRef = useRef<Set<string>>(new Set());
  const shownIdsRef = useRef<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const contentHashRef = useRef('');
  const skill = useAISkill<ProactiveAnalysisOutput>();

  // Hash content to detect real changes (null byte separator can't appear in text content)
  const contentHash = `${proposalContent.title}\0${proposalContent.abstract}\0${proposalContent.motivation}\0${proposalContent.rationale}`;

  // Debounced analysis trigger on content change
  useEffect(() => {
    if (!enabled) return;
    if (contentHash === contentHashRef.current) return;
    contentHashRef.current = contentHash;

    // Don't trigger if content is too short (still scaffolding)
    const totalLen =
      proposalContent.abstract.length +
      proposalContent.motivation.length +
      proposalContent.rationale.length;
    if (totalLen < 100) return;

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      skill.mutate(
        {
          skill: 'proactive-analysis',
          input: {
            proposalContent,
            proposalType,
            constitutionalScore,
            previousInsightIds: shownIdsRef.current,
          },
        },
        {
          onSuccess: (data) => {
            const newInsights = data.output.insights;
            if (newInsights.length === 0) return;

            // Track shown IDs for deduplication
            const newIds = newInsights.map((i) => i.id);
            shownIdsRef.current = [...shownIdsRef.current, ...newIds].slice(-MAX_TRACKED);

            // Merge with existing (keep undismissed, add new)
            setInsights((prev) => {
              const undismissed = prev.filter((i) => !dismissedIdsRef.current.has(i.id));
              const combined = [...undismissed, ...newInsights];
              // Deduplicate by ID, keep latest
              const seen = new Set<string>();
              const deduped: ProactiveInsight[] = [];
              for (const insight of combined.reverse()) {
                if (!seen.has(insight.id)) {
                  seen.add(insight.id);
                  deduped.push(insight);
                }
              }
              return deduped.reverse().slice(-MAX_TRACKED);
            });
          },
        },
      );
    }, DEBOUNCE_MS);

    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentHash, enabled]);

  const dismissInsight = useCallback((id: string) => {
    dismissedIdsRef.current.add(id);
    setInsights((prev) => prev.filter((i) => i.id !== id));
  }, []);

  // Filter out dismissed and limit to MAX_DISPLAYED
  const visibleInsights = insights
    .filter((i) => !dismissedIdsRef.current.has(i.id))
    .sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    })
    .slice(0, MAX_DISPLAYED);

  return {
    insights: visibleInsights,
    isAnalyzing: skill.isPending,
    dismissInsight,
  };
}
