/**
 * Preview Mode Utilities
 *
 * Synthetic wallet addresses for preview users. These addresses are never
 * valid Cardano addresses — they exist only in the `users` table to give
 * preview sessions a stable identity for drafts, votes, and annotations.
 */

export const PREVIEW_ADDRESS_PREFIX = 'preview_';

export function isPreviewAddress(address: string | null): boolean {
  return !!address && address.startsWith(PREVIEW_ADDRESS_PREFIX);
}

export function generatePreviewAddress(code: string): string {
  return `${PREVIEW_ADDRESS_PREFIX}${code}_${crypto.randomUUID().slice(0, 8)}`;
}
