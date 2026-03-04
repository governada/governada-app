'use client';

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { posthog } from '@/lib/posthog';
import { getStoredSession } from '@/lib/supabaseAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen, Save, Loader2, PenLine } from 'lucide-react';

interface GovernancePhilosophyEditorProps {
  drepId: string;
  readOnly?: boolean;
}

export function GovernancePhilosophyEditor({
  drepId,
  readOnly = false,
}: GovernancePhilosophyEditorProps) {
  const { data: philData, isLoading: loading } = useQuery({
    queryKey: ['drep-philosophy', drepId],
    queryFn: () =>
      fetch(`/api/drep/${encodeURIComponent(drepId)}/philosophy`).then((r) =>
        r.ok ? r.json() : null,
      ),
    enabled: !!drepId,
  });
  const initialText = (philData as any)?.philosophy_text || '';
  const [text, setText] = useState('');
  const [savedText, setSavedText] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [initialized, setInitialized] = useState(false);

  if (!initialized && philData !== undefined) {
    setText(initialText);
    setSavedText(initialText);
    setInitialized(true);
  }

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
        setSavedText(text.trim());
        setEditing(false);
        posthog.capture('philosophy_saved', { drep_id: drepId, length: text.trim().length });
      }
    } catch {
    } finally {
      setSaving(false);
    }
  }, [text, drepId]);

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
        <CardContent>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{savedText}</p>
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
      <CardContent>
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
            />
            <div className="flex justify-end gap-2">
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
        ) : (
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{savedText}</p>
        )}
      </CardContent>
    </Card>
  );
}
