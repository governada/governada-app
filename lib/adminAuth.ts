import { bech32 } from 'bech32';
import { logger } from '@/lib/logger';

function getConfiguredWallets(envValue: string | undefined): string[] {
  return (envValue || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function deriveStakeFromPaymentAddress(paymentAddress: string): string | null {
  try {
    const decoded = bech32.decode(paymentAddress, 256);
    if (decoded.prefix !== 'addr' && decoded.prefix !== 'addr_test') {
      logger.debug('Stake derivation: bad prefix', { prefix: decoded.prefix });
      return null;
    }

    const data = bech32.fromWords(decoded.words);
    if (data.length !== 57) {
      logger.debug('Stake derivation: unexpected data length', { length: data.length });
      return null;
    }

    const headerByte = data[0];
    const addrType = (headerByte & 0xf0) >> 4;
    if (addrType > 3) {
      logger.debug('Stake derivation: unsupported addr type', { addrType });
      return null;
    }

    const networkId = headerByte & 0x0f;
    const stakeKeyHash = data.slice(29);

    const stakeHeader = 0xe0 | networkId;
    const stakeBytes = new Uint8Array(1 + stakeKeyHash.length);
    stakeBytes[0] = stakeHeader;
    stakeBytes.set(stakeKeyHash, 1);

    const prefix = networkId === 1 ? 'stake' : 'stake_test';
    return bech32.encode(prefix, bech32.toWords(stakeBytes), 256);
  } catch (e) {
    logger.warn('Stake derivation failed', { error: String(e) });
    return null;
  }
}

export function isAdminWallet(address: string): boolean {
  const lower = address.toLowerCase();
  const adminWallets = getConfiguredWallets(process.env.ADMIN_WALLETS);
  const devAdminWallets =
    process.env.NODE_ENV === 'production'
      ? []
      : getConfiguredWallets(process.env.DEV_ADMIN_WALLETS);

  logger.info('isAdminWallet check', {
    context: 'admin-auth',
    inputAddr: lower.slice(0, 15) + '...',
    adminCount: adminWallets.length,
    devAdminCount: devAdminWallets.length,
    adminPrefixes: adminWallets.map((w) => w.slice(0, 10) + '...'),
  });

  if (devAdminWallets.includes(lower)) {
    logger.info('isAdminWallet dev override', {
      context: 'admin-auth',
      inputAddr: lower.slice(0, 15) + '...',
    });
    return true;
  }

  if (adminWallets.includes(lower)) return true;

  const stakeAddr = deriveStakeFromPaymentAddress(lower);
  logger.info('isAdminWallet derivation', {
    context: 'admin-auth',
    derivedStake: stakeAddr ? stakeAddr.slice(0, 15) + '...' : 'null',
    match: stakeAddr ? adminWallets.includes(stakeAddr.toLowerCase()) : false,
  });

  if (stakeAddr && adminWallets.includes(stakeAddr.toLowerCase())) return true;

  return false;
}
