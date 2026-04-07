import { cookies } from 'next/headers';
import { LEGACY_SESSION_COOKIE_NAMES, SESSION_COOKIE_NAME } from '@/lib/persistence';
import { validateSessionToken } from '@/lib/supabaseAuth';

export async function getValidatedSessionFromCookies() {
  const cookieStore = await cookies();
  const token =
    cookieStore.get(SESSION_COOKIE_NAME)?.value ??
    LEGACY_SESSION_COOKIE_NAMES.map((name) => cookieStore.get(name)?.value).find(Boolean);

  if (!token) return null;
  return validateSessionToken(token);
}
