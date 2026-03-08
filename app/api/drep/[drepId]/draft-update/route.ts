/**
 * AI Epoch Update Draft API
 * Generates an AI-drafted epoch update summarizing the DRep's governance
 * activity for a given epoch (defaults to the current epoch).
 *
 * POST /api/drep/[drepId]/draft-update
 * Body: { sessionToken: string; epoch?: number }
 * Returns: { draft: string; voteSummary: { total: number; yes: number; no: number; abstain: number } }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDRepById, getVotesByDRepId } from '@/lib/data';
import { generateText } from '@/lib/ai';
import { validateSessionToken } from '@/lib/supabaseAuth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { captureServerEvent } from '@/lib/posthog-server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { z } from 'zod';
import { SessionTokenSchema } from '@/lib/api/schemas/common';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Epoch derivation (same constants as lib/data.ts and lib/api/response.ts)
const SHELLEY_GENESIS = 1596491091;
const EPOCH_LEN = 432000;
const SHELLEY_BASE = 209;

function getCurrentEpoch(): number {
  return Math.floor((Date.now() / 1000 - SHELLEY_GENESIS) / EPOCH_LEN) + SHELLEY_BASE;
}

const DraftUpdateSchema = z.object({
  sessionToken: SessionTokenSchema,
  epoch: z.coerce.number().int().min(0).optional(),
});

export const POST = withRouteHandler(
  async (request: NextRequest) => {
    const drepId = decodeURIComponent(request.nextUrl.pathname.split('/')[3]);
    const body = await request.json();
    const { sessionToken, epoch } = DraftUpdateSchema.parse(body);

    // --- Auth: verify session and ownership ---
    const session = await validateSessionToken(sessionToken);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { data: user } = await supabase
      .from('users')
      .select('claimed_drep_id')
      .eq('wallet_address', session.walletAddress)
      .single();

    if (!user || user.claimed_drep_id !== drepId) {
      return NextResponse.json({ error: 'Not authorized for this DRep' }, { status: 403 });
    }

    // --- Determine epoch ---
    const targetEpoch = epoch ?? getCurrentEpoch();

    // --- Fetch vote data ---
    const allVotes = await getVotesByDRepId(drepId);
    const epochVotes = allVotes.filter((v) => v.epoch_no === targetEpoch);

    const voteSummary = {
      total: epochVotes.length,
      yes: epochVotes.filter((v) => v.vote === 'Yes').length,
      no: epochVotes.filter((v) => v.vote === 'No').length,
      abstain: epochVotes.filter((v) => v.vote === 'Abstain').length,
    };

    // --- Fetch DRep metadata for context ---
    const drep = await getDRepById(drepId);
    const metadata = drep?.metadata || {};
    const objectives = (metadata.objectives as string) || '';
    const motivations = (metadata.motivations as string) || '';
    const drepName = (metadata.givenName as string) || drep?.name || drep?.drepId || drepId;

    // --- Fetch proposal titles for voted proposals ---
    const proposalKeys = epochVotes.map((v) => `${v.proposal_tx_hash}#${v.proposal_index}`);
    const proposalTitles: Record<string, string> = {};

    if (proposalKeys.length > 0) {
      const txHashes = [...new Set(epochVotes.map((v) => v.proposal_tx_hash))];
      const { data: proposals } = await supabase
        .from('proposals')
        .select('tx_hash, index, title')
        .in('tx_hash', txHashes);

      if (proposals) {
        for (const p of proposals) {
          proposalTitles[`${p.tx_hash}#${p.index}`] = p.title || 'Untitled proposal';
        }
      }
    }

    // Build vote details for the prompt
    const voteDetails = epochVotes
      .map((v) => {
        const key = `${v.proposal_tx_hash}#${v.proposal_index}`;
        const title = proposalTitles[key] || 'Governance proposal';
        return `- ${title}: voted ${v.vote}`;
      })
      .join('\n');

    // --- Generate AI draft ---
    const drepContext = [
      objectives && `Stated objectives: ${objectives}`,
      motivations && `Motivations: ${motivations}`,
    ]
      .filter(Boolean)
      .join('\n');

    const prompt = `You are helping a Cardano DRep (Delegated Representative) named "${drepName}" write a concise epoch update for Epoch ${targetEpoch} to share with their delegators.

VOTING ACTIVITY THIS EPOCH:
Total votes cast: ${voteSummary.total}
Yes: ${voteSummary.yes} | No: ${voteSummary.no} | Abstain: ${voteSummary.abstain}
${voteDetails ? `\nDetailed votes:\n${voteDetails}` : '\nNo votes were cast this epoch.'}

${drepContext ? `DREP CONTEXT:\n${drepContext}\n` : ''}
Write a 2-3 paragraph epoch update that:
1. Summarizes the DRep's governance activity this epoch in a professional, first-person tone
2. Mentions specific proposals voted on and the rationale direction (without fabricating reasons — keep it factual based on the vote direction)
3. If no votes were cast, acknowledge it and note any relevant context (e.g., no active proposals, or a commitment to review upcoming ones)

Keep the tone professional but approachable, like a DRep communicating with their delegators. Under 250 words. Output only the update text, no preamble or headers.`;

    const draft = await generateText(prompt, {
      model: 'DRAFT',
      maxTokens: 1024,
      temperature: 0.7,
    });

    if (!draft) {
      return NextResponse.json(
        { error: 'AI features are currently unavailable. Please try again later.' },
        { status: 503 },
      );
    }

    captureServerEvent(
      'drep_epoch_update_ai_drafted',
      { drep_id: drepId, epoch: targetEpoch },
      drepId,
    );

    return NextResponse.json({ draft, voteSummary });
  },
  { auth: 'none', rateLimit: { max: 10, window: 60 } },
);
