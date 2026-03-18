'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { getStoredSession } from '@/lib/supabaseAuth';
import {
  useSegment,
  type SegmentOverride,
  type UserSegment,
} from '@/components/providers/SegmentProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search,
  User,
  Shield,
  Vote,
  FileText,
  MessageSquare,
  Copy,
  Check,
  CheckCheck,
  Loader2,
  AlertCircle,
  Wallet,
  UserCog,
  FlaskConical,
  Clock,
} from 'lucide-react';

interface InspectResult {
  user: {
    id: string;
    wallet_address: string;
    display_name: string | null;
    last_active: string | null;
    governance_depth: string;
  } | null;
  segment: {
    detected: string;
    segments: string[];
    drepId: string | null;
    poolId: string | null;
    stakeAddress: string | null;
    delegatedDrep: string | null;
    delegatedPool: string | null;
    tier: string | null;
  };
  drepProfile: {
    id: string;
    name: string | null;
    bio: string | null;
    score: number | null;
    tier: string | null;
    claimed: boolean;
  } | null;
  wallets: Array<{
    stake_address: string;
    payment_address: string;
    drep_id: string | null;
    pool_id: string | null;
  }>;
  activity: {
    pollVotes: number;
    proposalDrafts: number;
    draftReviews: number;
  };
}

function truncateAddress(addr: string, chars = 12): string {
  if (addr.length <= chars * 2 + 3) return addr;
  return `${addr.slice(0, chars)}...${addr.slice(-chars)}`;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors"
      title="Copy to clipboard"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function segmentColor(segment: string): string {
  switch (segment) {
    case 'drep':
      return 'bg-chart-1/20 text-chart-1 border-chart-1/30';
    case 'spo':
      return 'bg-chart-2/20 text-chart-2 border-chart-2/30';
    case 'cc':
      return 'bg-chart-3/20 text-chart-3 border-chart-3/30';
    case 'citizen':
      return 'bg-chart-4/20 text-chart-4 border-chart-4/30';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function tierColor(tier: string | null): string {
  switch (tier) {
    case 'stellar':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'established':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'emerging':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'nascent':
      return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths}mo ago`;
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Vote;
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-card/50 p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

interface ActivityEvent {
  type: 'poll_vote' | 'draft_created' | 'draft_updated' | 'review_submitted' | 'drep_vote';
  timestamp: string;
  details: Record<string, unknown>;
}

const activityIcons: Record<ActivityEvent['type'], typeof Vote> = {
  poll_vote: Vote,
  draft_created: FileText,
  draft_updated: FileText,
  review_submitted: MessageSquare,
  drep_vote: CheckCheck,
};

function activityDescription(event: ActivityEvent): string {
  switch (event.type) {
    case 'poll_vote':
      return `Voted in poll: ${String(event.details.proposalTitle ?? 'Unknown')}`;
    case 'draft_created':
      return `Created proposal draft: ${String(event.details.title ?? 'Untitled')}`;
    case 'draft_updated':
      return `Updated proposal draft: ${String(event.details.title ?? 'Untitled')}`;
    case 'review_submitted':
      return `Submitted review on: ${String(event.details.draftTitle ?? 'Unknown')}`;
    case 'drep_vote': {
      const vote = String(event.details.vote ?? 'unknown').toLowerCase();
      return `Voted ${vote} on: ${String(event.details.proposalTitle ?? 'Unknown')}`;
    }
    default:
      return 'Unknown activity';
  }
}

export function UsersClient() {
  const router = useRouter();
  const { setOverride, enterSandbox } = useSegment();
  const [searchInput, setSearchInput] = useState('');
  const [sandboxLoading, setSandboxLoading] = useState(false);

  const inspect = useMutation({
    mutationFn: async (address: string): Promise<InspectResult> => {
      const token = getStoredSession();
      const res = await fetch(`/api/admin/users/inspect?address=${encodeURIComponent(address)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      return res.json();
    },
  });

  const handleSearch = () => {
    const trimmed = searchInput.trim();
    if (!trimmed) return;
    inspect.mutate(trimmed);
  };

  const data = inspect.data;

  const buildOverrideFromData = useCallback(
    (inspectData: InspectResult): SegmentOverride => ({
      segment: inspectData.segment.detected as UserSegment,
      drepId: inspectData.segment.drepId,
      poolId: inspectData.segment.poolId,
      delegatedDrep: inspectData.segment.delegatedDrep,
      delegatedPool: inspectData.segment.delegatedPool,
    }),
    [],
  );

  const storeImpersonation = useCallback((inspectData: InspectResult) => {
    if (!inspectData.user) return;
    sessionStorage.setItem(
      'governada_impersonate',
      JSON.stringify({
        address: inspectData.user.wallet_address,
        segment: inspectData.segment.detected,
        displayName: inspectData.user.display_name,
      }),
    );
  }, []);

  const stakeAddress = data?.segment?.stakeAddress ?? null;

  const activityQuery = useQuery({
    queryKey: ['admin-user-activity', stakeAddress],
    queryFn: async (): Promise<{ events: ActivityEvent[] }> => {
      const token = getStoredSession();
      const res = await fetch(
        `/api/admin/users/activity?address=${encodeURIComponent(stakeAddress!)}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      return res.json();
    },
    enabled: !!stakeAddress,
  });

  const handleImpersonate = useCallback(() => {
    if (!data?.user) return;
    const override = buildOverrideFromData(data);
    setOverride(override);
    storeImpersonation(data);
    router.push('/');
  }, [data, buildOverrideFromData, storeImpersonation, setOverride, router]);

  const handleImpersonateInSandbox = useCallback(async () => {
    if (!data?.user) return;
    setSandboxLoading(true);
    try {
      const override = buildOverrideFromData(data);
      setOverride(override);
      storeImpersonation(data);

      // Create or get a sandbox cohort
      const token = getStoredSession();
      const res = await fetch('/api/admin/sandbox', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: 'create' }),
      });
      if (res.ok) {
        const sandboxData = await res.json();
        if (sandboxData.cohort?.id) {
          enterSandbox(sandboxData.cohort.id);
        }
      }

      router.push('/');
    } finally {
      setSandboxLoading(false);
    }
  }, [data, buildOverrideFromData, storeImpersonation, setOverride, enterSandbox, router]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">User Inspector</h1>
        <p className="text-sm text-muted-foreground">
          Look up any user by wallet address, stake address, DRep ID, or pool ID.
        </p>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <Input
          placeholder="Search by wallet, stake address, DRep ID, or pool ID..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="flex-1"
        />
        <Button onClick={handleSearch} disabled={inspect.isPending || !searchInput.trim()}>
          {inspect.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          <span className="ml-2">Inspect</span>
        </Button>
      </div>

      {/* Error */}
      {inspect.isError && (
        <Card className="border-destructive/50">
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="text-sm font-medium text-destructive">Inspection failed</p>
              <p className="text-xs text-muted-foreground">{inspect.error.message}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No user found */}
      {data && !data.user && (
        <Card>
          <CardContent className="pt-6 pb-6 text-center">
            <User className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No user found for this address. They may not have connected to Governada yet.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {data && data.user && (
        <div className="space-y-4">
          {/* Identity */}
          <Card className="bg-card/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" />
                Identity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Wallet Address</p>
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono">
                      {truncateAddress(data.user.wallet_address)}
                    </code>
                    <CopyButton text={data.user.wallet_address} />
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">User ID</p>
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono">{data.user.id.slice(0, 8)}...</code>
                    <CopyButton text={data.user.id} />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Display Name</p>
                  <p className="text-sm">{data.user.display_name || '--'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Last Active</p>
                  <p className="text-sm">{formatTimeAgo(data.user.last_active)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Governance Depth</p>
                  <p className="text-sm capitalize">{data.user.governance_depth}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Segment Detection */}
          <Card className="bg-card/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Segment Detection
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Detected Segment</p>
                  <Badge variant="outline" className={segmentColor(data.segment.detected)}>
                    {data.segment.detected.toUpperCase()}
                  </Badge>
                </div>
                {data.segment.tier && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Tier</p>
                    <Badge variant="outline" className={tierColor(data.segment.tier)}>
                      {data.segment.tier}
                    </Badge>
                  </div>
                )}
                {data.segment.segments.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">All Segments</p>
                    <div className="flex gap-1">
                      {data.segment.segments.map((s) => (
                        <Badge key={s} variant="outline" className="text-xs">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {data.segment.drepId && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">DRep ID</p>
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono">
                        {truncateAddress(data.segment.drepId)}
                      </code>
                      <CopyButton text={data.segment.drepId} />
                    </div>
                  </div>
                )}
                {data.segment.poolId && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Pool ID</p>
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono">
                        {truncateAddress(data.segment.poolId)}
                      </code>
                      <CopyButton text={data.segment.poolId} />
                    </div>
                  </div>
                )}
                {data.segment.stakeAddress && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Stake Address</p>
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono">
                        {truncateAddress(data.segment.stakeAddress)}
                      </code>
                      <CopyButton text={data.segment.stakeAddress} />
                    </div>
                  </div>
                )}
                {data.segment.delegatedDrep && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Delegated DRep</p>
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono">
                        {truncateAddress(data.segment.delegatedDrep)}
                      </code>
                      <CopyButton text={data.segment.delegatedDrep} />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Wallets */}
          {data.wallets.length > 0 && (
            <Card className="bg-card/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  Linked Wallets
                  <Badge variant="outline" className="ml-1 text-xs">
                    {data.wallets.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.wallets.map((w, i) => (
                    <div
                      key={i}
                      className="rounded-md border border-border/40 bg-background/50 p-3 space-y-1.5"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-16 shrink-0">Stake</span>
                        <code className="text-xs font-mono">
                          {truncateAddress(w.stake_address, 16)}
                        </code>
                        <CopyButton text={w.stake_address} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-16 shrink-0">Payment</span>
                        <code className="text-xs font-mono">
                          {truncateAddress(w.payment_address, 16)}
                        </code>
                        <CopyButton text={w.payment_address} />
                      </div>
                      {w.drep_id && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-16 shrink-0">DRep</span>
                          <code className="text-xs font-mono">
                            {truncateAddress(w.drep_id, 16)}
                          </code>
                          <CopyButton text={w.drep_id} />
                        </div>
                      )}
                      {w.pool_id && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-16 shrink-0">Pool</span>
                          <code className="text-xs font-mono">
                            {truncateAddress(w.pool_id, 16)}
                          </code>
                          <CopyButton text={w.pool_id} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* DRep Profile */}
          {data.drepProfile && (
            <Card className="bg-card/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <UserCog className="h-4 w-4" />
                  DRep Profile
                  {data.drepProfile.claimed && (
                    <Badge variant="outline" className="text-xs bg-green-500/20 text-green-400">
                      Claimed
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Name</p>
                    <p className="text-sm">{String(data.drepProfile.name ?? '--')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Score</p>
                    <p className="text-sm">
                      {data.drepProfile.score != null
                        ? `${data.drepProfile.score.toFixed(1)} / 100`
                        : '--'}
                    </p>
                  </div>
                </div>
                {data.drepProfile.bio && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Bio</p>
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {String(data.drepProfile.bio)}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Governance Activity */}
          <Card className="bg-card/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Vote className="h-4 w-4" />
                Governance Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                <StatCard label="Poll Votes" value={data.activity.pollVotes} icon={Vote} />
                <StatCard
                  label="Proposals Authored"
                  value={data.activity.proposalDrafts}
                  icon={FileText}
                />
                <StatCard
                  label="Reviews Submitted"
                  value={data.activity.draftReviews}
                  icon={MessageSquare}
                />
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="bg-card/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activityQuery.isLoading && (
                <div className="flex items-center gap-2 text-muted-foreground py-4 justify-center">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Loading activity...</span>
                </div>
              )}
              {activityQuery.isError && (
                <div className="flex items-center gap-2 text-destructive py-4">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span className="text-sm">Failed to load activity</span>
                </div>
              )}
              {activityQuery.isSuccess && activityQuery.data.events.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">No recent activity</p>
              )}
              {activityQuery.isSuccess && activityQuery.data.events.length > 0 && (
                <div className="space-y-1">
                  {activityQuery.data.events.map((event, i) => {
                    const Icon = activityIcons[event.type];
                    return (
                      <div
                        key={`${event.type}-${event.timestamp}-${i}`}
                        className="flex items-start gap-3 rounded-md px-2 py-2 hover:bg-muted/30 transition-colors"
                      >
                        <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm leading-snug truncate">
                            {activityDescription(event)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatTimeAgo(event.timestamp)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="bg-card/50">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={handleImpersonate}>
                  <UserCog className="h-4 w-4 mr-2" />
                  Impersonate
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleImpersonateInSandbox}
                  disabled={sandboxLoading}
                >
                  {sandboxLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FlaskConical className="h-4 w-4 mr-2" />
                  )}
                  Impersonate in Sandbox
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
