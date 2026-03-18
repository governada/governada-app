// Duck-typed registry interface to avoid circular dependency with commands.ts

type Registry = {
  getAvailable: () => Array<{ id: string; shortcut?: string; execute: () => void }>;
  execute: (id: string) => boolean;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const isMac =
  typeof navigator !== 'undefined' &&
  (navigator.platform?.startsWith('Mac') ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (navigator as any).userAgentData?.platform === 'macOS');

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

/** Parse a shortcut string into a normalised form for matching. */
interface ParsedShortcut {
  /** For a chord like 'g a', this is ['g', 'a']. For 'mod+shift+c', this is ['mod+shift+c']. */
  keys: string[];
  /** Whether this uses modifier keys (mod/ctrl/shift/alt). */
  hasModifier: boolean;
}

function parseShortcut(shortcut: string): ParsedShortcut {
  const parts = shortcut.split(' ').filter(Boolean);
  const hasModifier = parts.some(
    (p) => p.includes('mod+') || p.includes('ctrl+') || p.includes('shift+') || p.includes('alt+'),
  );
  return { keys: parts, hasModifier };
}

/** Normalize a keyboard event into a key string like 'mod+shift+c' or 'g'. */
function eventToKeyString(e: KeyboardEvent): string {
  const parts: string[] = [];

  const hasMod = e.metaKey || e.ctrlKey;
  if (hasMod) {
    parts.push('mod');
  }
  if (e.altKey) parts.push('alt');

  // Normalize the key
  const key = e.key.toLowerCase();

  // Don't include modifier-only presses
  if (key === 'control' || key === 'meta' || key === 'shift' || key === 'alt') {
    return '';
  }

  // Include shift as explicit modifier ONLY when combined with mod/alt or when
  // the key is a letter (a-z). For printable symbols like '?', '!', shift is
  // implicit in the character itself and should not be a separate modifier.
  if (e.shiftKey) {
    const isLetter = /^[a-z]$/.test(key);
    if (hasMod || e.altKey || isLetter) {
      parts.push('shift');
    }
  }

  parts.push(key);
  return parts.join('+');
}

/** Check if the normalized key string matches a shortcut segment. */
function matchesSegment(segment: string, keyString: string): boolean {
  // Normalize the segment
  const normalised = segment
    .toLowerCase()
    .replace(/\bmod\b/g, 'mod')
    .replace(/\bctrl\b/g, isMac ? '' : 'mod')
    .replace(/\bmeta\b/g, isMac ? 'mod' : '');

  return normalised === keyString;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export interface KeyboardEngineState {
  isChording: boolean;
  pendingChord: string | null;
}

export function createKeyboardEngine(registry: Registry): {
  attach: () => () => void;
  getState: () => KeyboardEngineState;
} {
  let pendingChord: string | null = null;
  let chordTimer: ReturnType<typeof setTimeout> | null = null;
  let stateListeners: Array<() => void> = [];

  function getState(): KeyboardEngineState {
    return {
      isChording: pendingChord !== null,
      pendingChord,
    };
  }

  function notifyStateChange() {
    for (const listener of stateListeners) {
      listener();
    }
  }

  function clearChord() {
    if (chordTimer) {
      clearTimeout(chordTimer);
      chordTimer = null;
    }
    if (pendingChord !== null) {
      pendingChord = null;
      notifyStateChange();
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    const keyString = eventToKeyString(e);
    if (!keyString) return; // modifier-only press

    const hasModifiers = e.metaKey || e.ctrlKey || e.altKey;
    const inputFocused = isInputFocused();

    // Skip single-key / chord shortcuts when focus is in an input,
    // UNLESS the shortcut uses modifiers (mod+...).
    const skipNonModifier = inputFocused;

    // Also skip if a cmdk dialog is open (let cmdk handle its own input)
    const cmdkOpen = document.querySelector('[cmdk-dialog]');

    const available = registry.getAvailable();

    // --- Chord continuation ---
    if (pendingChord !== null) {
      clearChord();

      if (skipNonModifier && !hasModifiers) return;
      if (cmdkOpen) return;

      // Try to match the second key of a chord
      for (const cmd of available) {
        if (!cmd.shortcut) continue;
        const parsed = parseShortcut(cmd.shortcut);
        if (parsed.keys.length !== 2) continue;
        if (!matchesSegment(parsed.keys[0], pendingChord!)) continue;
        if (matchesSegment(parsed.keys[1], keyString)) {
          e.preventDefault();
          e.stopPropagation();
          registry.execute(cmd.id);
          return;
        }
      }
      // No match — fall through to try single-key shortcuts
    }

    // --- Try direct match (single-key or modifier combo) ---
    for (const cmd of available) {
      if (!cmd.shortcut) continue;
      const parsed = parseShortcut(cmd.shortcut);

      // Skip non-modifier shortcuts when input is focused
      if (skipNonModifier && !parsed.hasModifier) continue;
      if (cmdkOpen && !parsed.hasModifier) continue;

      // Single key or modifier combo (1 segment)
      if (parsed.keys.length === 1) {
        if (matchesSegment(parsed.keys[0], keyString)) {
          e.preventDefault();
          e.stopPropagation();
          registry.execute(cmd.id);
          return;
        }
      }

      // Chord start (2 segments) — match first key
      if (parsed.keys.length === 2) {
        if (skipNonModifier && !hasModifiers) continue;
        if (cmdkOpen) continue;

        if (matchesSegment(parsed.keys[0], keyString)) {
          e.preventDefault();
          pendingChord = keyString;
          notifyStateChange();
          chordTimer = setTimeout(clearChord, 500);
          return;
        }
      }
    }
  }

  function attach(): () => void {
    window.addEventListener('keydown', handleKeyDown, true); // capture phase
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      clearChord();
      stateListeners = [];
    };
  }

  return { attach, getState };
}
