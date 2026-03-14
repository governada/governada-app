'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save, PenLine } from 'lucide-react';

interface PoolProfileEditorProps {
  poolId: string;
  walletAddress: string;
  initialStatement: string | null;
  initialSocialLinks: Array<{ uri: string; label?: string }>;
}

export function PoolProfileEditor({
  poolId,
  walletAddress,
  initialStatement,
  initialSocialLinks,
}: PoolProfileEditorProps) {
  const [statement, setStatement] = useState(initialStatement ?? '');
  const [twitter, setTwitter] = useState(
    initialSocialLinks.find((l) => l.label === 'twitter')?.uri ?? '',
  );
  const [website, setWebsite] = useState(
    initialSocialLinks.find((l) => l.label === 'website')?.uri ?? '',
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const socialLinks: Array<{ uri: string; label: string }> = [];
      if (twitter.trim()) socialLinks.push({ uri: twitter.trim(), label: 'twitter' });
      if (website.trim()) socialLinks.push({ uri: website.trim(), label: 'website' });

      const res = await fetch('/api/spo/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poolId,
          walletAddress,
          governanceStatement: statement.trim() || null,
          socialLinks,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to save');
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <PenLine className="h-4 w-4" />
          Edit Your Pool Profile
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Governance Statement */}
        <div className="space-y-1.5">
          <span className="text-sm font-medium text-foreground">Governance Statement</span>
          <Textarea
            placeholder="Share your governance philosophy, voting principles, and what delegators can expect from you..."
            value={statement}
            onChange={(e) => setStatement(e.target.value)}
            maxLength={500}
            className="min-h-24 resize-none"
          />
          <p className="text-[11px] text-muted-foreground text-right tabular-nums">
            {statement.length}/500
          </p>
        </div>

        {/* Social Links */}
        <div className="space-y-3">
          <span className="text-sm font-medium text-foreground">Social Links</span>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-16 shrink-0">X / Twitter</span>
              <Input
                placeholder="https://x.com/yourhandle"
                value={twitter}
                onChange={(e) => setTwitter(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-16 shrink-0">Website</span>
              <Input
                placeholder="https://yourpool.com"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Save button + status */}
        <div className="flex items-center gap-3 pt-1">
          <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5">
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
          {saved && (
            <span className="text-xs text-emerald-400 animate-in fade-in">Saved successfully</span>
          )}
          {error && <span className="text-xs text-rose-400">{error}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
