import { NextResponse } from 'next/server';
import { bech32 } from 'bech32';
import { requireAuth } from '@/lib/supabaseAuth';
import { withRouteHandler } from '@/lib/api/withRouteHandler';

function deriveStakeFromPaymentAddress(paymentAddress: string): string | null {
  try {
    const decoded = bech32.decode(paymentAddress, 256);
    if (decoded.prefix !== 'addr' && decoded.prefix !== 'addr_test') return null;

    const data = bech32.fromWords(decoded.words);
    if (data.length !== 57) return null;

    const headerByte = data[0];
    const addrType = (headerByte & 0xf0) >> 4;
    if (addrType > 3) return null;

    const networkId = headerByte & 0x0f;
    const stakeKeyHash = data.slice(29);

    const stakeHeader = 0xe0 | networkId;
    const stakeBytes = new Uint8Array(1 + stakeKeyHash.length);
    stakeBytes[0] = stakeHeader;
    stakeBytes.set(stakeKeyHash, 1);

    const prefix = networkId === 1 ? 'stake' : 'stake_test';
    return bech32.encode(prefix, bech32.toWords(stakeBytes), 256);
  } catch {
    return null;
  }
}

function isAdminWallet(address: string): boolean {
  const adminWallets = (process.env.ADMIN_WALLETS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const lower = address.toLowerCase();
  if (adminWallets.includes(lower)) return true;

  const stakeAddr = deriveStakeFromPaymentAddress(lower);
  if (stakeAddr && adminWallets.includes(stakeAddr.toLowerCase())) return true;

  return false;
}

/**
 * POST: Check if the authenticated wallet is an admin.
 * Requires a valid session token via Authorization header.
 */
export const POST = withRouteHandler(async (request) => {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    return NextResponse.json({ isAdmin: isAdminWallet(auth.wallet) });
  } catch {
    return NextResponse.json({ isAdmin: false });
  }
});
