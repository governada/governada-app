import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MobileStickyAction } from '@/components/governada/proposals/MobileStickyAction';
import { CITIZEN_PROPOSAL_ACTION_ID } from '@/lib/navigation/proposalAction';

const { useSegmentMock } = vi.hoisted(() => ({
  useSegmentMock: vi.fn(),
}));

vi.mock('@/components/providers/SegmentProvider', () => ({
  useSegment: useSegmentMock,
}));

function showStickyBar() {
  Object.defineProperty(window, 'scrollY', { value: 500, writable: true, configurable: true });
  fireEvent.scroll(window);
}

describe('MobileStickyAction', () => {
  beforeEach(() => {
    useSegmentMock.mockReset();
  });

  it('routes governance actors to the workspace review flow', () => {
    useSegmentMock.mockReturnValue({ segment: 'drep' });

    render(
      <MobileStickyAction
        txHash="abc"
        proposalIndex={1}
        isOpen
        verdictLabel="Leaning Pass"
        verdictColor="text-emerald-400"
        proposalType="InfoAction"
      />,
    );

    showStickyBar();

    expect(screen.getByRole('link', { name: /review & vote/i })).toHaveAttribute(
      'href',
      '/workspace/review?proposal=abc:1',
    );
  });

  it('scrolls citizens to the shared engagement anchor', () => {
    useSegmentMock.mockReturnValue({ segment: 'citizen' });
    const target = document.createElement('div');
    const scrollIntoView = vi.fn();
    target.id = CITIZEN_PROPOSAL_ACTION_ID;
    target.scrollIntoView = scrollIntoView;
    document.body.appendChild(target);

    render(
      <MobileStickyAction
        txHash="abc"
        proposalIndex={1}
        isOpen
        verdictLabel="Open"
        verdictColor="text-amber-400"
      />,
    );

    showStickyBar();
    fireEvent.click(screen.getByRole('button', { name: /signal/i }));

    expect(scrollIntoView).toHaveBeenCalled();
    target.remove();
  });

  it('preserves proposal return intent for anonymous users', () => {
    useSegmentMock.mockReturnValue({ segment: 'anonymous' });

    render(
      <MobileStickyAction
        txHash="abc"
        proposalIndex={1}
        isOpen
        verdictLabel="Open"
        verdictColor="text-amber-400"
      />,
    );

    showStickyBar();
    expect(screen.getByRole('link', { name: /connect/i })).toHaveAttribute(
      'href',
      '/?connect=1&returnTo=%2Fproposal%2Fabc%2F1',
    );
  });
});
