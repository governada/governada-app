/**
 * API Key Management
 * Generation, hashing, validation against Supabase api_keys table.
 */

import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabase';

const KEY_PREFIX = 'ds_live_';
const KEY_BYTE_LENGTH = 30; // 40 chars in base64url

export interface ApiKeyRecord {
  id: string;
  keyPrefix: string;
  name: string;
  tier: 'public' | 'pro' | 'business' | 'enterprise';
  ownerWallet: string | null;
  rateLimit: number;
  rateWindow: 'hour' | 'day';
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export function hashApiKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}

export function generateApiKey(): string {
  const rand = randomBytes(KEY_BYTE_LENGTH).toString('base64url').slice(0, 40);
  return `${KEY_PREFIX}${rand}`;
}

export function extractKeyPrefix(rawKey: string): string {
  return rawKey.slice(0, 16);
}

export function isApiKeyFormat(value: string): boolean {
  return value.startsWith(KEY_PREFIX) && value.length >= 20;
}

export interface KeyValidationResult {
  valid: boolean;
  key?: ApiKeyRecord;
  errorCode?: 'invalid_api_key' | 'revoked_api_key';
}

export async function validateApiKey(rawKey: string): Promise<KeyValidationResult> {
  if (!isApiKeyFormat(rawKey)) {
    return { valid: false, errorCode: 'invalid_api_key' };
  }

  const hash = hashApiKey(rawKey);
  const supabase = getSupabaseAdmin();

  const { data: row, error } = await supabase
    .from('api_keys')
    .select('*')
    .eq('key_hash', hash)
    .single();

  if (error || !row) {
    return { valid: false, errorCode: 'invalid_api_key' };
  }

  // Defense-in-depth: constant-time comparison of the computed hash against
  // the stored hash. The DB lookup by hash already matched, but this prevents
  // any theoretical timing side-channel from the database query layer.
  const storedHashBuf = Buffer.from(row.key_hash as string, 'hex');
  const computedHashBuf = Buffer.from(hash, 'hex');
  if (
    storedHashBuf.length !== computedHashBuf.length ||
    !timingSafeEqual(storedHashBuf, computedHashBuf)
  ) {
    return { valid: false, errorCode: 'invalid_api_key' };
  }

  if (row.revoked_at) {
    return { valid: false, errorCode: 'revoked_api_key' };
  }

  // Touch last_used_at (fire-and-forget)
  void supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', row.id)
    .then();

  return {
    valid: true,
    key: {
      id: row.id,
      keyPrefix: row.key_prefix,
      name: row.name,
      tier: row.tier,
      ownerWallet: row.owner_wallet,
      rateLimit: row.rate_limit,
      rateWindow: row.rate_window,
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at,
      revokedAt: row.revoked_at,
    },
  };
}

export function resolveApiKeyFromRequest(request: Request): string | null {
  return request.headers.get('x-api-key') || null;
}

const TIER_DEFAULTS: Record<string, { rateLimit: number; rateWindow: 'hour' | 'day' }> = {
  public: { rateLimit: 100, rateWindow: 'hour' },
  pro: { rateLimit: 10_000, rateWindow: 'day' },
  business: { rateLimit: 100_000, rateWindow: 'day' },
  enterprise: { rateLimit: 1_000_000, rateWindow: 'day' },
};

export function getTierDefaults(tier: string) {
  return TIER_DEFAULTS[tier] || TIER_DEFAULTS.public;
}
