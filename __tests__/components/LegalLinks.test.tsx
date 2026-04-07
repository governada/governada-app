import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LegalLinks } from '@/components/governada/LegalLinks';

describe('LegalLinks', () => {
  it('renders discoverable privacy and terms links', () => {
    render(<LegalLinks />);

    expect(screen.getByRole('navigation', { name: 'Legal' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Privacy' }).getAttribute('href')).toBe('/privacy');
    expect(screen.getByRole('link', { name: 'Terms' }).getAttribute('href')).toBe('/terms');
  });
});
