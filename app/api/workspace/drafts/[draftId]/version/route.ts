/**
 * Draft Version API — save a named version snapshot.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getSupabaseAdmin } from '@/lib/supabase';
import { SaveVersionSchema } from '@/lib/api/schemas/workspace';
import { captureServerEvent } from '@/lib/posthog-server';
import type { DraftVersion } from '@/lib/workspace/types';

export const dynamic = 'force-dynamic';

/** GET /api/workspace/drafts/[draftId]/version?versionNumber=N — fetch version content */
export const GET = withRouteHandler(
  async (request: NextRequest) => {
    const segments = request.nextUrl.pathname.split('/');
    const versionIdx = segments.indexOf('version');
    const draftId = versionIdx > 0 ? segments[versionIdx - 1] : null;

    if (!draftId) {
      return NextResponse.json({ error: 'Missing draftId' }, { status: 400 });
    }

    const versionNumber = request.nextUrl.searchParams.get('versionNumber');
    if (!versionNumber) {
      return NextResponse.json({ error: 'Missing versionNumber query param' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    const { data: version, error: versionError } = await admin
      .from('proposal_draft_versions')
      .select('*')
      .eq('draft_id', draftId)
      .eq('version_number', Number(versionNumber))
      .single();

    if (versionError || !version) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }

    const mapped: DraftVersion = {
      id: version.id,
      draftId: version.draft_id,
      versionNumber: version.version_number,
      versionName: version.version_name ?? '',
      editSummary: version.edit_summary ?? null,
      content: version.content,
      createdAt: version.created_at,
    };

    return NextResponse.json({ version: mapped });
  },
  { auth: 'none', rateLimit: { max: 30, window: 60 } },
);

/** POST /api/workspace/drafts/[draftId]/version — save a named version */
export const POST = withRouteHandler(
  async (request: NextRequest) => {
    // Extract draftId from URL: /api/workspace/drafts/{draftId}/version
    const segments = request.nextUrl.pathname.split('/');
    const versionIdx = segments.indexOf('version');
    const draftId = versionIdx > 0 ? segments[versionIdx - 1] : null;

    if (!draftId) {
      return NextResponse.json({ error: 'Missing draftId' }, { status: 400 });
    }

    const body = SaveVersionSchema.parse(await request.json());
    const admin = getSupabaseAdmin();

    // Fetch current draft
    const { data: draft, error: draftError } = await admin
      .from('proposal_drafts')
      .select('*')
      .eq('id', draftId)
      .single();

    if (draftError || !draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    // Get next version number
    const { data: latestVersion } = await admin
      .from('proposal_draft_versions')
      .select('version_number')
      .eq('draft_id', draftId)
      .order('version_number', { ascending: false })
      .limit(1)
      .single();

    const nextVersionNumber = (latestVersion?.version_number ?? 0) + 1;

    // Insert new version with content snapshot
    const { data: version, error: versionError } = await admin
      .from('proposal_draft_versions')
      .insert({
        draft_id: draftId,
        version_number: nextVersionNumber,
        version_name: body.versionName,
        edit_summary: body.editSummary ?? null,
        content: {
          title: draft.title ?? '',
          abstract: draft.abstract ?? '',
          motivation: draft.motivation ?? '',
          rationale: draft.rationale ?? '',
          proposalType: draft.proposal_type,
          typeSpecific: draft.type_specific ?? null,
        },
      })
      .select()
      .single();

    if (versionError || !version) {
      return NextResponse.json({ error: 'Failed to save version' }, { status: 500 });
    }

    // Update draft current_version
    await admin
      .from('proposal_drafts')
      .update({
        current_version: nextVersionNumber,
        updated_at: new Date().toISOString(),
      })
      .eq('id', draftId);

    captureServerEvent('author_version_saved', {
      draft_id: draftId,
      version_number: nextVersionNumber,
    });

    const mapped: DraftVersion = {
      id: version.id,
      draftId: version.draft_id,
      versionNumber: version.version_number,
      versionName: version.version_name ?? '',
      editSummary: version.edit_summary ?? null,
      content: version.content,
      createdAt: version.created_at,
    };

    return NextResponse.json({ version: mapped }, { status: 201 });
  },
  { auth: 'none', rateLimit: { max: 20, window: 60 } },
);
