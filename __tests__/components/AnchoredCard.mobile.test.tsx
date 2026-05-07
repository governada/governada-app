import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AnchoredCardLayer,
  AnchoredCardMobileStack,
  type AnchoredCardDescriptor,
} from '@/components/globe/AnchoredCard';

vi.mock('@react-three/drei', () => ({
  Html: ({ children }: { children: React.ReactNode }) => <div data-testid="html">{children}</div>,
}));

vi.mock('@/hooks/useViewportClass', () => ({
  useViewportClass: () => 'mobile',
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
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
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

  it('preserves auto-dismiss for mobile cards', () => {
    const onFold = vi.fn();
    render(<AnchoredCardMobileStack cards={[card('timer')]} onFold={onFold} onSelect={vi.fn()} />);

    vi.advanceTimersByTime(34_999);
    expect(onFold).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);

    expect(onFold).toHaveBeenCalledWith(expect.objectContaining({ id: 'timer', reason: 'timer' }));
  });

  it('opens the entity sheet callback when a stacked card is tapped', () => {
    const onSelect = vi.fn();
    render(<AnchoredCardMobileStack cards={[card('tap')]} onFold={vi.fn()} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button', { name: /card tap/i }));

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'tap' }));
  });
});
