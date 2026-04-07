import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as jose from 'jose';

const mockSetUser = vi.fn();
const mockSetTag = vi.fn();
const mockCaptureRequestError = vi.fn();

vi.mock('@sentry/nextjs', () => ({
  withScope: (
    callback: (scope: { setUser: typeof mockSetUser; setTag: typeof mockSetTag }) => void,
  ) => callback({ setUser: mockSetUser, setTag: mockSetTag }),
  captureRequestError: (...args: unknown[]) => mockCaptureRequestError(...args),
}));

import { onRequestError } from '@/instrumentation';

async function createToken(secret: string, walletAddress: string) {
  return new jose.SignJWT({ userId: 'user-1', walletAddress, expiresAt: Date.now() + 60_000 })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1m')
    .sign(new TextEncoder().encode(secret));
}

describe('onRequestError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SESSION_SECRET = 'test-session-secret';
  });

  it('tags Sentry with a verified session wallet hash', async () => {
    const token = await createToken(process.env.SESSION_SECRET!, 'addr_test1verifiedwallet');

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

    expect(mockSetUser).toHaveBeenCalledTimes(1);
    expect(mockSetTag).toHaveBeenCalledWith('hashedAddress', expect.any(String));
    expect(mockCaptureRequestError).toHaveBeenCalledTimes(1);
  });

  it('accepts the renamed governada session cookie', async () => {
    const token = await createToken(process.env.SESSION_SECRET!, 'addr_test1renamedwallet');

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

    expect(mockSetUser).toHaveBeenCalledTimes(1);
    expect(mockSetTag).toHaveBeenCalledWith('hashedAddress', expect.any(String));
    expect(mockCaptureRequestError).toHaveBeenCalledTimes(1);
  });

  it('does not trust unsigned or invalid session cookies', async () => {
    await onRequestError(
      new Error('boom') as Error & { digest: string },
      {
        path: '/workspace',
        method: 'GET',
        headers: { cookie: 'drepscore_session=forged.invalid.token' },
      },
      {
        routerKind: 'App Router',
        routePath: '/workspace',
        routeType: 'render',
        renderSource: 'server',
      },
    );

    expect(mockSetUser).not.toHaveBeenCalled();
    expect(mockSetTag).not.toHaveBeenCalledWith('hashedAddress', expect.any(String));
    expect(mockCaptureRequestError).toHaveBeenCalledTimes(1);
  });
});
