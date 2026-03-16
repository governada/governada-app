'use client';

import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Save,
  ShieldCheck,
  FileCode,
  History,
  ArrowRight,
  Archive,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { useSaveVersion, useConstitutionalCheck, useCip108Preview } from '@/hooks/useDrafts';
import { StageTransitionDialog } from './StageTransitionDialog';
import type {
  ProposalDraft,
  DraftVersion,
  DraftStatus,
  ConstitutionalCheckResult,
  Cip108Document,
} from '@/lib/workspace/types';
import { useQueryClient } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Stage transition config
// ---------------------------------------------------------------------------

const NEXT_STAGE: Partial<Record<DraftStatus, { target: DraftStatus; label: string }>> = {
  draft: { target: 'community_review', label: 'Move to Community Review' },
  community_review: { target: 'response_revision', label: 'Move to Response' },
  response_revision: { target: 'final_comment', label: 'Start FCP' },
  final_comment: { target: 'submitted', label: 'Mark as Submitted' },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface DraftActionsProps {
  draft: ProposalDraft;
  versions: DraftVersion[];
}

export function DraftActions({ draft, versions }: DraftActionsProps) {
  const queryClient = useQueryClient();
  const saveVersion = useSaveVersion(draft.id);
  const constitutionalCheck = useConstitutionalCheck();
  const cip108Preview = useCip108Preview();

  // Save version dialog state
  const [versionDialogOpen, setVersionDialogOpen] = useState(false);
  const [versionName, setVersionName] = useState('');
  const [editSummary, setEditSummary] = useState('');

  // Constitutional check result
  const [checkResult, setCheckResult] = useState<ConstitutionalCheckResult | null>(null);

  // CIP-108 preview
  const [cip108Open, setCip108Open] = useState(false);
  const [cip108Data, setCip108Data] = useState<{
    document: Cip108Document;
    contentHash: string;
  } | null>(null);

  // Stage transition dialog
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [stageTarget, setStageTarget] = useState<DraftStatus | null>(null);

  const handleSaveVersion = async () => {
    if (!versionName.trim()) return;
    await saveVersion.mutateAsync({
      versionName: versionName.trim(),
      editSummary: editSummary.trim() || undefined,
    });
    setVersionDialogOpen(false);
    setVersionName('');
    setEditSummary('');
  };

  const handleConstitutionalCheck = async () => {
    const result = await constitutionalCheck.mutateAsync({
      title: draft.title,
      abstract: draft.abstract,
      motivation: draft.motivation,
      rationale: draft.rationale,
      proposalType: draft.proposalType,
      typeSpecific: draft.typeSpecific ?? undefined,
    });
    setCheckResult(result);
  };

  const handleCip108Preview = async () => {
    const result = await cip108Preview.mutateAsync({
      title: draft.title,
      abstract: draft.abstract,
      motivation: draft.motivation,
      rationale: draft.rationale,
    });
    setCip108Data(result);
    setCip108Open(true);
  };

  const handleStageTransition = useCallback((target: DraftStatus) => {
    setStageTarget(target);
    setStageDialogOpen(true);
  }, []);

  const handleStageSuccess = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['author-draft', draft.id] });
    queryClient.invalidateQueries({ queryKey: ['author-drafts'] });
  }, [queryClient, draft.id]);

  const nextStage = NEXT_STAGE[draft.status];
  const canArchive = draft.status !== 'archived';
  const isSubmitted = draft.status === 'submitted';

  return (
    <div className="space-y-4">
      {/* Stage Transition */}
      {(nextStage || canArchive) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Lifecycle</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {nextStage && (
              <Button
                variant="default"
                size="sm"
                className="w-full justify-start"
                onClick={() => handleStageTransition(nextStage.target)}
              >
                <ArrowRight className="mr-2 h-4 w-4" />
                {nextStage.label}
              </Button>
            )}
            {canArchive && (
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start text-muted-foreground"
                onClick={() => handleStageTransition('archived')}
              >
                <Archive className="mr-2 h-4 w-4" />
                Archive
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={() => setVersionDialogOpen(true)}
            disabled={isSubmitted}
          >
            <Save className="mr-2 h-4 w-4" />
            Save Version
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={handleConstitutionalCheck}
            disabled={constitutionalCheck.isPending || !draft.title || isSubmitted}
          >
            <ShieldCheck className="mr-2 h-4 w-4" />
            {constitutionalCheck.isPending ? 'Checking...' : 'Constitutional Check'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={handleCip108Preview}
            disabled={cip108Preview.isPending || !draft.title}
          >
            <FileCode className="mr-2 h-4 w-4" />
            {cip108Preview.isPending ? 'Generating...' : 'CIP-108 Preview'}
          </Button>
        </CardContent>
      </Card>

      {/* Constitutional Check Result */}
      {checkResult && (
        <ConstitutionalCheckPanel
          result={checkResult}
          onRerun={handleConstitutionalCheck}
          isRunning={constitutionalCheck.isPending}
        />
      )}

      {/* Version History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <History className="h-4 w-4" />
            Version History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {versions.length === 0 ? (
            <p className="text-xs text-muted-foreground">No versions saved yet.</p>
          ) : (
            <div className="space-y-2">
              {versions.map((v) => (
                <div key={v.id} className="text-xs border-b last:border-0 pb-2 last:pb-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">v{v.versionNumber}</span>
                    <span className="text-muted-foreground">
                      {new Date(v.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-muted-foreground">{v.versionName}</p>
                  {v.editSummary && (
                    <p className="text-muted-foreground/70 italic">{v.editSummary}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Version Dialog */}
      <Dialog open={versionDialogOpen} onOpenChange={setVersionDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save Version</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="version-name">Version Name</Label>
              <Input
                id="version-name"
                value={versionName}
                onChange={(e) => setVersionName(e.target.value)}
                placeholder="e.g. Added treasury details"
                maxLength={200}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-summary">Edit Summary (optional)</Label>
              <Textarea
                id="edit-summary"
                value={editSummary}
                onChange={(e) => setEditSummary(e.target.value)}
                placeholder="What changed in this version?"
                rows={3}
                maxLength={1000}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setVersionDialogOpen(false)}
              disabled={saveVersion.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveVersion}
              disabled={saveVersion.isPending || !versionName.trim()}
            >
              {saveVersion.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CIP-108 Preview Modal */}
      {cip108Data && (
        <CIP108PreviewModal open={cip108Open} onOpenChange={setCip108Open} data={cip108Data} />
      )}

      {/* Stage Transition Dialog */}
      {stageTarget && (
        <StageTransitionDialog
          open={stageDialogOpen}
          onOpenChange={setStageDialogOpen}
          draftId={draft.id}
          currentStage={draft.status}
          targetStage={stageTarget}
          onSuccess={handleStageSuccess}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline ConstitutionalCheckPanel (simplified from original)
// ---------------------------------------------------------------------------

function ConstitutionalCheckPanel({
  result,
  onRerun,
  isRunning,
}: {
  result: ConstitutionalCheckResult;
  onRerun: () => void;
  isRunning: boolean;
}) {
  const icon =
    result.score === 'pass' ? (
      <CheckCircle className="h-4 w-4 text-emerald-500" />
    ) : result.score === 'warning' ? (
      <AlertTriangle className="h-4 w-4 text-amber-500" />
    ) : (
      <AlertCircle className="h-4 w-4 text-destructive" />
    );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          {icon}
          Constitutional Check
          <Badge
            variant="outline"
            className={`text-xs ml-auto ${
              result.score === 'pass'
                ? 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                : result.score === 'warning'
                  ? 'border-amber-500/30 text-amber-600 dark:text-amber-400'
                  : 'border-destructive/30 text-destructive'
            }`}
          >
            {result.score}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {result.flags.length === 0 ? (
          <p className="text-xs text-muted-foreground">No constitutional concerns found.</p>
        ) : (
          <div className="space-y-1.5">
            {result.flags.map((flag, i) => (
              <div key={i} className="text-xs space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      flag.severity === 'critical'
                        ? 'border-destructive/30 text-destructive'
                        : flag.severity === 'warning'
                          ? 'border-amber-500/30 text-amber-600 dark:text-amber-400'
                          : 'border-primary/30 text-primary'
                    }`}
                  >
                    {flag.severity}
                  </Badge>
                  <span className="font-medium">
                    Art. {flag.article}
                    {flag.section ? `, ${flag.section}` : ''}
                  </span>
                </div>
                <p className="text-muted-foreground pl-4">{flag.concern}</p>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] text-muted-foreground">
            Checked {new Date(result.checkedAt).toLocaleString()}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs"
            onClick={onRerun}
            disabled={isRunning}
          >
            Re-run
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Inline CIP108PreviewModal (simplified from original)
// ---------------------------------------------------------------------------

function CIP108PreviewModal({
  open,
  onOpenChange,
  data,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: { document: Cip108Document; contentHash: string } | null;
}) {
  if (!data) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>CIP-108 Preview</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label className="text-xs text-muted-foreground">Content Hash</Label>
            <p className="text-xs font-mono break-all">{data.contentHash}</p>
          </div>
          <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto">
            {JSON.stringify(data.document, null, 2)}
          </pre>
        </div>
      </DialogContent>
    </Dialog>
  );
}
