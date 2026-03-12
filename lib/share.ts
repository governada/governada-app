import { posthog } from '@/lib/posthog';

const SITE_URL = 'https://governada.io';

export function shareToX(text: string, url: string) {
  const tweetUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  window.open(tweetUrl, '_blank', 'noopener,noreferrer');
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export async function copyImage(imageUrl: string): Promise<boolean> {
  try {
    const res = await fetch(imageUrl);
    const blob = await res.blob();
    const pngBlob = blob.type === 'image/png' ? blob : await convertToPng(blob);
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
    return true;
  } catch {
    return false;
  }
}

export async function downloadImage(imageUrl: string, filename: string): Promise<void> {
  const res = await fetch(imageUrl);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function canWebShare(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.share;
}

export async function webShare(data: {
  title?: string;
  text?: string;
  url?: string;
}): Promise<boolean> {
  if (!canWebShare()) return false;
  try {
    await navigator.share(data);
    return true;
  } catch {
    return false;
  }
}

export function buildDRepUrl(drepId: string): string {
  return `${SITE_URL}/drep/${encodeURIComponent(drepId)}`;
}

export function buildPoolUrl(poolId: string): string {
  return `${SITE_URL}/pool/${encodeURIComponent(poolId)}`;
}

export function buildCompareUrl(drepIds: string[]): string {
  return `${SITE_URL}/compare?dreps=${drepIds.map(encodeURIComponent).join(',')}`;
}

export function buildPulseUrl(): string {
  return `${SITE_URL}/governance/health`;
}

export function buildMatchResultUrl(encodedProfile: string): string {
  return `${SITE_URL}/match/result?profile=${encodeURIComponent(encodedProfile)}`;
}

export function buildCitizenMilestoneUrl(stakeAddress: string, milestoneKey: string): string {
  return `${SITE_URL}/you?milestone=${encodeURIComponent(milestoneKey)}&stake=${encodeURIComponent(stakeAddress)}`;
}

export function buildCitizenMilestoneOgUrl(stakeAddress: string, milestoneKey: string): string {
  return `${SITE_URL}/api/og/citizen-milestone/${encodeURIComponent(stakeAddress)}/${encodeURIComponent(milestoneKey)}`;
}

export function buildPoolOgUrl(poolId: string): string {
  return `${SITE_URL}/api/og/pool/${encodeURIComponent(poolId)}`;
}

export function buildGovernanceStatsUrl(stakeAddress: string): string {
  return `${SITE_URL}/you?stake=${encodeURIComponent(stakeAddress)}`;
}

export function buildGovernanceStatsOgUrl(stakeAddress: string): string {
  return `${SITE_URL}/api/og/governance-stats/${encodeURIComponent(stakeAddress)}`;
}

export function buildDivergenceUrl(): string {
  return `${SITE_URL}/governance/health`;
}

export function buildDivergenceOgUrl(): string {
  return `${SITE_URL}/api/og/divergence`;
}

export function buildCoverageGapUrl(stakeAddress: string): string {
  return `${SITE_URL}/you?stake=${encodeURIComponent(stakeAddress)}`;
}

export function buildCoverageGapOgUrl(stakeAddress: string): string {
  return `${SITE_URL}/api/og/coverage-gap/${encodeURIComponent(stakeAddress)}`;
}

export function buildDRepOgUrl(drepId: string): string {
  return `${SITE_URL}/api/og/drep/${encodeURIComponent(drepId)}`;
}

export function trackShare(
  surface: string,
  platform: string,
  metadata?: Record<string, unknown>,
  outcome: 'initiated' | 'success' | 'failed' = 'initiated',
) {
  posthog.capture('share_action', { surface, platform, outcome, ...metadata });
}

async function convertToPng(blob: Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas not supported'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((pngBlob) => {
        URL.revokeObjectURL(url);
        if (pngBlob) resolve(pngBlob);
        else reject(new Error('PNG conversion failed'));
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image load failed'));
    };
    img.src = url;
  });
}
