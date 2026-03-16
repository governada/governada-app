'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, FileText, ExternalLink } from 'lucide-react';
import { MarkdownRenderer } from '@/components/shared/MarkdownRenderer';
import { AnnotatableText } from './AnnotatableText';
import { FeatureGate } from '@/components/FeatureGate';
import {
  useAnnotations,
  useCreateAnnotation,
  useUpdateAnnotation,
  useDeleteAnnotation,
} from '@/hooks/useAnnotations';
import { trackSectionRead } from '@/lib/workspace/engagement';
import type { AnnotationField, ProposalAnnotation, AnnotationType } from '@/lib/workspace/types';

interface ProposalContentProps {
  abstract: string | null;
  motivation: string | null;
  rationale: string | null;
  references: Array<{ type: string; label: string; uri: string }> | null;
  /** Required for annotations — proposal tx hash */
  proposalTxHash?: string;
  /** Required for annotations — proposal index */
  proposalIndex?: number;
  /** Current user ID for annotation ownership */
  currentUserId?: string;
  /** User segment for engagement tracking */
  userSegment?: string;
}

interface CollapsibleSectionProps {
  title: string;
  content: string | null;
  defaultExpanded?: boolean;
  /** When provided, renders AnnotatableText instead of MarkdownRenderer */
  field?: AnnotationField;
  proposalTxHash?: string;
  proposalIndex?: number;
  annotations?: ProposalAnnotation[];
  currentUserId?: string;
  onCreateAnnotation?: (annotation: {
    proposalTxHash: string;
    proposalIndex: number;
    anchorStart: number;
    anchorEnd: number;
    anchorField: AnnotationField;
    annotationText: string;
    annotationType: AnnotationType;
    isPublic?: boolean;
  }) => void;
  onUpdateAnnotation?: (
    id: string,
    updates: Partial<Pick<ProposalAnnotation, 'annotationText' | 'isPublic' | 'color'>>,
  ) => void;
  onDeleteAnnotation?: (id: string) => void;
  onSectionExpanded?: (field: string) => void;
}

function CollapsibleSection({
  title,
  content,
  defaultExpanded = false,
  field,
  proposalTxHash,
  proposalIndex,
  annotations,
  currentUserId,
  onCreateAnnotation,
  onUpdateAnnotation,
  onDeleteAnnotation,
  onSectionExpanded,
}: CollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const expandedAtRef = useRef<number | null>(null);
  const charCount = content?.length ?? 0;

  const handleToggle = useCallback(() => {
    const next = !expanded;
    setExpanded(next);
    if (next && field) {
      onSectionExpanded?.(field);
      expandedAtRef.current = Date.now();
    } else if (!next && expandedAtRef.current) {
      expandedAtRef.current = null;
    }
  }, [expanded, field, onSectionExpanded]);

  // Track section read on initial expand for defaultExpanded sections
  useEffect(() => {
    if (defaultExpanded && field) {
      expandedAtRef.current = Date.now();
    }
  }, [defaultExpanded, field]);

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

  const canAnnotate =
    field &&
    proposalTxHash &&
    proposalIndex != null &&
    onCreateAnnotation &&
    onUpdateAnnotation &&
    onDeleteAnnotation;

  return (
    <div className="border-b border-border/40 last:border-b-0 py-3 first:pt-0">
      <button
        onClick={handleToggle}
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
          {canAnnotate ? (
            <FeatureGate
              flag="review_inline_annotations"
              fallback={<MarkdownRenderer content={content} compact />}
            >
              <AnnotatableText
                text={content}
                field={field}
                proposalTxHash={proposalTxHash}
                proposalIndex={proposalIndex!}
                annotations={annotations?.filter((a) => a.anchorField === field) ?? []}
                currentUserId={currentUserId}
                onCreateAnnotation={onCreateAnnotation}
                onUpdateAnnotation={onUpdateAnnotation}
                onDeleteAnnotation={onDeleteAnnotation}
              />
            </FeatureGate>
          ) : (
            <MarkdownRenderer content={content} compact />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * ProposalContent — renders full proposal document.
 *
 * When proposalTxHash/proposalIndex are provided, sections use AnnotatableText
 * (behind the review_inline_annotations feature flag) instead of plain MarkdownRenderer.
 * Sections: Abstract (always expanded), Motivation, Rationale, References.
 */
export function ProposalContent({
  abstract,
  motivation,
  rationale,
  references,
  proposalTxHash,
  proposalIndex,
  currentUserId,
  userSegment,
}: ProposalContentProps) {
  const hasContent = abstract || motivation || rationale || (references && references.length > 0);

  // Fetch annotations when proposal identity is available
  const annotationsEnabled = !!proposalTxHash && proposalIndex != null;
  const { data: annotations } = useAnnotations(
    annotationsEnabled ? proposalTxHash : null,
    annotationsEnabled ? proposalIndex : null,
  );

  const createMutation = useCreateAnnotation();
  const updateMutation = useUpdateAnnotation();
  const deleteMutation = useDeleteAnnotation();

  const handleCreate = useCallback(
    (annotation: {
      proposalTxHash: string;
      proposalIndex: number;
      anchorStart: number;
      anchorEnd: number;
      anchorField: AnnotationField;
      annotationText: string;
      annotationType: AnnotationType;
      isPublic?: boolean;
    }) => {
      createMutation.mutate(annotation);
    },
    [createMutation],
  );

  const handleUpdate = useCallback(
    (
      id: string,
      updates: Partial<Pick<ProposalAnnotation, 'annotationText' | 'isPublic' | 'color'>>,
    ) => {
      if (!proposalTxHash || proposalIndex == null) return;
      updateMutation.mutate({
        id,
        proposalTxHash,
        proposalIndex,
        annotationText: updates.annotationText ?? undefined,
        isPublic: updates.isPublic ?? undefined,
        color: updates.color ?? undefined,
      });
    },
    [updateMutation, proposalTxHash, proposalIndex],
  );

  const handleDelete = useCallback(
    (id: string) => {
      if (!proposalTxHash || proposalIndex == null) return;
      deleteMutation.mutate({ id, proposalTxHash, proposalIndex });
    },
    [deleteMutation, proposalTxHash, proposalIndex],
  );

  const handleSectionExpanded = useCallback(
    (field: string) => {
      if (proposalTxHash && proposalIndex != null) {
        trackSectionRead(proposalTxHash, proposalIndex, field, 0, userSegment);
      }
    },
    [proposalTxHash, proposalIndex, userSegment],
  );

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
        <CollapsibleSection
          title="Abstract"
          content={abstract}
          defaultExpanded
          field="abstract"
          proposalTxHash={proposalTxHash}
          proposalIndex={proposalIndex}
          annotations={annotations ?? []}
          currentUserId={currentUserId}
          onCreateAnnotation={handleCreate}
          onUpdateAnnotation={handleUpdate}
          onDeleteAnnotation={handleDelete}
          onSectionExpanded={handleSectionExpanded}
        />

        <CollapsibleSection
          title="Motivation"
          content={motivation}
          defaultExpanded={!motivation || motivation.length < 500}
          field="motivation"
          proposalTxHash={proposalTxHash}
          proposalIndex={proposalIndex}
          annotations={annotations ?? []}
          currentUserId={currentUserId}
          onCreateAnnotation={handleCreate}
          onUpdateAnnotation={handleUpdate}
          onDeleteAnnotation={handleDelete}
          onSectionExpanded={handleSectionExpanded}
        />

        <CollapsibleSection
          title="Rationale"
          content={rationale}
          defaultExpanded={!rationale || rationale.length < 500}
          field="rationale"
          proposalTxHash={proposalTxHash}
          proposalIndex={proposalIndex}
          annotations={annotations ?? []}
          currentUserId={currentUserId}
          onCreateAnnotation={handleCreate}
          onUpdateAnnotation={handleUpdate}
          onDeleteAnnotation={handleDelete}
          onSectionExpanded={handleSectionExpanded}
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
