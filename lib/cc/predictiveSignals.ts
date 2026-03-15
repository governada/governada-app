/**
 * CC Predictive Signals — Constitutional Intelligence Pipeline (Chunk 7)
 *
 * Generates predictions for how the CC will vote on upcoming governance actions
 * based on member voting history, interpretation patterns, and bloc dynamics.
 */

import { generateJSON } from '@/lib/ai';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PredictionInput {
  proposalTitle: string;
  proposalType: string;
  relevantArticles: string[];
  memberHistories: string;
  blocSummary: string;
}

export interface PredictionResult {
  predicted_outcome: 'approve' | 'reject' | 'split';
  predicted_split: { yes: string[]; no: string[]; uncertain: string[] };
  confidence: number;
  reasoning: string;
  key_article: string;
  tension_flag: boolean;
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export async function generatePrediction(input: PredictionInput): Promise<PredictionResult | null> {
  const prompt = `You are predicting how the CC will vote on an upcoming governance action.

## Proposal
- Title: ${input.proposalTitle}
- Type: ${input.proposalType}
- Key constitutional articles: ${input.relevantArticles.join(', ') || 'None identified'}

## CC Members' Relevant History
${input.memberHistories}

## Bloc Dynamics
${input.blocSummary}

## Instructions
Predict:
1. **predicted_outcome**: 'approve' | 'reject' | 'split' (non-unanimous either way)
2. **predicted_split**: {yes: [member_names], no: [member_names], uncertain: [member_names]}
3. **confidence**: 0-100 (be honest — with <10 data points per member, confidence should rarely exceed 75)
4. **reasoning**: 2-3 sentences explaining the prediction basis. Reference specific prior votes and interpretations.
5. **key_article**: The constitutional article most likely to drive divergence.
6. **tension_flag**: true if predicted CC outcome diverges from likely DRep majority.

Return JSON. Mark members as 'uncertain' when their history on this proposal type is insufficient.`;

  try {
    const result = await generateJSON<PredictionResult>(prompt, {
      model: 'FAST',
      maxTokens: 1024,
      temperature: 0.2,
    });

    if (!result) {
      logger.warn('[predictive-signals] Prediction AI returned null', {
        proposal: input.proposalTitle,
      });
      return null;
    }

    // Validate required fields
    if (
      !result.predicted_outcome ||
      !result.predicted_split ||
      typeof result.confidence !== 'number' ||
      !result.reasoning
    ) {
      logger.warn('[predictive-signals] Prediction missing required fields', {
        proposal: input.proposalTitle,
      });
      return null;
    }

    // Cap confidence at 75 if there are fewer than 10 data points per member
    // (heuristic: if memberHistories is short, data is sparse)
    const lineCount = input.memberHistories.split('\n').filter((l) => l.trim().length > 0).length;
    const memberCount = (input.memberHistories.match(/^### /gm) || []).length || 1;
    const avgDataPoints = lineCount / memberCount;

    if (avgDataPoints < 10 && result.confidence > 75) {
      result.confidence = 75;
    }

    // Normalize outcome values
    const validOutcomes = ['approve', 'reject', 'split'] as const;
    if (!validOutcomes.includes(result.predicted_outcome)) {
      result.predicted_outcome = 'split';
    }

    return result;
  } catch (err) {
    logger.error('[predictive-signals] Prediction generation failed', {
      error: err instanceof Error ? err.message : String(err),
      proposal: input.proposalTitle,
    });
    return null;
  }
}
