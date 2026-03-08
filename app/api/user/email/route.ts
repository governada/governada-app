/**
 * POST /api/user/email — Save email address and send verification email.
 */
import { NextRequest, NextResponse } from 'next/server';
import React from 'react';

export const dynamic = 'force-dynamic';

import { sendEmail, generateVerificationUrl } from '@/lib/email';
import { EmailVerificationEmail } from '@/lib/emailTemplates';
import { captureServerEvent } from '@/lib/posthog-server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import { EmailSchema } from '@/lib/api/schemas/user';

export const POST = withRouteHandler(
  async (request: NextRequest, { userId, wallet }: RouteContext) => {
    const { email } = EmailSchema.parse(await request.json());

    const supabase = getSupabaseAdmin();

    await supabase.from('users').update({ email, email_verified: false }).eq('id', userId!);

    const verifyUrl = generateVerificationUrl(wallet!, email);
    const sent = await sendEmail(
      email,
      'Verify your email — Civica',
      React.createElement(EmailVerificationEmail, { verifyUrl }),
    );

    captureServerEvent('email_subscribed', { digest_frequency: 'weekly' }, wallet!);

    return NextResponse.json({ ok: true, sent });
  },
  { auth: 'required', rateLimit: { max: 5, window: 60 } },
);
