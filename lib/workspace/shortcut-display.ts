/**
 * Formats shortcut strings for display in the UI.
 *
 * Examples:
 *  'mod+shift+c' → '⌘⇧C' (Mac) or 'Ctrl+Shift+C' (Win/Linux)
 *  'g a'         → 'G A'
 *  'mod+k'       → '⌘K' (Mac) or 'Ctrl+K' (Win/Linux)
 *  'escape'      → 'Esc'
 *  '?'           → '?'
 */

const isMac =
  typeof navigator !== 'undefined' &&
  (navigator.platform?.startsWith('Mac') ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (navigator as any).userAgentData?.platform === 'macOS');

const MAC_SYMBOLS: Record<string, string> = {
  mod: '\u2318', // ⌘
  ctrl: '\u2303', // ⌃
  shift: '\u21E7', // ⇧
  alt: '\u2325', // ⌥
  enter: '\u21A9', // ↩
  escape: 'Esc',
  arrowup: '\u2191',
  arrowdown: '\u2193',
  arrowleft: '\u2190',
  arrowright: '\u2192',
  backspace: '\u232B',
  delete: '\u2326',
  tab: '\u21E5',
  space: 'Space',
};

const WIN_SYMBOLS: Record<string, string> = {
  mod: 'Ctrl',
  ctrl: 'Ctrl',
  shift: 'Shift',
  alt: 'Alt',
  enter: 'Enter',
  escape: 'Esc',
  arrowup: '\u2191',
  arrowdown: '\u2193',
  arrowleft: '\u2190',
  arrowright: '\u2192',
  backspace: 'Backspace',
  delete: 'Delete',
  tab: 'Tab',
  space: 'Space',
};

function formatSegment(segment: string): string {
  const symbols = isMac ? MAC_SYMBOLS : WIN_SYMBOLS;

  // Handle modifier combos like 'mod+shift+c'
  if (segment.includes('+')) {
    const parts = segment.split('+');
    return parts
      .map((p) => {
        const lower = p.toLowerCase();
        if (symbols[lower]) return symbols[lower];
        return p.toUpperCase();
      })
      .join(isMac ? '' : '+');
  }

  // Single key
  const lower = segment.toLowerCase();
  if (symbols[lower]) return symbols[lower];
  if (lower.length === 1) return lower.toUpperCase();
  // Capitalize first letter for named keys
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * Format a shortcut string for display.
 * @param shortcut Raw shortcut, e.g. 'mod+shift+c', 'g a', '?'
 * @returns Display string, e.g. '⌘⇧C', 'G A', '?'
 */
export function formatShortcut(shortcut: string): string {
  const segments = shortcut.split(' ').filter(Boolean);
  return segments.map(formatSegment).join(' ');
}

/**
 * Returns true if the current platform is macOS.
 */
export function isPlatformMac(): boolean {
  return isMac;
}
