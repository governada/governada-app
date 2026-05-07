import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AnchoredCard,
  applyAnchoredCardBudget,
  getBudgetFoldEntries,
  resolveOcclusionPlacement,
  type AnchoredCardDescriptor,
} from '@/components/globe/AnchoredCard';

vi.mock('@react-three/drei', () => ({
  Html: ({ children }: { children: React.ReactNode }) => <div data-testid="html">{children}</div>,
}));

function card(id: string): AnchoredCardDescriptor {
  return {
    id,
    kind: 'action',
    title: `Card ${id}`,
    anchorNodeId: `node-${id}`,
    position: [0, 0, 0],
  };
}

describe('AnchoredCard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('keeps only two visible cards and folds the oldest into Seneca', () => {
    const cards = [card('one'), card('two'), card('three')];
    const visible = applyAnchoredCardBudget(cards);
    const folded = getBudgetFoldEntries(cards);

    expect(visible.map((item) => item.id)).toEqual(['two', 'three']);
    expect(folded).toEqual([expect.objectContaining({ id: 'one', reason: 'budget' })]);
  });

  it('auto-dismisses after 35 seconds of no interaction', () => {
    const onFold = vi.fn();
    render(<AnchoredCard card={card('timer')} onFold={onFold} />);

    vi.advanceTimersByTime(34_999);
    expect(onFold).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);

    expect(onFold).toHaveBeenCalledWith(expect.objectContaining({ id: 'timer', reason: 'timer' }));
  });

  it('hover resets the auto-dismiss timer', () => {
    const onFold = vi.fn();
    render(<AnchoredCard card={card('hover')} onFold={onFold} />);

    vi.advanceTimersByTime(30_000);
    fireEvent.mouseEnter(screen.getByTestId('anchored-card'));
    vi.advanceTimersByTime(30_000);
    expect(onFold).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5_000);
    expect(onFold).toHaveBeenCalledWith(expect.objectContaining({ id: 'hover', reason: 'timer' }));
  });

  it('repositions to the opposite side when a node rect overlaps', () => {
    const cardRect = new DOMRect(100, 100, 120, 60);
    const nodeRects = [new DOMRect(130, 110, 20, 20)];

    expect(resolveOcclusionPlacement(cardRect, nodeRects)).toBe('left');
  });

  it('fades when both sides would occlude nodes', () => {
    const cardRect = new DOMRect(100, 100, 120, 60);
    const nodeRects = [new DOMRect(130, 110, 20, 20), new DOMRect(-30, 110, 20, 20)];

    expect(resolveOcclusionPlacement(cardRect, nodeRects)).toBe('fade');
  });
});
