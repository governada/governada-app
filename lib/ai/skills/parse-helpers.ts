/**
 * Shared parsing helpers for AI skill output.
 *
 * Centralizes the JSON fence cleaning and defensive array mapping
 * that every skill's parseOutput needs.
 */

/**
 * Strip markdown code fences from LLM output and return clean JSON string.
 * Handles: ```json, ```JSON, ``` (no language), interior fences, etc.
 */
export function cleanJsonFence(raw: string): string {
  return raw
    .replace(/^```(?:json|JSON)?\s*\n?/, '')
    .replace(/\n?\s*```\s*$/, '')
    .trim();
}

/**
 * Parse raw LLM output as JSON, stripping code fences first.
 * Returns parsed object or null on failure.
 */
export function parseJsonSafe(raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(cleanJsonFence(raw));
  } catch {
    return null;
  }
}

/**
 * Safely parse an array from unknown input, mapping each element through a typed mapper.
 * Returns empty array if input is not an array.
 */
export function safeParseArray<T>(
  input: unknown,
  mapper: (item: Record<string, unknown>) => T,
): T[] {
  if (!Array.isArray(input)) return [];
  return input.map((item) => mapper(item as Record<string, unknown>));
}

/**
 * Safely extract a string enum value, falling back to a default.
 */
export function safeEnum<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}
