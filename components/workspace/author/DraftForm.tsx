'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUpdateDraft } from '@/hooks/useDrafts';
import { DeduplicationBanner } from './DeduplicationBanner';
import { ProvenanceBadge } from '@/components/workspace/shared/ProvenanceBadge';
import { SectionHealthBadge } from '@/components/workspace/shared/SectionHealthBadge';
import { InlineImprovePopover } from './InlineImprovePopover';
import { AIProvenanceDiff } from './AIProvenanceDiff';
import { useFeatureFlag } from '@/components/FeatureGate';
import { Keyboard } from 'lucide-react';
import { posthog } from '@/lib/posthog';
import { getDraftAIMeta } from '@/lib/workspace/types';
import type { ProposalDraft } from '@/lib/workspace/types';
import type { SectionAnalysisOutput } from '@/lib/ai/skills/section-analysis';

interface DraftFormProps {
  draft: ProposalDraft;
  readOnly?: boolean;
  sectionResults?: Record<string, SectionAnalysisOutput | null>;
  sectionLoading?: Record<string, boolean>;
  onFieldAnalyze?: (field: 'abstract' | 'motivation' | 'rationale') => void;
}

type SaveStatus = 'saved' | 'saving' | 'unsaved';

/** Simple character-level edit distance as a percentage (0 = identical, 100 = completely different). */
function computeEditDistance(original: string, current: string): number {
  if (!original && !current) return 0;
  if (original === current) return 0;
  const maxLen = Math.max(original.length, current.length);
  if (maxLen === 0) return 0;
  let changes = 0;
  const minLen = Math.min(original.length, current.length);
  for (let i = 0; i < minLen; i++) {
    if (original[i] !== current[i]) changes++;
  }
  changes += Math.abs(original.length - current.length);
  return Math.round((changes / maxLen) * 100);
}

export function DraftForm({
  draft,
  readOnly = false,
  sectionResults,
  sectionLoading,
  onFieldAnalyze,
}: DraftFormProps) {
  const updateDraft = useUpdateDraft(draft.id);
  const aiMeta = getDraftAIMeta(draft.typeSpecific);

  // AI provenance diff dialog
  const [showProvenanceDiff, setShowProvenanceDiff] = useState(false);

  // Ctrl+I keyboard hint (shown once per session)
  const [showCtrlIHint, setShowCtrlIHint] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !sessionStorage.getItem('ctrlIHintDismissed');
  });

  // Local form state
  const [title, setTitle] = useState(draft.title);
  const [abstract, setAbstract] = useState(draft.abstract);
  const [motivation, setMotivation] = useState(draft.motivation);
  const [rationale, setRationale] = useState(draft.rationale);
  const [typeSpecific, setTypeSpecific] = useState<Record<string, unknown>>(
    draft.typeSpecific ?? {},
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');

  // Inline improve (Ctrl+I)
  const inlineIntelEnabled = useFeatureFlag('author_inline_intelligence');
  const [improveState, setImproveState] = useState<{
    selectedText: string;
    surroundingContext: string;
    position: { top: number; left: number };
    field: 'abstract' | 'motivation' | 'rationale';
    selectionStart: number;
    selectionEnd: number;
  } | null>(null);

  // Track if any field was changed since last save
  const dirtyRef = useRef(false);

  // Sync from server on fresh data
  useEffect(() => {
    setTitle(draft.title);
    setAbstract(draft.abstract);
    setMotivation(draft.motivation);
    setRationale(draft.rationale);
    setTypeSpecific(draft.typeSpecific ?? {});
    setSaveStatus('saved');
    dirtyRef.current = false;
  }, [
    draft.id,
    draft.updatedAt,
    draft.title,
    draft.abstract,
    draft.motivation,
    draft.rationale,
    draft.typeSpecific,
  ]);

  const markDirty = useCallback(() => {
    if (!dirtyRef.current) {
      dirtyRef.current = true;
      setSaveStatus('unsaved');
    }
  }, []);

  const handleSave = useCallback(
    async (fields: Record<string, unknown>) => {
      if (!dirtyRef.current || readOnly) return;
      setSaveStatus('saving');
      try {
        await updateDraft.mutateAsync(fields);
        dirtyRef.current = false;
        setSaveStatus('saved');
      } catch {
        setSaveStatus('unsaved');
      }
    },
    [updateDraft, readOnly],
  );

  const handleFieldBlur = useCallback(
    (field?: 'abstract' | 'motivation' | 'rationale') => {
      if (!dirtyRef.current || readOnly) return;
      handleSave({
        title,
        abstract,
        motivation,
        rationale,
        typeSpecific: Object.keys(typeSpecific).length > 0 ? typeSpecific : undefined,
      });
      if (field && onFieldAnalyze) onFieldAnalyze(field);
    },
    [title, abstract, motivation, rationale, typeSpecific, handleSave, readOnly, onFieldAnalyze],
  );

  const handleCtrlI = useCallback(
    (
      e: React.KeyboardEvent<HTMLTextAreaElement>,
      field: 'abstract' | 'motivation' | 'rationale',
    ) => {
      if (!(e.ctrlKey || e.metaKey) || e.key !== 'i' || !inlineIntelEnabled) return;
      e.preventDefault();
      // Dismiss keyboard hint permanently
      if (showCtrlIHint) {
        setShowCtrlIHint(false);
        try {
          sessionStorage.setItem('ctrlIHintDismissed', '1');
        } catch {
          // SSR or storage unavailable
        }
      }
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      if (start === end) return; // no selection

      const text = textarea.value;
      const selectedText = text.slice(start, end);
      const contextStart = Math.max(0, start - 300);
      const contextEnd = Math.min(text.length, end + 300);
      const surroundingContext = text.slice(contextStart, contextEnd);

      const rect = textarea.getBoundingClientRect();
      setImproveState({
        selectedText,
        surroundingContext,
        position: { top: rect.bottom + 8, left: rect.left },
        field,
        selectionStart: start,
        selectionEnd: end,
      });
    },
    [inlineIntelEnabled, setImproveState, showCtrlIHint, setShowCtrlIHint],
  );

  const handleAcceptImprove = useCallback(
    (improvedText: string) => {
      if (!improveState) return;
      const { field, selectionStart, selectionEnd } = improveState;
      const setter =
        field === 'abstract' ? setAbstract : field === 'motivation' ? setMotivation : setRationale;
      setter((prev) => prev.slice(0, selectionStart) + improvedText + prev.slice(selectionEnd));
      markDirty();
      setImproveState(null);
    },
    [improveState, markDirty, setAbstract, setMotivation, setRationale, setImproveState],
  );

  // Deduplication banner handler (community_review, non-owner)
  const showDeduplication = draft.status === 'community_review' && !readOnly;

  const scrollToReviewSection = useCallback(() => {
    // The ReviewRubric lives in the same parent (DraftEditor) above DraftForm
    const rubric = document.querySelector('[data-review-rubric]');
    if (rubric) {
      rubric.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Focus the first textarea in the rubric
      const textarea = rubric.querySelector('textarea');
      if (textarea) setTimeout(() => textarea.focus(), 400);
    }
  }, []);

  const handleEndorse = useCallback(
    (themes: string[]) => {
      try {
        posthog?.capture('deduplication_themes_endorsed', {
          draftId: draft.id,
          themeCount: themes.length,
        });
      } catch {
        // Non-critical
      }
      scrollToReviewSection();
    },
    [draft.id, scrollToReviewSection],
  );

  const handleAddNew = useCallback(() => {
    try {
      posthog?.capture('deduplication_add_new_clicked', { draftId: draft.id });
    } catch {
      // Non-critical
    }
    scrollToReviewSection();
  }, [draft.id, scrollToReviewSection]);

  return (
    <div className="space-y-5">
      {/* Deduplication banner for non-owners during community review */}
      {showDeduplication && (
        <DeduplicationBanner draftId={draft.id} onEndorse={handleEndorse} onAddNew={handleAddNew} />
      )}

      {/* Save status indicator */}
      {!readOnly && (
        <div className="flex justify-end">
          <span
            className={`text-xs font-medium ${
              saveStatus === 'saved'
                ? 'text-emerald-600 dark:text-emerald-400'
                : saveStatus === 'saving'
                  ? 'text-muted-foreground'
                  : 'text-amber-600 dark:text-amber-400'
            }`}
          >
            {saveStatus === 'saved' && 'Saved'}
            {saveStatus === 'saving' && 'Saving...'}
            {saveStatus === 'unsaved' && 'Unsaved changes'}
          </span>
        </div>
      )}

      {readOnly && (
        <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
          This draft is read-only in its current stage.
        </div>
      )}

      {/* Title */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Label htmlFor="draft-title">Title</Label>
          {aiMeta?.fieldsGenerated.includes('title') && (
            <button
              type="button"
              onClick={() => setShowProvenanceDiff(true)}
              className="cursor-pointer"
              title="View AI draft changes"
            >
              <ProvenanceBadge
                model={aiMeta.model}
                keySource={aiMeta.keySource}
                skillName={aiMeta.skillName}
                editDistance={computeEditDistance(aiMeta.originalText.title, title)}
              />
            </button>
          )}
        </div>
        <Input
          id="draft-title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            markDirty();
          }}
          onBlur={() => handleFieldBlur()}
          maxLength={200}
          placeholder="Proposal title"
          disabled={readOnly}
        />
        <CharCount current={title.length} max={200} />
      </div>

      {/* Abstract */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Label htmlFor="draft-abstract">Abstract</Label>
          {aiMeta?.fieldsGenerated.includes('abstract') && (
            <ProvenanceBadge
              model={aiMeta.model}
              keySource={aiMeta.keySource}
              skillName={aiMeta.skillName}
              editDistance={computeEditDistance(aiMeta.originalText.abstract, abstract)}
            />
          )}
          <SectionHealthBadge
            quality={sectionResults?.abstract?.overallQuality ?? null}
            loading={sectionLoading?.abstract ?? false}
            flagCount={sectionResults?.abstract?.constitutionalFlags?.length}
            gapCount={sectionResults?.abstract?.completenessGaps?.length}
          />
        </div>
        <Textarea
          id="draft-abstract"
          value={abstract}
          onChange={(e) => {
            setAbstract(e.target.value);
            markDirty();
          }}
          onBlur={() => handleFieldBlur('abstract')}
          onKeyDown={(e) => handleCtrlI(e, 'abstract')}
          maxLength={2000}
          rows={4}
          placeholder="Brief summary of what this proposal does"
          disabled={readOnly}
        />
        <CharCount current={abstract.length} max={2000} />
        {showCtrlIHint && inlineIntelEnabled && !readOnly && (
          <p className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
            <Keyboard className="h-3 w-3" />
            Select text +{' '}
            <kbd className="rounded border border-border/50 px-1 py-0.5 font-mono text-[9px]">
              Ctrl+I
            </kbd>{' '}
            to improve with AI
          </p>
        )}
      </div>

      {/* Motivation */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Label htmlFor="draft-motivation">Motivation</Label>
          {aiMeta?.fieldsGenerated.includes('motivation') && (
            <ProvenanceBadge
              model={aiMeta.model}
              keySource={aiMeta.keySource}
              skillName={aiMeta.skillName}
              editDistance={computeEditDistance(aiMeta.originalText.motivation, motivation)}
            />
          )}
          <SectionHealthBadge
            quality={sectionResults?.motivation?.overallQuality ?? null}
            loading={sectionLoading?.motivation ?? false}
            flagCount={sectionResults?.motivation?.constitutionalFlags?.length}
            gapCount={sectionResults?.motivation?.completenessGaps?.length}
          />
        </div>
        <Textarea
          id="draft-motivation"
          value={motivation}
          onChange={(e) => {
            setMotivation(e.target.value);
            markDirty();
          }}
          onBlur={() => handleFieldBlur('motivation')}
          onKeyDown={(e) => handleCtrlI(e, 'motivation')}
          maxLength={10000}
          rows={8}
          placeholder="Why is this proposal needed? What problem does it solve?"
          disabled={readOnly}
        />
        <CharCount current={motivation.length} max={10000} />
      </div>

      {/* Rationale */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Label htmlFor="draft-rationale">Rationale</Label>
          {aiMeta?.fieldsGenerated.includes('rationale') && (
            <ProvenanceBadge
              model={aiMeta.model}
              keySource={aiMeta.keySource}
              skillName={aiMeta.skillName}
              editDistance={computeEditDistance(aiMeta.originalText.rationale, rationale)}
            />
          )}
          <SectionHealthBadge
            quality={sectionResults?.rationale?.overallQuality ?? null}
            loading={sectionLoading?.rationale ?? false}
            flagCount={sectionResults?.rationale?.constitutionalFlags?.length}
            gapCount={sectionResults?.rationale?.completenessGaps?.length}
          />
        </div>
        <Textarea
          id="draft-rationale"
          value={rationale}
          onChange={(e) => {
            setRationale(e.target.value);
            markDirty();
          }}
          onBlur={() => handleFieldBlur('rationale')}
          onKeyDown={(e) => handleCtrlI(e, 'rationale')}
          maxLength={10000}
          rows={8}
          placeholder="Why is this the right approach? Why should DReps vote Yes?"
          disabled={readOnly}
        />
        <CharCount current={rationale.length} max={10000} />
      </div>

      {/* Type-specific fields */}
      {draft.proposalType === 'TreasuryWithdrawals' && (
        <TreasuryFields
          typeSpecific={typeSpecific}
          onChange={(ts) => {
            setTypeSpecific(ts);
            markDirty();
          }}
          onBlur={() => handleFieldBlur()}
          readOnly={readOnly}
        />
      )}
      {draft.proposalType === 'ParameterChange' && (
        <ParameterChangeFields
          typeSpecific={typeSpecific}
          onChange={(ts) => {
            setTypeSpecific(ts);
            markDirty();
          }}
          onBlur={() => handleFieldBlur()}
          readOnly={readOnly}
        />
      )}

      {/* Inline improve popover (Ctrl+I) */}
      {improveState && (
        <InlineImprovePopover
          selectedText={improveState.selectedText}
          surroundingContext={improveState.surroundingContext}
          proposalType={draft.proposalType}
          position={improveState.position}
          draftId={draft.id}
          onAccept={handleAcceptImprove}
          onDismiss={() => setImproveState(null)}
        />
      )}

      {/* AI provenance diff dialog */}
      {aiMeta && (
        <AIProvenanceDiff
          open={showProvenanceDiff}
          onOpenChange={setShowProvenanceDiff}
          aiMeta={aiMeta}
          currentText={{ title, abstract, motivation, rationale }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Character count
// ---------------------------------------------------------------------------

function CharCount({ current, max }: { current: number; max: number }) {
  return (
    <p
      className={`text-xs ${current > max * 0.9 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}
    >
      {current} / {max}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Type-specific field sets
// ---------------------------------------------------------------------------

interface TypeSpecificFieldsProps {
  typeSpecific: Record<string, unknown>;
  onChange: (ts: Record<string, unknown>) => void;
  onBlur: () => void;
  readOnly?: boolean;
}

function TreasuryFields({ typeSpecific, onChange, onBlur, readOnly }: TypeSpecificFieldsProps) {
  return (
    <div className="space-y-4 border-t pt-4">
      <h3 className="text-sm font-semibold text-muted-foreground">Treasury Details</h3>
      <div className="space-y-1.5">
        <Label htmlFor="ts-amount">Withdrawal Amount (ADA)</Label>
        <Input
          id="ts-amount"
          type="number"
          min={0}
          value={(typeSpecific.withdrawalAmountAda as number) ?? ''}
          onChange={(e) =>
            onChange({
              ...typeSpecific,
              withdrawalAmountAda: e.target.value ? Number(e.target.value) : undefined,
            })
          }
          onBlur={onBlur}
          placeholder="e.g. 100000"
          disabled={readOnly}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ts-address">Receiving Address</Label>
        <Input
          id="ts-address"
          value={(typeSpecific.receivingAddress as string) ?? ''}
          onChange={(e) => onChange({ ...typeSpecific, receivingAddress: e.target.value })}
          onBlur={onBlur}
          placeholder="addr1..."
          disabled={readOnly}
        />
      </div>
    </div>
  );
}

const COMMON_PARAMETERS = [
  'maxBlockBodySize',
  'maxTxSize',
  'maxBlockHeaderSize',
  'keyDeposit',
  'poolDeposit',
  'eMax',
  'nOpt',
  'a0',
  'rho',
  'tau',
  'minPoolCost',
  'coinsPerUTxOByte',
  'maxCollateralInputs',
  'maxValSize',
  'collateralPercentage',
  'govActionLifetime',
  'govActionDeposit',
  'dRepDeposit',
  'dRepActivity',
  'committeeMinSize',
  'committeeMaxTermLength',
];

function ParameterChangeFields({
  typeSpecific,
  onChange,
  onBlur,
  readOnly,
}: TypeSpecificFieldsProps) {
  return (
    <div className="space-y-4 border-t pt-4">
      <h3 className="text-sm font-semibold text-muted-foreground">Parameter Change Details</h3>
      <div className="space-y-1.5">
        <Label htmlFor="ts-param">Parameter Name</Label>
        <Select
          value={(typeSpecific.parameterName as string) ?? ''}
          onValueChange={(value) => {
            onChange({ ...typeSpecific, parameterName: value });
            onBlur();
          }}
          disabled={readOnly}
        >
          <SelectTrigger id="ts-param" aria-label="Select protocol parameter">
            <SelectValue placeholder="Select a parameter..." />
          </SelectTrigger>
          <SelectContent>
            {COMMON_PARAMETERS.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ts-value">Proposed Value</Label>
        <Input
          id="ts-value"
          value={(typeSpecific.proposedValue as string) ?? ''}
          onChange={(e) => onChange({ ...typeSpecific, proposedValue: e.target.value })}
          onBlur={onBlur}
          placeholder="New value for the parameter"
          disabled={readOnly}
        />
      </div>
    </div>
  );
}
