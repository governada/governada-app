'use client';

import { Html } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState } from 'react';

export type AnchoredCardKind = 'team' | 'delta' | 'epoch' | 'civic' | 'action' | 'sentiment';

export interface AnchoredCardDescriptor {
  id: string;
  kind: AnchoredCardKind;
  title: string;
  body?: string;
  anchorNodeId: string;
  position?: [number, number, number];
  href?: string;
}

export interface FoldedAnchoredCardEntry {
  id: string;
  title: string;
  kind: AnchoredCardKind;
  foldedAt: number;
  reason: 'budget' | 'timer' | 'occlusion';
}

interface AnchoredCardProps {
  card: AnchoredCardDescriptor;
  nodeRects?: DOMRect[];
  onFold: (entry: FoldedAnchoredCardEntry) => void;
  autoDismissMs?: number;
}

interface AnchoredCardLayerProps {
  cards: AnchoredCardDescriptor[];
  nodePositions?: Map<string, [number, number, number]>;
  onFold: (entry: FoldedAnchoredCardEntry) => void;
  autoDismissMs?: number;
}

const AUTO_DISMISS_MS = 35_000;
const MAX_VISIBLE_CARDS = 2;
const DEFAULT_POSITION: [number, number, number] = [0, 0, 0];

export function applyAnchoredCardBudget(cards: AnchoredCardDescriptor[]): AnchoredCardDescriptor[] {
  if (cards.length <= MAX_VISIBLE_CARDS) return cards;
  return cards.slice(-MAX_VISIBLE_CARDS);
}

export function getBudgetFoldEntries(cards: AnchoredCardDescriptor[]): FoldedAnchoredCardEntry[] {
  if (cards.length <= MAX_VISIBLE_CARDS) return [];
  const folded = cards.slice(0, Math.max(0, cards.length - MAX_VISIBLE_CARDS));
  return folded.map((card) => ({
    id: card.id,
    title: card.title,
    kind: card.kind,
    foldedAt: Date.now(),
    reason: 'budget',
  }));
}

export function resolveOcclusionPlacement(
  cardRect: DOMRect,
  nodeRects: DOMRect[],
): 'right' | 'left' | 'fade' {
  const overlaps = nodeRects.some((rect) => rectsOverlap(cardRect, rect));
  if (!overlaps) return 'right';

  const mirrored = new DOMRect(
    cardRect.x - cardRect.width - 24,
    cardRect.y,
    cardRect.width,
    cardRect.height,
  );
  const mirrorOverlaps = nodeRects.some((rect) => rectsOverlap(mirrored, rect));
  return mirrorOverlaps ? 'fade' : 'left';
}

export function AnchoredCardLayer({
  cards,
  nodePositions,
  onFold,
  autoDismissMs = AUTO_DISMISS_MS,
}: AnchoredCardLayerProps) {
  const visibleCards = useMemo(() => applyAnchoredCardBudget(cards), [cards]);
  const budgetFoldedIds = useRef(new Set<string>());

  useEffect(() => {
    for (const entry of getBudgetFoldEntries(cards)) {
      if (budgetFoldedIds.current.has(entry.id)) continue;
      budgetFoldedIds.current.add(entry.id);
      onFold(entry);
    }
  }, [cards, onFold]);

  return (
    <>
      {visibleCards.map((card) => (
        <AnchoredCard
          key={card.id}
          card={{
            ...card,
            position: nodePositions?.get(card.anchorNodeId) ?? card.position ?? DEFAULT_POSITION,
          }}
          onFold={onFold}
          autoDismissMs={autoDismissMs}
        />
      ))}
    </>
  );
}

export function AnchoredCard({
  card,
  nodeRects = [],
  onFold,
  autoDismissMs = AUTO_DISMISS_MS,
}: AnchoredCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<'right' | 'left' | 'fade'>('right');
  const [dismissed, setDismissed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDismissed(true);
      onFold({
        id: card.id,
        title: card.title,
        kind: card.kind,
        foldedAt: Date.now(),
        reason: 'timer',
      });
    }, autoDismissMs);
  };

  useEffect(() => {
    resetTimer();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // resetTimer intentionally depends on the current card id/title/kind through closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id, autoDismissMs]);

  useEffect(() => {
    if (!ref.current || nodeRects.length === 0) return;
    const nextPlacement = resolveOcclusionPlacement(ref.current.getBoundingClientRect(), nodeRects);
    setPlacement(nextPlacement);
    if (nextPlacement === 'fade') {
      onFold({
        id: card.id,
        title: card.title,
        kind: card.kind,
        foldedAt: Date.now(),
        reason: 'occlusion',
      });
    }
  }, [card.id, card.kind, card.title, nodeRects, onFold]);

  if (dismissed) return null;

  const offset = placement === 'left' ? '-translate-x-[calc(100%+18px)]' : 'translate-x-[18px]';
  const opacity = placement === 'fade' ? 'opacity-0' : 'opacity-100';

  return (
    <Html
      position={card.position ?? DEFAULT_POSITION}
      center
      distanceFactor={12}
      zIndexRange={[30, 0]}
      style={{ pointerEvents: 'auto', userSelect: 'none' }}
    >
      <div
        ref={ref}
        className={`${offset} ${opacity} w-[min(280px,72vw)] rounded-md border border-white/15 bg-[#10131b]/90 px-3 py-2 text-left shadow-2xl backdrop-blur transition-opacity duration-300`}
        data-testid="anchored-card"
        data-card-kind={card.kind}
        data-anchor-node-id={card.anchorNodeId}
        data-placement={placement}
        onMouseEnter={resetTimer}
        onClick={resetTimer}
      >
        <div className="text-[11px] font-semibold leading-snug text-white">{card.title}</div>
        {card.body && (
          <div className="mt-1 text-[10px] leading-snug text-white/60">{card.body}</div>
        )}
      </div>
    </Html>
  );
}

function rectsOverlap(a: DOMRect, b: DOMRect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}
