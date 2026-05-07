'use client';

import { Html } from '@react-three/drei';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useViewportClass } from '@/hooks/useViewportClass';
import { useSenecaThreadStore } from '@/stores/senecaThreadStore';
import { cn } from '@/lib/utils';

export type AnchoredCardKind =
  | 'team'
  | 'delta'
  | 'epoch'
  | 'civic'
  | 'action'
  | 'sentiment'
  | 'match';

export interface AnchoredCardDescriptor {
  id: string;
  kind: AnchoredCardKind;
  title: string;
  body?: string;
  content?: ReactNode;
  anchorNodeId: string;
  position?: [number, number, number];
  href?: string;
  className?: string;
  autoDismissMs?: number | null;
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
  onSelect?: (card: AnchoredCardDescriptor) => void;
  autoDismissMs?: number | null;
  engagementKey?: number;
}

interface AnchoredCardLayerProps {
  cards: AnchoredCardDescriptor[];
  nodePositions?: Map<string, [number, number, number]>;
  onFold: (entry: FoldedAnchoredCardEntry) => void;
  autoDismissMs?: number | null;
  engagedAnchorNodeId?: string | null;
  engagementKey?: number;
}

interface AnchoredCardMobileStackProps {
  cards: AnchoredCardDescriptor[];
  onFold: (entry: FoldedAnchoredCardEntry) => void;
  onSelect: (card: AnchoredCardDescriptor) => void;
  autoDismissMs?: number | null;
  engagedAnchorNodeId?: string | null;
  engagementKey?: number;
  foldBudget?: boolean;
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
  engagedAnchorNodeId,
  engagementKey = 0,
}: AnchoredCardLayerProps) {
  const viewportClass = useViewportClass();
  const visibleCards = useMemo(() => applyAnchoredCardBudget(cards), [cards]);
  const budgetFoldedIds = useRef(new Set<string>());

  useEffect(() => {
    for (const entry of getBudgetFoldEntries(cards)) {
      if (budgetFoldedIds.current.has(entry.id)) continue;
      budgetFoldedIds.current.add(entry.id);
      onFold(entry);
    }
  }, [cards, onFold]);

  if (viewportClass === 'mobile') return null;

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
          autoDismissMs={card.autoDismissMs === undefined ? autoDismissMs : card.autoDismissMs}
          engagementKey={card.anchorNodeId === engagedAnchorNodeId ? engagementKey : 0}
        />
      ))}
    </>
  );
}

export function AnchoredCardMobileStack({
  cards,
  onFold,
  onSelect,
  autoDismissMs = AUTO_DISMISS_MS,
  engagedAnchorNodeId,
  engagementKey = 0,
  foldBudget = false,
}: AnchoredCardMobileStackProps) {
  const viewportClass = useViewportClass();
  const isSenecaOpen = useSenecaThreadStore((s) => s.isOpen);
  const visibleCards = useMemo(() => applyAnchoredCardBudget(cards), [cards]);
  const budgetFoldedIds = useRef(new Set<string>());

  useEffect(() => {
    if (!foldBudget) return;
    for (const entry of getBudgetFoldEntries(cards)) {
      if (budgetFoldedIds.current.has(entry.id)) continue;
      budgetFoldedIds.current.add(entry.id);
      onFold(entry);
    }
  }, [cards, foldBudget, onFold]);

  if (viewportClass !== 'mobile' || isSenecaOpen || visibleCards.length === 0) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-[var(--governada-bottom-nav-height)] z-50 pointer-events-none px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      data-testid="anchored-card-mobile-stack"
    >
      <div className="mx-auto flex max-h-[42vh] w-full max-w-md flex-col gap-2 overflow-y-auto rounded-t-md border border-white/10 bg-[#080b12]/72 p-2 shadow-2xl backdrop-blur-xl">
        {visibleCards.map((card) => (
          <AnchoredCardMobileItem
            key={card.id}
            card={card}
            onFold={onFold}
            onSelect={onSelect}
            autoDismissMs={card.autoDismissMs === undefined ? autoDismissMs : card.autoDismissMs}
            engagementKey={card.anchorNodeId === engagedAnchorNodeId ? engagementKey : 0}
          />
        ))}
      </div>
    </div>
  );
}

export function AnchoredCard({
  card,
  nodeRects = [],
  onFold,
  onSelect,
  autoDismissMs = AUTO_DISMISS_MS,
  engagementKey = 0,
}: AnchoredCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<'right' | 'left' | 'fade'>('right');
  const [dismissed, setDismissed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (autoDismissMs === null) {
      timerRef.current = null;
      return;
    }
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
  }, [autoDismissMs, card.id, card.kind, card.title, onFold]);

  useEffect(() => {
    resetTimer();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [card.id, autoDismissMs, resetTimer]);

  useEffect(() => {
    if (engagementKey > 0) resetTimer();
  }, [engagementKey, resetTimer]);

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
  const handleEngage = () => {
    resetTimer();
    onSelect?.(card);
  };

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
        className={cn(
          offset,
          opacity,
          'w-[min(280px,72vw)] rounded-md border border-white/15 bg-[#10131b]/90 px-3 py-2 text-left shadow-2xl backdrop-blur transition-opacity duration-300',
          card.className,
        )}
        data-testid="anchored-card"
        data-card-kind={card.kind}
        data-anchor-node-id={card.anchorNodeId}
        data-placement={placement}
        onMouseEnter={resetTimer}
        onClick={handleEngage}
      >
        {card.content ?? (
          <>
            <div className="text-[11px] font-semibold leading-snug text-white">{card.title}</div>
            {card.body && (
              <div className="mt-1 text-[10px] leading-snug text-white/60">{card.body}</div>
            )}
          </>
        )}
      </div>
    </Html>
  );
}

function AnchoredCardMobileItem({
  card,
  onFold,
  onSelect,
  autoDismissMs,
  engagementKey,
}: Required<Pick<AnchoredCardProps, 'card' | 'onFold' | 'autoDismissMs' | 'engagementKey'>> & {
  onSelect: (card: AnchoredCardDescriptor) => void;
}) {
  const [dismissed, setDismissed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (autoDismissMs === null) {
      timerRef.current = null;
      return;
    }
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
  }, [autoDismissMs, card.id, card.kind, card.title, onFold]);

  useEffect(() => {
    resetTimer();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [card.id, resetTimer]);

  useEffect(() => {
    if (engagementKey > 0) resetTimer();
  }, [engagementKey, resetTimer]);

  if (dismissed) return null;

  if (card.content) {
    return (
      <div
        className={cn(
          'pointer-events-auto w-full rounded-md border border-white/10 bg-white/[0.06]',
          'px-3 py-2 text-left shadow-lg',
          card.className,
        )}
        data-testid="anchored-card-mobile"
        data-card-kind={card.kind}
        data-anchor-node-id={card.anchorNodeId}
        onMouseEnter={resetTimer}
      >
        {card.content}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={cn(
        'pointer-events-auto w-full rounded-md border border-white/10 bg-white/[0.06]',
        'px-3 py-2 text-left shadow-lg transition-colors',
        'hover:bg-white/[0.09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
      )}
      data-testid="anchored-card-mobile"
      data-card-kind={card.kind}
      data-anchor-node-id={card.anchorNodeId}
      onClick={() => {
        resetTimer();
        onSelect(card);
      }}
    >
      <span className="block text-[12px] font-semibold leading-snug text-white">{card.title}</span>
      {card.body && (
        <span className="mt-1 block text-[11px] leading-snug text-white/65">{card.body}</span>
      )}
    </button>
  );
}

function rectsOverlap(a: DOMRect, b: DOMRect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}
