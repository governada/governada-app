import { bech32 } from 'bech32';

/**
 * Derive a DRep bech32 ID (drep1...) from a Cardano stake/reward address (stake1...).
 *
 * In Cardano, DRep credentials use the same key hash as stake credentials.
 * The stake address header byte encodes the network; the DRep ID uses a
 * different header byte (0x22 for key-hash mainnet) followed by the 28-byte
 * key hash.
 *
 * Returns null if the address can't be decoded or isn't a key-hash credential.
 */
export function deriveDRepIdFromStakeAddress(stakeAddress: string): string | null {
  try {
    const decoded = bech32.decode(stakeAddress, 256);

    if (decoded.prefix !== 'stake' && decoded.prefix !== 'stake_test') {
      return null;
    }

    const data = bech32.fromWords(decoded.words);

    // Stake address: 1 header byte + 28-byte key hash
    if (data.length !== 29) return null;

    const headerByte = data[0];

    // Key hash credentials have header 0xe0 (mainnet) or 0xe1 (testnet)
    const isMainnet = (headerByte & 0x0f) === 0x00 || headerByte === 0xe0;
    const isKeyHash = (headerByte & 0xf0) === 0xe0;
    if (!isKeyHash) return null;

    const keyHash = data.slice(1);

    // DRep key-hash header: 0x22 (mainnet) or 0x23 (testnet)
    const drepHeader = isMainnet ? 0x22 : 0x23;
    const drepBytes = new Uint8Array(1 + keyHash.length);
    drepBytes[0] = drepHeader;
    drepBytes.set(keyHash, 1);

    const words = bech32.toWords(drepBytes);
    return bech32.encode('drep', words, 256);
  } catch {
    return null;
  }
}

/**
 * Decode a bech32 pool ID (pool1...) to its raw hex key hash.
 * MeshJS StakingPool voter requires the hex credential, not bech32.
 */
export function poolBech32ToKeyHash(poolId: string): string {
  const decoded = bech32.decode(poolId, 256);
  const data = bech32.fromWords(decoded.words);
  return Array.from(data)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Check if a DRep ID exists in the database via the API.
 * Light client-side check; avoids importing Supabase client in the browser.
 */
export async function checkDRepExists(drepId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/dreps?id=${encodeURIComponent(drepId)}&check=1`);
    if (!res.ok) return false;
    const data = await res.json();
    return data?.exists === true;
  } catch {
    return false;
  }
}
