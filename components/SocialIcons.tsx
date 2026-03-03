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
import { Linkedin, Link as LinkIcon, Mail } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface SocialIconsProps {
  metadata: Record<string, unknown> | null;
}

const BRAND_ICONS: Record<string, React.FC<{ size?: number; className?: string }>> = {
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

function getIcon(platform: string) {
  if (platform === 'LinkedIn') return <Linkedin className="h-3.5 w-3.5" />;
  const BrandIcon = BRAND_ICONS[platform];
  if (BrandIcon) return <BrandIcon size={14} className="shrink-0" />;
  return <LinkIcon className="h-3.5 w-3.5" />;
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

export function SocialIcons({ metadata }: SocialIconsProps) {
  if (!metadata) return null;

  const references =
    (metadata.references as Array<{ label: string; uri: string }> | undefined) || [];
  const email = metadata.email as string | undefined;

  if (references.length === 0 && !email) return null;

  const seenUris = new Set<string>();
  const dedupedRefs = references.filter((ref) => {
    if (!isValidUrl(ref.uri) || seenUris.has(ref.uri)) return false;
    seenUris.add(ref.uri);
    return true;
  });

  return (
    <div className="flex items-center gap-1 mt-1 flex-wrap">
      {dedupedRefs.slice(0, 6).map((ref, i) => {
        const platform = extractSocialPlatform(ref.uri, ref.label);
        return (
          <TooltipProvider key={i}>
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href={ref.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors p-0.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  {getIcon(platform)}
                </a>
              </TooltipTrigger>
              <TooltipContent>
                <p>{platform}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      })}

      {email && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <a
                href={`mailto:${email}`}
                className="text-muted-foreground hover:text-primary transition-colors p-0.5"
                onClick={(e) => e.stopPropagation()}
              >
                <Mail className="h-3.5 w-3.5" />
              </a>
            </TooltipTrigger>
            <TooltipContent>
              <p>Email</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
