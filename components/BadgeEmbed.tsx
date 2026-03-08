'use client';

import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Copy, Code2 } from 'lucide-react';
import { copyToClipboard, trackShare } from '@/lib/share';
import { posthog } from '@/lib/posthog';

type BadgeFormat = 'shield' | 'card' | 'full';

const FORMAT_META: Record<
  BadgeFormat,
  { label: string; description: string; width: number; height: number }
> = {
  shield: { label: 'Shield', description: 'GitHub-style badge', width: 180, height: 28 },
  card: { label: 'Card', description: 'Mini score card', width: 300, height: 100 },
  full: { label: 'Full', description: 'Rich score card', width: 480, height: 200 },
};

interface BadgeEmbedProps {
  drepId: string;
  drepName: string;
}

export function BadgeEmbed({ drepId, drepName }: BadgeEmbedProps) {
  const [format, setFormat] = useState<BadgeFormat>('shield');
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);

  useEffect(() => {
    posthog.capture('badge_embed_viewed', { drep_id: drepId });
  }, [drepId]);

  const badgeUrl = `https://drepscore.io/api/badge/${encodeURIComponent(drepId)}?format=${format}`;
  const profileUrl = `https://drepscore.io/drep/${encodeURIComponent(drepId)}`;

  const embedSnippets = {
    markdown: `[![DRepScore](${badgeUrl})](${profileUrl})`,
    html: `<a href="${profileUrl}"><img src="${badgeUrl}" alt="${drepName} DRepScore" /></a>`,
    bbcode: `[url=${profileUrl}][img]${badgeUrl}[/img][/url]`,
  };

  const handleCopy = useCallback(
    async (type: string, snippet: string) => {
      const ok = await copyToClipboard(snippet);
      if (ok) {
        setCopiedFormat(type);
        setTimeout(() => setCopiedFormat(null), 2000);
      }
      trackShare('badge_embed', `copy_${type}`, { drep_id: drepId, format });
    },
    [drepId, format],
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Code2 className="h-4 w-4" />
          Embeddable Badge
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Add your DRepScore badge to your website, forum signature, or X bio.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Format selector */}
        <div className="flex gap-2">
          {(Object.keys(FORMAT_META) as BadgeFormat[]).map((f) => (
            <button
              key={f}
              onClick={() => {
                setFormat(f);
                posthog.capture('badge_format_changed', { drep_id: drepId, format: f });
              }}
              className={`flex-1 rounded-lg border p-2 text-center transition-colors ${
                format === f
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/50'
              }`}
            >
              <p className="text-xs font-medium">{FORMAT_META[f].label}</p>
              <p className="text-[10px] text-muted-foreground">{FORMAT_META[f].description}</p>
            </button>
          ))}
        </div>

        {/* Preview */}
        <div className="flex items-center justify-center rounded-lg bg-muted/50 p-6 min-h-[80px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/badge/${encodeURIComponent(drepId)}?format=${format}`}
            alt={`${drepName} DRepScore badge`}
            width={FORMAT_META[format].width}
            height={FORMAT_META[format].height}
            className="max-w-full"
          />
        </div>

        {/* Embed snippets */}
        <div className="space-y-2">
          {Object.entries(embedSnippets).map(([type, snippet]) => (
            <div key={type} className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] w-16 justify-center shrink-0">
                {type === 'bbcode' ? 'BBCode' : type.charAt(0).toUpperCase() + type.slice(1)}
              </Badge>
              <code className="flex-1 text-[10px] bg-muted rounded px-2 py-1.5 truncate font-mono">
                {snippet}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => handleCopy(type, snippet)}
                aria-label={
                  copiedFormat === type ? `${type} snippet copied` : `Copy ${type} snippet`
                }
              >
                {copiedFormat === type ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
