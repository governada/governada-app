'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, FileText, ExternalLink } from 'lucide-react';
import { MarkdownRenderer } from '@/components/shared/MarkdownRenderer';

interface ProposalContentProps {
  abstract: string | null;
  motivation: string | null;
  rationale: string | null;
  references: Array<{ type: string; label: string; uri: string }> | null;
}

interface CollapsibleSectionProps {
  title: string;
  content: string | null;
  defaultExpanded?: boolean;
}

function CollapsibleSection({ title, content, defaultExpanded = false }: CollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const charCount = content?.length ?? 0;

  if (!content) {
    return (
      <div className="border-b border-border/40 last:border-b-0 py-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-foreground">{title}</h4>
          <span className="text-xs text-muted-foreground italic">Not provided</span>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-border/40 last:border-b-0 py-3 first:pt-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-left group"
        aria-expanded={expanded}
        aria-label={`${expanded ? 'Collapse' : 'Expand'} ${title}`}
      >
        <h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
          {title}
        </h4>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {charCount.toLocaleString()} chars
          </span>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>
      {expanded && (
        <div className="mt-2">
          <MarkdownRenderer content={content} compact />
        </div>
      )}
    </div>
  );
}

/**
 * ProposalContent — renders full proposal document using MarkdownRenderer.
 * Sections: Abstract (always expanded), Motivation, Rationale, References.
 */
export function ProposalContent({
  abstract,
  motivation,
  rationale,
  references,
}: ProposalContentProps) {
  const hasContent = abstract || motivation || rationale || (references && references.length > 0);

  if (!hasContent) {
    return (
      <div className="rounded-lg border border-border/50 bg-muted/10 p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="h-4 w-4" />
          No proposal content available. View the anchor URL for the full document.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/50 bg-card">
      <div className="px-4 py-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Proposal Document</h3>
        </div>
      </div>

      <div className="px-4">
        <CollapsibleSection title="Abstract" content={abstract} defaultExpanded />

        <CollapsibleSection
          title="Motivation"
          content={motivation}
          defaultExpanded={!motivation || motivation.length < 500}
        />

        <CollapsibleSection
          title="Rationale"
          content={rationale}
          defaultExpanded={!rationale || rationale.length < 500}
        />

        {/* References */}
        {references && references.length > 0 && (
          <div className="py-3">
            <h4 className="text-sm font-semibold text-foreground mb-2">References</h4>
            <ul className="space-y-1.5">
              {references.map((ref, i) => (
                <li key={i} className="flex items-start gap-2">
                  <ExternalLink className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    {ref.uri ? (
                      <a
                        href={ref.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline break-all"
                      >
                        {ref.label || ref.uri}
                      </a>
                    ) : (
                      <span className="text-sm text-foreground/80">{ref.label}</span>
                    )}
                    {ref.type && ref.type !== 'Other' && (
                      <span className="ml-2 text-[10px] text-muted-foreground">({ref.type})</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
