'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getStoredSession } from '@/lib/supabaseAuth';
import { SEGMENT_PRESETS } from '@/lib/admin/viewAsRegistry';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Copy, Plus, Trash2, ChevronDown, ChevronRight, Users, Eye } from 'lucide-react';

// ---- Types ----

interface Cohort {
  id: string;
  name: string;
  description: string | null;
  invite_count: number;
  session_count: number;
  created_at: string;
}

interface Invite {
  id: string;
  cohort_id: string;
  code: string;
  persona_preset_id: string;
  segment_overrides: Record<string, unknown>;
  expires_at: string;
  max_uses: number;
  use_count: number;
  revoked: boolean;
  notes: string | null;
  created_at: string;
}

interface Session {
  id: string;
  cohort_id: string;
  persona_snapshot: Record<string, unknown>;
  revoked: boolean;
  created_at: string;
}

// ---- API helpers ----

function authHeaders(): Record<string, string> {
  const token = getStoredSession();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchCohorts(): Promise<Cohort[]> {
  const res = await fetch('/api/admin/preview/cohorts', { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch cohorts');
  const data = await res.json();
  return data.cohorts ?? [];
}

async function fetchInvites(cohortId: string): Promise<Invite[]> {
  const res = await fetch(`/api/admin/preview/invites?cohort_id=${cohortId}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch invites');
  const data = await res.json();
  return data.invites ?? [];
}

async function fetchSessions(cohortId?: string): Promise<Session[]> {
  const url = cohortId
    ? `/api/admin/preview/sessions?cohort_id=${cohortId}`
    : '/api/admin/preview/sessions';
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch sessions');
  const data = await res.json();
  return data.sessions ?? [];
}

// ---- Components ----

function CohortInvites({ cohortId }: { cohortId: string }) {
  const queryClient = useQueryClient();
  const [showCreateInvite, setShowCreateInvite] = useState(false);
  const [presetId, setPresetId] = useState('');
  const [expiryDays, setExpiryDays] = useState('7');
  const [maxUses, setMaxUses] = useState('5');
  const [notes, setNotes] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: invites, isLoading } = useQuery({
    queryKey: ['admin-preview-invites', cohortId],
    queryFn: () => fetchInvites(cohortId),
    staleTime: 10_000,
  });

  const createInvite = useMutation({
    mutationFn: async () => {
      const token = getStoredSession();
      const res = await fetch('/api/admin/preview/invites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          cohortId,
          personaPresetId: presetId,
          expiresInDays: parseInt(expiryDays, 10) || 7,
          maxUses: parseInt(maxUses, 10) || 5,
          notes: notes || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to create invite');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-preview-invites', cohortId] });
      queryClient.invalidateQueries({ queryKey: ['admin-preview-cohorts'] });
      setShowCreateInvite(false);
      setPresetId('');
      setExpiryDays('7');
      setMaxUses('5');
      setNotes('');
    },
  });

  function copyCode(code: string, inviteId: string) {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedId(inviteId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  function getPresetLabel(id: string): string {
    const preset = SEGMENT_PRESETS.find((p) => p.id === id);
    return preset ? `${preset.segment} / ${preset.label}` : id;
  }

  function getInviteStatus(invite: Invite): {
    label: string;
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
  } {
    if (invite.revoked) return { label: 'Revoked', variant: 'destructive' };
    if (new Date(invite.expires_at) < new Date()) return { label: 'Expired', variant: 'secondary' };
    if (invite.use_count >= invite.max_uses) return { label: 'Exhausted', variant: 'secondary' };
    return { label: 'Active', variant: 'default' };
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-muted-foreground">Invites</h4>
        <Button size="sm" variant="outline" onClick={() => setShowCreateInvite(true)}>
          <Plus className="h-3.5 w-3.5" />
          Create Invite
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading invites...</p>}

      {invites && invites.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Persona</TableHead>
              <TableHead>Uses</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invites.map((invite) => {
              const status = getInviteStatus(invite);
              return (
                <TableRow key={invite.id}>
                  <TableCell>
                    <button
                      onClick={() => copyCode(invite.code, invite.id)}
                      className="inline-flex items-center gap-1.5 font-mono text-xs hover:text-foreground transition-colors"
                      title="Copy code"
                    >
                      {invite.code}
                      <Copy className="h-3 w-3 text-muted-foreground" />
                      {copiedId === invite.id && (
                        <span className="text-xs text-green-400">Copied</span>
                      )}
                    </button>
                  </TableCell>
                  <TableCell className="text-xs">
                    {getPresetLabel(invite.persona_preset_id)}
                  </TableCell>
                  <TableCell className="text-xs">
                    {invite.use_count}/{invite.max_uses}
                  </TableCell>
                  <TableCell className="text-xs">
                    {new Date(invite.expires_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant={status.variant} className="text-xs">
                      {status.label}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {invites && invites.length === 0 && (
        <p className="text-xs text-muted-foreground">No invites yet. Create one to get started.</p>
      )}

      {/* Create Invite Dialog */}
      <Dialog open={showCreateInvite} onOpenChange={setShowCreateInvite}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Invite</DialogTitle>
            <DialogDescription>
              Generate a new invite code for this cohort. Testers use this code to access the
              preview.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Persona Preset</label>
              <Select value={presetId} onValueChange={setPresetId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select persona..." />
                </SelectTrigger>
                <SelectContent>
                  {SEGMENT_PRESETS.filter((p) => !p.requiresPicker).map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>
                      {preset.segment} / {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Expiry (days)</label>
                <Input
                  type="number"
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(e.target.value)}
                  min={1}
                  max={90}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Max Uses</label>
                <Input
                  type="number"
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value)}
                  min={1}
                  max={100}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes (optional)</label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Sent to beta testers batch 1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateInvite(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createInvite.mutate()}
              disabled={!presetId || createInvite.isPending}
            >
              {createInvite.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
          {createInvite.isError && (
            <p className="text-sm text-destructive">{(createInvite.error as Error).message}</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CohortSessions({ cohortId }: { cohortId: string }) {
  const queryClient = useQueryClient();

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['admin-preview-sessions', cohortId],
    queryFn: () => fetchSessions(cohortId),
    staleTime: 10_000,
  });

  const revokeSession = useMutation({
    mutationFn: async (sessionId: string) => {
      const token = getStoredSession();
      const res = await fetch('/api/admin/preview/sessions', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ sessionId }),
      });
      if (!res.ok) throw new Error('Failed to revoke session');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-preview-sessions', cohortId] });
      queryClient.invalidateQueries({ queryKey: ['admin-preview-cohorts'] });
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading sessions...</p>;

  if (!sessions || sessions.length === 0) {
    return <p className="text-xs text-muted-foreground">No active sessions.</p>;
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-muted-foreground">Active Sessions</h4>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Persona</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="w-[80px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sessions.map((session) => {
            const segment =
              (session.persona_snapshot as Record<string, string>)?.segment ?? 'unknown';
            return (
              <TableRow key={session.id}>
                <TableCell className="text-xs capitalize">{segment}</TableCell>
                <TableCell className="text-xs">
                  {new Date(session.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => revokeSession.mutate(session.id)}
                    disabled={revokeSession.isPending}
                    title="Revoke session"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function PreviewClient() {
  const queryClient = useQueryClient();
  const [expandedCohort, setExpandedCohort] = useState<string | null>(null);
  const [showCreateCohort, setShowCreateCohort] = useState(false);
  const [cohortName, setCohortName] = useState('');
  const [cohortDescription, setCohortDescription] = useState('');

  const { data: cohorts, isLoading } = useQuery({
    queryKey: ['admin-preview-cohorts'],
    queryFn: fetchCohorts,
    staleTime: 10_000,
  });

  const createCohort = useMutation({
    mutationFn: async () => {
      const token = getStoredSession();
      const res = await fetch('/api/admin/preview/cohorts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ name: cohortName, description: cohortDescription || undefined }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to create cohort');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-preview-cohorts'] });
      setShowCreateCohort(false);
      setCohortName('');
      setCohortDescription('');
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Preview Management
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage preview cohorts, invite codes, and active sessions.
          </p>
        </div>
        <Button onClick={() => setShowCreateCohort(true)}>
          <Plus className="h-4 w-4" />
          Create Cohort
        </Button>
      </div>

      {isLoading && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Loading cohorts...
          </CardContent>
        </Card>
      )}

      {cohorts && cohorts.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No cohorts yet. Create one to start managing preview access.
          </CardContent>
        </Card>
      )}

      {cohorts?.map((cohort) => {
        const isExpanded = expandedCohort === cohort.id;
        return (
          <Card key={cohort.id}>
            <CardHeader
              className="cursor-pointer"
              onClick={() => setExpandedCohort(isExpanded ? null : cohort.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <CardTitle className="text-base">{cohort.name}</CardTitle>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Copy className="h-3 w-3" />
                    {cohort.invite_count} invites
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {cohort.session_count} sessions
                  </span>
                  <span>{new Date(cohort.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              {cohort.description && (
                <CardDescription className="ml-6">{cohort.description}</CardDescription>
              )}
            </CardHeader>
            {isExpanded && (
              <CardContent className="space-y-6 border-t border-border/40 pt-4">
                <CohortInvites cohortId={cohort.id} />
                <CohortSessions cohortId={cohort.id} />
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* Create Cohort Dialog */}
      <Dialog open={showCreateCohort} onOpenChange={setShowCreateCohort}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Cohort</DialogTitle>
            <DialogDescription>
              A cohort groups preview testers together so they share drafts and annotations within
              their testing namespace.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={cohortName}
                onChange={(e) => setCohortName(e.target.value)}
                placeholder="e.g. Beta Testers March 2026"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description (optional)</label>
              <Input
                value={cohortDescription}
                onChange={(e) => setCohortDescription(e.target.value)}
                placeholder="e.g. Internal team testing ahead of launch"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateCohort(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createCohort.mutate()}
              disabled={!cohortName.trim() || createCohort.isPending}
            >
              {createCohort.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
          {createCohort.isError && (
            <p className="text-sm text-destructive">{(createCohort.error as Error).message}</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
