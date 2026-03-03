'use client';

import { useState, useCallback } from 'react';
import { posthog } from '@/lib/posthog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Copy, Check, Loader2, RotateCcw } from 'lucide-react';

interface RationaleAssistantProps {
  drepId: string;
  proposalTitle: string;
  proposalAbstract: string | null;
  proposalType: string;
  aiSummary: string | null;
}

export function RationaleAssistant({
  drepId,
  proposalTitle,
  proposalAbstract,
  proposalType,
  aiSummary,
}: RationaleAssistantProps) {
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [generated, setGenerated] = useState(false);

  const generateDraft = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/rationale/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          drepId,
          proposalTitle,
          proposalAbstract,
          proposalType,
          aiSummary,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to generate draft');
      }

      const data = await res.json();
      setDraft(data.draft || '');
      setGenerated(true);
      try {
        posthog?.capture('rationale_draft_generated', { drepId, proposalType });
      } catch {}
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [drepId, proposalTitle, proposalAbstract, proposalType, aiSummary]);

  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      try {
        posthog?.capture('rationale_draft_copied', { drepId, proposalType });
      } catch {}
    } catch {
      /* ignore */
    }
  }, [draft, drepId, proposalType]);

  if (!generated) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Rationale Assistant</span>
          <Badge variant="outline" className="text-[10px]">
            AI
          </Badge>
          <Badge
            variant="outline"
            className="text-[10px] bg-primary/10 text-primary border-primary/30"
          >
            Pro
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Generate a structured rationale draft based on this proposal and your DRep profile. Edit
          it before copying to GovTool.
        </p>
        <Button
          onClick={generateDraft}
          disabled={loading}
          size="sm"
          variant="outline"
          className="gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating...
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5" /> Generate Draft
            </>
          )}
        </Button>
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Rationale Draft</span>
          <Badge variant="outline" className="text-[10px]">
            AI
          </Badge>
          <Badge
            variant="outline"
            className="text-[10px] bg-primary/10 text-primary border-primary/30"
          >
            Pro
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button
            onClick={generateDraft}
            disabled={loading}
            size="sm"
            variant="ghost"
            className="h-7 gap-1 text-xs"
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RotateCcw className="h-3 w-3" />
            )}
            Regenerate
          </Button>
          <Button
            onClick={copyToClipboard}
            size="sm"
            variant="outline"
            className="h-7 gap-1 text-xs"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </div>
      </div>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="w-full min-h-[200px] rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
        placeholder="Your rationale draft will appear here..."
      />
      <p className="text-[10px] text-muted-foreground">
        Edit the draft above, then copy and paste into GovTool when casting your vote. This is
        AI-generated — always review before submitting.
      </p>
    </div>
  );
}
