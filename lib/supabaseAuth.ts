import * as jose from 'jose';

const SESSION_KEY = 'drepscore_session';
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface SessionPayload {
  walletAddress: string;
  expiresAt: number;
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

export async function createSessionToken(walletAddress: string): Promise<string> {
  const payload: SessionPayload = {
    walletAddress,
    expiresAt: Date.now() + SESSION_DURATION_MS,
  };

  const jwt = await new jose.SignJWT(payload as unknown as jose.JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(payload.expiresAt / 1000))
    .sign(getSecretKey());

  return jwt;
}

export async function validateSessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, getSecretKey());

    const sessionPayload: SessionPayload = {
      walletAddress: payload.walletAddress as string,
      expiresAt: (payload.expiresAt as number) || (payload.exp as number) * 1000,
    };

    if (!sessionPayload.walletAddress) return null;
    if (sessionPayload.expiresAt < Date.now()) return null;

    return sessionPayload;
  } catch {
    return null;
  }
}

export function saveSession(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SESSION_KEY, token);
}

export function getStoredSession(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(SESSION_KEY);
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SESSION_KEY);
}

export async function clearSessionCookie(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch {}
}

export function parseSessionToken(token: string): SessionPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(atob(parts[1]));
    return {
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
