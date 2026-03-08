import * as jose from 'jose';

const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const NONCE_TTL_SECONDS = 5 * 60; // 5 minutes in seconds (for Redis EX)

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET not configured');
  return new TextEncoder().encode(secret);
}

export async function createNonce(): Promise<{
  nonce: string;
  signature: string;
  expiresAt: number;
}> {
  const timestamp = Date.now();
  const sessionId = crypto.randomUUID().slice(0, 8);
  const jti = crypto.randomUUID();
  const timeStr = new Date(timestamp).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  // Human-readable message shown in wallet signing popup
  const nonce = `Sign in to DRepScore\nTime: ${timeStr}\nSession: ${sessionId}`;

  const signature = await new jose.SignJWT({ nonce, timestamp })
    .setProtectedHeader({ alg: 'HS256' })
    .setJti(jti)
    .setExpirationTime(Math.floor((timestamp + NONCE_TTL_MS) / 1000))
    .sign(getSecretKey());

  return { nonce, signature, expiresAt: timestamp + NONCE_TTL_MS };
}

/**
 * Mark a nonce JTI as consumed in Redis so it cannot be replayed.
 * Returns true if the nonce was freshly consumed, false if already used.
 * Fails closed (returns false) if Redis is unavailable to prevent replay attacks.
 */
async function consumeNonce(jti: string): Promise<boolean> {
  try {
    const { getRedis } = await import('@/lib/redis');
    const redis = getRedis();
    const key = `nonce:consumed:${jti}`;
    // SET NX returns truthy only if the key did not already exist
    const wasSet = await redis.set(key, '1', { ex: NONCE_TTL_SECONDS, nx: true });
    return wasSet !== null;
  } catch {
    // Redis unavailable — fail closed to prevent nonce replay attacks.
    // Matches fail-closed pattern used by session revocation and rate limiters.
    return false;
  }
}

export async function verifyNonce(nonce: string, signature: string): Promise<boolean> {
  try {
    const { payload } = await jose.jwtVerify(signature, getSecretKey());
    if (payload.nonce !== nonce) return false;

    // Reject replay: each nonce JTI can only be consumed once
    const jti = payload.jti;
    if (!jti) return false;
    return consumeNonce(jti);
  } catch {
    return false;
  }
}
