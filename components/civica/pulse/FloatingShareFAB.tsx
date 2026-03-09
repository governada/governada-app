'use client';

import { useState, useEffect } from 'react';
import { Share2 } from 'lucide-react';
import { ShareModal } from '@/components/civica/shared/ShareModal';

export function FloatingShareFAB({
  epoch,
  score,
  band,
}: {
  epoch: number;
  score: number;
  band: string;
}) {
  const [visible, setVisible] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  return (
    <>
      <button
        onClick={() => setShareOpen(true)}
        className="fixed bottom-6 right-6 z-50 rounded-full bg-primary text-primary-foreground p-3 shadow-lg hover:bg-primary/90 transition-colors"
        aria-label="Share this report"
      >
        <Share2 className="h-5 w-5" />
      </button>

      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title={`Epoch ${epoch} Governance Report`}
        shareText={`Cardano Epoch ${epoch} Governance Report — GHI: ${score} (${band}). Read the full analysis:`}
        shareUrl={`https://governada.io/pulse/report/${epoch}`}
        ogImageUrl={`/api/og/governance-report/${epoch}`}
      />
    </>
  );
}
