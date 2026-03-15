import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const persona = searchParams.get('persona') ?? 'default';
  const supabase = createClient();

  const { data } = await supabase
    .from('cc_intelligence_briefs')
    .select('*')
    .eq('brief_type', 'committee_epoch')
    .eq('persona_variant', persona)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ briefing: null });
  }

  return NextResponse.json({
    briefing: {
      headline: data.headline as string,
      executiveSummary: data.executive_summary as string,
      keyFindings: data.key_findings as { finding: string; severity: string }[],
      whatChanged: (data.what_changed as string) ?? null,
      fullNarrative: (data.full_narrative as string) ?? null,
      generatedAt: data.generated_at as string,
    },
  });
});
