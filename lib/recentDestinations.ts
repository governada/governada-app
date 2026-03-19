/**
 * Recent Destinations — MRU tracker for command palette.
 *
 * Stores the last 5 visited pages in localStorage so the command palette
 * can show them when opened with an empty query.
 */

const STORAGE_KEY = 'governada_recent_destinations';
const MAX_ITEMS = 5;

export interface RecentDestination {
  href: string;
  label: string;
  timestamp: number;
}

export function getRecentDestinations(): RecentDestination[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

export function addRecentDestination(href: string, label: string): void {
  try {
    const existing = getRecentDestinations();
    // Remove duplicate if already exists
    const filtered = existing.filter((d) => d.href !== href);
    // Prepend new entry
    const updated = [{ href, label, timestamp: Date.now() }, ...filtered].slice(0, MAX_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // localStorage unavailable
  }
}

export function clearRecentDestinations(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage unavailable
  }
}
