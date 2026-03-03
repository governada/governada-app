'use client';

import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);

    setOffline(!navigator.onLine);

    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="fixed top-16 left-0 right-0 z-40 flex justify-center px-4 animate-fade-in-up">
      <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-950/90 backdrop-blur-sm shadow-lg px-4 py-2 text-sm">
        <WifiOff className="h-3.5 w-3.5 text-amber-400 shrink-0" />
        <span className="text-amber-200">You&apos;re offline — showing cached data</span>
      </div>
    </div>
  );
}
