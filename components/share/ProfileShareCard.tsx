'use client';

import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, Copy, Download, Share2, Code, Link } from 'lucide-react';
import {
  shareToX,
  copyToClipboard,
  downloadImage,
  canWebShare,
  webShare,
  trackShare,
} from '@/lib/share';

interface ProfileShareCardProps {
  open: boolean;
  onClose: () => void;
  ogImageUrl: string;
  shareText: string;
  shareUrl: string;
  title: string;
  /** Analytics surface identifier */
  surface: string;
  /** Filename for image download (without extension) */
  downloadFilename?: string;
  /** Enable embed snippet */
  showEmbed?: boolean;
}

/**
 * Reusable share dialog with OG image preview.
 * Supports: Share to X, copy link, native share, download image, embed snippet.
 */
export function ProfileShareCard({
  open,
  onClose,
  ogImageUrl,
  shareText,
  shareUrl,
  title,
  surface,
  downloadFilename = 'governada-card',
  showEmbed = false,
}: ProfileShareCardProps) {
  const [copied, setCopied] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const embedSnippet = `<iframe src="${shareUrl}" width="600" height="315" frameborder="0" style="border-radius:12px;border:1px solid rgba(255,255,255,0.08)"></iframe>`;

  const handleShareX = useCallback(() => {
    trackShare(surface, 'twitter', { url: shareUrl }, 'initiated');
    shareToX(shareText, shareUrl);
    trackShare(surface, 'twitter', { url: shareUrl }, 'success');
  }, [shareText, shareUrl, surface]);

  const handleNativeShare = useCallback(async () => {
    trackShare(surface, 'native', { url: shareUrl }, 'initiated');
    const success = await webShare({ title, text: shareText, url: shareUrl });
    trackShare(surface, 'native', { url: shareUrl }, success ? 'success' : 'failed');
  }, [title, shareText, shareUrl, surface]);

  const handleCopyLink = useCallback(async () => {
    trackShare(surface, 'clipboard', { url: shareUrl }, 'initiated');
    const success = await copyToClipboard(shareUrl);
    trackShare(surface, 'clipboard', { url: shareUrl }, success ? 'success' : 'failed');
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [shareUrl, surface]);

  const handleDownload = useCallback(async () => {
    trackShare(surface, 'download', { url: shareUrl }, 'initiated');
    try {
      await downloadImage(ogImageUrl, `${downloadFilename}.png`);
      trackShare(surface, 'download', { url: shareUrl }, 'success');
    } catch {
      trackShare(surface, 'download', { url: shareUrl }, 'failed');
    }
  }, [ogImageUrl, downloadFilename, shareUrl, surface]);

  const handleCopyEmbed = useCallback(async () => {
    trackShare(surface, 'embed', { url: shareUrl }, 'initiated');
    const success = await copyToClipboard(embedSnippet);
    trackShare(surface, 'embed', { url: shareUrl }, success ? 'success' : 'failed');
    if (success) {
      setEmbedCopied(true);
      setTimeout(() => setEmbedCopied(false), 2000);
    }
  }, [embedSnippet, shareUrl, surface]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* OG card preview */}
          <div className="relative aspect-[1200/630] w-full overflow-hidden rounded-lg border border-border bg-muted">
            {!imgLoaded && <div className="absolute inset-0 animate-pulse rounded-lg bg-muted" />}
            {/* eslint-disable-next-line @next/next/no-img-element -- OG image preview */}
            <img
              src={ogImageUrl}
              alt="Share preview"
              className="w-full rounded-lg"
              onLoad={() => setImgLoaded(true)}
            />
          </div>

          {/* Share text preview */}
          <div className="rounded-md border border-border bg-muted/50 p-3">
            <p className="text-sm text-muted-foreground">{shareText}</p>
          </div>

          {/* Primary actions */}
          <div className="flex gap-2">
            <Button
              variant="default"
              className="flex-1 gap-2"
              onClick={handleShareX}
              aria-label="Share on X (Twitter)"
            >
              <Share2 className="h-4 w-4" aria-hidden="true" />
              Share on X
            </Button>

            {canWebShare() && (
              <Button
                variant="secondary"
                className="flex-1 gap-2"
                onClick={handleNativeShare}
                aria-label="Share via native share"
              >
                <Share2 className="h-4 w-4" aria-hidden="true" />
                Share
              </Button>
            )}
          </div>

          {/* Secondary actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 gap-2"
              onClick={handleCopyLink}
              aria-label={copied ? 'Link copied' : 'Copy share link'}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-green-500" aria-hidden="true" />
                  Copied!
                </>
              ) : (
                <>
                  <Link className="h-4 w-4" aria-hidden="true" />
                  Copy Link
                </>
              )}
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={handleDownload}
              aria-label="Download share image"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>

          {/* Embed snippet */}
          {showEmbed && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Code className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <span className="text-xs font-medium text-muted-foreground">Embed</span>
              </div>
              <div className="relative">
                <pre className="overflow-x-auto rounded-md border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
                  {embedSnippet}
                </pre>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1"
                  onClick={handleCopyEmbed}
                  aria-label={embedCopied ? 'Embed code copied' : 'Copy embed code'}
                >
                  {embedCopied ? (
                    <Check className="h-3 w-3 text-green-500" aria-hidden="true" />
                  ) : (
                    <Copy className="h-3 w-3" aria-hidden="true" />
                  )}
                </Button>
              </div>
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground">
            via Governada &mdash; governance intelligence for Cardano
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
