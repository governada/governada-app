/**
 * Feature Flags — Supabase-backed with in-memory caching.
 *
 * Server components: use getFeatureFlag() or getAllFlags()
 * Client components: use <FeatureGate flag="key"> or useFeatureFlag("key")
 *
 * Flags are cached for 60s in memory to avoid per-request DB hits.
 * Toggle instantly via the admin UI at /admin/flags — no redeploy needed.
 *
 * Targeting: the `targeting` JSONB column supports per-wallet overrides:
 *   { "wallets": { "stake1...": true } }  — enable for specific wallet even if globally off
 * Use getFeatureFlag(key, default, walletAddress) to check per-user targeting.
 * Use setUserFlagOverride(key, wallet, enabled|null) to manage overrides.
 *
 * ---------------------------------------------------------------------------
 * ACTIVE FLAGS (in feature_flags table, toggleable via /admin/flags)
 * ---------------------------------------------------------------------------
 * score_tiers                    — Tier computation + change detection in sync pipeline
 * alignment_drift                — Citizen-DRep alignment drift detection
 * spo_claim_flow                 — SPO pool ownership claim flow
 * spo_governance_identity        — SPO Governance Identity pillar (4th scoring pillar)
 * ghi_citizen_engagement         — GHI citizen engagement component in GHI weighting
 * governance_font                — Custom display font (Space Grotesk) for headings
 * governance_wrapped             — Governance Wrapped generation (gates expensive AI jobs)
 * citizen_assembly_ai_generation — AI-generated citizen assembly questions
 * community_mandate             — Citizen Mandate dashboard (priority signal aggregation)
 * sentiment_divergence           — Sentiment Divergence Index (citizen vs DRep alignment)
 * state_of_governance_report     — Auto-generated epoch report with community intelligence
 * governance_temperature         — Governance Temperature gauge (0-100 aggregate sentiment)
 * research_assistant             — Conversational AI research assistant for proposal analysis
 * globe_alignment_layout         — Cluster labels on globe + highlightCluster behavior (Living Republic Chunk 1)
 * navigation_rail                — 48px icon rail replacing 240px sidebar (Phase 2 nav renaissance)
 * view_transitions               — View Transitions API for spatial navigation continuity (Phase 6)
 * temporal_adaptation             — Governance temporal mode + ambient temperature tinting (Phase 6)
 * peek_drawer                    — Entity peek drawer on list pages (Phase 3 nav renaissance)
 * keyboard_shortcuts              — Global keyboard shortcut system with chords and help overlay (Phase 8)
 * governance_copilot               — Right-side intelligence panel with AI governance briefings (Phase 5)
 * conversational_nav               — Governance advisor in command palette (Phase 9 nav renaissance)
 * mobile_gestures                  — Mobile gesture navigation, long-press peek, pull-to-refresh (Phase 10)
 * ai_composed_hub                  — AI-generated one-line insights on Hub cards with temporal ordering (Phase 7)
 * ambient_annotations              — Ambient AI annotations on proposal, DRep, and score pages (Phase 7)
 * community_intelligence            — Community Pulse dashboard (aggregate preference intelligence from matching)
 * governance_observatory             — Unified Observatory page replacing Treasury/Committee/Health tabs
 * globe_homepage_v2                  — Inhabited Constellation: globe-centric authenticated homepage with user node, bonds, Seneca DJ
 * workspace_decision_table            — AI-enriched decision table replacing kanban in review workspace (Phase 2 studio upgrade)
 * proposal_plan                        — Comprehensive Proposal Plan (constitutional assessment + risk analysis + similar proposals + improvements) instead of plain draft (Phase 4 studio excellence)
 * rationale_codraft                    — Structured rationale co-generation from bullet points with constitutional citations (Phase 4 studio excellence)
 * personalized_briefing                — Personalized executive summary for reviewers based on voting history/philosophy (Phase 4 studio excellence)
 * feedback_synthesis                   — AI severity-ranked feedback synthesis with suggested edits during response_revision (Phase 4 studio excellence)
 * cc_express_lane                      — Article-by-article constitutional assessment for CC members with one-click accept (Phase 4 studio excellence)
 * proactive_interventions              — Multi-insight proactive analysis stack replacing single ProactiveInsight (Phase 4 studio excellence)
 * peer_connect                    — CIP-45 peer connect for mobile wallet connections via QR/deep link
 *
 * ---------------------------------------------------------------------------
 * RETIRED FLAGS (code checks removed or hardcoded)
 * ---------------------------------------------------------------------------
 * Cleaned up in migrations 039 and 063. Features either shipped (gate removed)
 * or were abandoned. Do not re-add retired flags.
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

export async function getFeatureFlag(
  key: string,
  defaultValue = true,
  walletAddress?: string,
): Promise<boolean> {
  const envOverride = process.env[`FF_${key.toUpperCase()}`];
  if (envOverride !== undefined) {
    return envOverride === 'true' || envOverride === '1';
  }

  // Check per-user targeting before returning global value
  if (walletAddress) {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('feature_flags')
        .select('targeting')
        .eq('key', key)
        .single();

      if (data?.targeting) {
        const targeting = data.targeting as { wallets?: Record<string, boolean> };
        if (targeting.wallets && walletAddress in targeting.wallets) {
          return targeting.wallets[walletAddress];
        }
      }
    } catch {
      // Fall through to global value on error
    }
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

/**
 * Set or remove a per-user feature flag override.
 * Pass `enabled: null` to remove the override for this wallet.
 */
export async function setUserFlagOverride(
  key: string,
  walletAddress: string,
  enabled: boolean | null,
): Promise<boolean> {
  try {
    const { getSupabaseAdmin } = await import('./supabase');
    const supabase = getSupabaseAdmin();

    // Read current targeting
    const { data, error: readError } = await supabase
      .from('feature_flags')
      .select('targeting')
      .eq('key', key)
      .single();

    if (readError || !data) {
      logger.error('[featureFlags] Flag not found for targeting update', { key });
      return false;
    }

    const targeting = (data.targeting as { wallets?: Record<string, boolean> }) ?? {};
    const wallets = { ...(targeting.wallets ?? {}) };

    if (enabled === null) {
      delete wallets[walletAddress];
    } else {
      wallets[walletAddress] = enabled;
    }

    const updatedTargeting = { ...targeting, wallets };

    const { error: writeError } = await supabase
      .from('feature_flags')
      .update({ targeting: updatedTargeting, updated_at: new Date().toISOString() })
      .eq('key', key);

    if (writeError) {
      logger.error('[featureFlags] Failed to update targeting', { error: writeError.message });
      return false;
    }

    return true;
  } catch (err) {
    logger.error('[featureFlags] Unexpected error updating targeting', { error: err });
    return false;
  }
}

// ---------------------------------------------------------------------------
// Client-side API route
// ---------------------------------------------------------------------------

export async function fetchClientFlags(
  walletAddress?: string | null,
): Promise<Record<string, boolean>> {
  try {
    const url = walletAddress
      ? `/api/admin/feature-flags?wallet=${encodeURIComponent(walletAddress)}`
      : '/api/admin/feature-flags';
    const res = await fetch(url);
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
