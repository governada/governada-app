import * as jose from 'jose';
import { NextRequest, NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';
import { STORAGE_KEYS, readStoredValue, removeStoredValue, writeStoredValue } from '@/lib/persistence';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export interface SessionPayload {
  userId: string;
  walletAddress: string;
  expiresAt: number;
  jti?: string;
}

export interface SessionToken {
  payload: SessionPayload;
  signature: string;
}

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET not configured');
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(userId: string, walletAddress: string): Promise<string> {
  const jti = crypto.randomUUID();
  const payload: SessionPayload = {
    userId,
    walletAddress,
    expiresAt: Date.now() + SESSION_DURATION_MS,
    jti,
  };

  const jwt = await new jose.SignJWT(payload as unknown as jose.JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setJti(jti)
    .setExpirationTime(Math.floor(payload.expiresAt / 1000))
    .sign(getSecretKey());

  return jwt;
}

async function isSessionRevoked(jti: string): Promise<boolean> {
  try {
    const redis = getRedis();
    const revoked = await redis.get<string>(`revoked:${jti}`);
    if (revoked) return true;
  } catch {
    // Redis failed — fall through to DB check
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('revoked_sessions')
      .select('jti')
      .eq('jti', jti)
      .maybeSingle();
    return !!data;
  } catch {
    // Both Redis and DB unavailable — fail closed (assume revoked)
    logger.warn('Session revocation check failed — assuming revoked (fail-closed)', { jti });
    return true;
  }
}

export async function revokeSession(jti: string, userId: string): Promise<void> {
  try {
    const redis = getRedis();
    await redis.set(`revoked:${jti}`, '1', { ex: SESSION_MAX_AGE_SECONDS + 86400 });
  } catch {
    logger.warn('Failed to set revocation in Redis', { context: 'session-revoke', jti });
  }

  try {
    const supabase = getSupabaseAdmin();
    await supabase.from('revoked_sessions').upsert({ jti, user_id: userId });
  } catch {
    logger.warn('Failed to insert revocation in Supabase', { context: 'session-revoke', jti });
  }
}

export async function validateSessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, getSecretKey());

    const sessionPayload: SessionPayload = {
      userId: payload.userId as string,
      walletAddress: payload.walletAddress as string,
      expiresAt: (payload.expiresAt as number) || (payload.exp as number) * 1000,
      jti: (payload.jti as string) || undefined,
    };

    if (!sessionPayload.walletAddress) return null;
    if (sessionPayload.expiresAt < Date.now()) return null;

    if (sessionPayload.jti) {
      const revoked = await isSessionRevoked(sessionPayload.jti);
      if (revoked) return null;
    }

    return sessionPayload;
  } catch {
    return null;
  }
}

/**
 * Issue a fresh token if the current one is past 50% of its lifetime.
 * Returns null if no refresh is needed or the token is invalid.
 */
export async function refreshSession(token: string): Promise<string | null> {
  try {
    const { payload } = await jose.jwtVerify(token, getSecretKey());
    const iat = (payload.iat as number) * 1000;
    const exp = (payload.expiresAt as number) || (payload.exp as number) * 1000;
    const halfLife = iat + (exp - iat) / 2;

    if (Date.now() < halfLife) return null;

    const oldJti = payload.jti as string | undefined;
    const userId = payload.userId as string;
    const wallet = payload.walletAddress as string;
    const newToken = await createSessionToken(userId, wallet);

    if (oldJti) {
      await revokeSession(oldJti, userId);
    }

    return newToken;
  } catch {
    return null;
  }
}

export function saveSession(token: string): void {
  if (typeof window === 'undefined') return;
  writeStoredValue(STORAGE_KEYS.session, token);
  removeStoredValue(STORAGE_KEYS.sessionToken);
}

export function getStoredSession(): string | null {
  return readStoredValue(STORAGE_KEYS.session) || readStoredValue(STORAGE_KEYS.sessionToken);
}

export function clearSession(): void {
  removeStoredValue(STORAGE_KEYS.session);
  removeStoredValue(STORAGE_KEYS.sessionToken);
}

export async function clearSessionCookie(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch {}
}

/**
 * Extract and verify the session from an Authorization: Bearer header.
 * Returns { wallet } on success, or a 401 NextResponse on failure.
 */
export async function requireAuth(
  request: NextRequest,
): Promise<{ userId: string | undefined; wallet: string } | NextResponse> {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const session = await validateSessionToken(auth.slice(7));
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return { userId: session.userId, wallet: session.walletAddress };
}

/**
 * CLIENT-ONLY: Decode a JWT payload without signature verification.
 * Do NOT use for server-side auth — use `validateSessionToken` or `requireAuth` instead.
 */
export function parseSessionToken(token: string): SessionPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(atob(parts[1]));
    return {
      userId: payload.userId,
      walletAddress: payload.walletAddress,
      expiresAt: payload.expiresAt || payload.exp * 1000,
    };
  } catch {
    return null;
  }
}

export function isSessionExpired(payload: SessionPayload): boolean {
  return payload.expiresAt < Date.now();
}
