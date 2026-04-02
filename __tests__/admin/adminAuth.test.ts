import { afterEach, describe, expect, it } from 'vitest';
import { isAdminWallet } from '@/lib/adminAuth';

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('admin auth', () => {
  it('allows a development-only admin override wallet outside production', () => {
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: 'development',
      ADMIN_WALLETS: '',
      DEV_ADMIN_WALLETS: 'mock_admin_local',
    };

    expect(isAdminWallet('mock_admin_local')).toBe(true);
  });

  it('does not allow the development-only admin override in production', () => {
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: 'production',
      ADMIN_WALLETS: '',
      DEV_ADMIN_WALLETS: 'mock_admin_local',
    };

    expect(isAdminWallet('mock_admin_local')).toBe(false);
  });

  it('still respects the normal admin wallet allowlist', () => {
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: 'development',
      ADMIN_WALLETS: 'stake1exampleadmin',
      DEV_ADMIN_WALLETS: '',
    };

    expect(isAdminWallet('stake1exampleadmin')).toBe(true);
  });
});
