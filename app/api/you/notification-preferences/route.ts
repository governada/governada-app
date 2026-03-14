/**
 * POST/GET /api/you/notification-preferences
 * Manages email opt-in for epoch digests and alert preferences.
 */

import { NextRequest, NextResponse } from 'next/server';
import React from 'react';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase';
import { sendEmail, generateVerificationUrl } from '@/lib/email';
import { EmailVerificationEmail } from '@/lib/emailTemplates';
import { captureServerEvent } from '@/lib/posthog-server';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const PreferencesSchema = z.object({
  email: z.string().email().optional(),
  digestFrequency: z.enum(['epoch', 'weekly', 'major_only', 'none']).optional().default('none'),
  alertDrepVoted: z.boolean().optional(),
  alertCoverageChanged: z.boolean().optional(),
  alertScoreShifted: z.boolean().optional(),
  alertMilestoneEarned: z.boolean().optional(),
});

/**
 * GET — Fetch current notification preferences.
 */
export const GET = withRouteHandler(
  async (_request: NextRequest, { userId }: RouteContext) => {
    const supabase = getSupabaseAdmin();

    const { data } = await supabase
      .from('user_notification_preferences')
      .select('*')
      .eq('user_id', userId!)
      .maybeSingle();

    return NextResponse.json(data || { digestFrequency: 'none' });
  },
  { auth: 'required' },
);

/**
 * POST — Save email and digest preferences. Sends verification email if new.
 */
export const POST = withRouteHandler(
  async (request: NextRequest, { userId }: RouteContext) => {
    const body = await request.json();
    const parsed = PreferencesSchema.parse(body);
    const supabase = getSupabaseAdmin();

    const update: Record<string, unknown> = {
      user_id: userId!,
      digest_frequency: parsed.digestFrequency,
      updated_at: new Date().toISOString(),
    };

    if (parsed.email !== undefined) update.email = parsed.email;
    if (parsed.alertDrepVoted !== undefined) update.alert_drep_voted = parsed.alertDrepVoted;
    if (parsed.alertCoverageChanged !== undefined)
      update.alert_coverage_changed = parsed.alertCoverageChanged;
    if (parsed.alertScoreShifted !== undefined)
      update.alert_score_shifted = parsed.alertScoreShifted;
    if (parsed.alertMilestoneEarned !== undefined)
      update.alert_milestone_earned = parsed.alertMilestoneEarned;

    const { error } = await supabase.from('user_notification_preferences').upsert(update, {
      onConflict: 'user_id',
    });

    if (error) {
      logger.error('[notification-preferences] Upsert failed', { error: error.message });
      return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 });
    }

    // If email provided, also save to users table and send verification
    if (parsed.email) {
      // Check if email is already verified on users table
      const { data: user } = await supabase
        .from('users')
        .select('email, email_verified')
        .eq('id', userId!)
        .single();

      const needsVerification = !user?.email_verified || user?.email !== parsed.email;

      if (needsVerification) {
        await supabase
          .from('users')
          .update({ email: parsed.email, email_verified: false })
          .eq('id', userId!);

        const verifyUrl = generateVerificationUrl(userId!, parsed.email);
        await sendEmail(
          parsed.email,
          'Verify your email — Governada',
          React.createElement(EmailVerificationEmail, { verifyUrl }),
        );
      }
    }

    captureServerEvent('email_opted_in', { digest_frequency: parsed.digestFrequency }, userId!);

    return NextResponse.json({ ok: true });
  },
  { auth: 'required', rateLimit: { max: 10, window: 60 } },
);
