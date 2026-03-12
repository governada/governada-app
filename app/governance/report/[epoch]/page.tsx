export const dynamic = 'force-dynamic';

import { cache } from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getFeatureFlag } from '@/lib/featureFlags';
import { PageViewTracker } from '@/components/PageViewTracker';
import { ArrowLeft, Calendar, BarChart3, Users, Zap } from 'lucide-react';

interface Props {
  params: Promise<{ epoch: string }>;
}

interface GovernanceReportData {
  epoch: number;
  report_data: {
    proposals_decided?: number;
    proposal_outcomes?: Array<{
      title: string;
      type: string;
      outcome: string;
    }>;
    drep_participation?: {
      active: number;
      total: number;
      rate: number;
    };
    citizen_engagement?: {
      sentiment_votes: number;
      priority_votes: number;
      assembly_responses: number;
      total: number;
    };
    divergence_highlights?: Array<{
      proposalTitle: string;
      divergenceScore: number;
    }>;
    treasury?: {
      balance: string;
      withdrawals: number;
    };
    temperature?: number;
    temperature_band?: string;
  };
  narrative: string | null;
  generated_at: string;
}

const getReport = cache(async (epochParam: string) => {
  const supabase = getSupabaseAdmin();

  if (epochParam === 'latest') {
    const { data } = await supabase
      .from('governance_reports')
      .select('*')
      .order('epoch', { ascending: false })
      .limit(1)
      .single();
    return data;
  }

  const epochNo = parseInt(epochParam, 10);
  if (isNaN(epochNo)) return null;

  const { data } = await supabase
    .from('governance_reports')
    .select('*')
    .eq('epoch', epochNo)
    .single();

  return data;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { epoch } = await params;
  const report = await getReport(epoch);
  if (!report) return { title: 'Report Not Found | Governada' };

  return {
    title: `Governance Report — Epoch ${report.epoch} | Governada`,
    description: `Community intelligence governance report for Cardano Epoch ${report.epoch}.`,
    openGraph: {
      title: `Governance Report — Epoch ${report.epoch}`,
      description: `Community-driven governance analysis for Epoch ${report.epoch}`,
      type: 'article',
    },
  };
}

export default async function GovernanceReportPage({ params }: Props) {
  const enabled = await getFeatureFlag('state_of_governance_report', false);
  if (!enabled) notFound();

  const { epoch } = await params;

  if (epoch === 'latest') {
    const report = await getReport('latest');
    if (report) redirect(`/governance/report/${report.epoch}`);
    notFound();
  }

  const report = await getReport(epoch);
  if (!report) notFound();

  const data = report.report_data as GovernanceReportData['report_data'];

  return (
    <>
      <PageViewTracker event="community_report_viewed" properties={{ epoch: report.epoch }} />

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">
        <Link
          href="/governance/health"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Governance Health
        </Link>

        {/* Hero */}
        <header className="text-center space-y-4 py-8">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>Epoch {report.epoch}</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Community Governance Report
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Community intelligence and governance analysis powered by citizen participation data.
          </p>
        </header>

        {/* Stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {data.drep_participation && (
            <StatCard
              icon={<Users className="h-4 w-4" />}
              label="DRep Participation"
              value={`${data.drep_participation.rate}%`}
              sublabel={`${data.drep_participation.active} of ${data.drep_participation.total}`}
            />
          )}
          {data.citizen_engagement && (
            <StatCard
              icon={<BarChart3 className="h-4 w-4" />}
              label="Citizen Signals"
              value={String(data.citizen_engagement.total)}
              sublabel="Total engagement"
            />
          )}
          {data.proposals_decided != null && (
            <StatCard
              icon={<Zap className="h-4 w-4" />}
              label="Proposals Decided"
              value={String(data.proposals_decided)}
              sublabel="This epoch"
            />
          )}
          {data.temperature != null && (
            <StatCard
              icon={<Zap className="h-4 w-4" />}
              label="Temperature"
              value={String(data.temperature)}
              sublabel={data.temperature_band ?? 'N/A'}
            />
          )}
        </div>

        {/* Narrative */}
        {report.narrative && (
          <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-6 space-y-3">
            <h3 className="text-sm font-bold">Analysis</h3>
            <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
              {report.narrative}
            </div>
          </div>
        )}

        {/* Proposal outcomes */}
        {data.proposal_outcomes && data.proposal_outcomes.length > 0 && (
          <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-5 space-y-3">
            <h3 className="text-sm font-bold">Proposal Outcomes</h3>
            <div className="space-y-2">
              {data.proposal_outcomes.map((p, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-sm"
                >
                  <span className="font-medium truncate mr-2">{p.title || 'Untitled'}</span>
                  <span className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary">
                    {p.outcome}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Divergence highlights */}
        {data.divergence_highlights && data.divergence_highlights.length > 0 && (
          <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-5 space-y-3">
            <h3 className="text-sm font-bold">Citizen-DRep Divergence Highlights</h3>
            <div className="space-y-2">
              {data.divergence_highlights.map((d, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-sm"
                >
                  <span className="font-medium truncate mr-2">{d.proposalTitle}</span>
                  <span className="shrink-0 tabular-nums text-xs font-medium text-amber-500">
                    {Math.round(d.divergenceScore * 100)}% divergence
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-center text-xs text-muted-foreground pt-4">
          Generated {new Date(report.generated_at).toLocaleDateString()}
        </div>
      </div>
    </>
  );
}

function StatCard({
  icon,
  label,
  value,
  sublabel,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sublabel: string;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-4 text-center space-y-1">
      <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{sublabel}</div>
    </div>
  );
}
