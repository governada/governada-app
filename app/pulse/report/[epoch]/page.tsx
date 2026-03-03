import { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getFeatureFlag } from '@/lib/featureFlags';
import { GovernanceSubNav } from '@/components/GovernanceSubNav';
import { ShareActions } from '@/components/ShareActions';
import { GHI_BAND_COLORS, GHI_BAND_LABELS, type GHIBand } from '@/lib/ghi';
import { StateOfGovernanceContent } from './report-content';
import type { ReportData } from '@/lib/stateOfGovernance';
import { BASE_URL } from '@/lib/constants';
import { ArrowLeft, Calendar, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Props {
  params: Promise<{ epoch: string }>;
}

async function getReport(epochParam: string) {
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
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { epoch } = await params;
  const report = await getReport(epoch);
  if (!report) return { title: 'Report Not Found | DRepScore' };

  const reportData = report.report_data as unknown as ReportData;
  return {
    title: `State of Governance — Epoch ${report.epoch_no} | DRepScore`,
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

  const reportsEnabled = await getFeatureFlag('state_of_governance_reports', false);
  if (!reportsEnabled) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">
        <GovernanceSubNav />
        <Link
          href="/pulse"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Pulse
        </Link>
        <div className="rounded-lg border bg-card p-8 text-center">
          <h2 className="text-xl font-semibold mb-2">Coming soon</h2>
          <p className="text-muted-foreground text-sm">
            State of Governance reports are under development.
          </p>
        </div>
      </div>
    );
  }

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

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">
      <GovernanceSubNav />

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
            <div className="text-muted-foreground">Votes</div>
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

      <StateOfGovernanceContent data={data} narrative={narrative} />

      {/* Share footer */}
      <div className="border-t pt-8 space-y-4">
        <ShareActions
          url={`https://drepscore.io/pulse/report/${data.epoch}`}
          text={`State of Governance — Epoch ${data.epoch}. GHI: ${data.ghi.score}/100. Via @DRepScore`}
          imageUrl={`/api/og/governance-report/${data.epoch}`}
          surface="governance_report"
        />

        <div className="text-center">
          <Link href="/profile" className="text-sm text-primary hover:underline">
            Subscribe to weekly governance updates
          </Link>
        </div>
      </div>
    </div>
  );
}
