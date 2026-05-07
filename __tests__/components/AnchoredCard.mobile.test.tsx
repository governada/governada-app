import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AnchoredCardLayer,
  AnchoredCardMobileStack,
  type AnchoredCardDescriptor,
} from '@/components/globe/AnchoredCard';
import { useSenecaThreadStore } from '@/stores/senecaThreadStore';

let viewportClass: 'mobile' | 'desktop' = 'mobile';

vi.mock('@react-three/drei', () => ({
  Html: ({ children }: { children: React.ReactNode }) => <div data-testid="html">{children}</div>,
}));

vi.mock('@/hooks/useViewportClass', () => ({
  useViewportClass: () => viewportClass,
}));

function card(id: string): AnchoredCardDescriptor {
  return {
    id,
    kind: 'action',
    title: `Card ${id}`,
    body: `Body ${id}`,
    anchorNodeId: `drep_${id}`,
    position: [0, 0, 0],
  };
}

describe('AnchoredCard mobile stack', () => {
  beforeEach(() => {
    viewportClass = 'mobile';
    useSenecaThreadStore.setState({ isOpen: false });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    cleanup();
  });

  it('renders the visible cards in a viewport-bottom DOM stack on mobile', () => {
    render(
      <AnchoredCardMobileStack
        cards={[card('one'), card('two'), card('three')]}
        onFold={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByTestId('anchored-card-mobile-stack')).toBeTruthy();
    expect(screen.queryByText('Card one')).toBeNull();
    expect(screen.getByText('Card two')).toBeTruthy();
    expect(screen.getByText('Card three')).toBeTruthy();
  });

  it('keeps the 3D Html path desktop-only on mobile', () => {
    render(<AnchoredCardLayer cards={[card('one')]} onFold={vi.fn()} />);

    expect(screen.queryByTestId('html')).toBeNull();
  });

  it('keeps the mobile DOM stack out of the desktop path', () => {
    viewportClass = 'desktop';
    render(<AnchoredCardMobileStack cards={[card('one')]} onFold={vi.fn()} onSelect={vi.fn()} />);

    expect(screen.queryByTestId('anchored-card-mobile-stack')).toBeNull();
  });

  it('hides the bottom stack when the mobile Seneca sheet is open', () => {
    useSenecaThreadStore.setState({ isOpen: true });

    render(<AnchoredCardMobileStack cards={[card('one')]} onFold={vi.fn()} onSelect={vi.fn()} />);

    expect(screen.queryByTestId('anchored-card-mobile-stack')).toBeNull();
  });

  it('preserves auto-dismiss for mobile cards', () => {
    const onFold = vi.fn();
    render(<AnchoredCardMobileStack cards={[card('timer')]} onFold={onFold} onSelect={vi.fn()} />);

    vi.advanceTimersByTime(34_999);
    expect(onFold).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);

    expect(onFold).toHaveBeenCalledWith(expect.objectContaining({ id: 'timer', reason: 'timer' }));
  });

  it('allows destination cards to opt out of auto-dismiss', () => {
    const onFold = vi.fn();
    render(
      <AnchoredCardMobileStack
        cards={[{ ...card('match'), kind: 'match', autoDismissMs: null }]}
        onFold={onFold}
        onSelect={vi.fn()}
      />,
    );

    vi.advanceTimersByTime(120_000);

    expect(onFold).not.toHaveBeenCalled();
    expect(screen.getByText('Card match')).toBeTruthy();
  });

  it('renders rich card content without wrapping it in a button', () => {
    render(
      <AnchoredCardMobileStack
        cards={[
          {
            ...card('content'),
            kind: 'match',
            autoDismissMs: null,
            content: <a href="/match/vote">Strengthen with proposal voting</a>,
          },
        ]}
        onFold={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByRole('link', { name: /strengthen with proposal voting/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /strengthen with proposal voting/i })).toBeNull();
  });

  it('opens the entity sheet callback when a stacked card is tapped', () => {
    const onSelect = vi.fn();
    render(<AnchoredCardMobileStack cards={[card('tap')]} onFold={vi.fn()} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button', { name: /card tap/i }));

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'tap' }));
  });
});
