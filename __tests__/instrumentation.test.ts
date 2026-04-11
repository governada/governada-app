import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSetUser = vi.fn();
const mockSetTag = vi.fn();
const mockCaptureRequestError = vi.fn();
const mockValidateSessionToken = vi.fn();

vi.mock('@sentry/nextjs', () => ({
  withScope: (
    callback: (scope: { setUser: typeof mockSetUser; setTag: typeof mockSetTag }) => void,
  ) => callback({ setUser: mockSetUser, setTag: mockSetTag }),
  captureRequestError: (...args: unknown[]) => mockCaptureRequestError(...args),
}));

vi.mock('@/lib/supabaseAuth', () => ({
  validateSessionToken: (...args: unknown[]) => mockValidateSessionToken(...args),
}));

import { onRequestError } from '@/instrumentation';

describe('onRequestError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateSessionToken.mockResolvedValue(null);
  });

  it('tags Sentry with a verified session wallet hash', async () => {
    mockValidateSessionToken.mockResolvedValue({
      walletAddress: 'addr_test1verifiedwallet',
    });
    const token = encodeURIComponent('verified.session.token');

    await onRequestError(
      new Error('boom') as Error & { digest: string },
      {
        path: '/workspace',
        method: 'GET',
        headers: { cookie: `drepscore_session=${token}` },
      },
      {
        routerKind: 'App Router',
        routePath: '/workspace',
        routeType: 'render',
        renderSource: 'server',
      },
    );

    expect(mockValidateSessionToken).toHaveBeenCalledWith('verified.session.token');
    expect(mockSetUser).toHaveBeenCalledTimes(1);
    expect(mockSetTag).toHaveBeenCalledWith('hashedAddress', expect.any(String));
    expect(mockCaptureRequestError).toHaveBeenCalledTimes(1);
  });

  it('accepts the renamed governada session cookie', async () => {
    mockValidateSessionToken.mockResolvedValue({
      walletAddress: 'addr_test1renamedwallet',
    });
    const token = encodeURIComponent('renamed.session.token');

    await onRequestError(
      new Error('boom') as Error & { digest: string },
      {
        path: '/workspace',
        method: 'GET',
        headers: { cookie: `governada_session=${token}` },
      },
      {
        routerKind: 'App Router',
        routePath: '/workspace',
        routeType: 'render',
        renderSource: 'server',
      },
    );

    expect(mockValidateSessionToken).toHaveBeenCalledWith('renamed.session.token');
    expect(mockSetUser).toHaveBeenCalledTimes(1);
    expect(mockSetTag).toHaveBeenCalledWith('hashedAddress', expect.any(String));
    expect(mockCaptureRequestError).toHaveBeenCalledTimes(1);
  });

  it('does not trust sessions rejected by the canonical validator', async () => {
    await onRequestError(
      new Error('boom') as Error & { digest: string },
      {
        path: '/workspace',
        method: 'GET',
        headers: { cookie: `drepscore_session=${encodeURIComponent('revoked.session.token')}` },
      },
      {
        routerKind: 'App Router',
        routePath: '/workspace',
        routeType: 'render',
        renderSource: 'server',
      },
    );

    expect(mockValidateSessionToken).toHaveBeenCalledWith('revoked.session.token');
    expect(mockSetUser).not.toHaveBeenCalled();
    expect(mockSetTag).not.toHaveBeenCalledWith('hashedAddress', expect.any(String));
    expect(mockCaptureRequestError).toHaveBeenCalledTimes(1);
  });
});
