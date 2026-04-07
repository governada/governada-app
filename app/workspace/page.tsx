import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getValidatedSessionFromCookies } from '@/lib/navigation/session';
import { resolveWorkspaceDestinationForSession } from '@/lib/navigation/workspaceEntry';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Workspace — Governada',
  description: 'Your governance workspace. Review pending proposals and take action.',
};

export default async function Workspace() {
  const session = await getValidatedSessionFromCookies();
  const destination = await resolveWorkspaceDestinationForSession(session);
  redirect(destination);
}
