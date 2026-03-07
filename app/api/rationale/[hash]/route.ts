/**
 * Rationale Document Retrieval API
 * GET: Serves a CIP-100 JSON-LD document by its Blake2b-256 content hash.
 * This URL is used as the on-chain vote anchor.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ hash: string }> },
) {
  const { hash } = await params;

  if (!hash || hash.length < 16) {
    return NextResponse.json({ error: 'Invalid hash' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('rationale_documents')
    .select('document')
    .eq('content_hash', hash)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Rationale not found' }, { status: 404 });
  }

  return NextResponse.json(data.document, {
    headers: {
      'Content-Type': 'application/json+ld',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
