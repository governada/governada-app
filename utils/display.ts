/**
 * Display Utilities for DRep Names and Formatting
 */

import { DRep } from '@/types/drep';

/**
 * Get formatted display name for a DRep
 * Priority: Name (Ticker) > $Handle > Shortened DRep ID
 */
export function getDRepDisplayName(
  drep: Pick<DRep, 'name' | 'ticker' | 'handle' | 'drepId'>,
): string {
  // Priority 1: Name with optional ticker
  if (drep.name) {
    if (drep.ticker) {
      return `${drep.name} (${drep.ticker})`;
    }
    return drep.name;
  }

  // Priority 2: Ticker alone
  if (drep.ticker) {
    return drep.ticker;
  }

  // Priority 3: Handle
  if (drep.handle) {
    return drep.handle;
  }

  // Fallback: Shortened DRep ID
  return shortenDRepId(drep.drepId);
}

/**
 * Get primary display name (without ticker in parentheses)
 */
export function getDRepPrimaryName(
  drep: Pick<DRep, 'name' | 'ticker' | 'handle' | 'drepId'>,
): string {
  return drep.name || drep.ticker || drep.handle || shortenDRepId(drep.drepId);
}

/**
 * Check if DRep has custom metadata
 */
export function hasCustomMetadata(drep: Pick<DRep, 'name' | 'ticker' | 'description'>): boolean {
  return !!(drep.name || drep.ticker || drep.description);
}

/**
 * Get display name with "Unnamed DRep" fallback
 */
export function getDRepDisplayNameOrUnnamed(
  drep: Pick<DRep, 'name' | 'ticker' | 'handle' | 'drepId'>,
): {
  name: string;
  isUnnamed: boolean;
} {
  const hasName = !!(drep.name || drep.ticker || drep.handle);

  if (hasName) {
    return {
      name: getDRepDisplayName(drep),
      isUnnamed: false,
    };
  }

  return {
    name: 'Unnamed DRep',
    isUnnamed: true,
  };
}

/**
 * Shorten DRep ID for display
 */
export function shortenDRepId(
  drepId: string,
  prefixLength: number = 10,
  suffixLength: number = 6,
): string {
  if (drepId.length <= prefixLength + suffixLength) return drepId;
  return `${drepId.slice(0, prefixLength)}...${drepId.slice(-suffixLength)}`;
}

/**
 * Format ticker for display (uppercase, max 10 chars)
 */
export function formatTicker(ticker: string | null): string | null {
  if (!ticker) return null;
  return ticker.toUpperCase().slice(0, 10);
}

/**
 * Truncate description for preview
 */
export function truncateDescription(
  description: string | null,
  maxLength: number = 150,
): string | null {
  if (!description) return null;
  if (description.length <= maxLength) return description;
  return `${description.slice(0, maxLength)}...`;
}

/**
 * Generate meaningful proposal title when metadata title is missing
 */
export function getProposalDisplayTitle(
  title: string | null,
  proposalTxHash: string,
  proposalIndex: number,
): string {
  if (title) return title;

  // Generate fallback title from transaction hash and index
  const shortHash = proposalTxHash.slice(0, 8);
  return `Governance Action #${proposalIndex} (${shortHash})`;
}

export const KNOWN_PLATFORM_NAMES = new Set([
  'Twitter/X',
  'LinkedIn',
  'GitHub',
  'GitLab',
  'Facebook',
  'Instagram',
  'YouTube',
  'Reddit',
  'Medium',
  'Discord',
  'Telegram',
  'Linktree',
  'WhatsApp',
  'Bluesky',
  'Mastodon',
  'Twitch',
  'Cardano Foundation',
  'IOHK',
  'EMURGO',
]);

const PLATFORM_URL_MAP: Record<string, string> = {
  'twitter.com': 'Twitter/X',
  'x.com': 'Twitter/X',
  't.co': 'Twitter/X',
  'linkedin.com': 'LinkedIn',
  'lnkd.in': 'LinkedIn',
  'github.com': 'GitHub',
  'gitlab.com': 'GitLab',
  'facebook.com': 'Facebook',
  'instagram.com': 'Instagram',
  'youtube.com': 'YouTube',
  'youtu.be': 'YouTube',
  'reddit.com': 'Reddit',
  'medium.com': 'Medium',
  'discord.com': 'Discord',
  'discord.gg': 'Discord',
  'telegram.org': 'Telegram',
  't.me': 'Telegram',
  'telegram.me': 'Telegram',
  'linktr.ee': 'Linktree',
  'wa.me': 'WhatsApp',
  'whatsapp.com': 'WhatsApp',
  'bsky.app': 'Bluesky',
  'mastodon.social': 'Mastodon',
  'fosstodon.org': 'Mastodon',
  'twitch.tv': 'Twitch',
  'cardano.org': 'Cardano Foundation',
  'iohk.io': 'IOHK',
  'emurgo.io': 'EMURGO',
};

/**
 * Normalize a label into a canonical platform name if possible.
 * Handles common user-supplied variants (e.g. "X", "Twitter", "Github").
 */
const LABEL_ALIAS_MAP: Record<string, string> = {
  x: 'Twitter/X',
  twitter: 'Twitter/X',
  github: 'GitHub',
  gitlab: 'GitLab',
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  instagram: 'Instagram',
  youtube: 'YouTube',
  reddit: 'Reddit',
  medium: 'Medium',
  discord: 'Discord',
  telegram: 'Telegram',
  linktree: 'Linktree',
  whatsapp: 'WhatsApp',
  bluesky: 'Bluesky',
  mastodon: 'Mastodon',
  twitch: 'Twitch',
};

/**
 * Check if a URI resolves to a known social/communication platform.
 * Used for profile completeness scoring to validate references.
 */
export function isValidatedSocialLink(uri: string, label?: string): boolean {
  const platform = extractSocialPlatform(uri, label);
  return KNOWN_PLATFORM_NAMES.has(platform);
}

/**
 * Extract social media platform name from URL.
 * URL-based detection is always attempted first (most reliable).
 * The label is used as a fallback only when the URL doesn't match a known domain.
 */
export function extractSocialPlatform(uri: string, label?: string): string {
  try {
    const url = new URL(uri);
    const hostname = url.hostname.toLowerCase();

    // Exact and www-prefixed matches
    for (const [domain, platform] of Object.entries(PLATFORM_URL_MAP)) {
      if (hostname === domain || hostname === `www.${domain}`) {
        return platform;
      }
    }

    // Subdomain matches (e.g. blog.medium.com)
    for (const [domain, platform] of Object.entries(PLATFORM_URL_MAP)) {
      if (hostname.endsWith(`.${domain}`)) {
        return platform;
      }
    }
  } catch {
    // URL parsing failed — fall through to label handling
  }

  // URL didn't resolve to a known platform: try to normalize the label
  if (label && typeof label === 'string') {
    const normalized = LABEL_ALIAS_MAP[label.toLowerCase().trim()];
    if (normalized) return normalized;
    // If label is non-generic, use it as-is (human-readable tooltip)
    const lower = label.toLowerCase().trim();
    if (lower !== 'label' && lower !== 'link' && lower !== 'url' && lower.length > 0) {
      return label;
    }
  }

  // Last resort: derive from domain name
  try {
    const hostname = new URL(uri).hostname.toLowerCase();
    return hostname.replace(/^www\./, '');
  } catch {
    return 'Link';
  }
}
