'use client';

import { useEffect, useState } from 'react';
import { X, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) return;

    // Only count once per session to avoid prompting on every page navigation
    const alreadyCounted = sessionStorage.getItem('pwa-visit-counted');
    let visits = parseInt(localStorage.getItem('pwa-visit-count') || '0', 10);
    if (!alreadyCounted) {
      visits += 1;
      localStorage.setItem('pwa-visit-count', String(visits));
      sessionStorage.setItem('pwa-visit-counted', '1');
    }

    if (visits < 3) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShow(true);
    };

    window.addEventListener('beforeinstallprompt', handler as EventListener);
    return () => window.removeEventListener('beforeinstallprompt', handler as EventListener);
  }, []);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  if (!show || !deferredPrompt) return null;

  const handleInstall = async () => {
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShow(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem('pwa-install-dismissed', '1');
  };

  return (
    <div className="fixed top-[68px] left-0 right-0 z-40 flex justify-center px-4 animate-fade-in-up">
      <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-popover/95 backdrop-blur-xl shadow-lg px-4 py-2.5 max-w-lg">
        <Download className="h-4 w-4 text-primary shrink-0" />
        <p className="text-sm flex-1">Add Governada to your homescreen for instant access.</p>
        <Button
          size="sm"
          variant="default"
          onClick={handleInstall}
          className="shrink-0 h-7 text-xs"
        >
          Install
        </Button>
        <button
          onClick={handleDismiss}
          className="p-1 rounded hover:bg-muted transition-colors shrink-0"
        >
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}
