/**
 * GET/POST /api/user/unsubscribe?token=... — One-click email unsubscribe.
 * GET renders a confirmation page. POST handles RFC 8058 List-Unsubscribe-Post.
 */
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { parseUnsubscribeToken } from '@/lib/email';
import { captureServerEvent } from '@/lib/posthog-server';
import { getSupabaseAdmin } from '@/lib/supabase';

async function handleUnsubscribe(token: string | null): Promise<NextResponse> {
  if (!token) {
    return new NextResponse('Missing token', { status: 400 });
  }

  const parsed = parseUnsubscribeToken(token);
  if (!parsed) {
    return new NextResponse('Invalid token', { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  await supabase
    .from('users')
    .update({ digest_frequency: 'off' })
    .eq('wallet_address', parsed.walletAddress);

  captureServerEvent('email_unsubscribed', {}, parsed.walletAddress);

  return new NextResponse(
    `<!DOCTYPE html>
<html><head><title>Unsubscribed — DRepScore</title>
<style>body{font-family:system-ui,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#f6f9fc;margin:0}
.card{background:#fff;padding:48px;border-radius:12px;text-align:center;max-width:400px;box-shadow:0 1px 3px rgba(0,0,0,.1)}
h1{color:#1a1a2e;margin:0 0 12px}p{color:#6b7280;line-height:1.6}
a{color:#6366f1;text-decoration:none}</style></head>
<body><div class="card">
<h1>Unsubscribed</h1>
<p>You won't receive any more email digests from DRepScore.</p>
<p>Changed your mind? <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://drepscore.io'}/profile">Update your preferences</a></p>
</div></body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html' } },
  );
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  return handleUnsubscribe(token);
}

export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  return handleUnsubscribe(token);
}
