import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BASE_URL } from '@/lib/constants';

export const dynamic = 'force-dynamic';

interface PageParams {
  entityType: string;
  entityId: string;
  period: string;
}

// ── Stat formatting helpers ───────────────────────────────────────────────────

function entityLabel(entityType: string, entityId: string): string {
  if (entityType === 'drep') return `DRep ${entityId.slice(0, 12)}…`;
  if (entityType === 'spo') return `Pool ${entityId.slice(0, 12)}…`;
  return `Citizen ${entityId.slice(0, 12)}…`;
}

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { entityType, entityId, period } = await params;
  const label = entityLabel(entityType, entityId);
  const title = `${label}'s Governance Wrapped — ${period}`;
  const description = `See ${label}'s governance activity for ${period} on DRepScore.`;
  const ogImageUrl = `${BASE_URL}/api/og/wrapped/${entityType}/${encodeURIComponent(entityId)}?period=${period}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      images: [{ url: ogImageUrl, width: 1080, height: 1080, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

// ── Stat display component ────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card p-5 text-center">
      <p className="text-3xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PublicWrappedPage({ params }: { params: Promise<PageParams> }) {
  const { entityType, entityId, period } = await params;
  const supabase = createClient();

  const { data: wrapped } = await supabase
    .from('governance_wrapped')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .eq('period_id', period)
    .single();

  const ogImageUrl = `${BASE_URL}/api/og/wrapped/${entityType}/${encodeURIComponent(entityId)}?period=${period}`;
  const publicUrl = `${BASE_URL}/wrapped/${entityType}/${encodeURIComponent(entityId)}/${period}`;

  // ── No data fallback ────────────────────────────────────────────────────────
  if (!wrapped) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-sm text-center space-y-4">
          <p className="text-4xl">⏳</p>
          <p className="text-lg font-semibold text-foreground">Wrapped not yet available</p>
          <p className="text-sm text-muted-foreground">
            The Governance Wrapped for this entity and period has not been generated yet.
          </p>
          <Button asChild variant="outline">
            <Link href="/">Find your governance story</Link>
          </Button>
        </div>
      </main>
    );
  }

  const data = (wrapped.data ?? {}) as Record<string, unknown>;

  // Build stats based on entity type
  const stats: Array<{ label: string; value: string | number }> = [];

  if (entityType === 'drep') {
    if (data.score_end !== undefined)
      stats.push({ label: 'Governance Score', value: `${data.score_end}/100` });
    if (data.votes_cast !== undefined)
      stats.push({ label: 'Proposals Voted', value: data.votes_cast as number });
    if (data.rationales_written !== undefined)
      stats.push({ label: 'Rationales Written', value: data.rationales_written as number });
    if (data.delegators_end !== undefined)
      stats.push({ label: 'Delegators', value: data.delegators_end as number });
  } else if (entityType === 'spo') {
    if (data.score_end !== undefined)
      stats.push({ label: 'Governance Score', value: `${data.score_end}/100` });
    if (data.votes_cast !== undefined)
      stats.push({ label: 'Proposals Voted', value: data.votes_cast as number });
    if (data.participation_rate !== undefined)
      stats.push({
        label: 'Participation Rate',
        value: `${data.participation_rate}%`,
      });
    if (data.delegators_end !== undefined)
      stats.push({ label: 'Delegators', value: data.delegators_end as number });
  } else {
    // citizen
    if (data.drep_votes_cast !== undefined)
      stats.push({ label: "DRep's Votes Cast", value: data.drep_votes_cast as number });
    if (data.drep_rationales !== undefined)
      stats.push({ label: 'Votes with Rationale', value: data.drep_rationales as number });
    if (data.epochs_delegating !== undefined)
      stats.push({ label: 'Epochs Delegating', value: data.epochs_delegating as number });
  }

  const label = entityLabel(entityType, entityId);

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-12 space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <Badge variant="outline" className="text-xs">
            {entityType.toUpperCase()} · {period}
          </Badge>
          <h1 className="text-2xl font-bold text-foreground mt-2">{label}</h1>
          <p className="text-sm text-muted-foreground">Governance Wrapped</p>
        </div>

        {/* OG card preview */}
        <Card className="overflow-hidden border border-border">
          <CardContent className="p-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ogImageUrl}
              alt={`${label} Governance Wrapped ${period}`}
              className="w-full"
              width={1080}
              height={1080}
            />
          </CardContent>
        </Card>

        {/* Stats grid */}
        {stats.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {stats.map((s) => (
              <StatCard key={s.label} label={s.label} value={s.value} />
            ))}
          </div>
        )}

        {/* Acquisition CTA */}
        <Card className="border border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Find YOUR governance story</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Connect your Cardano wallet to discover your own Governance Wrapped and track your
              participation.
            </p>
            <Button asChild className="w-full">
              <Link href="/">Get started on DRepScore</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Share link */}
        <p className="text-center text-xs text-muted-foreground">
          Share: <span className="font-mono text-foreground/70 break-all">{publicUrl}</span>
        </p>
      </div>
    </main>
  );
}
