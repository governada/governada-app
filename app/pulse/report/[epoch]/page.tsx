import { cache } from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabase';

import { ShareActions } from '@/components/ShareActions';
import { GHI_BAND_COLORS, GHI_BAND_LABELS, type GHIBand } from '@/lib/ghi';
import { StateOfGovernanceContent } from './report-content';
import { FloatingShareFAB } from '@/components/civica/pulse/FloatingShareFAB';
import type { ReportData } from '@/lib/stateOfGovernance';
import { BASE_URL } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { ArrowLeft, Calendar, TrendingUp, TrendingDown, Bell } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ epoch: string }>;
}

const getReport = cache(async (epochParam: string) => {
  const supabase = getSupabaseAdmin();

  if (epochParam === 'latest') {
    const { data } = await supabase
      .from('state_of_governance_reports')
      .select('*')
      .eq('published', true)
      .order('epoch_no', { ascending: false })
      .limit(1)
      .single();
    return data;
  }

  const epochNo = parseInt(epochParam, 10);
  if (isNaN(epochNo)) return null;

  const { data } = await supabase
    .from('state_of_governance_reports')
    .select('*')
    .eq('epoch_no', epochNo)
    .eq('published', true)
    .single();

  return data;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { epoch } = await params;
  const report = await getReport(epoch);
  if (!report) return { title: 'Report Not Found | Governada' };

  const reportData = report.report_data as unknown as ReportData;
  return {
    title: `State of Governance — Epoch ${report.epoch_no} | Governada`,
    description: `Cardano governance health score: ${reportData.ghi.score}/100 (${GHI_BAND_LABELS[reportData.ghi.band as GHIBand]}). ${reportData.stats.activeDReps} active DReps governing ${reportData.stats.totalAdaGoverned} ADA.`,
    openGraph: {
      title: `State of Governance — Epoch ${report.epoch_no}`,
      description: `GHI: ${reportData.ghi.score}/100 | ${reportData.stats.activeDReps} DReps | ${reportData.stats.totalAdaGoverned} ADA`,
      images: [`${BASE_URL}/api/og/governance-report/${report.epoch_no}`],
    },
    twitter: {
      card: 'summary_large_image',
      title: `State of Governance — Epoch ${report.epoch_no}`,
      images: [`${BASE_URL}/api/og/governance-report/${report.epoch_no}`],
    },
  };
}

export default async function StateOfGovernancePage({ params }: Props) {
  const { epoch } = await params;

  if (epoch === 'latest') {
    const report = await getReport('latest');
    if (report) redirect(`/pulse/report/${report.epoch_no}`);
    notFound();
  }

  const report = await getReport(epoch);
  if (!report) notFound();

  const data = report.report_data as unknown as ReportData;
  const narrative = report.narrative_html;
  const color = GHI_BAND_COLORS[data.ghi.band as GHIBand];
  const bandLabel = GHI_BAND_LABELS[data.ghi.band as GHIBand];
  const ghiDelta =
    data.ghiPrevScore != null ? Math.round((data.ghi.score - data.ghiPrevScore) * 10) / 10 : null;

  // Fetch previous epoch report for inter-epoch comparison
  const prevEpoch = data.epoch - 1;
  const prevReport = await getReport(String(prevEpoch));
  const prevData = prevReport ? (prevReport.report_data as unknown as ReportData) : null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">
      <Link
        href="/pulse"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Pulse
      </Link>

      {/* Hero */}
      <header className="text-center space-y-4 py-8">
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>
            Epoch {data.epoch} &middot; {data.dateRange.start} — {data.dateRange.end}
          </span>
        </div>

        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">State of Governance</h1>
        <p className="text-muted-foreground max-w-xl mx-auto">
          A snapshot of Cardano&apos;s governance health this epoch — how engaged representatives
          are, what passed, and where the system is heading.
        </p>

        <div className="flex items-center justify-center gap-4 mt-6">
          <div className="text-center">
            <div className="text-6xl font-bold tabular-nums" style={{ color }}>
              {data.ghi.score}
            </div>
            <div className="text-sm font-medium mt-1" style={{ color }}>
              {bandLabel}
            </div>
          </div>

          {ghiDelta != null && ghiDelta !== 0 && (
            <div
              className="flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium"
              style={{ backgroundColor: `${color}15`, color }}
            >
              {ghiDelta > 0 ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              <span className="tabular-nums">
                {ghiDelta > 0 ? '+' : ''}
                {ghiDelta}
              </span>
            </div>
          )}
        </div>

        {/* Stat strip */}
        <div className="flex flex-wrap justify-center gap-6 mt-6 text-sm">
          <div className="text-center">
            <div className="text-lg font-bold tabular-nums">{data.stats.activeDReps}</div>
            <div className="text-muted-foreground">Active DReps</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold tabular-nums">{data.stats.totalVotes}</div>
            <div className="text-muted-foreground">Votes Cast</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold tabular-nums">{data.stats.totalAdaGoverned}</div>
            <div className="text-muted-foreground">ADA Governed</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold tabular-nums">{data.stats.avgParticipation}%</div>
            <div className="text-muted-foreground">Avg Participation</div>
          </div>
        </div>
      </header>

      {/* Key Takeaways */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h3 className="text-sm font-bold">Key Takeaways</h3>
        <ul className="space-y-1.5 text-sm text-muted-foreground list-disc list-inside">
          {data.stats.activeDReps > 0 && (
            <li>
              {data.stats.activeDReps} DReps voted this epoch
              {ghiDelta != null && (
                <>
                  {' '}
                  — participation is{' '}
                  {ghiDelta > 0 ? 'trending up' : ghiDelta < 0 ? 'declining' : 'holding steady'}
                </>
              )}
            </li>
          )}
          {data.proposals.length > 0 && (
            <li>{data.proposals.length} proposals were submitted for governance review</li>
          )}
          <li>
            Governance Health Index: {data.ghi.score} ({bandLabel})
            {ghiDelta != null && ghiDelta !== 0 && (
              <>
                {' '}
                — {ghiDelta > 0
                  ? `up ${ghiDelta} points`
                  : `down ${Math.abs(ghiDelta)} points`}{' '}
                from last epoch
              </>
            )}
          </li>
          {data.stats.avgParticipation > 0 && (
            <li>Average DRep participation rate: {data.stats.avgParticipation}%</li>
          )}
        </ul>
      </div>

      {/* Inter-epoch comparison */}
      {prevData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <DeltaCard label="GHI Score" current={data.ghi.score} previous={prevData.ghi.score} />
          <DeltaCard
            label="Active DReps"
            current={data.stats.activeDReps}
            previous={prevData.stats.activeDReps}
          />
          <DeltaCard
            label="Votes Cast"
            current={data.stats.totalVotes}
            previous={prevData.stats.totalVotes}
          />
          <DeltaCard
            label="Participation"
            current={data.stats.avgParticipation}
            previous={prevData.stats.avgParticipation}
            suffix="%"
          />
        </div>
      )}

      <StateOfGovernanceContent data={data} narrative={narrative} />

      {/* Share footer */}
      <div className="border-t pt-8 space-y-4">
        <ShareActions
          url={`https://governada.io/pulse/report/${data.epoch}`}
          text={`State of Governance — Epoch ${data.epoch}. GHI: ${data.ghi.score}/100. Via @GovernadaIO`}
          imageUrl={`/api/og/governance-report/${data.epoch}`}
          surface="governance_report"
        />

        {/* Subscribe CTA */}
        <div className="rounded-xl border border-dashed border-border p-5 text-center space-y-2">
          <Bell className="h-5 w-5 text-primary mx-auto" />
          <p className="text-sm font-medium">Get epoch reports in your inbox</p>
          <p className="text-xs text-muted-foreground">
            Be the first to read each epoch&apos;s governance analysis
          </p>
          <Link
            href="/my-gov/profile"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            Set up notifications &rarr;
          </Link>
        </div>
      </div>

      {/* Floating share FAB */}
      <FloatingShareFAB epoch={data.epoch} score={data.ghi.score} band={bandLabel} />
    </div>
  );
}

function DeltaCard({
  label,
  current,
  previous,
  suffix = '',
}: {
  label: string;
  current: number;
  previous: number;
  suffix?: string;
}) {
  const delta = Math.round((current - previous) * 10) / 10;
  return (
    <div className="rounded-lg border border-border bg-card p-3 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">
        {current}
        {suffix}
      </p>
      <p
        className={cn(
          'text-xs font-medium',
          delta > 0 ? 'text-emerald-500' : delta < 0 ? 'text-rose-500' : 'text-muted-foreground',
        )}
      >
        {delta > 0 ? '\u2191' : delta < 0 ? '\u2193' : '\u2192'} {Math.abs(delta)}
        {suffix} from last epoch
      </p>
    </div>
  );
}
