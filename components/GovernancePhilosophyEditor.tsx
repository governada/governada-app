'use client';

import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { posthog } from '@/lib/posthog';
import { getStoredSession } from '@/lib/supabaseAuth';
import { useWallet } from '@/utils/wallet';
import { useDRepUpdate } from '@/hooks/useDRepUpdate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  BookOpen,
  Save,
  Loader2,
  PenLine,
  Globe,
  CheckCircle2,
  ExternalLink,
  AlertCircle,
  Copy,
  Check,
} from 'lucide-react';

interface PhilosophyData {
  philosophy_text: string | null;
  updated_at: string | null;
  anchor_url: string | null;
  anchor_hash: string | null;
}

interface GovernancePhilosophyEditorProps {
  drepId: string;
  readOnly?: boolean;
}

export function GovernancePhilosophyEditor({
  drepId,
  readOnly = false,
}: GovernancePhilosophyEditorProps) {
  const queryClient = useQueryClient();
  const { connected, ownDRepId } = useWallet();
  const { phase, publishOnChain, reset, isProcessing, canPublish } = useDRepUpdate();

  const { data: philData, isLoading: loading } = useQuery<PhilosophyData>({
    queryKey: ['drep-philosophy', drepId],
    queryFn: () =>
      fetch(`/api/drep/${encodeURIComponent(drepId)}/philosophy`).then((r) =>
        r.ok ? r.json() : null,
      ),
    enabled: !!drepId,
  });

  const [text, setText] = useState('');
  const [savedText, setSavedText] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [anchorUrl, setAnchorUrl] = useState<string | null>(null);
  const [anchorHash, setAnchorHash] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!initialized && philData !== undefined) {
    const initialText = philData?.philosophy_text || '';
    setText(initialText);
    setSavedText(initialText);
    setAnchorUrl(philData?.anchor_url ?? null);
    setAnchorHash(philData?.anchor_hash ?? null);
    setInitialized(true);
  }

  const isOwner = connected && ownDRepId === drepId;

  const handleSave = useCallback(async () => {
    const token = getStoredSession();
    if (!token || !text.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/drep/${encodeURIComponent(drepId)}/philosophy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken: token, philosophyText: text.trim() }),
      });
      if (res.ok) {
        const result = await res.json();
        setSavedText(text.trim());
        setAnchorUrl(result.anchor_url ?? null);
        setAnchorHash(result.anchor_hash ?? null);
        setEditing(false);
        reset();
        queryClient.invalidateQueries({ queryKey: ['drep-philosophy', drepId] });
        posthog.capture('philosophy_saved', { drep_id: drepId, length: text.trim().length });
      }
    } catch {
    } finally {
      setSaving(false);
    }
  }, [text, drepId, reset, queryClient]);

  const handlePublish = useCallback(async () => {
    if (!anchorUrl || !anchorHash) return;
    await publishOnChain(anchorUrl, anchorHash);
  }, [anchorUrl, anchorHash, publishOnChain]);

  const handleCopyHash = useCallback(() => {
    if (!anchorHash) return;
    navigator.clipboard.writeText(anchorHash).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [anchorHash]);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4" />
            Governance Philosophy
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-16 animate-pulse bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  if (readOnly) {
    if (!savedText) return null;
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4" />
            Governance Philosophy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{savedText}</p>
          {anchorHash && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              CIP-100 anchored
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4" />
            Governance Philosophy
          </CardTitle>
          {!editing && savedText && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs gap-1"
              onClick={() => setEditing(true)}
            >
              <PenLine className="h-3 w-3" /> Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!savedText && !editing ? (
          <div className="text-center py-3 space-y-2">
            <p className="text-xs text-muted-foreground">Tell delegators what you stand for.</p>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => setEditing(true)}
            >
              <PenLine className="h-3 w-3" /> Write Philosophy
            </Button>
          </div>
        ) : editing ? (
          <div className="space-y-3">
            <textarea
              className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Describe your governance values, priorities, and approach..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={10000}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{text.length}/10,000</span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setText(savedText);
                    setEditing(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={handleSave}
                  disabled={saving || !text.trim()}
                >
                  {saving ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Save className="h-3 w-3" />
                  )}{' '}
                  Save
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{savedText}</p>
        )}

        {/* Anchor info + Publish On-Chain (only for owner with saved text) */}
        {isOwner && savedText && !editing && anchorHash && (
          <div className="border-t pt-3 space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
              <span>CIP-100 document ready</span>
              <button
                onClick={handleCopyHash}
                className="ml-auto flex items-center gap-1 hover:text-foreground transition-colors"
                title="Copy content hash"
              >
                {copied ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                <span className="font-mono">{anchorHash.slice(0, 12)}...</span>
              </button>
            </div>

            {/* Publish on-chain button */}
            {phase.status === 'idle' && (
              <Button
                size="sm"
                variant="outline"
                className="w-full gap-1.5 text-xs"
                onClick={handlePublish}
                disabled={!canPublish || isProcessing}
              >
                <Globe className="h-3 w-3" />
                Publish On-Chain
              </Button>
            )}

            {/* Processing states */}
            {isProcessing && (
              <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs" disabled>
                <Loader2 className="h-3 w-3 animate-spin" />
                {phase.status === 'building'
                  ? 'Building transaction...'
                  : phase.status === 'signing'
                    ? 'Waiting for wallet signature...'
                    : 'Submitting to network...'}
              </Button>
            )}

            {/* Success */}
            {phase.status === 'success' && (
              <div className="rounded-md bg-green-500/10 border border-green-500/20 p-2 space-y-1">
                <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Published on-chain!
                </p>
                <a
                  href={`https://cexplorer.io/tx/${phase.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  View transaction
                </a>
              </div>
            )}

            {/* Error */}
            {phase.status === 'error' && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-2 space-y-1">
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {phase.message}
                </p>
                <p className="text-xs text-muted-foreground">{phase.hint}</p>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={reset}>
                  Try again
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
