/**
 * Export Draft API — download a proposal draft as Markdown or CIP-108 JSON.
 *
 * GET /api/workspace/drafts/[draftId]/export?format=markdown|cip108&stakeAddress=...
 * Returns: File download with Content-Disposition: attachment
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getSupabaseAdmin } from '@/lib/supabase';
import { ExportFormat } from '@/lib/api/schemas/workspace';
import { buildCip108Document } from '@/lib/workspace/cip108';
import { PROPOSAL_TYPE_LABELS } from '@/lib/workspace/types';
import type { ProposalType } from '@/lib/workspace/types';

export const dynamic = 'force-dynamic';

function extractDraftId(pathname: string): string | null {
  const match = pathname.match(/\/drafts\/([^/]+)\/export/);
  return match?.[1] ?? null;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toISOString().split('T')[0];
}

export const GET = withRouteHandler(async (request: NextRequest) => {
  const draftId = extractDraftId(request.nextUrl.pathname);
  if (!draftId) {
    return NextResponse.json({ error: 'Missing draftId' }, { status: 400 });
  }

  const formatParam = request.nextUrl.searchParams.get('format') ?? 'markdown';
  const format = ExportFormat.parse(formatParam);

  const admin = getSupabaseAdmin();

  // Fetch the draft
  const { data: draft, error: fetchError } = await admin
    .from('proposal_drafts')
    .select('*')
    .eq('id', draftId)
    .single();

  if (fetchError || !draft) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
  }

  if (format === 'cip108') {
    // Build CIP-108 JSON-LD document
    const document = buildCip108Document({
      title: draft.title,
      abstract: draft.abstract,
      motivation: draft.motivation,
      rationale: draft.rationale,
    });

    const jsonContent = JSON.stringify(document, null, 2);

    return new NextResponse(jsonContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="proposal-${draftId}.json"`,
      },
    });
  }

  // Default: Markdown format
  const proposalTypeLabel =
    PROPOSAL_TYPE_LABELS[draft.proposal_type as ProposalType] ?? draft.proposal_type;

  let markdown = `# ${draft.title}\n\n`;
  markdown += `**Type:** ${proposalTypeLabel}\n`;
  markdown += `**Status:** ${draft.status}\n`;
  markdown += `**Version:** ${draft.current_version}\n`;
  markdown += `**Last Updated:** ${formatDate(draft.updated_at)}\n\n`;

  markdown += `## Abstract\n\n${draft.abstract || '_No abstract provided._'}\n\n`;
  markdown += `## Motivation\n\n${draft.motivation || '_No motivation provided._'}\n\n`;
  markdown += `## Rationale\n\n${draft.rationale || '_No rationale provided._'}\n`;

  // Include type-specific fields if present
  const typeSpecific = draft.type_specific as Record<string, unknown> | null;
  if (typeSpecific && Object.keys(typeSpecific).length > 0) {
    // Filter out internal fields (starting with _)
    const publicFields = Object.entries(typeSpecific).filter(([key]) => !key.startsWith('_'));
    if (publicFields.length > 0) {
      markdown += `\n## Type-Specific Details\n\n`;
      for (const [key, value] of publicFields) {
        const label = key
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, (s) => s.toUpperCase())
          .trim();
        markdown += `**${label}:** ${String(value)}\n`;
      }
    }
  }

  return new NextResponse(markdown, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="proposal-${draftId}.md"`,
    },
  });
});
