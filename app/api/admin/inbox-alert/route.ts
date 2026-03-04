/**
 * Governance Inbox Engagement Alert — Cron endpoint
 *
 * Fires Discord/Slack alerts when:
 * - Critical proposals have low DRep vote coverage (< 40%)
 * - Proposals are expiring within 1 epoch with < 50% coverage
 * - Overall epoch response rate drops below 30%
 *
 * Designed to run every 6h via Inngest scheduled function.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { captureServerEvent } from '@/lib/posthog-server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';

export const dynamic = 'force-dynamic';
export const maxDuration = 15;

interface InboxAlert {
  level: 'critical' | 'warning';
  title: string;
  detail: string;
}

export const GET = withRouteHandler(async (request) => {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json({ skipped: true, reason: 'No webhook URL configured' });
  }

  const supabase = createClient();
  const alerts: InboxAlert[] = [];

  const activeDrepsRes = await supabase
    .from('dreps')
    .select('id', { count: 'exact', head: true })
    .filter('info->>isActive', 'eq', 'true');
  const totalActiveDreps = activeDrepsRes.count ?? 0;

  if (totalActiveDreps === 0) {
    return NextResponse.json({ alerts: 0, reason: 'No active DReps' });
  }

  const { data: openProposals } = await supabase
    .from('proposals')
    .select(
      `
      tx_hash,
      proposal_index,
      proposal_type,
      title,
      expiration_epoch,
      proposed_epoch,
      proposal_voting_summary (
        drep_yes_votes_cast,
        drep_no_votes_cast,
        drep_abstain_votes_cast
      )
    `,
    )
    .is('enacted_epoch', null)
    .is('ratified_epoch', null)
    .is('dropped_epoch', null)
    .is('expired_epoch', null);

  if (!openProposals || openProposals.length === 0) {
    return NextResponse.json({ alerts: 0, reason: 'No open proposals' });
  }

  const SHELLEY_START = 1591566291;
  const EPOCH_LENGTH = 432000;
  const SHELLEY_EPOCH = 208;
  const currentEpoch =
    Math.floor((Date.now() / 1000 - SHELLEY_START) / EPOCH_LENGTH) + SHELLEY_EPOCH;

  const CRITICAL_TYPES = new Set([
    'HardForkInitiation',
    'NoConfidence',
    'NewCommittee',
    'NewConstitutionalCommittee',
    'NewConstitution',
    'UpdateConstitution',
  ]);

  let totalDrepVotes = 0;

  for (const p of openProposals) {
    const vs = Array.isArray(p.proposal_voting_summary)
      ? p.proposal_voting_summary[0]
      : p.proposal_voting_summary;
    const drepVotes =
      (vs?.drep_yes_votes_cast ?? 0) +
      (vs?.drep_no_votes_cast ?? 0) +
      (vs?.drep_abstain_votes_cast ?? 0);
    totalDrepVotes += drepVotes;
    const coverage = Math.round((drepVotes / totalActiveDreps) * 100);
    const expirationEpoch =
      p.expiration_epoch ?? (p.proposed_epoch != null ? p.proposed_epoch + 6 : null);
    const epochsRemaining =
      expirationEpoch != null ? Math.max(0, expirationEpoch - currentEpoch) : null;
    const isCritical = CRITICAL_TYPES.has(p.proposal_type);
    const label = p.title || `${p.tx_hash.slice(0, 12)}...#${p.proposal_index}`;

    if (isCritical && coverage < 40) {
      alerts.push({
        level: 'critical',
        title: `Low coverage on critical proposal`,
        detail: `"${label}" (${p.proposal_type}) — only ${coverage}% DRep coverage (${drepVotes}/${totalActiveDreps})`,
      });
    }

    if (epochsRemaining != null && epochsRemaining <= 1 && coverage < 50) {
      alerts.push({
        level: 'critical',
        title: `Proposal expiring with low coverage`,
        detail: `"${label}" expires in ${epochsRemaining} epoch — only ${coverage}% DRep coverage`,
      });
    }
  }

  const avgCoverage =
    openProposals.length > 0
      ? Math.round((totalDrepVotes / openProposals.length / totalActiveDreps) * 100)
      : 0;
  if (avgCoverage < 30) {
    alerts.push({
      level: 'warning',
      title: 'Low overall DRep engagement',
      detail: `Average vote coverage across ${openProposals.length} open proposals is ${avgCoverage}% (threshold: 30%)`,
    });
  }

  captureServerEvent('inbox_engagement_alert_check', {
    alertCount: alerts.length,
    openProposals: openProposals.length,
    avgCoverage,
    currentEpoch,
  });

  if (alerts.length === 0) {
    return NextResponse.json({ alerts: 0, sent: false });
  }

  const isSlack = webhookUrl.includes('hooks.slack.com');
  let body: unknown;

  if (isSlack) {
    body = {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `DRepScore Governance Alert — ${alerts.length} issue${alerts.length !== 1 ? 's' : ''}`,
          },
        },
        ...alerts.map((a) => ({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${a.level === 'critical' ? ':red_circle:' : ':large_yellow_circle:'} *${a.title}*\n>${a.detail}`,
          },
        })),
      ],
    };
  } else {
    const lines = alerts.map((a) => {
      const icon = a.level === 'critical' ? '🔴' : '🟡';
      return `${icon} **${a.title}**\n↳ ${a.detail}`;
    });
    body = {
      embeds: [
        {
          title: `Governance Engagement Alert — ${alerts.length} issue${alerts.length !== 1 ? 's' : ''}`,
          description: lines.join('\n\n'),
          color: alerts.some((a) => a.level === 'critical') ? 0xff4444 : 0xf59e0b,
          footer: { text: 'DRepScore Inbox Monitor' },
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });

    captureServerEvent('inbox_engagement_alert_sent', {
      alertCount: alerts.length,
      criticalCount: alerts.filter((a) => a.level === 'critical').length,
      webhookStatus: res.status,
    });

    return NextResponse.json({ alerts: alerts.length, sent: res.ok, details: alerts });
  } catch (err) {
    return NextResponse.json(
      {
        alerts: alerts.length,
        sent: false,
        error: err instanceof Error ? err.message : 'Webhook failed',
      },
      { status: 502 },
    );
  }
});
