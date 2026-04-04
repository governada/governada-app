export interface StorageKeySet {
  current: string;
  legacy: readonly string[];
}

export const SESSION_COOKIE_NAME = 'governada_session';
export const LEGACY_SESSION_COOKIE_NAMES = ['drepscore_session'] as const;
export const SESSION_COOKIE_NAMES = [SESSION_COOKIE_NAME, ...LEGACY_SESSION_COOKIE_NAMES] as const;

export const STORAGE_KEYS = {
  session: {
    current: SESSION_COOKIE_NAME,
    legacy: LEGACY_SESSION_COOKIE_NAMES,
  },
  sessionToken: {
    current: 'governada_session_token',
    legacy: ['drepscore_session_token'],
  },
  prefs: {
    current: 'governada_prefs',
    legacy: ['drepscore_prefs'],
  },
  watchlist: {
    current: 'governada_watchlist',
    legacy: ['drepscore_watchlist'],
  },
  viewMode: {
    current: 'governada_view_mode',
    legacy: ['drepscore_view_mode'],
  },
  onboardingComplete: {
    current: 'governada_onboarding_complete',
    legacy: ['drepscore_onboarding_complete'],
  },
  recentSearches: {
    current: 'governada_recent_searches',
    legacy: ['drepscore_recent_searches'],
  },
  lastVisit: {
    current: 'governada_last_visit',
    legacy: ['drepscore_last_visit'],
  },
  prevMatchScores: {
    current: 'governada_prev_match_scores',
    legacy: ['drepscore_prev_match_scores'],
  },
  dismissedAlerts: {
    current: 'governada_dismissed_alerts',
    legacy: ['drepscore_dismissed_alerts'],
  },
  soundEnabled: {
    current: 'governada_sound_enabled',
    legacy: ['drepscore-sound-enabled'],
  },
  walletName: {
    current: 'governada_wallet_name',
    legacy: ['drepscore_wallet_name'],
  },
} satisfies Record<string, StorageKeySet>;

export function readStoredValue(keySet: StorageKeySet): string | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }

  const currentValue = localStorage.getItem(keySet.current);
  if (currentValue !== null) {
    return currentValue;
  }

  for (const legacyKey of keySet.legacy) {
    const value = localStorage.getItem(legacyKey);
    if (value !== null) {
      localStorage.setItem(keySet.current, value);
      localStorage.removeItem(legacyKey);
      return value;
    }
  }

  return null;
}

export function writeStoredValue(keySet: StorageKeySet, value: string): void {
  if (typeof localStorage === 'undefined') {
    return;
  }

  localStorage.setItem(keySet.current, value);
  for (const legacyKey of keySet.legacy) {
    localStorage.removeItem(legacyKey);
  }
}

export function removeStoredValue(keySet: StorageKeySet): void {
  if (typeof localStorage === 'undefined') {
    return;
  }

  localStorage.removeItem(keySet.current);
  for (const legacyKey of keySet.legacy) {
    localStorage.removeItem(legacyKey);
  }
}

export function readStoredJson<T>(keySet: StorageKeySet, fallback: T): T {
  const raw = readStoredValue(keySet);
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function findCookieValue(
  cookieHeader: string | undefined,
  cookieNames: readonly string[] = SESSION_COOKIE_NAMES,
): string | null {
  if (!cookieHeader) {
    return null;
  }

  for (const cookieName of cookieNames) {
    const escapedName = cookieName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${escapedName}=([^;]+)`));
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}
