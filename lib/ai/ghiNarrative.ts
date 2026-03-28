/**
 * GHI Trend Narrative Generation
 *
 * Auto-generates "what changed and why" narratives when GHI components
 * shift significantly between epochs. Stored in ghi_snapshots for
 * display on the North Star tracker.
 *
 * Example output: "DRep Participation rose 4 points this epoch driven by
 * 12 new DReps voting on the treasury withdrawal batch. Deliberation
 * Quality fell 3 points as rationale provision rate dropped from 68% to 61%."
 */

import { generateText } from '@/lib/ai';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { buildSenecaPrompt } from '@/lib/ai/senecaPersona';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ComponentSnapshot {
  name: string;
  value: number;
  weight: number;
  contribution: number;
}

interface EpochNarrative {
  epoch: number;
  narrative: string;
  significantChanges: { component: string; delta: number; direction: 'up' | 'down' }[];
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

const NARRATIVE_SYSTEM = buildSenecaPrompt(
  'vitals',
  'Write 2-4 sentences as continuous prose. Be specific about what changed and by how much. Focus on the "why" when the data supports it. Do not use emojis, markdown formatting, or bullet points.',
);

interface StaleComponentInfo {
  name: string;
  staleMinutes: number;
}

function buildNarrativePrompt(
  currentEpoch: number,
  currentScore: number,
  prevScore: number,
  changes: { name: string; current: number; previous: number; delta: number }[],
  staleComponents?: StaleComponentInfo[],
): string {
  const significantChanges = changes
    .filter((c) => Math.abs(c.delta) >= 2)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  if (significantChanges.length === 0) {
    return `Epoch ${currentEpoch}: GHI score is ${currentScore} (previous: ${prevScore}). No significant component changes. Write a brief 1-sentence summary noting stability.`;
  }

  const changeDescriptions = significantChanges
    .map((c) => `${c.name}: ${c.previous} → ${c.current} (${c.delta > 0 ? '+' : ''}${c.delta})`)
    .join('\n');

  // Add staleness caveat if any significant changes overlap with stale components
  let caveat = '';
  if (staleComponents && staleComponents.length > 0) {
    const staleSet = new Set(staleComponents.map((s) => s.name));
    const staleChanges = significantChanges.filter((c) => staleSet.has(c.name));
    if (staleChanges.length > 0) {
      const staleNames = staleChanges.map((c) => c.name).join(', ');
      caveat = `\n\nIMPORTANT: ${staleNames} ${staleChanges.length > 1 ? 'are' : 'is'} computed from delayed data (data sync temporarily unavailable). Mention this caveat — do NOT present the change as a confirmed governance event. Frame it as a possible data delay.`;
    }
  }

  return `Epoch ${currentEpoch}: GHI score changed from ${prevScore} to ${currentScore}.

Component changes:
${changeDescriptions}

Write a 2-4 sentence narrative explaining what changed and what it means for Cardano governance health. Be specific about which components moved and by how much. If the overall direction is positive, note what's improving. If negative, note what's declining.${caveat}`;
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Generate a narrative for the most recent GHI epoch transition.
 * Compares the two most recent snapshots and generates an AI explanation.
 *
 * Returns the narrative text, or null if insufficient data.
 */
/** Threshold matching lib/ghi/components.ts DREP_STALE_THRESHOLD_MINS */
const DREP_STALE_THRESHOLD_MINS = 720;

export async function generateGHINarrative(
  staleComponents?: StaleComponentInfo[],
): Promise<EpochNarrative | null> {
  const supabase = getSupabaseAdmin();

  // Auto-detect stale components if not explicitly provided
  if (!staleComponents) {
    const { data: syncHealth } = await supabase
      .from('v_sync_health')
      .select('last_run, last_success')
      .eq('sync_type', 'dreps')
      .maybeSingle();
    if (syncHealth?.last_run) {
      const staleMins = Math.round((Date.now() - new Date(syncHealth.last_run).getTime()) / 60_000);
      if (staleMins > DREP_STALE_THRESHOLD_MINS || syncHealth.last_success === false) {
        staleComponents = [{ name: 'DRep Participation', staleMinutes: staleMins }];
      }
    }
  }

  // Fetch the two most recent snapshots
  const { data: snapshots } = await supabase
    .from('ghi_snapshots')
    .select('epoch_no, score, components')
    .order('epoch_no', { ascending: false })
    .limit(2);

  if (!snapshots || snapshots.length < 2) {
    logger.info('[ghiNarrative] Insufficient snapshots for narrative generation');
    return null;
  }

  const current = snapshots[0];
  const previous = snapshots[1];
  const currentComps = (current.components as ComponentSnapshot[]) ?? [];
  const prevComps = (previous.components as ComponentSnapshot[]) ?? [];

  // Build change map
  const changes: { name: string; current: number; previous: number; delta: number }[] = [];
  for (const comp of currentComps) {
    const prev = prevComps.find((p) => p.name === comp.name);
    if (prev) {
      changes.push({
        name: comp.name,
        current: comp.value,
        previous: prev.value,
        delta: comp.value - prev.value,
      });
    }
  }

  const significantChanges = changes
    .filter((c) => Math.abs(c.delta) >= 2)
    .map((c) => ({
      component: c.name,
      delta: c.delta,
      direction: (c.delta > 0 ? 'up' : 'down') as 'up' | 'down',
    }));

  // Generate narrative
  const prompt = buildNarrativePrompt(
    current.epoch_no,
    Number(current.score),
    Number(previous.score),
    changes,
    staleComponents,
  );

  const narrative = await generateText(prompt, {
    system: NARRATIVE_SYSTEM,
    maxTokens: 256,
    temperature: 0.3,
  });

  if (!narrative) {
    logger.warn('[ghiNarrative] AI generation failed, using template');
    // Template fallback
    const scoreDelta = Number(current.score) - Number(previous.score);
    const direction = scoreDelta > 0 ? 'rose' : scoreDelta < 0 ? 'fell' : 'remained stable at';
    const deltaStr = scoreDelta !== 0 ? ` by ${Math.abs(scoreDelta)} points` : '';
    const fallback = `Governance Health Index ${direction}${deltaStr} to ${current.score} in epoch ${current.epoch_no}.`;
    return {
      epoch: current.epoch_no,
      narrative: fallback,
      significantChanges,
    };
  }

  // Store narrative on the snapshot
  await supabase
    .from('ghi_snapshots')
    .update({ narrative: narrative.slice(0, 1000) })
    .eq('epoch_no', current.epoch_no);

  logger.info('[ghiNarrative] Generated narrative for epoch', {
    epoch: current.epoch_no,
    changes: significantChanges.length,
  });

  return {
    epoch: current.epoch_no,
    narrative,
    significantChanges,
  };
}
