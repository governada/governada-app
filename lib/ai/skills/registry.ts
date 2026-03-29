/**
 * Skill registry — manages registration and lookup of AI skills.
 */

import type { SkillDefinition } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const skills = new Map<string, SkillDefinition<any, any>>();

/**
 * Register an AI skill. Typically called at module level in each skill file.
 */
export function registerSkill<TInput, TOutput>(skill: SkillDefinition<TInput, TOutput>): void {
  if (skills.has(skill.name)) {
    throw new Error(`Skill "${skill.name}" is already registered`);
  }
  skills.set(skill.name, skill);
}

/**
 * Get a registered skill by name.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSkill(name: string): SkillDefinition<any, any> | undefined {
  return skills.get(name);
}

/**
 * List all registered skills.
 */
export function listSkills(): Array<{ name: string; description: string; category: string }> {
  return Array.from(skills.values()).map((s) => ({
    name: s.name,
    description: s.description,
    category: s.category,
  }));
}

/**
 * Import and register all built-in skills.
 * Call this once during app initialization.
 */
export async function loadBuiltinSkills(): Promise<void> {
  await import('./constitutional-check');
  await import('./research-precedent');
  await import('./proposal-draft-generator');
  await import('./section-analysis');
  await import('./text-improve');
  await import('./amendment-translator');
  await import('./amendment-conflict-check');
  await import('./amendment-bridge');
  await import('./readiness-narrative');
  await import('./proposal-plan-generator');
  await import('./rationale-draft');
}
