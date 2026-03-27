/**
 * Dev-only mock authentication endpoint.
 *
 * Creates a valid session for any persona without wallet signing.
 * Used by adversarial review agents to test auth-gated UI flows locally.
 *
 * LOCKED: Only works when DEV_MOCK_AUTH=true AND NODE_ENV !== 'production'.
 */

import { NextResponse } from 'next/server';
import { createSessionToken, SESSION_MAX_AGE_SECONDS } from '@/lib/supabaseAuth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MOCK_PERSONAS = {
  anonymous: { address: 'mock_anonymous_000', segment: 'anonymous' },
  citizen: {
    address: 'stake1ux8q4rvxrjqlhnnhdhq0t94cxwm02ysnzpnhpmgfqnvmsclh3r6z',
    segment: 'citizen',
  },
  'citizen-delegated': {
    address: 'stake1uxwlmhgpjge4k7evlqt3l9r3fq8hnxmr78ee5s24ewuylqvkc2rd',
    segment: 'citizen',
  },
  drep: {
    address: 'stake1uy0hxjyz3y7h3aqwj0v2k9xe3njuqfpxl8ufn0ynqm8ygsdqkf0q',
    segment: 'drep',
    drepId: 'drep1yg0zzxthgdahmfn3cdjtqvtps4ptqe2gyqf30uqtxe7y7svrwvd',
  },
  spo: {
    address: 'stake1uxptz3ffnlxz9e4m9nm7l9tml09a9rl4assytfce5rjzerg2xqf6q',
    segment: 'spo',
    poolId: 'pool19pyfv08e84mcelyg4mfnx805kp6652a9dwxk0pjulejk7gxsfnz',
  },
  cc: {
    address: 'stake1uyehkckxwxmmly4t2ddv3hylxvphkmtjwsqa4p0gfrqv2ecqnzfkf',
    segment: 'cc',
  },
} as const;

type PersonaKey = keyof typeof MOCK_PERSONAS;

export async function POST(request: Request) {
  // Hard lock: never in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }

  if (process.env.DEV_MOCK_AUTH !== 'true') {
    return NextResponse.json(
      {
        error: 'DEV_MOCK_AUTH not enabled. Set DEV_MOCK_AUTH=true in .env.local to use mock auth.',
      },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const persona = (body.persona || 'citizen') as string;

  if (!(persona in MOCK_PERSONAS)) {
    return NextResponse.json(
      {
        error: `Unknown persona: ${persona}. Valid: ${Object.keys(MOCK_PERSONAS).join(', ')}`,
      },
      { status: 400 },
    );
  }

  const config = MOCK_PERSONAS[persona as PersonaKey];

  if (persona === 'anonymous') {
    // Clear session for anonymous testing
    const response = NextResponse.json({ persona: 'anonymous', cleared: true });
    response.cookies.delete('drepscore_session');
    return response;
  }

  const supabase = getSupabaseAdmin();
  const mockAddress = `mock_${persona}_${config.address.slice(-12)}`;

  // Find or create the mock dev user
  let userId: string;

  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('wallet_address', mockAddress)
    .maybeSingle();

  if (existing) {
    userId = existing.id;
    await supabase.from('users').update({ last_active: new Date().toISOString() }).eq('id', userId);
  } else {
    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        wallet_address: mockAddress,
        last_active: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error || !newUser) {
      logger.error('Dev mock user creation failed', {
        context: 'auth/dev-mock',
        error: error?.message,
      });
      return NextResponse.json({ error: 'Failed to create mock user' }, { status: 500 });
    }
    userId = newUser.id;
  }

  const sessionToken = await createSessionToken(userId, mockAddress);

  const responseBody: Record<string, unknown> = {
    sessionToken,
    userId,
    address: mockAddress,
    persona,
    segment: config.segment,
  };

  if ('drepId' in config) responseBody.drepId = config.drepId;
  if ('poolId' in config) responseBody.poolId = config.poolId;

  // Include segment override payload so the client can apply it
  responseBody.segmentOverride = {
    segment: config.segment,
    ...('drepId' in config ? { drepId: config.drepId } : {}),
    ...('poolId' in config ? { poolId: config.poolId } : {}),
  };

  const response = NextResponse.json(responseBody);

  response.cookies.set('drepscore_session', sessionToken, {
    httpOnly: true,
    secure: false, // Dev only — no HTTPS
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return response;
}
