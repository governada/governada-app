'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { History, Loader2, PencilLine, Plus, Siren } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import {
  buildInitialIncidentForm,
  createSystemsIncident,
  fetchSystemsSection,
  formatDate,
  formatDateTime,
  incidentEntryTypeLabel,
  incidentSeverityLabel,
  incidentStatusLabel,
  updateSystemsIncident,
  type IncidentFormState,
} from './systems-client';
import { EmptyState, SectionCard, StatusBadge, WorkspaceHero } from './systems-ui';

function invalidateSystems(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: ['systems'] });
}

const STATUS_TRANSITIONS: Record<
  'open' | 'mitigated' | 'follow_up_pending' | 'resolved',
  Array<{ label: string; status: 'open' | 'mitigated' | 'follow_up_pending' | 'resolved' }>
> = {
  open: [
    { label: 'Mitigate', status: 'mitigated' },
    { label: 'Mark follow-up pending', status: 'follow_up_pending' },
    { label: 'Resolve', status: 'resolved' },
  ],
  mitigated: [
    { label: 'Mark follow-up pending', status: 'follow_up_pending' },
    { label: 'Resolve', status: 'resolved' },
    { label: 'Reopen', status: 'open' },
  ],
  follow_up_pending: [
    { label: 'Resolve', status: 'resolved' },
    { label: 'Reopen', status: 'open' },
  ],
  resolved: [{ label: 'Reopen', status: 'open' }],
};

const INCIDENT_ENTRY_TYPES: IncidentFormState['entryType'][] = ['incident', 'drill'];
const INCIDENT_SEVERITY_OPTIONS: IncidentFormState['severity'][] = ['p0', 'p1', 'p2', 'near_miss'];
const INCIDENT_STATUS_OPTIONS: IncidentFormState['status'][] = [
  'open',
  'mitigated',
  'follow_up_pending',
  'resolved',
];
const DRILL_STATUS_OPTIONS: IncidentFormState['status'][] = [
  'open',
  'follow_up_pending',
  'resolved',
];

export function IncidentsWorkspaceClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const panel = searchParams.get('panel');
  const incidentId = searchParams.get('incidentId');
  const isEditorOpen = panel === 'create' || panel === 'edit';
  const [form, setForm] = useState<IncidentFormState | null>(null);

  const query = useQuery({
    queryKey: ['systems', 'incidents'],
    queryFn: () => fetchSystemsSection('incidents'),
  });

  const selectedIncident = useMemo(
    () => query.data?.incidents.find((incident) => incident.id === incidentId) ?? null,
    [incidentId, query.data?.incidents],
  );

  useEffect(() => {
    if (!isEditorOpen || !query.data || form) return;
    setForm(buildInitialIncidentForm(panel === 'edit' ? selectedIncident : null));
  }, [form, isEditorOpen, panel, query.data, selectedIncident]);

  const createMutation = useMutation({
    mutationFn: createSystemsIncident,
    onSuccess: async () => {
      toast.success('Incident logged');
      setForm(null);
      router.replace(pathname, { scroll: false });
      await invalidateSystems(queryClient);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to log incident');
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateSystemsIncident,
    onSuccess: async () => {
      toast.success('Incident updated');
      setForm(null);
      router.replace(pathname, { scroll: false });
      await invalidateSystems(queryClient);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update incident');
    },
  });

  if (query.isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-72 animate-pulse rounded-3xl border border-border/60 bg-muted/25" />
        <div className="h-[36rem] animate-pulse rounded-3xl border border-border/60 bg-muted/25" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <EmptyState
        title="Incident workspace unavailable"
        description={
          query.error instanceof Error
            ? query.error.message
            : 'The incident workspace could not be loaded.'
        }
      />
    );
  }

  const data = query.data;
  const liveIncidents = data.incidents.filter((incident) => incident.status !== 'resolved');

  const openCreate = () => {
    setForm(buildInitialIncidentForm(null));
    router.replace(`${pathname}?panel=create`, { scroll: false });
  };

  const openEdit = (id: string) => {
    const record = data.incidents.find((incident) => incident.id === id) ?? null;
    setForm(buildInitialIncidentForm(record));
    router.replace(`${pathname}?panel=edit&incidentId=${encodeURIComponent(id)}`, {
      scroll: false,
    });
  };

  const closeEditor = () => {
    setForm(null);
    router.replace(pathname, { scroll: false });
  };

  const submitForm = async (event: FormEvent) => {
    event.preventDefault();
    if (!form) return;
    if (form.id) {
      await updateMutation.mutateAsync(form);
      return;
    }
    await createMutation.mutateAsync(form);
  };

  const quickTransition = async (
    incidentIdValue: string,
    status: 'open' | 'mitigated' | 'follow_up_pending' | 'resolved',
  ) => {
    const incident = data.incidents.find((entry) => entry.id === incidentIdValue);
    if (!incident) return;
    await updateMutation.mutateAsync({ ...buildInitialIncidentForm(incident), status });
  };

  const setEntryType = (entryType: IncidentFormState['entryType']) => {
    setForm((current) => {
      if (!current) return current;

      if (entryType === 'incident') {
        return {
          ...current,
          entryType,
          severity: current.severity === 'drill' ? 'p1' : current.severity,
          status:
            current.entryType === 'drill' && current.status === 'resolved'
              ? 'open'
              : current.status,
        };
      }

      return {
        ...current,
        entryType,
        severity: 'drill',
        status:
          current.status === 'mitigated' || current.status === 'open'
            ? 'follow_up_pending'
            : current.status,
      };
    });
  };

  return (
    <div className="space-y-6">
      <WorkspaceHero summary={data.summary}>
        <div className="flex flex-wrap gap-3">
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Log incident or drill
          </Button>
        </div>
      </WorkspaceHero>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard title="Live incidents" description={data.incidentSummary.summary}>
          <div className="space-y-3">
            {liveIncidents.length === 0 ? (
              <EmptyState
                title="No live incidents"
                description="There are no unresolved incidents or drills at the moment."
                actionLabel="Log a drill"
                onAction={openCreate}
              />
            ) : (
              liveIncidents.map((incident) => (
                <div
                  key={incident.id}
                  className="rounded-2xl border border-border/70 bg-card/70 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge
                      status={
                        incident.status === 'resolved'
                          ? 'good'
                          : incident.severity === 'p0' || incident.severity === 'p1'
                            ? 'critical'
                            : 'warning'
                      }
                    />
                    <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                      {incidentStatusLabel(incident.status)}
                    </Badge>
                    <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                      {incidentSeverityLabel(incident.severity)}
                    </Badge>
                    <p className="text-sm font-semibold">{incident.title}</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{incident.summary}</p>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {incident.entryType === 'drill' ? 'Drill' : 'Incident'} |{' '}
                    {formatDate(incident.incidentDate)} | Owner {incident.followUpOwner}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {STATUS_TRANSITIONS[incident.status].map((transition) => (
                      <Button
                        key={transition.label}
                        size="sm"
                        variant={transition.status === 'resolved' ? 'default' : 'outline'}
                        onClick={() => quickTransition(incident.id, transition.status)}
                      >
                        {transition.label}
                      </Button>
                    ))}
                    <Button size="sm" variant="ghost" onClick={() => openEdit(incident.id)}>
                      <PencilLine className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Drill and retro follow-ups"
          description="These are the automation nudges that keep drills and incident learning from silently disappearing."
        >
          <div className="space-y-3">
            {data.automationFollowups.length === 0 ? (
              <EmptyState
                title="No drill-specific follow-ups"
                description="Drill cadence and incident retro follow-ups are currently clear."
              />
            ) : (
              data.automationFollowups.map((followup) => (
                <div
                  key={followup.sourceKey}
                  className="rounded-2xl border border-border/70 bg-card/70 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                      {followup.triggerType === 'drill_cadence'
                        ? 'Drill cadence'
                        : 'Incident retro'}
                    </Badge>
                    <StatusBadge
                      status={followup.severity === 'critical' ? 'critical' : 'warning'}
                    />
                  </div>
                  <p className="mt-3 text-base font-semibold">{followup.title}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{followup.summary}</p>
                  {followup.actionHref ? (
                    <Button asChild variant="ghost" className="mt-3 px-0">
                      <Link href={followup.actionHref}>Open source</Link>
                    </Button>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <SectionCard
          title="Recent incident trail"
          description="The current record, not the raw audit log, should tell the founder which incidents are still live."
        >
          <div className="space-y-3">
            {data.incidents.length === 0 ? (
              <EmptyState
                title="No incidents logged"
                description="The incident and drill trail has not started yet."
              />
            ) : (
              data.incidents.map((incident) => (
                <div
                  key={incident.id}
                  className="rounded-2xl border border-border/70 bg-card/70 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                      {incident.entryType}
                    </Badge>
                    <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                      {incidentStatusLabel(incident.status)}
                    </Badge>
                    <p className="text-sm font-semibold">{incident.title}</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {incident.userImpact}
                  </p>
                  <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                    <p>Detected by {incident.detectedBy}</p>
                    <p>Systems affected: {incident.systemsAffected.join(', ') || 'Not recorded'}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Event trail"
          description="Status transitions remain visible even after an incident is resolved."
        >
          <div className="space-y-3">
            {data.incidentEvents.length === 0 ? (
              <EmptyState
                title="No incident events"
                description="No incident events are recorded yet."
              />
            ) : (
              data.incidentEvents.map((eventRecord) => (
                <div
                  key={eventRecord.id}
                  className="rounded-2xl border border-border/70 bg-card/70 p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-muted p-2 text-muted-foreground">
                      <History className="h-4 w-4" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                          {eventRecord.eventType.replace('_', ' ')}
                        </Badge>
                        <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                          {incidentStatusLabel(eventRecord.status)}
                        </Badge>
                      </div>
                      <p className="text-sm font-semibold">{eventRecord.title}</p>
                      <p className="text-sm leading-6 text-muted-foreground">
                        {eventRecord.summary}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(eventRecord.createdAt)} | {eventRecord.actorWalletAddress}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </div>

      <Sheet
        open={isEditorOpen}
        onOpenChange={(open) =>
          open
            ? panel === 'edit' && selectedIncident
              ? openEdit(selectedIncident.id)
              : openCreate()
            : closeEditor()
        }
      >
        <SheetContent className="w-full sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>
              {form?.id ? 'Update incident or drill' : 'Log incident or drill'}
            </SheetTitle>
            <SheetDescription>
              Keep the founder-facing incident state durable, explicit, and auditable.
            </SheetDescription>
          </SheetHeader>
          {form ? (
            <form
              onSubmit={submitForm}
              className="flex h-full flex-col gap-4 overflow-y-auto px-4 pb-6"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="incident-date">Date</Label>
                  <Input
                    id="incident-date"
                    type="date"
                    value={form.incidentDate}
                    onChange={(event) => setForm({ ...form, incidentDate: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="follow-up-owner">Follow-up owner</Label>
                  <Input
                    id="follow-up-owner"
                    value={form.followUpOwner}
                    onChange={(event) => setForm({ ...form, followUpOwner: event.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="entry-type">Entry type</Label>
                  <Select
                    value={form.entryType}
                    onValueChange={(value) => setEntryType(value as IncidentFormState['entryType'])}
                  >
                    <SelectTrigger id="entry-type" className="w-full">
                      <SelectValue placeholder="Choose entry type" />
                    </SelectTrigger>
                    <SelectContent>
                      {INCIDENT_ENTRY_TYPES.map((entryType) => (
                        <SelectItem key={entryType} value={entryType}>
                          {incidentEntryTypeLabel(entryType)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="incident-severity">Severity</Label>
                  <Select
                    value={form.severity}
                    onValueChange={(value) =>
                      setForm({
                        ...form,
                        severity: value as IncidentFormState['severity'],
                      })
                    }
                  >
                    <SelectTrigger id="incident-severity" className="w-full">
                      <SelectValue placeholder="Choose severity" />
                    </SelectTrigger>
                    <SelectContent>
                      {(form.entryType === 'drill' ? ['drill'] : INCIDENT_SEVERITY_OPTIONS).map(
                        (severity) => (
                          <SelectItem key={severity} value={severity}>
                            {incidentSeverityLabel(severity as IncidentFormState['severity'])}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="incident-status">Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(value) =>
                      setForm({ ...form, status: value as IncidentFormState['status'] })
                    }
                  >
                    <SelectTrigger id="incident-status" className="w-full">
                      <SelectValue placeholder="Choose status" />
                    </SelectTrigger>
                    <SelectContent>
                      {(form.entryType === 'incident'
                        ? INCIDENT_STATUS_OPTIONS
                        : DRILL_STATUS_OPTIONS
                      ).map((status) => (
                        <SelectItem key={status} value={status}>
                          {incidentStatusLabel(status)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="incident-title">Title</Label>
                <Input
                  id="incident-title"
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="detected-by">Detected by</Label>
                <Input
                  id="detected-by"
                  value={form.detectedBy}
                  onChange={(event) => setForm({ ...form, detectedBy: event.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="systems-affected">Systems affected</Label>
                <Textarea
                  id="systems-affected"
                  rows={3}
                  value={form.systemsAffected}
                  onChange={(event) => setForm({ ...form, systemsAffected: event.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="user-impact">User impact</Label>
                <Textarea
                  id="user-impact"
                  rows={4}
                  value={form.userImpact}
                  onChange={(event) => setForm({ ...form, userImpact: event.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="root-cause">Root cause</Label>
                <Textarea
                  id="root-cause"
                  rows={4}
                  value={form.rootCause}
                  onChange={(event) => setForm({ ...form, rootCause: event.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mitigation">Mitigation</Label>
                <Textarea
                  id="mitigation"
                  rows={4}
                  value={form.mitigation}
                  onChange={(event) => setForm({ ...form, mitigation: event.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="permanent-fix">Permanent fix</Label>
                <Textarea
                  id="permanent-fix"
                  rows={4}
                  value={form.permanentFix}
                  onChange={(event) => setForm({ ...form, permanentFix: event.target.value })}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="tta">Time to acknowledge (min)</Label>
                  <Input
                    id="tta"
                    type="number"
                    min="0"
                    step="1"
                    value={form.timeToAcknowledgeMinutes}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        timeToAcknowledgeMinutes: event.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ttm">Time to mitigate (min)</Label>
                  <Input
                    id="ttm"
                    type="number"
                    min="0"
                    step="1"
                    value={form.timeToMitigateMinutes}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        timeToMitigateMinutes: event.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ttr">Time to resolve (min)</Label>
                  <Input
                    id="ttr"
                    type="number"
                    min="0"
                    step="1"
                    value={form.timeToResolveMinutes}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        timeToResolveMinutes: event.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Siren className="mr-2 h-4 w-4" />
                  )}
                  {form.id ? 'Save incident' : 'Log incident'}
                </Button>
                <Button type="button" variant="outline" onClick={closeEditor}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
