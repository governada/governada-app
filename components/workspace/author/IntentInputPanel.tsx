'use client';

/**
 * IntentInputPanel — Path B entry overlay for AI-assisted amendment creation.
 *
 * Full-screen overlay where the user describes their intent in plain language.
 * On submit, calls the amendment-translator AI skill to generate specific
 * constitutional amendments.
 */

import { useState, useCallback, useMemo } from 'react';
import { Sparkles, Loader2, ChevronDown, ChevronUp, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CONSTITUTION_NODES } from '@/lib/constitution/fullText';
import type { AmendmentChange } from '@/lib/constitution/types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface IntentInputPanelProps {
  onAmendmentsGenerated: (
    changes: AmendmentChange[],
    metadata: { summary: string; motivation: string; rationale: string },
  ) => void;
  isGenerating: boolean;
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function IntentInputPanel({
  onAmendmentsGenerated,
  isGenerating,
  onCancel,
}: IntentInputPanelProps) {
  const [intent, setIntent] = useState('');
  const [targetArticles, setTargetArticles] = useState<Set<string>>(new Set());
  const [showArticleFilter, setShowArticleFilter] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only articles (not preamble/defined-terms) for the filter
  const articleNodes = useMemo(
    () => CONSTITUTION_NODES.filter((n) => n.articleNumber !== null),
    [],
  );

  const toggleArticle = useCallback((id: string) => {
    setTargetArticles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!intent.trim()) return;
    setError(null);

    try {
      const res = await fetch('/api/ai/skill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skill: 'amendment-translator',
          input: {
            intent: intent.trim(),
            targetArticles: targetArticles.size > 0 ? Array.from(targetArticles) : undefined,
          },
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Failed to generate amendments: ${res.status} ${text}`);
      }

      const data = await res.json();
      const output = data.output ?? data;

      onAmendmentsGenerated(output.amendments ?? [], {
        summary: output.summary ?? '',
        motivation: output.motivation ?? '',
        rationale: output.rationale ?? '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    }
  }, [intent, targetArticles, onAmendmentsGenerated]);

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <h2 className="text-xl font-bold">What would you like to change?</h2>
            <p className="text-sm text-muted-foreground">
              Describe your intent in plain language. The AI will identify the relevant articles and
              draft specific amendments for you to review.
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Intent textarea */}
        <Textarea
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          placeholder="e.g., I want to strengthen the requirements for treasury withdrawals to include mandatory impact assessments and quarterly reporting..."
          rows={6}
          className="resize-none text-sm"
          disabled={isGenerating}
          autoFocus
        />

        {/* Optional article filter */}
        <div>
          <button
            onClick={() => setShowArticleFilter((prev) => !prev)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            {showArticleFilter ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
            Target specific articles
            {targetArticles.size > 0 && (
              <span className="text-primary font-medium">({targetArticles.size} selected)</span>
            )}
          </button>

          {showArticleFilter && (
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto rounded-lg border border-border p-3">
              {articleNodes.map((node) => (
                <label
                  key={node.id}
                  className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/30 rounded px-2 py-1.5 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={targetArticles.has(node.id)}
                    onChange={() => toggleArticle(node.id)}
                    className="rounded border-border"
                    disabled={isGenerating}
                  />
                  <span className="truncate">
                    {node.articleNumber !== null && (
                      <span className="font-mono text-primary mr-1">Art. {node.articleNumber}</span>
                    )}
                    {node.title.replace(/^Article \d+ Section \d+ — /, '')}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Error message */}
        {error && <p className="text-sm text-destructive">{error}</p>}

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={onCancel}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Edit directly instead
          </button>

          <Button onClick={handleSubmit} disabled={!intent.trim() || isGenerating} size="sm">
            {isGenerating ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                Generate Amendments
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
