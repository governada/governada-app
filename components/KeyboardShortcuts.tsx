'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isInputFocused } from '@/lib/shortcuts';

export function KeyboardShortcuts() {
  const router = useRouter();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isInputFocused()) return;

      const cmdkOpen = document.querySelector('[cmdk-dialog]');
      if (cmdkOpen) return;

      switch (e.key) {
        case '?':
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('openShortcutsHelp'));
          break;
        case '/':
          e.preventDefault();
          document.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }),
          );
          break;
        case 'h':
          router.push('/');
          break;
        case 'd':
          router.push('/governance');
          break;
        case 'p':
          router.push('/governance/proposals');
          break;
        case 'g':
          router.push('/my-gov');
          break;
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [router]);

  return null;
}
