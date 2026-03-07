'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Scale, ShieldCheck, AlertTriangle, Minus } from 'lucide-react';

interface ArticleAssessment {
  articleId: string;
  articleTitle: string;
  assessment: 'supports' | 'tension' | 'neutral';
  reasoning: string;
}

interface ConstitutionalAnalysis {
  alignment: 'aligned' | 'tension' | 'neutral';
  confidence: number;
  summary: string;
  relevantArticles: ArticleAssessment[];
}

interface ConstitutionalAlignmentCardProps {
  txHash: string;
  proposalIndex: number;
}

export function ConstitutionalAlignmentCard({
  txHash,
  proposalIndex,
}: ConstitutionalAlignmentCardProps) {
  const { data, isLoading } = useQuery<{ analysis: ConstitutionalAnalysis | null }>({
    queryKey: ['constitutional-analysis', txHash, proposalIndex],
    queryFn: () =>
      fetch(
        `/api/proposal/${encodeURIComponent(txHash)}/${proposalIndex}/constitutional-analysis`,
      ).then((r) => (r.ok ? r.json() : { analysis: null })),
  });

  const analysis = data?.analysis;

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Scale className="h-4 w-4" />
            Constitutional Alignment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-16 animate-pulse bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!analysis) return null;

  const alignmentConfig = {
    aligned: {
      icon: ShieldCheck,
      label: 'Constitutionally Aligned',
      color: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-500/10',
      border: 'border-green-500/20',
    },
    tension: {
      icon: AlertTriangle,
      label: 'Constitutional Tension',
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
    },
    neutral: {
      icon: Minus,
      label: 'Constitutionally Neutral',
      color: 'text-muted-foreground',
      bg: 'bg-muted/50',
      border: 'border-muted',
    },
  };

  const config = alignmentConfig[analysis.alignment];
  const Icon = config.icon;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Scale className="h-4 w-4" />
          Constitutional Alignment
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Overall assessment */}
        <div className={`rounded-md ${config.bg} border ${config.border} p-3`}>
          <div className="flex items-center gap-2 mb-1">
            <Icon className={`h-4 w-4 ${config.color}`} />
            <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
            <span className="text-xs text-muted-foreground ml-auto">
              {Math.round(analysis.confidence * 100)}% confidence
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{analysis.summary}</p>
        </div>

        {/* Relevant articles */}
        {analysis.relevantArticles.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Relevant Articles</p>
            {analysis.relevantArticles.map((article) => (
              <div
                key={article.articleId}
                className="flex items-start gap-2 text-xs border-l-2 pl-2 py-1"
                style={{
                  borderColor:
                    article.assessment === 'supports'
                      ? 'rgb(34 197 94 / 0.4)'
                      : article.assessment === 'tension'
                        ? 'rgb(245 158 11 / 0.4)'
                        : 'rgb(148 163 184 / 0.3)',
                }}
              >
                <div className="flex-1">
                  <span className="font-medium">
                    {article.articleId}: {article.articleTitle}
                  </span>
                  <p className="text-muted-foreground mt-0.5">{article.reasoning}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-[10px] text-muted-foreground">
          AI analysis against the Cardano Constitution — not legal advice
        </p>
      </CardContent>
    </Card>
  );
}
