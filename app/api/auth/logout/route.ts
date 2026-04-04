export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { LEGACY_SESSION_COOKIE_NAMES, SESSION_COOKIE_NAME } from '@/lib/persistence';
import { validateSessionToken, revokeSession } from '@/lib/supabaseAuth';

export const POST = withRouteHandler(async (request: NextRequest) => {
  const cookie =
    request.cookies.get(SESSION_COOKIE_NAME) ??
    LEGACY_SESSION_COOKIE_NAMES.map((name) => request.cookies.get(name)).find(Boolean);
  if (cookie?.value) {
    const session = await validateSessionToken(cookie.value);
    if (session?.jti) {
      await revokeSession(session.jti, session.userId);
    }
  }

  const response = NextResponse.json({ ok: true });

  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  for (const legacyCookie of LEGACY_SESSION_COOKIE_NAMES) {
    response.cookies.set(legacyCookie, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
  }

  return response;
});
