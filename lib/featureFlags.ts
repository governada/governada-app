/**
 * Feature Flags — Supabase-backed with in-memory caching.
 *
 * Server components: use getFeatureFlag() or getAllFlags()
 * Client components: use <FeatureGate flag="key"> or useFeatureFlag("key")
 *
 * Flags are cached for 60s in memory to avoid per-request DB hits.
 * Toggle instantly via the admin UI at /admin/flags — no redeploy needed.
 *
 * Targeting (future): the `targeting` JSONB column supports per-wallet overrides:
 *   { "wallets": { "stake1...": true } }  — enable for specific wallet even if globally off
 */

import { createClient } from './supabase';

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  description: string | null;
  targeting: Record<string, unknown>;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// In-memory cache (server-side, shared across requests in the same process)
// ---------------------------------------------------------------------------

let flagCache: Map<string, boolean> = new Map();
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000;

async function loadFlags(): Promise<Map<string, boolean>> {
  const now = Date.now();
  if (flagCache.size > 0 && now - cacheTimestamp < CACHE_TTL_MS) {
    return flagCache;
  }

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('feature_flags')
      .select('key, enabled');

    if (error || !data) {
      console.warn('[featureFlags] Failed to load flags, using cache/defaults:', error?.message);
      return flagCache;
    }

    const fresh = new Map<string, boolean>();
    for (const row of data) {
      fresh.set(row.key, row.enabled);
    }
    flagCache = fresh;
    cacheTimestamp = now;
    return flagCache;
  } catch (err) {
    console.warn('[featureFlags] Unexpected error loading flags:', err);
    return flagCache;
  }
}

// ---------------------------------------------------------------------------
// Server-side API
// ---------------------------------------------------------------------------

export async function getFeatureFlag(key: string, defaultValue = true): Promise<boolean> {
  const envOverride = process.env[`FF_${key.toUpperCase()}`];
  if (envOverride !== undefined) {
    return envOverride === 'true' || envOverride === '1';
  }

  const flags = await loadFlags();
  return flags.get(key) ?? defaultValue;
}

export async function getAllFlags(): Promise<FeatureFlag[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('feature_flags')
      .select('key, enabled, description, targeting, updated_at')
      .order('key');

    if (error || !data) return [];

    return data.map(row => ({
      key: row.key,
      enabled: row.enabled,
      description: row.description,
      targeting: row.targeting ?? {},
      updatedAt: row.updated_at,
    }));
  } catch {
    return [];
  }
}

export async function setFeatureFlag(key: string, enabled: boolean): Promise<boolean> {
  try {
    const { getSupabaseAdmin } = await import('./supabase');
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('feature_flags')
      .update({ enabled, updated_at: new Date().toISOString() })
      .eq('key', key);

    if (error) {
      console.error('[featureFlags] Failed to update flag:', error.message);
      return false;
    }

    flagCache.set(key, enabled);
    return true;
  } catch (err) {
    console.error('[featureFlags] Unexpected error updating flag:', err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Client-side API route
// ---------------------------------------------------------------------------

export async function fetchClientFlags(): Promise<Record<string, boolean>> {
  try {
    const res = await fetch('/api/admin/feature-flags');
    if (!res.ok) return {};
    const data = await res.json();
    return data.flags ?? {};
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Invalidation (call after toggling a flag to bust the cache)
// ---------------------------------------------------------------------------

export function invalidateFlagCache() {
  cacheTimestamp = 0;
}
