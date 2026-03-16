'use client';

import { useState } from 'react';
import { Users, Copy, Check, UserPlus, LogOut, Crown, Pencil, Eye, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  useTeam,
  useCreateTeam,
  useCreateInvite,
  useUpdateMemberRole,
  useRemoveMember,
} from '@/hooks/useTeam';
import type { TeamMember, TeamRole } from '@/lib/workspace/types';

interface TeamManagementProps {
  draftId: string;
  isOwner: boolean;
  viewerStakeAddress: string;
}

const ROLE_ICONS: Record<TeamRole, typeof Crown> = {
  lead: Crown,
  editor: Pencil,
  viewer: Eye,
};

const ROLE_LABELS: Record<TeamRole, string> = {
  lead: 'Lead',
  editor: 'Editor',
  viewer: 'Viewer',
};

function truncateAddress(addr: string): string {
  if (addr.length <= 16) return addr;
  return `${addr.slice(0, 8)}...${addr.slice(-8)}`;
}

export function TeamManagement({ draftId, isOwner, viewerStakeAddress }: TeamManagementProps) {
  const { data, isLoading } = useTeam(draftId);
  const createTeam = useCreateTeam();
  const createInvite = useCreateInvite();
  const updateRole = useUpdateMemberRole();
  const removeMember = useRemoveMember();

  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor');
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const team = data?.team ?? null;
  const members = data?.members ?? [];
  const isLead = members.some((m) => m.stakeAddress === viewerStakeAddress && m.role === 'lead');
  const isMember = members.some((m) => m.stakeAddress === viewerStakeAddress);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Team
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-16 animate-pulse bg-muted/30 rounded" />
        </CardContent>
      </Card>
    );
  }

  // No team yet -- show create button for owners
  if (!team) {
    if (!isOwner) return null;
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Team
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            Invite collaborators to edit or review this draft together.
          </p>
          <Button
            size="sm"
            className="w-full"
            onClick={() => {
              createTeam.mutate(
                { draftId },
                {
                  onSuccess: () => setShowInviteDialog(true),
                },
              );
            }}
            disabled={createTeam.isPending}
          >
            <UserPlus className="h-3.5 w-3.5 mr-1.5" />
            {createTeam.isPending ? 'Creating...' : 'Invite Collaborators'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const handleCreateInvite = () => {
    if (!team) return;
    createInvite.mutate(
      { teamId: team.id, role: inviteRole },
      {
        onSuccess: (result) => {
          setInviteCode(result.invite.inviteCode);
        },
      },
    );
  };

  const handleCopyInvite = () => {
    if (!inviteCode) return;
    const url = `${window.location.origin}/workspace/author/join?code=${inviteCode}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRoleChange = (member: TeamMember, newRole: 'editor' | 'viewer') => {
    updateRole.mutate({ memberId: member.id, role: newRole });
  };

  const handleRemove = (member: TeamMember) => {
    removeMember.mutate({ memberId: member.id });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" />
          Team
          <Badge variant="secondary" className="ml-auto text-xs">
            {members.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Member list */}
        <div className="space-y-2">
          {members.map((member) => {
            const RoleIcon = ROLE_ICONS[member.role];
            const isMe = member.stakeAddress === viewerStakeAddress;
            return (
              <div key={member.id} className="flex items-center gap-2 text-sm">
                <RoleIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate flex-1 font-mono text-xs">
                  {truncateAddress(member.stakeAddress)}
                  {isMe && <span className="text-muted-foreground ml-1">(you)</span>}
                </span>
                <Badge variant="outline" className="text-[10px] shrink-0">
                  {ROLE_LABELS[member.role]}
                </Badge>

                {/* Actions */}
                {isLead && member.role !== 'lead' && (
                  <div className="flex gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      title={member.role === 'editor' ? 'Change to Viewer' : 'Change to Editor'}
                      onClick={() =>
                        handleRoleChange(member, member.role === 'editor' ? 'viewer' : 'editor')
                      }
                    >
                      {member.role === 'editor' ? (
                        <Eye className="h-3 w-3" />
                      ) : (
                        <Pencil className="h-3 w-3" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive"
                      title="Remove member"
                      onClick={() => handleRemove(member)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}

                {/* Self-remove for non-leads */}
                {isMe && member.role !== 'lead' && !isLead && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive"
                    title="Leave team"
                    onClick={() => handleRemove(member)}
                  >
                    <LogOut className="h-3 w-3" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {/* Invite section (lead only) */}
        {isLead && (
          <>
            {!showInviteDialog ? (
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => setShowInviteDialog(true)}
              >
                <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                Invite Member
              </Button>
            ) : (
              <div className="border rounded-lg p-3 space-y-3 bg-muted/20">
                <p className="text-xs font-medium">Generate invite link</p>

                {/* Role selector */}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={inviteRole === 'editor' ? 'default' : 'outline'}
                    className="flex-1 text-xs"
                    onClick={() => setInviteRole('editor')}
                  >
                    <Pencil className="h-3 w-3 mr-1" />
                    Editor
                  </Button>
                  <Button
                    size="sm"
                    variant={inviteRole === 'viewer' ? 'default' : 'outline'}
                    className="flex-1 text-xs"
                    onClick={() => setInviteRole('viewer')}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    Viewer
                  </Button>
                </div>

                {!inviteCode ? (
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={handleCreateInvite}
                    disabled={createInvite.isPending}
                  >
                    {createInvite.isPending ? 'Generating...' : 'Generate Link'}
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                        ...join?code={inviteCode.slice(0, 8)}...
                      </code>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7 shrink-0"
                        onClick={handleCopyInvite}
                      >
                        {copied ? (
                          <Check className="h-3 w-3 text-emerald-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Link expires in 72 hours. Single use.
                    </p>
                  </div>
                )}

                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full text-xs"
                  onClick={() => {
                    setShowInviteDialog(false);
                    setInviteCode(null);
                    setCopied(false);
                  }}
                >
                  Close
                </Button>
              </div>
            )}
          </>
        )}

        {/* Leave team for non-lead members */}
        {isMember && !isLead && (
          <Button
            size="sm"
            variant="ghost"
            className="w-full text-xs text-destructive"
            onClick={() => {
              const me = members.find((m) => m.stakeAddress === viewerStakeAddress);
              if (me) handleRemove(me);
            }}
          >
            <LogOut className="h-3.5 w-3.5 mr-1.5" />
            Leave Team
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
