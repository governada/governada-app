import * as jose from 'jose';

const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes

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
  const timeStr = new Date(timestamp).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  // Human-readable message shown in wallet signing popup
  const nonce = `Sign in to DRepScore\nTime: ${timeStr}\nSession: ${sessionId}`;

  const signature = await new jose.SignJWT({ nonce, timestamp })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(Math.floor((timestamp + NONCE_TTL_MS) / 1000))
    .sign(getSecretKey());

  return { nonce, signature, expiresAt: timestamp + NONCE_TTL_MS };
}

export async function verifyNonce(nonce: string, signature: string): Promise<boolean> {
  try {
    const { payload } = await jose.jwtVerify(signature, getSecretKey());
    return payload.nonce === nonce;
  } catch {
    return false;
  }
}
