'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Share2, Copy, Check, ExternalLink, Code, X } from 'lucide-react';
import {
  shareToX,
  copyToClipboard,
  webShare,
  canWebShare,
  buildDRepUrl,
  buildPoolUrl,
  trackShare,
} from '@/lib/share';
import { posthog } from '@/lib/posthog';

interface ProfileShareToolkitProps {
  /** 'drep' or 'spo' */
  entityType: 'drep' | 'spo';
  entityId: string;
  entityName: string;
}

/**
 * ProfileShareToolkit — workspace component for sharing profiles.
 *
 * Pre-formatted text for X/Twitter, copy link, native share, embed code.
 */
export function ProfileShareToolkit({
  entityType,
  entityId,
  entityName,
}: ProfileShareToolkitProps) {
  const [copied, setCopied] = useState<'link' | 'embed' | null>(null);
  const [showEmbed, setShowEmbed] = useState(false);

  const profileUrl = entityType === 'drep' ? buildDRepUrl(entityId) : buildPoolUrl(entityId);

  const shareText =
    entityType === 'drep'
      ? `I'm a DRep on Cardano governance. Check my record on Governada:`
      : `Check out our pool's governance record on Governada:`;

  const embedCode = `<iframe src="${profileUrl}?embed=1" width="400" height="500" frameborder="0" style="border-radius:12px;border:1px solid rgba(255,255,255,0.08)"></iframe>`;

  const ogImageUrl =
    entityType === 'drep'
      ? `${profileUrl.replace('/drep/', '/api/og/drep/')}`
      : `${profileUrl.replace('/pool/', '/api/og/staking/')}`;

  async function handleCopyLink() {
    const success = await copyToClipboard(profileUrl);
    if (success) {
      setCopied('link');
      trackShare('workspace_toolkit', 'copy_link', { entityType, entityId });
      posthog.capture('profile_shared', {
        entity_type: entityType,
        entity_id: entityId,
        platform: 'copy_link',
      });
      setTimeout(() => setCopied(null), 2000);
    }
  }

  async function handleCopyEmbed() {
    const success = await copyToClipboard(embedCode);
    if (success) {
      setCopied('embed');
      trackShare('workspace_toolkit', 'copy_embed', { entityType, entityId });
      setTimeout(() => setCopied(null), 2000);
    }
  }

  function handleShareX() {
    shareToX(shareText, profileUrl);
    trackShare('workspace_toolkit', 'x', { entityType, entityId });
    posthog.capture('profile_shared', {
      entity_type: entityType,
      entity_id: entityId,
      platform: 'x',
    });
  }

  async function handleNativeShare() {
    const success = await webShare({
      title: `${entityName} — Governada`,
      text: shareText,
      url: profileUrl,
    });
    if (success) {
      trackShare('workspace_toolkit', 'native', { entityType, entityId }, 'success');
      posthog.capture('profile_shared', {
        entity_type: entityType,
        entity_id: entityId,
        platform: 'native',
      });
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Share2 className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Share Your Profile
        </h3>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        {/* OG preview */}
        <div className="rounded-xl bg-muted/30 p-3 space-y-2">
          <p className="text-xs text-muted-foreground">Preview when shared</p>
          <div className="rounded-lg overflow-hidden border border-border/50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ogImageUrl}
              alt={`${entityName} share card`}
              className="w-full h-auto"
              loading="lazy"
            />
          </div>
        </div>

        {/* Share actions */}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleShareX}>
            <X className="h-3.5 w-3.5" />
            Share to X
          </Button>

          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCopyLink}>
            {copied === 'link' ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied === 'link' ? 'Copied!' : 'Copy Link'}
          </Button>

          {canWebShare() && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleNativeShare}>
              <ExternalLink className="h-3.5 w-3.5" />
              Share
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setShowEmbed(!showEmbed)}
          >
            <Code className="h-3.5 w-3.5" />
            Embed
          </Button>
        </div>

        {/* Embed code */}
        {showEmbed && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Paste this code on any website to embed your profile:
            </p>
            <div className="relative">
              <pre className="rounded-lg bg-muted p-3 text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap break-all font-mono">
                {embedCode}
              </pre>
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-1 right-1 h-7 w-7 p-0"
                onClick={handleCopyEmbed}
              >
                {copied === 'embed' ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Pre-formatted text */}
        <div className="rounded-xl bg-muted/30 p-3 space-y-1">
          <p className="text-xs text-muted-foreground">Suggested post text</p>
          <p className="text-sm text-foreground">{shareText}</p>
          <p className="text-xs text-primary">{profileUrl}</p>
        </div>
      </div>
    </div>
  );
}
