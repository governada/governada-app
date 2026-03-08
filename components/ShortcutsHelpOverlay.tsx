'use client';

import { useEffect, useState } from 'react';
import { SHORTCUTS } from '@/lib/shortcuts';
import { X } from 'lucide-react';

export function ShortcutsHelpOverlay() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('openShortcutsHelp', handler);
    return () => window.removeEventListener('openShortcutsHelp', handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  if (!open) return null;

  const navigation = SHORTCUTS.filter((s) => s.category === 'navigation');
  const actions = SHORTCUTS.filter((s) => s.category === 'actions');

  return (
    <div className="fixed inset-0 z-[100]">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <div className="fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-md px-4">
        <div className="rounded-xl border border-border/50 bg-popover/95 backdrop-blur-xl shadow-2xl overflow-hidden ring-1 ring-white/5">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
            <h2 className="text-sm font-semibold">Keyboard Shortcuts</h2>
            <button
              onClick={() => setOpen(false)}
              className="rounded-md p-1 hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          <div className="p-5 space-y-5">
            <div>
              <h3 className="text-xs font-medium text-muted-foreground mb-2.5 uppercase tracking-wider">
                Navigation
              </h3>
              <div className="space-y-2">
                {navigation.map((s) => (
                  <div key={s.key} className="flex items-center justify-between">
                    <span className="text-sm">{s.description}</span>
                    <kbd className="inline-flex h-6 items-center rounded border border-border/50 bg-muted/50 px-2 font-mono text-[11px] text-muted-foreground">
                      {s.label}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-xs font-medium text-muted-foreground mb-2.5 uppercase tracking-wider">
                Actions
              </h3>
              <div className="space-y-2">
                {actions.map((s) => (
                  <div key={s.key} className="flex items-center justify-between">
                    <span className="text-sm">{s.description}</span>
                    <kbd className="inline-flex h-6 items-center rounded border border-border/50 bg-muted/50 px-2 font-mono text-[11px] text-muted-foreground">
                      {s.label}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
