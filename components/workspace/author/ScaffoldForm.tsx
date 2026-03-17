'use client';

/**
 * ScaffoldForm — guided prompt UI for AI-assisted proposal drafting.
 *
 * Shown when a draft is empty and the `author_ai_draft` flag is enabled.
 * Replaces the blank DraftForm with structured questions per proposal type,
 * then generates a CIP-108 compliant first draft via the AI skill system.
 */

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Sparkles, SkipForward } from 'lucide-react';
import { useAISkill } from '@/hooks/useAISkill';
import { useUpdateDraft } from '@/hooks/useDrafts';
import { SCAFFOLD_DEFINITIONS } from '@/lib/workspace/scaffolds';
import { PROPOSAL_TYPE_LABELS } from '@/lib/workspace/types';
import type { ProposalDraft, DraftAIMeta } from '@/lib/workspace/types';

interface ScaffoldFormProps {
  draft: ProposalDraft;
  /** Called after AI generates and saves, or when the user skips. */
  onComplete: () => void;
}

interface DraftGeneratorOutput {
  title: string;
  abstract: string;
  motivation: string;
  rationale: string;
  typeSpecific?: Record<string, unknown>;
}

export function ScaffoldForm({ draft, onComplete }: ScaffoldFormProps) {
  const scaffold = SCAFFOLD_DEFINITIONS[draft.proposalType];
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const skill = useAISkill<DraftGeneratorOutput>();
  const updateDraft = useUpdateDraft(draft.id);
  const isGenerating = skill.isPending || updateDraft.isPending;

  const requiredPrompts = scaffold.prompts.filter((p) => p.required);
  const allRequiredFilled = requiredPrompts.every((p) => (answers[p.key] ?? '').trim().length > 0);

  const handleAnswerChange = useCallback((key: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    setError(null);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!allRequiredFilled) return;
    setError(null);

    skill.mutate(
      {
        skill: 'proposal-draft-generator',
        input: {
          proposalType: draft.proposalType,
          scaffoldAnswers: answers,
        },
        draftId: draft.id,
      },
      {
        onSuccess: async (data) => {
          const { output, provenance } = data;

          // Build AI provenance metadata
          const aiMeta: DraftAIMeta = {
            generatedAt: provenance.executedAt,
            model: provenance.model,
            keySource: provenance.keySource,
            skillName: provenance.skillName,
            fieldsGenerated: ['title', 'abstract', 'motivation', 'rationale'],
            scaffoldAnswers: answers,
            originalText: {
              title: output.title,
              abstract: output.abstract,
              motivation: output.motivation,
              rationale: output.rationale,
            },
          };

          // Merge AI output + provenance into draft
          const mergedTypeSpecific = {
            ...(draft.typeSpecific ?? {}),
            ...(output.typeSpecific ?? {}),
            _aiMeta: aiMeta,
          };

          try {
            await updateDraft.mutateAsync({
              title: output.title,
              abstract: output.abstract,
              motivation: output.motivation,
              rationale: output.rationale,
              typeSpecific: mergedTypeSpecific,
            });
            onComplete();
          } catch {
            setError('Draft generated but failed to save. Please try again.');
          }
        },
        onError: (err) => {
          setError(err.message || 'Draft generation failed. Please try again.');
        },
      },
    );
  }, [allRequiredFilled, answers, draft, skill, updateDraft, onComplete]);

  const typeLabel = PROPOSAL_TYPE_LABELS[draft.proposalType] ?? draft.proposalType;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Let&apos;s build your {typeLabel}
            </CardTitle>
            <CardDescription className="mt-1.5">{scaffold.description}</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onComplete} disabled={isGenerating}>
            <SkipForward className="h-4 w-4 mr-1.5" />
            Skip to blank form
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Answer the questions below and we&apos;ll generate a CIP-108 compliant first draft. You
          can edit everything afterward.
        </p>

        {scaffold.prompts.map((prompt) => (
          <div key={prompt.key} className="space-y-1.5">
            <Label htmlFor={`scaffold-${prompt.key}`}>
              {prompt.label}
              {prompt.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Textarea
              id={`scaffold-${prompt.key}`}
              value={answers[prompt.key] ?? ''}
              onChange={(e) => handleAnswerChange(prompt.key, e.target.value)}
              rows={prompt.rows ?? 3}
              placeholder={prompt.placeholder}
              disabled={isGenerating}
            />
          </div>
        ))}

        {error && (
          <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <Button onClick={handleGenerate} disabled={!allRequiredFilled || isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating your draft...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Draft
              </>
            )}
          </Button>
          {!allRequiredFilled && (
            <span className="text-xs text-muted-foreground">
              Fill in required fields (*) to generate
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
