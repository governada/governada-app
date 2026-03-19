/**
 * Keyboard Shortcut Registry — Global shortcut system with chord support.
 *
 * Supports:
 * - Single-key shortcuts (?, /, Escape)
 * - Chord sequences (G then H = Go Home)
 * - Modified shortcuts (Cmd+Shift+M)
 * - Context-dependent shortcuts (only active on certain pages)
 * - Categories for organized display in the help overlay
 *
 * Feature-flagged behind `keyboard_shortcuts`.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ShortcutCategory = 'navigation' | 'actions' | 'panels' | 'modes';

export interface ShortcutDefinition {
  /** Unique identifier */
  id: string;
  /** Human-readable key sequence (e.g. "G H", "?", "Cmd+Shift+M") */
  keys: string;
  /** Short label for display */
  label: string;
  /** What this shortcut does */
  description: string;
  /** Category for grouping in the overlay */
  category: ShortcutCategory;
  /** Callback when shortcut triggers */
  action: () => void;
  /** Optional: only active when pathname starts with one of these */
  contextPaths?: string[];
  /** Whether this is a chord (multi-key sequence) */
  isChord?: boolean;
}

export interface ShortcutRegistration {
  /** Unregister this shortcut */
  unregister: () => void;
}

// ---------------------------------------------------------------------------
// Input focus detection
// ---------------------------------------------------------------------------

export function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if ((el as HTMLElement).isContentEditable) return true;
  // Also check if inside a cmdk dialog (command palette)
  if (el.closest('[cmdk-input]')) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Key normalization
// ---------------------------------------------------------------------------

/** Normalize a KeyboardEvent into a comparable key string */
export function normalizeKey(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.metaKey || e.ctrlKey) parts.push('Cmd');
  if (e.shiftKey) parts.push('Shift');
  if (e.altKey) parts.push('Alt');

  let key = e.key;
  // Normalize common keys
  if (key === ' ') key = 'Space';
  if (key.length === 1) key = key.toUpperCase();

  // Don't add modifier keys themselves
  if (!['Control', 'Meta', 'Shift', 'Alt'].includes(key)) {
    parts.push(key);
  }

  return parts.join('+');
}

/** Parse a shortcut keys string into its components for matching */
export function parseShortcutKeys(keys: string): {
  isChord: boolean;
  firstKey: string;
  secondKey?: string;
  modifiers: { cmd: boolean; shift: boolean; alt: boolean };
} {
  const parts = keys.split(' ').map((p) => p.trim());

  if (parts.length === 2 && parts[0].length === 1 && parts[1].length === 1) {
    // Chord: "G H"
    return {
      isChord: true,
      firstKey: parts[0].toUpperCase(),
      secondKey: parts[1].toUpperCase(),
      modifiers: { cmd: false, shift: false, alt: false },
    };
  }

  // Single key or modified key: "?", "/", "Escape", "Cmd+Shift+M"
  const modParts = keys.split('+').map((p) => p.trim());
  const cmd = modParts.includes('Cmd');
  const shift = modParts.includes('Shift');
  const alt = modParts.includes('Alt');
  const key = modParts.filter((p) => !['Cmd', 'Shift', 'Alt'].includes(p)).pop() || '';

  return {
    isChord: false,
    firstKey: key.length === 1 ? key.toUpperCase() : key,
    modifiers: { cmd, shift, alt },
  };
}

// ---------------------------------------------------------------------------
// Platform detection
// ---------------------------------------------------------------------------

/** Returns true if the user is on macOS */
export function isMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  return navigator.platform?.toUpperCase().includes('MAC') || false;
}

/** Format shortcut keys for display based on platform */
export function formatShortcutKeys(keys: string): string {
  if (isMac()) {
    return keys
      .replace(/Cmd\+/g, '\u2318')
      .replace(/Shift\+/g, '\u21E7')
      .replace(/Alt\+/g, '\u2325');
  }
  return keys.replace(/Cmd\+/g, 'Ctrl+');
}
