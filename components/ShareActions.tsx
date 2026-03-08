'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Copy, Check, Download, Image as ImageIcon, ChevronDown } from 'lucide-react';
import { shareToX, copyToClipboard, copyImage, downloadImage, trackShare } from '@/lib/share';

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

interface ShareActionsProps {
  url: string;
  text: string;
  imageUrl?: string;
  imageFilename?: string;
  surface: string;
  metadata?: Record<string, unknown>;
  variant?: 'buttons' | 'dropdown' | 'compact';
  className?: string;
}

export function ShareActions({
  url,
  text,
  imageUrl,
  imageFilename,
  surface,
  metadata,
  variant = 'buttons',
  className,
}: ShareActionsProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);

  const handleShareX = useCallback(() => {
    shareToX(text, url);
    trackShare(surface, 'x', metadata);
  }, [text, url, surface, metadata]);

  const handleCopyLink = useCallback(async () => {
    const ok = await copyToClipboard(url);
    if (ok) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
    trackShare(surface, 'copy_link', metadata, ok ? 'success' : 'failed');
  }, [url, surface, metadata]);

  const handleCopyImage = useCallback(async () => {
    if (!imageUrl) return;
    const ok = await copyImage(imageUrl);
    if (ok) {
      setCopiedImage(true);
      setTimeout(() => setCopiedImage(false), 2000);
    }
    trackShare(surface, 'copy_image', metadata, ok ? 'success' : 'failed');
  }, [imageUrl, surface, metadata]);

  const handleDownload = useCallback(async () => {
    if (!imageUrl) return;
    try {
      await downloadImage(imageUrl, imageFilename || 'civica-card.png');
      trackShare(surface, 'download', metadata, 'success');
    } catch {
      trackShare(surface, 'download', metadata, 'failed');
    }
  }, [imageUrl, imageFilename, surface, metadata]);

  if (variant === 'dropdown') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={`flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-md border border-transparent hover:border-border ${className || ''}`}
          >
            Share
            <ChevronDown className="h-3 w-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleShareX} className="gap-2 cursor-pointer">
            <XIcon className="h-3.5 w-3.5" />
            Share on X
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleCopyLink} className="gap-2 cursor-pointer">
            {copiedLink ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copiedLink ? 'Copied!' : 'Copy link'}
          </DropdownMenuItem>
          {imageUrl && (
            <>
              <DropdownMenuItem onClick={handleCopyImage} className="gap-2 cursor-pointer">
                {copiedImage ? (
                  <Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <ImageIcon className="h-3.5 w-3.5" />
                )}
                {copiedImage ? 'Copied!' : 'Copy image'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownload} className="gap-2 cursor-pointer">
                <Download className="h-3.5 w-3.5" />
                Download image
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-1.5 ${className || ''}`}>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleShareX}
          aria-label="Share on X"
        >
          <XIcon className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleCopyLink}
          aria-label={copiedLink ? 'Link copied' : 'Copy link'}
        >
          {copiedLink ? (
            <Check className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </Button>
        {imageUrl && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleDownload}
            aria-label="Download image"
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={`flex gap-2 flex-wrap ${className || ''}`}>
      <Button variant="default" size="sm" className="gap-1.5 text-xs" onClick={handleShareX}>
        <XIcon className="h-3 w-3" />
        Share on X
      </Button>
      <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleCopyLink}>
        {copiedLink ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        {copiedLink ? 'Copied!' : 'Copy Link'}
      </Button>
      {imageUrl && (
        <>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleDownload}>
            <Download className="h-3 w-3" />
            Download
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleCopyImage}>
            {copiedImage ? <Check className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
            {copiedImage ? 'Copied!' : 'Copy Image'}
          </Button>
        </>
      )}
    </div>
  );
}
