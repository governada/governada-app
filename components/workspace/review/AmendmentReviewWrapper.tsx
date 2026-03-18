'use client';

/**
 * AmendmentReviewWrapper — Review-mode container for NewConstitution drafts.
 *
 * Renders the ConstitutionEditor in read-only mode with:
 * - Existing amendment changes applied (from draft.typeSpecific)
 * - Section sentiment widgets portalled into each section header
 * - Bridging statements + genealogy timeline in the studio intel panel
 * - Read-only proposal description card below the editor
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { FileText } from 'lucide-react';
import { ConstitutionEditor } from '@/components/workspace/editor/ConstitutionEditor';
import { SectionSentimentWidget } from '@/components/workspace/review/SectionSentimentWidget';
import { AmendmentGenealogyTimeline } from '@/components/workspace/review/AmendmentGenealogyTimeline';
import { BridgingStatementsCard } from '@/components/workspace/review/BridgingStatementsCard';
import { useAmendmentSentiment, useSubmitSentiment } from '@/hooks/useAmendmentSentiment';
import { useAmendmentGenealogy } from '@/hooks/useAmendmentGenealogy';
import { CONSTITUTION_NODES } from '@/lib/constitution/fullText';
import { extractAmendmentChanges } from '@/lib/constitution/utils';
import type { ProposalDraft } from '@/lib/workspace/types';
import type { AmendmentChange } from '@/lib/constitution/types';
import type { Editor } from '@tiptap/core';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AmendmentReviewWrapperProps {
  draft: ProposalDraft;
  draftId: string;
  currentUserId?: string;
}

// ---------------------------------------------------------------------------
// Sentiment portals — render widgets into DOM placeholders
// ---------------------------------------------------------------------------

interface SentimentPortalsProps {
  draftId: string;
  sectionIds: string[];
  sentimentData: Record<string, import('@/lib/constitution/types').SectionSentiment> | undefined;
  onVote: (
    sectionId: string,
    sentiment: 'support' | 'oppose' | 'neutral',
    comment?: string,
  ) => void;
  isVoting: boolean;
}

function SentimentPortals({
  draftId,
  sectionIds,
  sentimentData,
  onVote,
  isVoting,
}: SentimentPortalsProps) {
  const [containers, setContainers] = useState<Record<string, Element>>({});

  // Find the DOM placeholder elements after the editor renders
  useEffect(() => {
    const findSlots = () => {
      const found: Record<string, Element> = {};
      for (const id of sectionIds) {
        const el = document.querySelector(`.constitution-sentiment-slot[data-field="${id}"]`);
        if (el) found[id] = el;
      }
      setContainers(found);
    };

    // Initial scan + periodic retry (editor may take a moment to render)
    findSlots();
    const interval = setInterval(findSlots, 500);
    const timeout = setTimeout(() => clearInterval(interval), 5000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [sectionIds]);

  return (
    <>
      {Object.entries(containers).map(([sectionId, container]) =>
        createPortal(
          <SectionSentimentWidget
            draftId={draftId}
            sectionId={sectionId}
            sentiment={sentimentData?.[sectionId]}
            onVote={(sentiment, comment) => onVote(sectionId, sentiment, comment)}
            isVoting={isVoting}
          />,
          container,
          `sentiment-${sectionId}`,
        ),
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AmendmentReviewWrapper({
  draft,
  draftId,
  currentUserId,
}: AmendmentReviewWrapperProps) {
  const editorRef = useRef<Editor | null>(null);
  const [, setSelectedChangeId] = useState<string | undefined>(undefined);

  // Extract existing amendment changes from draft
  const existingChanges: AmendmentChange[] = useMemo(
    () => extractAmendmentChanges(draft.typeSpecific),
    [draft.typeSpecific],
  );

  // All section IDs (for sentiment widgets on every section)
  const allSectionIds = useMemo(() => CONSTITUTION_NODES.map((n) => n.id), []);

  // Hooks
  const { data: sentimentData } = useAmendmentSentiment(draftId);
  const submitSentiment = useSubmitSentiment();
  useAmendmentGenealogy(draftId); // prefetch for intel panel

  // Handle sentiment vote
  const handleVote = useCallback(
    (sectionId: string, sentiment: 'support' | 'oppose' | 'neutral', comment?: string) => {
      submitSentiment.mutate({ draftId, sectionId, sentiment, comment });
    },
    [draftId, submitSentiment],
  );

  // Handle editor ready
  const handleEditorReady = useCallback((editor: Editor) => {
    editorRef.current = editor;
  }, []);

  // Handle diff mark click — show genealogy for that change
  const handleDiffAccept = useCallback((editId: string) => {
    setSelectedChangeId(editId);
  }, []);

  const handleDiffReject = useCallback((editId: string) => {
    setSelectedChangeId(editId);
  }, []);

  return (
    <div className="space-y-6">
      {/* Constitution editor in review mode */}
      <ConstitutionEditor
        constitutionNodes={CONSTITUTION_NODES}
        existingChanges={existingChanges}
        mode="review"
        readOnly
        onEditorReady={handleEditorReady}
        onDiffAccept={handleDiffAccept}
        onDiffReject={handleDiffReject}
        currentUserId={currentUserId}
      />

      {/* Sentiment portals — render into section header placeholders */}
      <SentimentPortals
        draftId={draftId}
        sectionIds={allSectionIds}
        sentimentData={sentimentData?.sections}
        onVote={handleVote}
        isVoting={submitSentiment.isPending}
      />

      {/* Proposal description card (read-only) */}
      {(draft.title || draft.abstract || draft.motivation || draft.rationale) && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 bg-muted/20">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Proposal Description</span>
          </div>
          <div className="p-4 space-y-4">
            {draft.title && (
              <div>
                <h3 className="text-base font-semibold text-foreground">{draft.title}</h3>
              </div>
            )}
            {draft.abstract && (
              <div>
                <p className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider mb-1">
                  Abstract
                </p>
                <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                  {draft.abstract}
                </p>
              </div>
            )}
            {draft.motivation && (
              <div>
                <p className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider mb-1">
                  Motivation
                </p>
                <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                  {draft.motivation}
                </p>
              </div>
            )}
            {draft.rationale && (
              <div>
                <p className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider mb-1">
                  Rationale
                </p>
                <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                  {draft.rationale}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Intel content for StudioPanel — exported for use by ReviewWorkspace
// ---------------------------------------------------------------------------

export interface AmendmentIntelContentProps {
  draftId: string;
  amendments: AmendmentChange[];
  selectedChangeId?: string;
}

export function AmendmentIntelContent({
  draftId,
  amendments,
  selectedChangeId,
}: AmendmentIntelContentProps) {
  const { data: genealogyData } = useAmendmentGenealogy(draftId);

  return (
    <div className="space-y-4 p-3">
      {/* Bridging statements */}
      <BridgingStatementsCard draftId={draftId} amendments={amendments} />

      {/* Genealogy timeline */}
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
          <span className="text-sm font-medium text-foreground">Amendment History</span>
        </div>
        <div className="p-3">
          <AmendmentGenealogyTimeline
            entries={genealogyData?.entries ?? []}
            changeId={selectedChangeId}
          />
        </div>
      </div>
    </div>
  );
}
