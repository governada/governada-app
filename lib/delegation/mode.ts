export type DelegationMode = 'mainnet' | 'sandbox';

function readEnv(key: string): string | undefined {
  if (typeof process === 'undefined') return undefined;
  return process.env?.[key];
}

function normalizeDelegationMode(raw: string | undefined): DelegationMode {
  return raw === 'sandbox' ? 'sandbox' : 'mainnet';
}

export function getDelegationMode(): DelegationMode {
  return normalizeDelegationMode(
    readEnv('GOVERNADA_DELEGATION_MODE') ?? readEnv('NEXT_PUBLIC_GOVERNADA_DELEGATION_MODE'),
  );
}

export function isSandboxMode(): boolean {
  return getDelegationMode() === 'sandbox';
}

function getExplicitPublicDelegationMode(): DelegationMode | undefined {
  const raw = readEnv('NEXT_PUBLIC_GOVERNADA_DELEGATION_MODE');
  if (raw === 'mainnet' || raw === 'sandbox') return raw;
  return undefined;
}

export async function resolveDelegationMode(
  fetchImpl: typeof fetch = fetch,
): Promise<DelegationMode> {
  const envMode = getDelegationMode();
  const publicMode = getExplicitPublicDelegationMode();
  if (typeof window === 'undefined' || envMode === 'sandbox' || publicMode === 'mainnet') {
    return envMode;
  }

  try {
    const response = await fetchImpl('/api/delegation/mode', {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return envMode;
    const body = (await response.json()) as { mode?: string };
    return normalizeDelegationMode(body.mode);
  } catch {
    return envMode;
  }
}
