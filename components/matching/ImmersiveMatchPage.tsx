'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { X } from 'lucide-react';
import { ConversationalMatchFlow } from '@/components/matching/ConversationalMatchFlow';
import { useFeatureFlag } from '@/components/FeatureGate';
import { cn } from '@/lib/utils';
import type { ConstellationRef } from '@/lib/globe/types';

const ConstellationScene = dynamic(
  () => import('@/components/ConstellationScene').then((m) => ({ default: m.ConstellationScene })),
  { ssr: false, loading: () => <div className="w-full h-full bg-black" /> },
);

/**
 * Immersive matching page — "Xavier's Room / Cerebro."
 *
 * Full-screen globe + conversational matching flow.
 * No distractions, no scrolling — just the globe and the questions.
 *
 * Accepts ?topic=topic-treasury to auto-start with a topic hint.
 */
export function ImmersiveMatchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const globeRef = useRef<ConstellationRef>(null);
  const [isMatching, setIsMatching] = useState(false);
  const conversationalEnabled = useFeatureFlag('conversational_matching');

  // Extract topic from URL params (set by homepage pill tap)
  const initialTopic = searchParams.get('topic');

  const handleClose = useCallback(() => {
    router.push('/');
  }, [router]);

  const handleMatchStart = useCallback(() => {
    setIsMatching(true);
  }, []);

  // Auto-trigger start when arriving with a topic param
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (initialTopic && !autoStartedRef.current) {
      autoStartedRef.current = true;
      setIsMatching(true);
    }
  }, [initialTopic]);

  // Redirect if conversational matching is disabled
  if (conversationalEnabled === false) {
    router.replace('/');
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col overflow-y-auto">
      {/* Close button */}
      <button
        onClick={handleClose}
        className={cn(
          'fixed top-4 right-4 z-[60] rounded-full p-2',
          'bg-white/10 backdrop-blur-sm border border-white/10',
          'text-white/70 hover:text-white hover:bg-white/20',
          'transition-all duration-200',
        )}
        aria-label="Close matching"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Globe — fills viewport, stays behind content */}
      <div className="fixed inset-0 z-0">
        <ConstellationScene ref={globeRef} className="w-full h-full" interactive={false} />
      </div>

      {/* Gradient overlay */}
      <div className="fixed inset-x-0 bottom-0 h-[70%] bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-none z-[1]" />

      {/* Matching flow — scrollable content on top of globe */}
      <div
        className={cn(
          'relative z-10 min-h-screen flex flex-col items-center justify-end',
          'px-6 pb-[calc(env(safe-area-inset-bottom,16px)+16px)]',
        )}
      >
        {/* Title — only before matching starts */}
        {!isMatching && (
          <div className="text-center mb-6 max-w-lg mt-auto">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Find your governance match
            </h1>
            <p className="mt-2 text-sm sm:text-base text-white/70">
              Answer a few questions. The globe narrows down to your ideal representative.
            </p>
          </div>
        )}

        <div className="w-full max-w-lg">
          <ConversationalMatchFlow
            globeRef={globeRef}
            onMatchStart={handleMatchStart}
            initialTopics={initialTopic ? [initialTopic] : undefined}
            autoStart={!!initialTopic}
          />
        </div>
      </div>
    </div>
  );
}
