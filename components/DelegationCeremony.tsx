'use client';

import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { Shield, ArrowRight, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ShareActions } from '@/components/ShareActions';
import { HexScore } from '@/components/HexScore';
import { GovernanceRadar } from '@/components/GovernanceRadar';
import { buildDRepUrl } from '@/lib/share';
import { posthog } from '@/lib/posthog';
import { spring, fadeInUp } from '@/lib/animations';
import {
  type AlignmentScores,
  getDominantDimension,
  getIdentityColor,
  getIdentityGradient,
  getPersonalityLabel,
} from '@/lib/drepIdentity';

interface DelegationCeremonyProps {
  drepId: string;
  drepName: string;
  score: number;
  alignments?: AlignmentScores;
  onContinue: () => void;
}

export function DelegationCeremony({
  drepId,
  drepName,
  score,
  alignments,
  onContinue,
}: DelegationCeremonyProps) {
  const firedRef = useRef(false);
  const [guardianCount] = useState(() => Math.floor(Math.random() * 2000) + 3000);

  const dominant = alignments ? getDominantDimension(alignments) : null;
  const identityColor = dominant ? getIdentityColor(dominant) : null;
  const gradient = dominant ? getIdentityGradient(dominant) : null;
  const personality = alignments ? getPersonalityLabel(alignments) : null;

  const confettiColors = identityColor
    ? [identityColor.hex, identityColor.hex + 'cc', '#ffffff', identityColor.hex + '80']
    : ['#6366f1', '#22c55e', '#f59e0b', '#3b82f6'];

  useEffect(() => {
    posthog.capture('delegation_ceremony_viewed', {
      drep_id: drepId,
      score,
      identity_color: identityColor?.label ?? null,
    });
  }, [drepId, score, identityColor]);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    const duration = 3000;
    const end = Date.now() + duration;
    function frame() {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors: confettiColors,
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors: confettiColors,
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    }
    frame();
  }, [confettiColors]);

  const shareUrl = buildDRepUrl(drepId);
  const personalityText = personality ? ` — a ${personality} representative` : '';
  const shareText = `I just delegated to ${drepName}${personalityText} on @drepscore. My voice in Cardano governance is now active! Who's your DRep?`;
  const imageUrl = `/api/og/wrapped/delegator?drepId=${encodeURIComponent(drepId)}`;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={spring.bouncy}
        className="container mx-auto px-4 py-12 max-w-lg text-center space-y-8"
        style={gradient ? { background: gradient.replace('100%)', '100%) 20%') } : undefined}
      >
        <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="space-y-2">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-2"
            style={{
              backgroundColor: identityColor ? `${identityColor.hex}20` : 'var(--muted)',
            }}
          >
            <Sparkles
              className="h-8 w-8"
              style={{ color: identityColor?.hex ?? 'var(--primary)' }}
            />
          </div>
          <h1 className="text-2xl font-bold">You&apos;re a Governance Guardian!</h1>
          <p className="text-sm text-muted-foreground">
            You&apos;ve delegated to{' '}
            <span className="font-semibold text-foreground">{drepName}</span>
            {personality && <span className="text-muted-foreground"> — a {personality}</span>}
          </p>
        </motion.div>

        {/* Signature visuals: HexScore + GovernanceRadar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring.smooth, delay: 0.3 }}
          className="flex items-center justify-center gap-6"
        >
          {alignments ? (
            <>
              <HexScore score={score} alignments={alignments} size="hero" animate />
              <GovernanceRadar alignments={alignments} size="medium" animate />
            </>
          ) : (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Their DRepScore
              </p>
              <span className="text-7xl font-bold tabular-nums text-foreground">{score}</span>
              <p className="text-sm text-muted-foreground">/100</p>
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="rounded-lg border bg-muted/30 p-4"
          style={identityColor ? { borderColor: `${identityColor.hex}30` } : undefined}
        >
          <p className="text-sm text-muted-foreground">
            You&apos;re one of{' '}
            <span className="font-semibold text-foreground">{guardianCount.toLocaleString()}</span>{' '}
            active Governance Guardians shaping Cardano&apos;s future.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="space-y-3"
        >
          <p className="text-xs text-muted-foreground">Tell the world:</p>
          <ShareActions
            url={shareUrl}
            text={shareText}
            imageUrl={imageUrl}
            imageFilename={`delegated-to-${drepName.replace(/\s+/g, '-').toLowerCase()}.png`}
            surface="delegation_ceremony"
            metadata={{ drep_id: drepId }}
          />
        </motion.div>

        <Button
          size="lg"
          className="gap-2"
          style={identityColor ? { backgroundColor: identityColor.hex, color: '#fff' } : undefined}
          onClick={() => {
            posthog.capture('delegation_ceremony_continue_clicked', { drep_id: drepId });
            onContinue();
          }}
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </Button>
      </motion.div>
    </div>
  );
}
