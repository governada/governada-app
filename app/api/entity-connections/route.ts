/**
 * Entity Connections API — returns relationship data for the Connected Graph panel.
 *
 * Params: entityType (drep|proposal|pool|cc), entityId, optional viewerDrepId
 * Returns up to 10 connections sorted by relevance (personal first).
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getEntityConnections, type EntityType } from '@/lib/entityConnections';

export const dynamic = 'force-dynamic';

const VALID_TYPES = new Set(['drep', 'proposal', 'pool', 'cc']);

export const GET = withRouteHandler(async (request: NextRequest) => {
  const entityType = request.nextUrl.searchParams.get('type') as EntityType;
  const entityId = request.nextUrl.searchParams.get('id');
  const viewerDrepId = request.nextUrl.searchParams.get('viewerDrepId');
  const viewerStakeAddress = request.nextUrl.searchParams.get('viewerStakeAddress');

  if (!entityType || !VALID_TYPES.has(entityType)) {
    return NextResponse.json({ error: 'Invalid entity type' }, { status: 400 });
  }
  if (!entityId) {
    return NextResponse.json({ error: 'Missing entity id' }, { status: 400 });
  }

  const connections = await getEntityConnections(entityType, entityId, {
    viewerDrepId,
    viewerStakeAddress,
  });

  return NextResponse.json(
    { connections },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800',
      },
    },
  );
});
