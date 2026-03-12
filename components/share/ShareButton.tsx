'use client';

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, Share2 } from 'lucide-react';
import { canWebShare, webShare, copyToClipboard, trackShare } from '@/lib/share';

interface ShareButtonProps {
  title: string;
  text: string;
  url: string;
  ogImageUrl?: string;
  /** Analytics surface identifier */
  surface: string;
  /** Button variant */
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  /** Button size */
  size?: 'default' | 'sm' | 'lg' | 'icon';
  /** Custom class name */
  className?: string;
  /** Optional onClick callback (fires after share action) */
  onShare?: () => void;
  /** Label text override (default: "Share") */
  label?: string;
}

/**
 * Reusable one-tap share button.
 * - Mobile: uses navigator.share() (native share sheet)
 * - Desktop: copies link to clipboard with check animation
 * - All actions fire PostHog analytics via trackShare()
 */
export function ShareButton({
  title,
  text,
  url,
  surface,
  variant = 'outline',
  size = 'default',
  className,
  onShare,
  label = 'Share',
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    trackShare(surface, 'native', { url }, 'initiated');

    // Mobile: native share
    if (canWebShare()) {
      const success = await webShare({ title, text, url });
      trackShare(surface, 'native', { url }, success ? 'success' : 'failed');
      onShare?.();
      return;
    }

    // Desktop: copy to clipboard
    const success = await copyToClipboard(url);
    trackShare(surface, 'clipboard', { url }, success ? 'success' : 'failed');

    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
    onShare?.();
  }, [title, text, url, surface, onShare]);

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleShare}
      aria-label={copied ? 'Link copied' : `Share ${title}`}
    >
      {copied ? (
        <>
          <Check className="mr-1.5 h-4 w-4 text-green-500" aria-hidden="true" />
          {size !== 'icon' && 'Copied!'}
        </>
      ) : (
        <>
          <Share2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
          {size !== 'icon' && label}
        </>
      )}
    </Button>
  );
}
