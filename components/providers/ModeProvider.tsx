'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';

export type GovernadaMode = 'browse' | 'work' | 'analyze';

interface ModeContextValue {
  mode: GovernadaMode;
  setMode: (mode: GovernadaMode) => void;
  cycleMode: () => void;
  isAutoSelected: boolean;
}

const ModeContext = createContext<ModeContextValue>({
  mode: 'browse',
  setMode: () => {},
  cycleMode: () => {},
  isAutoSelected: true,
});

export function useMode() {
  return useContext(ModeContext);
}

const STORAGE_KEY = 'governada-mode-override';
const MODE_ORDER: GovernadaMode[] = ['browse', 'work', 'analyze'];

function getModeForPath(pathname: string): GovernadaMode {
  if (pathname.startsWith('/workspace')) return 'work';
  if (pathname.startsWith('/admin')) return 'work';
  // Everything else defaults to browse
  return 'browse';
}

export function ModeProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const autoMode = getModeForPath(pathname);

  const [userOverride, setUserOverride] = useState<GovernadaMode | null>(null);
  const [mounted, setMounted] = useState(false);

  // Read persisted override on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && MODE_ORDER.includes(stored as GovernadaMode)) {
        setUserOverride(stored as GovernadaMode);
      }
    } catch {
      // localStorage unavailable
    }
    setMounted(true);
  }, []);

  const mode = userOverride ?? autoMode;
  const isAutoSelected = userOverride === null;

  const setMode = useCallback((newMode: GovernadaMode) => {
    setUserOverride(newMode);
    try {
      localStorage.setItem(STORAGE_KEY, newMode);
    } catch {
      // localStorage unavailable
    }
  }, []);

  const cycleMode = useCallback(() => {
    const currentIndex = MODE_ORDER.indexOf(mode);
    const nextMode = MODE_ORDER[(currentIndex + 1) % MODE_ORDER.length];
    setMode(nextMode);
  }, [mode, setMode]);

  // Clear override when user navigates to a route with a different auto-mode
  // This prevents Work mode from sticking when navigating to Browse routes
  useEffect(() => {
    if (userOverride && userOverride === autoMode) {
      setUserOverride(null);
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // localStorage unavailable
      }
    }
  }, [autoMode, userOverride]);

  // Sync mode to body for CSS selectors that target body-level elements
  // (e.g., noise texture on body::before, scrollbar styles)
  useEffect(() => {
    const resolvedMode = mounted ? mode : autoMode;
    document.body.setAttribute('data-mode', resolvedMode);
    return () => {
      document.body.removeAttribute('data-mode');
    };
  }, [mode, autoMode, mounted]);

  return (
    <ModeContext.Provider value={{ mode, setMode, cycleMode, isAutoSelected }}>
      <div data-mode={mounted ? mode : autoMode} className="contents">
        {children}
      </div>
    </ModeContext.Provider>
  );
}
