'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, Copy, Download, Share2 } from 'lucide-react';

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  ogImageUrl: string;
  shareText: string;
  shareUrl: string;
  title: string;
}

export function ShareModal({
  open,
  onClose,
  ogImageUrl,
  shareText,
  shareUrl,
  title,
}: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const handleShareX = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async () => {
    try {
      const res = await fetch(ogImageUrl);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = 'civica-card.png';
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      // silently fail
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* OG card preview */}
          <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-border bg-muted">
            {!imgLoaded && <div className="absolute inset-0 animate-pulse bg-muted rounded-lg" />}
            {/* eslint-disable-next-line @next/next/no-img-element -- OG image from external URL, dimensions unknown */}
            <img
              src={ogImageUrl}
              alt="Share preview"
              className="w-full rounded-lg border border-border"
              onLoad={() => setImgLoaded(true)}
            />
          </div>

          {/* Action buttons */}
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

            <Button
              variant="outline"
              className="flex-1 gap-2"
              onClick={handleCopy}
              aria-label={copied ? 'Link copied' : 'Copy share link'}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-green-500" aria-hidden="true" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" aria-hidden="true" />
                  Copy link
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

          <p className="text-center text-xs text-muted-foreground">
            via Civica &mdash; governance intelligence for Cardano
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
