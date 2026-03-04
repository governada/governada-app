'use client';

import { useEffect, useState, useCallback } from 'react';
import { posthog } from '@/lib/posthog';
import { getStoredSession } from '@/lib/supabaseAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Circle, Sparkles, ExternalLink, FileText, Share2, X } from 'lucide-react';
import { useOnboarding } from '@/hooks/queries';

interface OnboardingChecklistProps {
  drepId: string;
  walletAddress: string;
  profileCompleteness: number;
}

const ITEMS = [
  {
    key: 'profile',
    label: 'Complete your profile',
    desc: 'Add objectives, motivations, and social links via GovTool',
    icon: Sparkles,
    href: 'https://gov.tools',
  },
  {
    key: 'rationale',
    label: 'Write your first rationale',
    desc: 'Use the AI Rationale Assistant in your Governance Inbox',
    icon: FileText,
    href: null,
  },
  {
    key: 'vote',
    label: 'Vote on a pending proposal',
    desc: 'Head to GovTool to cast your vote',
    icon: ExternalLink,
    href: 'https://gov.tools',
  },
  {
    key: 'share',
    label: 'Share your score',
    desc: 'Let delegators know you are active on DRepScore',
    icon: Share2,
    href: null,
  },
];

export function OnboardingChecklist({
  drepId,
  walletAddress,
  profileCompleteness,
}: OnboardingChecklistProps) {
  const { data: raw, isLoading: loading } = useOnboarding(walletAddress);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!raw) return;
    const d = raw as any;
    const cl = d.checklist || {};
    if (cl._dismissed) setDismissed(true);
    if (profileCompleteness >= 80 && !cl.profile) cl.profile = true;
    setChecklist(cl);
  }, [raw, profileCompleteness]);

  const toggleItem = useCallback(
    async (key: string) => {
      const token = getStoredSession();
      if (!token) return;
      const newVal = !checklist[key];
      setChecklist((prev) => ({ ...prev, [key]: newVal }));
      posthog.capture('onboarding_checklist_item_completed', {
        drep_id: drepId,
        item: key,
        completed: newVal,
      });
      await fetch('/api/dashboard/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken: token, item: key, completed: newVal }),
      }).catch(() => {});
    },
    [checklist, drepId],
  );

  const handleDismiss = useCallback(async () => {
    const token = getStoredSession();
    if (!token) return;
    setDismissed(true);
    posthog.capture('onboarding_checklist_dismissed', { drep_id: drepId });
    await fetch('/api/dashboard/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionToken: token, item: '_dismissed', completed: true }),
    }).catch(() => {});
  }, [drepId]);

  if (loading || dismissed) return null;

  const completedCount = ITEMS.filter((i) => checklist[i.key]).length;
  const allDone = completedCount === ITEMS.length;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Getting Started ({completedCount}/{ITEMS.length})
          </CardTitle>
          {allDone && (
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={handleDismiss}>
              <X className="h-3 w-3 mr-1" /> Dismiss
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {ITEMS.map((item) => {
          const done = !!checklist[item.key];
          return (
            <button
              key={item.key}
              className={`w-full flex items-start gap-3 p-2 rounded-lg text-left transition-colors ${done ? 'opacity-60' : 'hover:bg-muted/50'}`}
              onClick={() => {
                if (item.href && !done) {
                  window.open(item.href, '_blank');
                }
                toggleItem(item.key);
              }}
            >
              {done ? (
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              )}
              <div>
                <p className={`text-xs font-medium ${done ? 'line-through' : ''}`}>{item.label}</p>
                <p className="text-[10px] text-muted-foreground">{item.desc}</p>
              </div>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
