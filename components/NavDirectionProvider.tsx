'use client';

import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { type NavDirection } from '@/lib/animations';

const NavDirectionContext = createContext<NavDirection>('neutral');

export function useNavDirection() {
  return useContext(NavDirectionContext);
}

function pathDepth(p: string) {
  return p.split('/').filter(Boolean).length;
}

const GOVERNANCE_ROUTES = new Set(['/governance/health', '/governance', '/my-gov']);

function inferDirection(prev: string, next: string): NavDirection {
  if (!prev || prev === next) return 'neutral';

  const prevDepth = pathDepth(prev);
  const nextDepth = pathDepth(next);

  if (nextDepth > prevDepth) return 'forward';
  if (nextDepth < prevDepth) return 'backward';

  const prevBase = '/' + (prev.split('/')[1] ?? '');
  const nextBase = '/' + (next.split('/')[1] ?? '');
  if (GOVERNANCE_ROUTES.has(prevBase) && GOVERNANCE_ROUTES.has(nextBase)) {
    return 'neutral';
  }

  return 'neutral';
}

export function NavDirectionProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const prevPathRef = useRef(pathname);
  const [direction, setDirection] = useState<NavDirection>('neutral');

  useEffect(() => {
    const prev = prevPathRef.current;
    if (prev !== pathname) {
      setDirection(inferDirection(prev, pathname));
      prevPathRef.current = pathname;
    }
  }, [pathname]);

  return <NavDirectionContext.Provider value={direction}>{children}</NavDirectionContext.Provider>;
}
