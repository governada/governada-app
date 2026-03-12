'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { posthog } from '@/lib/posthog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Award, Shield, Users, Star, Target, FileText, CheckCircle2, Lock, X } from 'lucide-react';
import { ShareActions } from '@/components/ShareActions';
import { buildDRepUrl } from '@/lib/share';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Shield,
  Users,
  Star,
  Target,
  FileText,
  CheckCircle2,
};

interface Milestone {
  key: string;
  label: string;
  description: string;
  icon: string;
  category: string;
  achieved: boolean;
  achievedAt: string | null;
}

interface MilestoneBadgesProps {
  drepId: string;
  compact?: boolean;
}

export function MilestoneBadges({ drepId, compact = false }: MilestoneBadgesProps) {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [celebratingMilestone, setCelebratingMilestone] = useState<Milestone | null>(null);
  const previousAchievedRef = useRef<Set<string>>(new Set());
  const confettiFired = useRef(false);

  useEffect(() => {
    if (!drepId) return;
    fetch('/api/dashboard/milestones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drepId }),
    })
      .then(() => fetch(`/api/dashboard/milestones?drepId=${encodeURIComponent(drepId)}`))
      .then((r) => r.json())
      .then((d) => {
        if (d.milestones) {
          setMilestones(d.milestones);
          const newlyAchieved = (d.milestones as Milestone[]).filter(
            (m) => m.achieved && !previousAchievedRef.current.has(m.key),
          );
          if (newlyAchieved.length > 0 && previousAchievedRef.current.size > 0) {
            setCelebratingMilestone(newlyAchieved[0]);
          }
          previousAchievedRef.current = new Set(
            (d.milestones as Milestone[]).filter((m) => m.achieved).map((m) => m.key),
          );
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [drepId]);

  useEffect(() => {
    if (!celebratingMilestone || confettiFired.current) return;
    confettiFired.current = true;
    posthog.capture('milestone_celebration_viewed', {
      drep_id: drepId,
      milestone_key: celebratingMilestone.key,
      milestone_label: celebratingMilestone.label,
    });
    confetti({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.7 },
      colors: ['#f59e0b', '#6366f1', '#22c55e'],
    });
  }, [celebratingMilestone, drepId]);

  const dismissCelebration = useCallback(() => {
    if (celebratingMilestone) {
      posthog.capture('milestone_celebration_dismissed', {
        drep_id: drepId,
        milestone_key: celebratingMilestone.key,
      });
    }
    setCelebratingMilestone(null);
    confettiFired.current = false;
  }, [celebratingMilestone, drepId]);

  useEffect(() => {
    const achieved = milestones.filter((m) => m.achieved);
    if (achieved.length > 0) {
      posthog.capture('milestone_achieved', {
        drepId,
        count: achieved.length,
        keys: achieved.map((m) => m.key),
      });
    }
  }, [milestones, drepId]);

  if (loading) {
    return compact ? null : (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Award className="h-4 w-4" />
            Achievements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-16 animate-pulse bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  const achieved = milestones.filter((m) => m.achieved);
  const unachieved = milestones.filter((m) => !m.achieved);

  if (compact) {
    if (achieved.length === 0) return null;
    return (
      <TooltipProvider>
        <div className="flex flex-wrap gap-1.5">
          {achieved.map((m) => {
            const Icon = ICON_MAP[m.icon] || Award;
            return (
              <Tooltip key={m.key}>
                <TooltipTrigger asChild>
                  <Badge variant="secondary" className="gap-1 text-[10px]">
                    <Icon className="h-3 w-3" />
                    {m.label}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">{m.description}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>
    );
  }

  return (
    <>
      {/* Milestone celebration overlay */}
      {celebratingMilestone && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-sm w-full border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-transparent">
            <CardContent className="p-6 text-center space-y-4">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 h-8 w-8"
                onClick={dismissCelebration}
                aria-label="Dismiss celebration"
              >
                <X className="h-4 w-4" />
              </Button>
              <div className="text-4xl">🏆</div>
              <div>
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium uppercase tracking-wider">
                  Achievement Unlocked
                </p>
                <h3 className="text-xl font-bold mt-1">{celebratingMilestone.label}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {celebratingMilestone.description}
                </p>
              </div>
              <ShareActions
                url={buildDRepUrl(drepId)}
                text={`Achievement Unlocked on @GovernadaIO: ${celebratingMilestone.label}! ${celebratingMilestone.description}.`}
                imageUrl={`/api/og/moment/milestone/${encodeURIComponent(drepId)}/${celebratingMilestone.key}`}
                imageFilename={`milestone-${celebratingMilestone.key}.png`}
                surface="milestone_celebration"
                metadata={{ drep_id: drepId, milestone: celebratingMilestone.key }}
              />
              <Button variant="outline" size="sm" onClick={dismissCelebration}>
                Continue
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Award className="h-4 w-4" />
            Achievements
            <Badge variant="secondary" className="text-[10px]">
              {achieved.length}/{milestones.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TooltipProvider>
            <div className="grid grid-cols-3 gap-2">
              {achieved.map((m) => {
                const Icon = ICON_MAP[m.icon] || Award;
                return (
                  <Tooltip key={m.key}>
                    <TooltipTrigger asChild>
                      <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-primary/5 border border-primary/20 text-center">
                        <Icon className="h-5 w-5 text-primary" />
                        <span className="text-[10px] font-medium leading-tight">{m.label}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">{m.description}</p>
                      {m.achievedAt && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Achieved {new Date(m.achievedAt).toLocaleDateString()}
                        </p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
              {unachieved.slice(0, 6 - achieved.length).map((m) => {
                return (
                  <Tooltip key={m.key}>
                    <TooltipTrigger asChild>
                      <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-muted/40 text-center opacity-40">
                        <Lock className="h-5 w-5" />
                        <span className="text-[10px] font-medium leading-tight">{m.label}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">{m.description}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </TooltipProvider>
        </CardContent>
      </Card>
    </>
  );
}
