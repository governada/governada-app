import { describe, expect, it } from 'vitest';
import { HELP_ITEMS, getCurrentSection } from '@/lib/nav/config';
import { HOMEPAGE_MATCH_PATH } from '@/lib/matching/routes';

describe('navigation match route contracts', () => {
  it('keeps the homepage as the only first-class home section', () => {
    expect(getCurrentSection('/')).toBe('home');
    expect(getCurrentSection('/match')).toBeNull();
  });

  it('uses the canonical homepage match workspace for the help entrypoint', () => {
    expect(HELP_ITEMS[0]?.href).toBe(HOMEPAGE_MATCH_PATH);
  });
});
