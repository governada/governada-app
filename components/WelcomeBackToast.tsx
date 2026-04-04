'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { STORAGE_KEYS, readStoredValue, writeStoredValue } from '@/lib/persistence';
const HOURS_THRESHOLD = 4;
const DISMISS_MS = 4000;

interface WelcomeBackToastProps {
  streak?: number;
}

export function WelcomeBackToast({ streak }: WelcomeBackToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const lastVisit = readStoredValue(STORAGE_KEYS.lastVisit);
    const now = Date.now();
    const fourHoursMs = HOURS_THRESHOLD * 60 * 60 * 1000;
    const shouldShow = lastVisit && now - parseInt(lastVisit, 10) > fourHoursMs;

    if (shouldShow) {
      setVisible(true);
      const t = setTimeout(() => setVisible(false), DISMISS_MS);
      writeStoredValue(STORAGE_KEYS.lastVisit, String(now));
      return () => clearTimeout(t);
    }
    writeStoredValue(STORAGE_KEYS.lastVisit, String(now));
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40"
        >
          <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-xl px-4 py-2 text-white/80 text-sm">
            {streak != null && streak > 0
              ? `Welcome back! 🔥 ${streak} day streak`
              : 'Welcome back!'}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
