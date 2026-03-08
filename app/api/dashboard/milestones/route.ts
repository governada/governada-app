import { NextRequest, NextResponse } from 'next/server';
import { MILESTONES, getAchievedMilestones, checkAndAwardMilestones } from '@/lib/milestones';
import { captureServerEvent } from '@/lib/posthog-server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(async (request: NextRequest) => {
  const drepId = request.nextUrl.searchParams.get('drepId');
  if (!drepId) return NextResponse.json({ error: 'Missing drepId' }, { status: 400 });

  const achieved = await getAchievedMilestones(drepId);
  const achievedKeys = new Set(achieved.map((a) => a.milestoneKey));

  const milestones = MILESTONES.map((m) => ({
    ...m,
    achieved: achievedKeys.has(m.key),
    achievedAt: achieved.find((a) => a.milestoneKey === m.key)?.achievedAt || null,
  }));

  return NextResponse.json({
    milestones,
    achievedCount: achieved.length,
    totalCount: MILESTONES.length,
  });
});

export const POST = withRouteHandler(async (request: NextRequest) => {
  const { drepId } = await request.json();
  if (!drepId) return NextResponse.json({ error: 'Missing drepId' }, { status: 400 });

  const newMilestones = await checkAndAwardMilestones(drepId);

  captureServerEvent(
    'milestone_updated',
    { drep_id: drepId, new_milestones: newMilestones.length },
    drepId,
  );

  return NextResponse.json({ newMilestones });
});
