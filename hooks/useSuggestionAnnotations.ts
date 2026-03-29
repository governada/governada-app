'use client';

import { useMemo, useCallback } from 'react';
import { useAnnotations, useCreateAnnotation, useUpdateAnnotation } from './useAnnotations';
import type { ProposalAnnotation, AnnotationField, SuggestedText } from '@/lib/workspace/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SuggestionAnnotation extends ProposalAnnotation {
  annotationType: 'suggestion';
  suggestedText: SuggestedText;
}

function isSuggestion(a: ProposalAnnotation): a is SuggestionAnnotation {
  return a.annotationType === 'suggestion' && a.suggestedText !== null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSuggestionAnnotations(
  txHash: string | null | undefined,
  index: number | null | undefined,
) {
  const { data: annotations, isLoading } = useAnnotations(txHash, index);
  const createAnnotation = useCreateAnnotation();
  const updateAnnotation = useUpdateAnnotation();

  // Filter to only active suggestion annotations
  const suggestions = useMemo(() => {
    if (!annotations) return [];
    return annotations.filter(
      (a): a is SuggestionAnnotation => isSuggestion(a) && a.status === 'active',
    );
  }, [annotations]);

  // All suggestions including resolved (for history)
  const allSuggestions = useMemo(() => {
    if (!annotations) return [];
    return annotations.filter(isSuggestion);
  }, [annotations]);

  // Create a new suggestion
  const createSuggestion = useCallback(
    (params: {
      anchorField: AnnotationField;
      anchorStart: number;
      anchorEnd: number;
      original: string;
      proposed: string;
      explanation: string;
    }) => {
      if (!txHash || index === null || index === undefined) return;

      return createAnnotation.mutateAsync({
        proposalTxHash: txHash,
        proposalIndex: index,
        anchorField: params.anchorField,
        anchorStart: params.anchorStart,
        anchorEnd: params.anchorEnd,
        annotationText: params.explanation,
        annotationType: 'suggestion',
        isPublic: true,
        suggestedText: {
          original: params.original,
          proposed: params.proposed,
          explanation: params.explanation,
        },
      });
    },
    [txHash, index, createAnnotation],
  );

  // Accept a suggestion (mark as accepted)
  const acceptSuggestion = useCallback(
    (annotationId: string) => {
      if (!txHash || index === null || index === undefined) return;

      return updateAnnotation.mutateAsync({
        id: annotationId,
        proposalTxHash: txHash,
        proposalIndex: index,
        status: 'accepted',
      });
    },
    [txHash, index, updateAnnotation],
  );

  // Reject a suggestion (mark as rejected)
  const rejectSuggestion = useCallback(
    (annotationId: string) => {
      if (!txHash || index === null || index === undefined) return;

      return updateAnnotation.mutateAsync({
        id: annotationId,
        proposalTxHash: txHash,
        proposalIndex: index,
        status: 'rejected',
      });
    },
    [txHash, index, updateAnnotation],
  );

  return {
    suggestions,
    allSuggestions,
    isLoading,
    createSuggestion,
    acceptSuggestion,
    rejectSuggestion,
    isCreating: createAnnotation.isPending,
    isUpdating: updateAnnotation.isPending,
  };
}
