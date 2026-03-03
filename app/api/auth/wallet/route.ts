import { NextRequest, NextResponse } from 'next/server';
import { checkSignature, DataSignature } from '@meshsdk/core';
import { createSessionToken } from '@/lib/supabaseAuth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { verifyNonce } from '@/lib/nonce';

export const runtime = 'nodejs';

interface AuthRequest {
  address: string;
  nonce: string;
  nonceSignature: string;
  signature: string;
  key: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: AuthRequest = await request.json();
    const { address, nonce, nonceSignature, signature, key } = body;

    if (!address || !nonce || !nonceSignature || !signature || !key) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const nonceValid = await verifyNonce(nonce, nonceSignature);
    if (!nonceValid) {
      return NextResponse.json({ error: 'Invalid or expired nonce' }, { status: 401 });
    }

    const dataSignature: DataSignature = { signature, key };

    // Must verify against hex-encoded nonce (same format that was signed on client)
    const hexPayload = Array.from(new TextEncoder().encode(nonce))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    let isValid = false;
    try {
      isValid = await checkSignature(hexPayload, dataSignature, address);
    } catch (sigError) {
      console.error('Signature verification error:', sigError);
      return NextResponse.json({ error: 'Signature verification failed' }, { status: 401 });
    }

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { error: upsertError } = await supabase.from('users').upsert(
      {
        wallet_address: address,
        last_active: new Date().toISOString(),
      },
      { onConflict: 'wallet_address' },
    );

    if (upsertError) {
      console.error('User upsert error:', upsertError);
      return NextResponse.json({ error: 'Failed to create user record' }, { status: 500 });
    }

    const sessionToken = await createSessionToken(address);

    const response = NextResponse.json({
      sessionToken,
      address,
    });

    response.cookies.set('drepscore_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return response;
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
  }
}
