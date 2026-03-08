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
 *
 * ---------------------------------------------------------------------------
 * ACTIVE FLAGS (in feature_flags table, toggleable via /admin/flags)
 * ---------------------------------------------------------------------------
 * drep_communication       — DRep position statements / Phase B communication features
 * score_tiers              — Tier computation + change detection in sync pipeline
 * alignment_drift          — Citizen-DRep alignment drift detection
 * spo_claim_flow           — SPO pool ownership claim flow
 * spo_governance_identity  — SPO Governance Identity pillar (4th scoring pillar)
 * interactive_constellation — WebGL constellation visualization
 * ghi_citizen_engagement   — GHI citizen engagement component
 * governance_footprint     — Wallet governance footprint feature
 * cc_page                  — Constitutional Committee transparency page
 * spo_profiles             — SPO governance profile pages
 * governance_font          — Custom display font (Space Grotesk) for headings
 *
 * ---------------------------------------------------------------------------
 * RETIRED FLAGS (deleted in migration 039 — code checks removed or hardcoded)
 * ---------------------------------------------------------------------------
 * All other flags from migrations 035-036 were removed because either:
 *   (a) the feature shipped and the check was removed from code, or
 *   (b) the feature was abandoned.
 * Do not re-add retired flags. Use hardcoded true/false in code instead.
 * ---------------------------------------------------------------------------
 */

import { createClient } from './supabase';
import { logger } from '@/lib/logger';

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  description: string | null;
  category: string;
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
    const { data, error } = await supabase.from('feature_flags').select('key, enabled');

    if (error || !data) {
      logger.warn('[featureFlags] Failed to load flags, using cache/defaults', {
        error: error?.message,
      });
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
    logger.warn('[featureFlags] Unexpected error loading flags', { error: err });
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
      .select('key, enabled, description, category, targeting, updated_at')
      .order('category')
      .order('key');

    if (error || !data) return [];

    return data.map((row) => ({
      key: row.key,
      enabled: row.enabled,
      description: row.description,
      category: row.category ?? 'Uncategorized',
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
      logger.error('[featureFlags] Failed to update flag', { error: error.message });
      return false;
    }

    flagCache.set(key, enabled);
    return true;
  } catch (err) {
    logger.error('[featureFlags] Unexpected error updating flag', { error: err });
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
