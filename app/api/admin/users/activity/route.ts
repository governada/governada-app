export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isAdminWallet } from '@/lib/adminAuth';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';

interface ActivityEvent {
  type: 'poll_vote' | 'draft_created' | 'draft_updated' | 'review_submitted' | 'drep_vote';
  timestamp: string;
  details: Record<string, unknown>;
}

export const GET = withRouteHandler(
  async (request: NextRequest, ctx: RouteContext) => {
    if (!isAdminWallet(ctx.wallet!)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(request.url);
    const address = url.searchParams.get('address')?.trim();
    const daysParam = url.searchParams.get('days');
    const days = daysParam ? Math.min(Math.max(parseInt(daysParam, 10) || 30, 1), 365) : 30;

    if (!address) {
      return NextResponse.json({ error: 'Required: address query param' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const since = new Date(Date.now() - days * 86_400_000).toISOString();

    const events: ActivityEvent[] = [];

    // Run all queries in parallel
    const [pollVotes, drafts, reviews, drepVotes] = await Promise.all([
      // 1. Poll votes
      supabase
        .from('poll_responses')
        .select('created_at, vote, proposal_tx_hash, proposal_index')
        .eq('stake_address', address)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(50),

      // 2. Proposal drafts
      supabase
        .from('proposal_drafts')
        .select('id, title, status, created_at, updated_at')
        .eq('owner_stake_address', address)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(50),

      // 3. Draft reviews
      supabase
        .from('draft_reviews')
        .select('id, draft_id, created_at, feedback_text')
        .eq('reviewer_stake_address', address)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(50),

      // 4. DRep votes (look up by drep_id if the address is a drep)
      // First find drep_id from user_wallets
      (async () => {
        const { data: wallet } = await supabase
          .from('user_wallets')
          .select('drep_id')
          .eq('stake_address', address)
          .not('drep_id', 'is', null)
          .limit(1)
          .maybeSingle();

        if (!wallet?.drep_id) return { data: null };

        return supabase
          .from('drep_votes')
          .select('vote, proposal_tx_hash, proposal_index, block_time')
          .eq('drep_id', wallet.drep_id)
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(50);
      })(),
    ]);

    // Collect all proposal keys we need to look up titles for
    const proposalKeys = new Set<string>();

    if (pollVotes.data) {
      for (const pv of pollVotes.data) {
        proposalKeys.add(`${pv.proposal_tx_hash}:${pv.proposal_index}`);
      }
    }

    if (drepVotes.data) {
      for (const dv of drepVotes.data) {
        proposalKeys.add(`${dv.proposal_tx_hash}:${dv.proposal_index}`);
      }
    }

    // Batch look up proposal titles
    const proposalTitles = new Map<string, string>();
    if (proposalKeys.size > 0) {
      const keys = Array.from(proposalKeys);
      // Build filter: each key is tx_hash + proposal_index
      const txHashes = [...new Set(keys.map((k) => k.split(':')[0]))];

      if (txHashes.length > 0) {
        const { data: proposals } = await supabase
          .from('proposals')
          .select('tx_hash, proposal_index, title')
          .in('tx_hash', txHashes);

        if (proposals) {
          for (const p of proposals) {
            proposalTitles.set(`${p.tx_hash}:${p.proposal_index}`, p.title ?? 'Untitled proposal');
          }
        }
      }
    }

    // Also look up draft titles for reviews
    const draftIds = new Set<string>();
    if (reviews.data) {
      for (const r of reviews.data) {
        draftIds.add(r.draft_id);
      }
    }

    const draftTitles = new Map<string, string>();
    if (draftIds.size > 0) {
      const { data: draftData } = await supabase
        .from('proposal_drafts')
        .select('id, title')
        .in('id', Array.from(draftIds));

      if (draftData) {
        for (const d of draftData) {
          draftTitles.set(d.id, d.title || 'Untitled draft');
        }
      }
    }

    // Build events from poll votes
    if (pollVotes.data) {
      for (const pv of pollVotes.data) {
        const key = `${pv.proposal_tx_hash}:${pv.proposal_index}`;
        events.push({
          type: 'poll_vote',
          timestamp: pv.created_at ?? new Date(0).toISOString(),
          details: {
            vote: pv.vote,
            proposalTitle: proposalTitles.get(key) ?? 'Untitled proposal',
          },
        });
      }
    }

    // Build events from drafts (created + updated as separate events)
    if (drafts.data) {
      for (const d of drafts.data) {
        events.push({
          type: 'draft_created',
          timestamp: d.created_at,
          details: {
            title: d.title || 'Untitled draft',
            status: d.status,
          },
        });

        // Add an update event if updated_at is meaningfully later than created_at
        if (d.updated_at && d.updated_at !== d.created_at) {
          const createdMs = new Date(d.created_at).getTime();
          const updatedMs = new Date(d.updated_at).getTime();
          // Only show update if it's at least 60 seconds after creation
          if (updatedMs - createdMs > 60_000) {
            events.push({
              type: 'draft_updated',
              timestamp: d.updated_at,
              details: {
                title: d.title || 'Untitled draft',
                status: d.status,
              },
            });
          }
        }
      }
    }

    // Build events from reviews
    if (reviews.data) {
      for (const r of reviews.data) {
        events.push({
          type: 'review_submitted',
          timestamp: r.created_at,
          details: {
            draftTitle: draftTitles.get(r.draft_id) ?? 'Unknown draft',
          },
        });
      }
    }

    // Build events from drep votes
    if (drepVotes.data) {
      for (const dv of drepVotes.data) {
        const key = `${dv.proposal_tx_hash}:${dv.proposal_index}`;
        events.push({
          type: 'drep_vote',
          timestamp: dv.block_time
            ? new Date(dv.block_time * 1000).toISOString()
            : new Date(0).toISOString(),
          details: {
            vote: dv.vote,
            proposalTitle: proposalTitles.get(key) ?? 'Untitled proposal',
          },
        });
      }
    }

    // Sort by timestamp descending, limit to 50
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const limited = events.slice(0, 50);

    return NextResponse.json({ events: limited });
  },
  { auth: 'required', rateLimit: { max: 30, window: 60 } },
);
