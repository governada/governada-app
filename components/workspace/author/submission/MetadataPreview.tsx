'use client';

/**
 * Metadata Preview — Step 2 of the submission ceremony.
 *
 * Shows the exact CIP-108 JSON-LD document that will be published permanently.
 * Uses the useCip108Preview() hook to generate the preview from draft content.
 */

import { useEffect } from 'react';
import { ArrowRight, ArrowLeft, Loader2, FileCode, Hash, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCip108Preview } from '@/hooks/useDrafts';
import { BASE_URL } from '@/lib/constants';
import type { ProposalDraft } from '@/lib/workspace/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MetadataPreviewProps {
  draft: ProposalDraft;
  onContinue: () => void;
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MetadataPreview({ draft, onContinue, onBack }: MetadataPreviewProps) {
  const { mutate: generatePreview, data, isPending } = useCip108Preview();

  // Generate preview on mount
  useEffect(() => {
    generatePreview({
      title: draft.title,
      abstract: draft.abstract || undefined,
      motivation: draft.motivation || undefined,
      rationale: draft.rationale || undefined,
    });
  }, [draft.title, draft.abstract, draft.motivation, draft.rationale, generatePreview]);

  const anchorUrl = `${BASE_URL}/api/workspace/cip108/${draft.id}`;

  if (isPending || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--compass-teal)]" />
        <p className="text-sm text-muted-foreground">Generating metadata preview...</p>
      </div>
    );
  }

  const jsonString = JSON.stringify(data.document, null, 2);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-display font-semibold text-foreground mb-1">
          Metadata Preview
        </h2>
        <p className="text-sm text-muted-foreground">
          This is the governance metadata that will be published permanently. Review it carefully.
        </p>
      </div>

      {/* ── JSON Viewer ── */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/50">
          <FileCode className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">CIP-108 JSON-LD</span>
        </div>
        <div className="max-h-[400px] overflow-auto">
          <pre className="p-4 text-xs font-mono text-foreground whitespace-pre-wrap break-words leading-relaxed">
            {jsonString}
          </pre>
        </div>
      </div>

      {/* ── Anchor URL & Hash ── */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Anchor URL</span>
          </div>
          <code className="text-xs text-foreground break-all">{anchorUrl}</code>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Hash className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">
              Content Hash (blake2b-256)
            </span>
          </div>
          <code className="text-xs text-foreground break-all font-mono">{data.contentHash}</code>
        </div>
      </div>

      {/* ── Navigation ── */}
      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={onBack} className="flex-1">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button onClick={onContinue} className="flex-1">
          Continue
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
