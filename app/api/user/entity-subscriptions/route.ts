import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';

export const dynamic = 'force-dynamic';

const VALID_ENTITY_TYPES = ['drep', 'spo', 'proposal', 'cc_member'] as const;
type EntityType = (typeof VALID_ENTITY_TYPES)[number];

function isValidEntityType(value: string): value is EntityType {
  return (VALID_ENTITY_TYPES as readonly string[]).includes(value);
}

export const GET = withRouteHandler(
  async (_request: NextRequest, { userId }: RouteContext) => {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('user_entity_subscriptions')
      .select('*')
      .eq('user_id', userId!);

    if (error) {
      logger.error('Entity subscriptions fetch error', {
        context: 'entity-subscriptions',
        error: error.message,
      });
      return NextResponse.json({ error: 'Failed to fetch entity subscriptions' }, { status: 500 });
    }

    return NextResponse.json({ subscriptions: data });
  },
  { auth: 'required' },
);

export const POST = withRouteHandler(
  async (request: NextRequest, { userId }: RouteContext) => {
    const body = await request.json();
    const { entity_type, entity_id } = body;

    if (!entity_type || !entity_id) {
      return NextResponse.json(
        { error: 'entity_type and entity_id are required' },
        { status: 400 },
      );
    }

    if (!isValidEntityType(entity_type)) {
      return NextResponse.json(
        { error: `Invalid entity_type. Must be one of: ${VALID_ENTITY_TYPES.join(', ')}` },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('user_entity_subscriptions')
      .insert({
        user_id: userId!,
        entity_type,
        entity_id,
      })
      .select()
      .single();

    if (error) {
      logger.error('Entity subscription create error', {
        context: 'entity-subscriptions',
        error: error.message,
      });
      return NextResponse.json({ error: 'Failed to create entity subscription' }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  },
  { auth: 'required' },
);

export const DELETE = withRouteHandler(
  async (request: NextRequest, { userId }: RouteContext) => {
    const body = await request.json();
    const { entity_type, entity_id } = body;

    if (!entity_type || !entity_id) {
      return NextResponse.json(
        { error: 'entity_type and entity_id are required' },
        { status: 400 },
      );
    }

    if (!isValidEntityType(entity_type)) {
      return NextResponse.json(
        { error: `Invalid entity_type. Must be one of: ${VALID_ENTITY_TYPES.join(', ')}` },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('user_entity_subscriptions')
      .delete()
      .eq('user_id', userId!)
      .eq('entity_type', entity_type)
      .eq('entity_id', entity_id);

    if (error) {
      logger.error('Entity subscription delete error', {
        context: 'entity-subscriptions',
        error: error.message,
      });
      return NextResponse.json({ error: 'Failed to delete entity subscription' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  },
  { auth: 'required' },
);
