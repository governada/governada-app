import { describe, expect, it } from 'vitest';
import { HELP_ITEMS, getCurrentSection } from '@/lib/nav/config';

describe('navigation match route contracts', () => {
  it('treats /match as part of the home section', () => {
    expect(getCurrentSection('/match')).toBe('home');
  });

  it('uses the durable /match route for the help entrypoint', () => {
    expect(HELP_ITEMS[0]?.href).toBe('/match');
  });
});
