'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Vote,
  ScrollText,
  FileText,
  Users,
  Activity,
  TrendingUp,
  CheckCircle2,
} from 'lucide-react';

interface ActivityEvent {
  type: 'vote' | 'rationale' | 'proposal' | 'score_change' | 'proposal_outcome' | 'delegation';
  drepId: string;
  drepName: string | null;
  detail: string | null;
  vote?: 'Yes' | 'No' | 'Abstain';
  timestamp: number;
  proposalTxHash?: string;
  proposalIndex?: number;
}

const EVENT_ICONS: Record<string, { icon: typeof Vote; color: string; bg: string }> = {
  vote: { icon: Vote, color: 'text-green-400', bg: 'bg-green-500/10' },
  rationale: { icon: ScrollText, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  proposal: { icon: FileText, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  delegation: { icon: Users, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  score_change: { icon: TrendingUp, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  proposal_outcome: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
};

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000 - timestamp);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function formatEventText(event: ActivityEvent): string {
  const name = event.drepName || (event.drepId ? `${event.drepId.slice(0, 8)}...` : '');

  switch (event.type) {
    case 'vote': {
      const proposal = event.detail ? ` on ${event.detail}` : '';
      return `${name} voted ${event.vote ?? ''}${proposal}`.trim();
    }
    case 'rationale':
      return `${name} published rationale`;
    case 'proposal':
      return event.detail ? `New proposal: ${event.detail}` : 'New proposal submitted';
    case 'score_change':
      return event.detail || `${name} score changed`;
    case 'proposal_outcome':
      return event.detail || 'Proposal outcome recorded';
    case 'delegation':
      return event.detail || `${name} delegated`;
    default:
      return '';
  }
}

function getEventHref(event: ActivityEvent): string | null {
  if (event.proposalTxHash != null && event.proposalIndex != null) {
    return `/proposals/${encodeURIComponent(event.proposalTxHash)}/${event.proposalIndex}`;
  }
  if (event.drepId) {
    return `/drep/${encodeURIComponent(event.drepId)}`;
  }
  return null;
}

export function LiveVoteFeed({ limit = 10 }: { limit?: number }) {
  const { data } = useQuery({
    queryKey: ['governance-activity', limit],
    queryFn: () => fetch(`/api/governance/activity?limit=${limit}`).then((r) => r.json()),
    refetchInterval: 30000,
  });
  const events = (data as ActivityEvent[]) ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4 text-primary" />
          Live Governance Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul
          className="space-y-2 max-h-[320px] overflow-y-auto"
          aria-label="Recent governance activity"
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {events.map((event) => {
              const config = EVENT_ICONS[event.type] || EVENT_ICONS.vote;
              const Icon = config.icon;
              const href = getEventHref(event);
              const itemId = `${event.type}-${event.timestamp}-${event.drepId}-${event.detail}`;

              const content = (
                <div className="flex items-start gap-3 py-2 px-2 -mx-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <div
                    className={`flex items-center justify-center w-7 h-7 rounded-full ${config.bg} shrink-0 mt-0.5`}
                  >
                    <Icon className={`h-3.5 w-3.5 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug">{formatEventText(event)}</p>
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTime(event.timestamp)}
                    </span>
                  </div>
                </div>
              );

              return (
                <motion.li
                  key={itemId}
                  layout
                  initial={{ opacity: 0, y: -12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-start gap-3"
                >
                  {href ? (
                    <Link href={href} className="block flex-1 min-w-0">
                      {content}
                    </Link>
                  ) : (
                    content
                  )}
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      </CardContent>
    </Card>
  );
}
