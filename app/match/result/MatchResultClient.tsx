'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { ArrowRight, Zap, Share2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GovernanceRadar } from '@/components/GovernanceRadar';
import type { AlignmentScores } from '@/lib/drepIdentity';
import { getDominantDimension, getIdentityColor } from '@/lib/drepIdentity';
import { webShare, canWebShare, copyToClipboard } from '@/lib/share';

interface ShareableProfile {
  personality: string;
  dimensions: AlignmentScores;
  narrative: string;
}

function parseProfile(encoded: string | undefined): ShareableProfile | null {
  if (!encoded) return null;
  try {
    const json = atob(encoded);
    const data = JSON.parse(json);
    if (!data.personality || !data.dimensions) return null;
    return data as ShareableProfile;
  } catch {
    return null;
  }
}

function getPersonalityDescription(label: string): string {
  const descriptions: Record<string, string> = {
    'The Guardian': 'Protects what matters — treasury discipline and institutional stability.',
    'The Fiscal Hawk': 'Holds every ADA accountable. The treasury exists to be guarded.',
    'The Prudent Steward': 'Balances caution with responsibility. Thoughtful governance.',
    'The Builder': 'Invests in growth. The ecosystem thrives when we fund boldly.',
    'The Growth Champion': 'Pushes for expansion. Nothing ventured, nothing gained.',
    'The Catalyst': 'Sparks change. Strategic investment fuels the future.',
    'The Federalist': 'Champions distributed governance. Power to the community.',
    'The Power Distributor': 'Distributes power. No single entity should dominate.',
    'The Decentralizer': 'Keeps decisions close to the people they affect.',
    'The Sentinel': 'Guards the protocol. Security and stability come first.',
    'The Cautious Architect': 'Stands watch over system integrity. Careful, deliberate.',
    'The Shield': 'Smooths out volatility. Steady progress over disruption.',
    'The Pioneer': 'Explores the frontier. Innovation is non-negotiable.',
    'The Changemaker': "Pushes boundaries. Cardano leads by building what's next.",
    'The Innovator': "Thinks in decades. Today's experiments are tomorrow's standards.",
    'The Beacon': 'Demands accountability. Every vote explained, every decision justified.',
    'The Transparent Champion': 'Makes governance visible. Sunlight is the best disinfectant.',
    'The Open Book': "Holds feet to fire. Transparency isn't optional.",
  };
  return descriptions[label] || "A unique governance identity shaping Cardano's future.";
}

export function MatchResultClient({ encoded }: { encoded: string | undefined }) {
  const profile = useMemo(() => parseProfile(encoded), [encoded]);

  if (!profile) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4">
        <div className="text-center max-w-lg space-y-6 animate-in fade-in duration-500">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Zap className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">
              Governance Match
            </h1>
            <p className="text-muted-foreground text-base sm:text-lg leading-relaxed">
              This link doesn&apos;t contain a valid match profile. Take the quiz to discover your
              governance identity.
            </p>
          </div>
          <Button asChild size="lg" className="text-base px-8 py-6 rounded-xl font-semibold">
            <Link href="/match">
              Take the Quiz
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const dominant = getDominantDimension(profile.dimensions);
  const identityColor = getIdentityColor(dominant);

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-2xl space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-500">
        <div className="text-center space-y-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
            Governance Identity
          </p>

          <div className="flex justify-center">
            <GovernanceRadar alignments={profile.dimensions} size="full" />
          </div>

          <div className="space-y-2">
            <Badge
              className="text-sm px-3 py-1"
              style={{
                backgroundColor: identityColor.hex + '20',
                color: identityColor.hex,
                borderColor: identityColor.hex + '40',
              }}
            >
              {profile.personality}
            </Badge>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              {getPersonalityDescription(profile.personality)}
            </p>
          </div>

          {profile.narrative && (
            <div className="text-center max-w-md mx-auto">
              <p className="text-sm text-foreground/90 leading-relaxed">{profile.narrative}</p>
            </div>
          )}

          <ShareResultButton personality={profile.personality} encoded={encoded!} />
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4 pb-8">
          <Button asChild size="lg" className="text-base px-8 font-semibold">
            <Link href="/match">
              <Zap className="mr-2 h-5 w-5" />
              Take the Quiz
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/governance/representatives">
              Browse DReps
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function ShareResultButton({ personality, encoded }: { personality: string; encoded: string }) {
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    const url = `${window.location.origin}/match/result?profile=${encodeURIComponent(encoded)}`;
    const text = `I'm "${personality}" on Cardano governance. Find your governance identity:`;

    if (canWebShare()) {
      const shared = await webShare({
        title: `I'm ${personality} — Governada`,
        text,
        url,
      });
      if (shared) return;
    }

    const ok = await copyToClipboard(url);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [personality, encoded]);

  return (
    <Button variant="outline" size="sm" onClick={handleShare} className="gap-2">
      {copied ? (
        <>
          <Check className="h-4 w-4" />
          Link Copied
        </>
      ) : (
        <>
          <Share2 className="h-4 w-4" />
          Share This Identity
        </>
      )}
    </Button>
  );
}
