'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getStoredSession } from '@/lib/supabaseAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Vote, CheckCircle2, XCircle, Eye, Clock, Users } from 'lucide-react';

interface Assembly {
  id: string;
  title: string;
  description: string | null;
  question: string;
  options: { key: string; label: string; description?: string }[];
  status: 'draft' | 'active' | 'closed' | 'cancelled';
  epoch: number;
  opens_at: string;
  closes_at: string;
  total_votes: number;
  source: string | null;
  created_at: string;
}

async function fetchAssemblies(): Promise<Assembly[]> {
  const token = getStoredSession();
  const res = await fetch('/api/admin/assemblies', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error('Failed to fetch assemblies');
  return res.json();
}

export function AssembliesClient() {
  const queryClient = useQueryClient();
  const { data: assemblies, isLoading } = useQuery({
    queryKey: ['admin-assemblies'],
    queryFn: fetchAssemblies,
    staleTime: 10_000,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const token = getStoredSession();
      const res = await fetch('/api/admin/assemblies', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error('Failed to update assembly');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-assemblies'] });
    },
  });

  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const drafts = assemblies?.filter((a) => a.status === 'draft') ?? [];
  const active = assemblies?.filter((a) => a.status === 'active') ?? [];
  const closed = assemblies?.filter((a) => a.status === 'closed') ?? [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Citizen Assemblies</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review AI-generated drafts, activate assemblies, and view results.
        </p>
      </div>

      {/* Drafts */}
      {drafts.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Drafts awaiting review ({drafts.length})
          </h2>
          {drafts.map((assembly) => (
            <Card key={assembly.id} className="ring-1 ring-amber-500/20">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Vote className="h-4 w-4 text-amber-500" />
                    {assembly.title}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {assembly.source === 'ai_generated' ? 'AI Generated' : 'Manual'}
                    </Badge>
                    <Badge variant="outline">Epoch {assembly.epoch}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {assembly.description && (
                  <p className="text-sm text-muted-foreground">{assembly.description}</p>
                )}
                <p className="text-sm font-medium">{assembly.question}</p>

                <div className="space-y-1">
                  {assembly.options.map((opt) => (
                    <div
                      key={opt.key}
                      className="text-sm p-2 rounded border border-border/50 bg-muted/30"
                    >
                      <span className="font-medium">{opt.label}</span>
                      {opt.description && (
                        <span className="text-muted-foreground"> — {opt.description}</span>
                      )}
                    </div>
                  ))}
                </div>

                <div className="text-xs text-muted-foreground">
                  Opens: {new Date(assembly.opens_at).toLocaleString()} | Closes:{' '}
                  {new Date(assembly.closes_at).toLocaleString()}
                </div>

                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    onClick={() => updateStatus.mutate({ id: assembly.id, status: 'active' })}
                    disabled={updateStatus.isPending}
                    className="gap-1.5"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Activate
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => updateStatus.mutate({ id: assembly.id, status: 'cancelled' })}
                    disabled={updateStatus.isPending}
                    className="gap-1.5"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Discard
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      {/* Active */}
      {active.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Active ({active.length})
          </h2>
          {active.map((assembly) => (
            <Card key={assembly.id} className="ring-1 ring-green-500/20">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Clock className="h-4 w-4 text-green-500" />
                    {assembly.title}
                  </CardTitle>
                  <Badge className="bg-green-500/15 text-green-600 dark:text-green-400 border-0">
                    Active
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="text-sm">
                <p>{assembly.question}</p>
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {assembly.total_votes} votes | Closes{' '}
                  {new Date(assembly.closes_at).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      {/* Closed */}
      {closed.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Closed ({closed.length})
          </h2>
          {closed.map((assembly) => (
            <Card key={assembly.id} className="opacity-70">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{assembly.title}</CardTitle>
                  <button
                    onClick={() => setExpandedId(expandedId === assembly.id ? null : assembly.id)}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    <Eye className="h-3 w-3" />
                    {expandedId === assembly.id ? 'Hide' : 'Details'}
                  </button>
                </div>
              </CardHeader>
              {expandedId === assembly.id && (
                <CardContent className="text-sm space-y-1">
                  <p className="text-muted-foreground">{assembly.question}</p>
                  <p className="text-xs">
                    {assembly.total_votes} votes | Epoch {assembly.epoch}
                  </p>
                </CardContent>
              )}
            </Card>
          ))}
        </section>
      )}

      {drafts.length === 0 && active.length === 0 && closed.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No assemblies yet. Enable the{' '}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">
              citizen_assembly_ai_generation
            </code>{' '}
            feature flag to start generating drafts.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
