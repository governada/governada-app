'use client';

import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { Check, ArrowRight, Sparkles, FileText, Vote, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface ClaimCelebrationProps {
  name: string;
  score: number;
  participation: number;
  rationale: number;
  reliability: number;
  profile: number;
  onContinue: () => void;
}

const CHECKLIST_ITEMS = [
  {
    key: 'profile',
    icon: Sparkles,
    label: 'Complete your CIP-119 profile',
    desc: 'Add objectives, motivations, and social links on GovTool',
    href: 'https://gov.tools',
  },
  {
    key: 'rationale',
    icon: FileText,
    label: 'Draft rationale for a pending proposal',
    desc: 'Use the AI Rationale Assistant in your Governance Inbox',
    href: null,
  },
  {
    key: 'vote',
    icon: Vote,
    label: 'Vote on a pending proposal',
    desc: 'Head to GovTool to cast your vote with rationale attached',
    href: 'https://gov.tools',
  },
];

function AnimatedScore({ target }: { target: number }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    let frame: number;
    const start = performance.now();
    const duration = 1200;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(eased * target));
      if (progress < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  const color =
    current >= 80 ? 'text-green-500' : current >= 60 ? 'text-amber-500' : 'text-red-500';

  return <span className={`text-7xl font-bold tabular-nums ${color}`}>{current}</span>;
}

function PillarReveal({
  label,
  value,
  max,
  delay,
}: {
  label: string;
  value: number;
  max: number;
  delay: number;
}) {
  const [width, setWidth] = useState(0);
  const pct = Math.min(100, (value / 100) * 100);
  const color = pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500';
  const points = Math.round((value / 100) * max);

  useEffect(() => {
    const timer = setTimeout(() => setWidth(pct), delay);
    return () => clearTimeout(timer);
  }, [pct, delay]);

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-24 shrink-0">{label}</span>
      <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${color}`}
          style={{ width: `${width}%` }}
        />
      </div>
      <span className="text-xs font-semibold tabular-nums w-10 text-right">
        {points}/{max}
      </span>
    </div>
  );
}

export function ClaimCelebration({
  name,
  score,
  participation,
  rationale,
  reliability,
  profile,
  onContinue,
}: ClaimCelebrationProps) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;

    const duration = 2000;
    const end = Date.now() + duration;

    function frame() {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors: ['#6366f1', '#22c55e', '#f59e0b'],
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors: ['#6366f1', '#22c55e', '#f59e0b'],
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    }
    frame();
  }, []);

  return (
    <div className="container mx-auto px-4 py-12 max-w-lg text-center space-y-8">
      <div className="space-y-2">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 mb-2">
          <Check className="h-7 w-7 text-green-600 dark:text-green-400" />
        </div>
        <h1 className="text-2xl font-bold">Welcome, {name}!</h1>
        <p className="text-sm text-muted-foreground">Your DRepScore command center is live.</p>
      </div>

      <div className="space-y-1">
        <AnimatedScore target={score} />
        <p className="text-sm text-muted-foreground">/100 DRepScore</p>
      </div>

      <div className="space-y-2 max-w-sm mx-auto">
        <PillarReveal label="Participation" value={participation} max={30} delay={400} />
        <PillarReveal label="Rationale" value={rationale} max={35} delay={600} />
        <PillarReveal label="Reliability" value={reliability} max={20} delay={800} />
        <PillarReveal label="Profile" value={profile} max={15} delay={1000} />
      </div>

      <Card className="text-left border-primary/20">
        <CardContent className="pt-5 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Your first 3 actions
          </h3>
          {CHECKLIST_ITEMS.map((item) => (
            <div
              key={item.key}
              className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <item.icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Button size="lg" className="gap-2" onClick={onContinue}>
        Go to Dashboard
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
