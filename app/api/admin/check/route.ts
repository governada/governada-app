import { NextRequest, NextResponse } from 'next/server';
import { bech32 } from 'bech32';

/**
 * Derive the stake (reward) address from a Cardano base payment address.
 * Base addresses encode both payment and staking key hashes;
 * this extracts the staking credential and wraps it as stake1... / stake_test1...
 */
function deriveStakeFromPaymentAddress(paymentAddress: string): string | null {
  try {
    const decoded = bech32.decode(paymentAddress, 256);
    if (decoded.prefix !== 'addr' && decoded.prefix !== 'addr_test') return null;

    const data = bech32.fromWords(decoded.words);
    // Base address: 1 header + 28 payment key hash + 28 staking key hash = 57 bytes
    if (data.length !== 57) return null;

    const headerByte = data[0];
    const addrType = (headerByte & 0xf0) >> 4;
    // Only base addresses (types 0-3) carry a staking credential
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

/**
 * Check if a given wallet address is an admin wallet.
 * Accepts payment OR stake addresses in ADMIN_WALLETS (comma-separated).
 * When a payment address is submitted, also derives its stake address
 * so either format in the env var will match.
 */
export async function POST(request: NextRequest) {
  try {
    const { address } = await request.json();
    if (!address || typeof address !== 'string') {
      return NextResponse.json({ isAdmin: false });
    }

    const adminWallets = (process.env.ADMIN_WALLETS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const lower = address.toLowerCase();
    if (adminWallets.includes(lower)) {
      return NextResponse.json({ isAdmin: true });
    }

    // Also check derived stake address (resilient to HD wallet address rotation)
    const stakeAddr = deriveStakeFromPaymentAddress(lower);
    if (stakeAddr && adminWallets.includes(stakeAddr.toLowerCase())) {
      return NextResponse.json({ isAdmin: true });
    }

    return NextResponse.json({ isAdmin: false });
  } catch {
    return NextResponse.json({ isAdmin: false });
  }
}
