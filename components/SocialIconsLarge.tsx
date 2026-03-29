'use client';

import { extractSocialPlatform } from '@/utils/display';
import {
  SiX,
  SiGithub,
  SiFacebook,
  SiInstagram,
  SiYoutube,
  SiDiscord,
  SiTelegram,
  SiReddit,
  SiMedium,
  SiGitlab,
  SiLinktree,
  SiWhatsapp,
  SiBluesky,
  SiMastodon,
  SiTwitch,
} from '@icons-pack/react-simple-icons';
import { Globe, Link as LinkIcon, AlertTriangle } from 'lucide-react';

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface SocialIconsLargeProps {
  metadata?: Record<string, unknown> | null;
  references?: Array<{ uri: string; label?: string }>;
  brokenLinks?: Set<string>;
}

const BRAND_ICONS: Record<string, React.FC<{ className?: string; size?: number }>> = {
  'Twitter/X': SiX,
  GitHub: SiGithub,
  Facebook: SiFacebook,
  Instagram: SiInstagram,
  YouTube: SiYoutube,
  Discord: SiDiscord,
  Telegram: SiTelegram,
  Reddit: SiReddit,
  Medium: SiMedium,
  GitLab: SiGitlab,
  Linktree: SiLinktree,
  WhatsApp: SiWhatsapp,
  Bluesky: SiBluesky,
  Mastodon: SiMastodon,
  Twitch: SiTwitch,
};

const ECOSYSTEM_PLATFORMS = new Set(['Cardano Foundation', 'IOHK', 'EMURGO']);

function getIcon(platform: string) {
  if (platform === 'LinkedIn') return <LinkedInIcon className="h-5 w-5" />;
  const BrandIcon = BRAND_ICONS[platform];
  if (BrandIcon) return <BrandIcon size={20} className="shrink-0" />;
  if (ECOSYSTEM_PLATFORMS.has(platform)) return <Globe className="h-5 w-5" />;
  return <LinkIcon className="h-5 w-5" />;
}

function isValidUrl(url: string) {
  try {
    if (!url || url.length < 5) return false;
    const lower = url.toLowerCase();
    if (
      lower.includes('example.com') ||
      lower === 'http://' ||
      lower === 'https://' ||
      lower === 'na' ||
      lower === 'none'
    ) {
      return false;
    }
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function SocialIconsLarge({
  metadata,
  references: propReferences,
  brokenLinks,
}: SocialIconsLargeProps) {
  const references =
    propReferences ||
    (metadata?.references as Array<{ label: string; uri: string }> | undefined) ||
    [];

  if (references.length === 0) return null;

  const seenUris = new Set<string>();
  const validRefs = references.filter((ref) => {
    if (!isValidUrl(ref.uri) || seenUris.has(ref.uri)) return false;
    seenUris.add(ref.uri);
    return true;
  });
  if (validRefs.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {validRefs.slice(0, 6).map((ref, i) => {
        const platform = extractSocialPlatform(ref.uri, ref.label);
        const isBroken = brokenLinks?.has(ref.uri);
        return (
          <TooltipProvider key={i}>
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href={ref.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`relative p-2 rounded-lg border transition-colors ${
                    isBroken
                      ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800 text-red-500'
                      : 'bg-muted/30 text-muted-foreground hover:text-primary hover:bg-muted/50'
                  }`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {getIcon(platform)}
                  {isBroken && (
                    <AlertTriangle className="absolute -top-1 -right-1 h-3 w-3 text-red-500" />
                  )}
                </a>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isBroken ? `${platform} (link appears broken)` : platform}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      })}
    </div>
  );
}
