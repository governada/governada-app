'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Users, Wallet, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import dynamic from 'next/dynamic';
import { trackFunnel, FUNNEL_EVENTS } from '@/lib/funnel';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { BarChart3 } from 'lucide-react';
import { GovernanceConsequenceCard } from './GovernanceConsequenceCard';
import { IntelligencePreview } from './IntelligencePreview';
import { PillCloud } from '@/components/matching/PillCloud';
import { CommunityPulse } from '@/components/intelligence/CommunityPulse';
import { useFeatureFlag } from '@/components/FeatureGate';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

const ConstellationScene = dynamic(
  () => import('@/components/ConstellationScene').then((m) => ({ default: m.ConstellationScene })),
  { ssr: false, loading: () => <div className="w-full h-full bg-background" /> },
);

interface AnonymousLandingProps {
  pulseData?: {
    activeProposals: number;
    activeDReps: number;
    totalDelegators: number;
  };
}

interface MatchingTopicResponse {
  topics: Array<{
    id: string;
    slug: string;
    displayText: string;
    source: string;
    trending: boolean;
    selectionCount: number;
  }>;
}

const FALLBACK_TOPICS = [
  { id: 'topic-treasury', text: 'Treasury', trending: false },
  { id: 'topic-innovation', text: 'Innovation', trending: false },
  { id: 'topic-security', text: 'Security', trending: false },
  { id: 'topic-transparency', text: 'Transparency', trending: false },
  { id: 'topic-decentralization', text: 'Decentralization', trending: false },
  { id: 'topic-developer-funding', text: 'Developer Funding', trending: false },
  { id: 'topic-community-growth', text: 'Community Growth', trending: false },
  { id: 'topic-constitutional', text: 'Constitutional Compliance', trending: false },
] as const;

/**
 * Anonymous Landing — Optimized conversion page.
 *
 * When conversational matching is enabled, topic pills navigate to the
 * dedicated /match page (Xavier's Room) instead of running the flow inline.
 */
export function AnonymousLanding({ pulseData }: AnonymousLandingProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const conversationalMatchingEnabled = useFeatureFlag('conversational_matching');
  const communityIntelligenceEnabled = useFeatureFlag('community_intelligence');

  const { data: topicsData } = useQuery<MatchingTopicResponse>({
    queryKey: ['matching-topics'],
    queryFn: async () => {
      const res = await fetch('/api/governance/matching-topics');
      if (!res.ok) throw new Error('Failed to fetch topics');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
    enabled: conversationalMatchingEnabled === true,
  });

  const topicPills = topicsData?.topics?.length
    ? topicsData.topics.map((t) => ({
        id: `topic-${t.slug}`,
        text: t.displayText,
        trending: t.trending,
      }))
    : FALLBACK_TOPICS.map((t) => ({ id: t.id, text: t.text, trending: t.trending }));

  useEffect(() => {
    trackFunnel(FUNNEL_EVENTS.LANDING_VIEWED);
  }, []);

  /** Navigate to /match with the tapped topic as a query param */
  const handleTopicTap = (topicId: string) => {
    trackFunnel(FUNNEL_EVENTS.MATCH_STARTED, { source: 'landing_pill', topic: topicId });
    router.push(`/match?topic=${encodeURIComponent(topicId)}`);
  };

  return (
    <div className="relative flex flex-col min-h-[calc(100vh-4rem)]">
      {/* Constellation hero */}
      <section className="force-dark relative sm:-mt-14 overflow-visible flex items-start sm:items-center justify-center flex-1 min-h-[50vh]">
        <div className="absolute inset-0 overflow-hidden">
          <ConstellationScene className="w-full h-full" interactive={false} />
        </div>

        {/* Gradient fade */}
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent pointer-events-none" />

        {/* Hero content */}
        <div className="relative z-10 text-center px-6 pt-16 sm:pt-14 w-full flex flex-col max-w-lg">
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-tight hero-text-shadow">
            {t('Your ADA gives you')}
            <br />
            <span className="text-primary">{t('a voice.')}</span>
          </h1>
          <p
            className="mt-4 text-lg sm:text-xl text-white/90 font-medium"
            style={{
              textShadow: '0 2px 12px rgba(0,0,0,0.8), 0 0 40px rgba(0,0,0,0.5)',
            }}
          >
            {t('Choose who votes for you. It takes 60 seconds.')}
          </p>

          {/* Topic pills — tapping navigates to /match */}
          {conversationalMatchingEnabled && (
            <div className="mt-8 space-y-4 rounded-2xl bg-black/40 backdrop-blur-md p-5 border border-white/[0.06]">
              <p className="text-center text-sm text-white/70 font-medium">
                What matters to you in governance?
              </p>
              <PillCloud
                pills={topicPills.map((t) => ({
                  id: t.id,
                  text: t.trending ? t.text : t.text,
                  icon: t.trending ? <TrendingUp className="h-3 w-3 text-orange-400" /> : undefined,
                }))}
                selected={new Set()}
                onToggle={handleTopicTap}
                multiSelect={false}
                layout="cloud"
                size="md"
              />
              {/* Direct CTA for impatient users */}
              <Button
                asChild
                variant="ghost"
                className="w-full gap-2 text-primary/80 hover:text-primary"
              >
                <Link href="/match">
                  Just find my match
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* CTAs + social proof */}
      <section className="relative z-10 mx-auto w-full max-w-lg px-6 -mt-8 pb-12 space-y-6">
        {!conversationalMatchingEnabled && (
          <div className="flex flex-col gap-3">
            <Button
              asChild
              size="lg"
              className="w-full gap-2 text-base py-6 rounded-xl font-semibold"
              onClick={() =>
                trackFunnel(FUNNEL_EVENTS.MATCH_STARTED, { source: 'landing_primary' })
              }
            >
              <Link href="/match">
                <Users className="h-5 w-5" />
                {t('Choose Your Representative')}
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
          </div>
        )}

        {conversationalMatchingEnabled && <div />}

        {pulseData && (
          <GovernanceConsequenceCard
            activeProposals={pulseData.activeProposals}
            totalDelegators={pulseData.totalDelegators}
          />
        )}

        <Link
          href="/get-started"
          className="block rounded-xl border border-white/[0.08] bg-card/60 backdrop-blur-xl p-4 space-y-2 transition-all duration-200 hover:border-primary/60 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5"
          onClick={() =>
            trackFunnel(FUNNEL_EVENTS.EXPLORE_CLICKED, { source: 'landing_get_started' })
          }
        >
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">{t('Get Started')}</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t(
              'Connect your wallet to see personalized governance insights, track your delegation, and discover representatives aligned with your values.',
            )}
          </p>
          <span className="inline-flex items-center gap-1 text-xs text-primary/80 hover:text-primary">
            {t('Learn how')} <ArrowRight className="h-3 w-3" />
          </span>
        </Link>

        <IntelligencePreview />

        {communityIntelligenceEnabled && (
          <div className="rounded-xl border border-white/[0.08] bg-card/60 backdrop-blur-sm p-4 space-y-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Community Pulse</span>
            </div>
            <CommunityPulse />
          </div>
        )}
      </section>
    </div>
  );
}
