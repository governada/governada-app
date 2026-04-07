import { describe, expect, it } from 'vitest';
import {
  CIVIC_IDENTITY_PATH,
  CIVIC_IDENTITY_SHARE_URL,
  LEGACY_CIVIC_IDENTITY_PATH,
} from '@/lib/navigation/civicIdentity';

describe('civic identity route contract', () => {
  it('uses /you as the canonical civic identity path', () => {
    expect(CIVIC_IDENTITY_PATH).toBe('/you');
    expect(LEGACY_CIVIC_IDENTITY_PATH).toBe('/my-gov/identity');
  });

  it('builds share URLs from the canonical path', () => {
    expect(CIVIC_IDENTITY_SHARE_URL).toMatch(/\/you$/);
  });
});
