'use client';

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

const STORAGE_KEY = 'governada_motion_strength';
export const MOTION_STRENGTH_USER_OVERRIDE_KEY = 'motion_strength_user_override';
const REDUCED_MOTION_DEFAULT = 0.05; // Tim Q0.3

export type MotionStrength = number; // 0.0 to 1.0
export type MotionStrengthUserOverride = 'auto' | 'full' | 'suspended';

type MotionStrengthContextValue = {
  strength: MotionStrength;
  userOverride: MotionStrengthUserOverride;
  setUserOverride: (value: MotionStrengthUserOverride) => void;
  setStrength: (value: MotionStrength) => void;
  resetToSystemDefault: () => void;
};

type MotionStrengthState = {
  strength: MotionStrength;
  userOverride: MotionStrengthUserOverride;
};

const MotionStrengthContext = createContext<MotionStrengthContextValue | null>(null);

function getSystemDefault(): MotionStrength {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 1.0;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? REDUCED_MOTION_DEFAULT
    : 1.0;
}

function readStoredStrength(): MotionStrength | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) return null;
    const parsed = Number.parseFloat(stored);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) return parsed;
  } catch {
    // localStorage may be unavailable in restricted browser contexts.
  }
  return null;
}

function isMotionStrengthUserOverride(value: string | null): value is MotionStrengthUserOverride {
  return value === 'auto' || value === 'full' || value === 'suspended';
}

function readStoredUserOverride(): MotionStrengthUserOverride {
  try {
    const stored = localStorage.getItem(MOTION_STRENGTH_USER_OVERRIDE_KEY);
    if (isMotionStrengthUserOverride(stored)) return stored;
  } catch {
    // localStorage may be unavailable in restricted browser contexts.
  }

  const legacyStrength = readStoredStrength();
  if (legacyStrength === 0) return 'suspended';
  if (legacyStrength === 1) return 'full';
  return 'auto';
}

function resolveMotionStrength(override: MotionStrengthUserOverride): MotionStrength {
  switch (override) {
    case 'full':
      return 1.0;
    case 'suspended':
      return 0;
    case 'auto':
      return getSystemDefault();
  }
}

function getInitialMotionStrengthState(): MotionStrengthState {
  const userOverride = readStoredUserOverride();
  return { strength: resolveMotionStrength(userOverride), userOverride };
}

export function MotionStrengthProvider({ children }: { children: ReactNode }) {
  const [{ strength, userOverride }, setMotionStrengthState] = useState<MotionStrengthState>(
    getInitialMotionStrengthState,
  );

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function' ||
      userOverride !== 'auto'
    ) {
      return;
    }

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateFromSystem = () => {
      setMotionStrengthState({
        strength: motionQuery.matches ? REDUCED_MOTION_DEFAULT : 1.0,
        userOverride: 'auto',
      });
    };

    updateFromSystem();
    motionQuery.addEventListener?.('change', updateFromSystem);
    return () => {
      motionQuery.removeEventListener?.('change', updateFromSystem);
    };
  }, [userOverride]);

  const persistUserOverride = useCallback((value: MotionStrengthUserOverride) => {
    try {
      localStorage.setItem(MOTION_STRENGTH_USER_OVERRIDE_KEY, value);
    } catch {
      // Keep in-memory state even if persistence is unavailable.
    }
  }, []);

  const setUserOverride = useCallback(
    (value: MotionStrengthUserOverride) => {
      persistUserOverride(value);
      setMotionStrengthState({ strength: resolveMotionStrength(value), userOverride: value });
    },
    [persistUserOverride],
  );

  const setStrength = useCallback(
    (value: MotionStrength) => {
      const clamped = Math.max(0, Math.min(1, value));
      const nextOverride: MotionStrengthUserOverride =
        clamped <= 0 ? 'suspended' : clamped >= 1 ? 'full' : 'auto';
      persistUserOverride(nextOverride);
      try {
        localStorage.setItem(STORAGE_KEY, String(clamped));
      } catch {
        // Legacy numeric persistence is best-effort only.
      }
      setMotionStrengthState({
        strength: nextOverride === 'auto' ? clamped : resolveMotionStrength(nextOverride),
        userOverride: nextOverride,
      });
    },
    [persistUserOverride],
  );

  const resetToSystemDefault = useCallback(() => {
    try {
      localStorage.setItem(MOTION_STRENGTH_USER_OVERRIDE_KEY, 'auto');
    } catch {
      // Ignore unavailable storage; system default still updates in-memory.
    }
    setMotionStrengthState({ strength: getSystemDefault(), userOverride: 'auto' });
  }, []);

  return createElement(
    MotionStrengthContext.Provider,
    { value: { strength, userOverride, setUserOverride, setStrength, resetToSystemDefault } },
    children,
  );
}

export function useMotionStrength(): MotionStrength {
  const ctx = useContext(MotionStrengthContext);
  return ctx?.strength ?? 1.0;
}

export function useMotionStrengthSetter() {
  const ctx = useContext(MotionStrengthContext);
  if (!ctx) {
    throw new Error('useMotionStrengthSetter must be used within MotionStrengthProvider');
  }
  return {
    userOverride: ctx.userOverride,
    setUserOverride: ctx.setUserOverride,
    setStrength: ctx.setStrength,
    resetToSystemDefault: ctx.resetToSystemDefault,
  };
}
