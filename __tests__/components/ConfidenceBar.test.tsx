import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfidenceBar } from '@/components/matching/ConfidenceBar';
import {
  STRONG_SIGNAL_THRESHOLD,
  VALUES_ONLY_BASELINE_CONFIDENCE,
} from '@/lib/matching/confidence';

describe('ConfidenceBar', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  it('renders the sourced honest-baseline reference points', () => {
    render(<ConfidenceBar confidence={55} expandable={false} showReferencePoints />);

    expect(screen.getByTestId('confidence-reference-points')).toBeTruthy();
    expect(screen.getByText('values-only baseline')).toBeTruthy();
    expect(screen.getByText('current score')).toBeTruthy();
    expect(screen.getByText('strong working signal')).toBeTruthy();
    expect(screen.getByText(String(VALUES_ONLY_BASELINE_CONFIDENCE))).toBeTruthy();
    expect(screen.getByText('55')).toBeTruthy();
    expect(screen.getByText(String(STRONG_SIGNAL_THRESHOLD))).toBeTruthy();
  });
});
