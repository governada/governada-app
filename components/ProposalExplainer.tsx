'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarkdownContent } from '@/components/MarkdownContent';
import { fadeInUp } from '@/lib/animations';

interface ProposalExplainerProps {
  txHash: string;
  index: number;
  cachedExplanation?: string | null;
}

export function ProposalExplainer({ txHash, index, cachedExplanation }: ProposalExplainerProps) {
  const [explanation, setExplanation] = useState<string | null>(cachedExplanation ?? null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(!!cachedExplanation);
  const [error, setError] = useState(false);

  const generate = useCallback(async () => {
    if (explanation) {
      setExpanded((e) => !e);
      return;
    }

    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/proposals/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash, index }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setExplanation(data.explanation);
      setExpanded(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [txHash, index, explanation]);

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 overflow-hidden">
      <button
        onClick={generate}
        disabled={loading}
        className="flex items-center justify-between w-full px-4 py-3 text-left hover:bg-primary/10 transition-colors disabled:opacity-70"
      >
        <div className="flex items-center gap-2">
          {loading ? (
            <Loader2 className="h-4 w-4 text-primary animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 text-primary" />
          )}
          <span className="text-sm font-semibold text-primary">
            {loading
              ? 'Generating explanation...'
              : explanation
                ? 'AI Explanation'
                : 'Explain this proposal'}
          </span>
        </div>
        {explanation &&
          (expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ))}
      </button>

      <AnimatePresence>
        {expanded && explanation && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <motion.div
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              className="px-4 pb-4 space-y-2"
            >
              <MarkdownContent content={explanation} className="text-sm leading-relaxed" />
              <p className="text-[10px] text-muted-foreground">
                AI-assisted analysis — verify important details independently
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <div className="px-4 pb-3">
          <p className="text-xs text-destructive">
            Explanation unavailable right now.{' '}
            <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={generate}>
              Try again
            </Button>
          </p>
        </div>
      )}
    </div>
  );
}
