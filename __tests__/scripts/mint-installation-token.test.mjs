import { generateKeyPairSync, createVerify } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

import {
  main,
  mintAppJwt,
  normalizePrivateKey,
  requestInstallationToken,
} from '../../scripts/mint-installation-token.mjs';

function keyPair() {
  return generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
}

function decodeSegment(segment) {
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
}

describe('mint-installation-token', () => {
  it('mints an installation token with valid env', async () => {
    const { privateKey } = keyPair();
    const fetchImpl = vi.fn(async () => ({
      status: 201,
      json: async () => ({ token: 'ghs_test123', expires_at: '2026-05-05T00:00:00Z' }),
    }));
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await main(
      {
        GOVERNADA_GITHUB_CLIENT_ID: 'Iv23test',
        GOVERNADA_GITHUB_INSTALLATION_ID: '123',
        GOVERNADA_GITHUB_APP_PRIVATE_KEY: privateKey,
      },
      fetchImpl,
    );

    expect(write).toHaveBeenCalledWith('ghs_test123\n');
    write.mockRestore();
  });

  it('normalizes escaped newlines in PEM env values', () => {
    const { privateKey, publicKey } = keyPair();
    const jwt = mintAppJwt({
      clientId: 'Iv23test',
      privateKey: privateKey.replaceAll('\n', '\\n'),
      now: 1_777_777_777,
    });
    const [encodedHeader, encodedPayload, encodedSignature] = jwt.split('.');

    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${encodedHeader}.${encodedPayload}`);
    verifier.end();
    expect(verifier.verify(publicKey, Buffer.from(encodedSignature, 'base64url'))).toBe(true);
  });

  it('normalizes one-line PEM values from concealed fields', () => {
    const { privateKey, publicKey } = keyPair();
    const oneLinePem = privateKey.replace(/\n/gu, '');
    const normalized = normalizePrivateKey(oneLinePem);
    expect(normalized.split('\n').length).toBeGreaterThan(3);

    const jwt = mintAppJwt({
      clientId: 'Iv23test',
      privateKey: oneLinePem,
      now: 1_777_777_777,
    });
    const [encodedHeader, encodedPayload, encodedSignature] = jwt.split('.');

    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${encodedHeader}.${encodedPayload}`);
    verifier.end();
    expect(verifier.verify(publicKey, Buffer.from(encodedSignature, 'base64url'))).toBe(true);
  });

  it('fails closed when client id is missing', async () => {
    await expect(main({}, vi.fn())).rejects.toThrow('GOVERNADA_GITHUB_CLIENT_ID is missing');
  });

  it('fails closed when the private key is malformed', async () => {
    await expect(
      requestInstallationToken({
        clientId: 'Iv23test',
        installationId: '123',
        privateKey: 'not a pem',
        fetchImpl: vi.fn(),
      }),
    ).rejects.toThrow();
  });

  it('fails closed on GitHub API 401 with redacted error text', async () => {
    const { privateKey } = keyPair();
    const fetchImpl = vi.fn(async () => ({
      status: 401,
      json: async () => ({ message: 'bad credentials', token: 'ghs_should_not_leak_12345' }),
    }));

    await expect(
      requestInstallationToken({
        clientId: 'Iv23test',
        installationId: '123',
        privateKey,
        fetchImpl,
      }),
    ).rejects.toThrow('[redacted-github-token]');
  });

  it('mints a JWT with the expected RS256 shape and claims', () => {
    const { privateKey, publicKey } = keyPair();
    const jwt = mintAppJwt({ clientId: 'Iv23test', privateKey, now: 1_777_777_777 });
    const [encodedHeader, encodedPayload, encodedSignature] = jwt.split('.');

    expect(decodeSegment(encodedHeader)).toEqual({ alg: 'RS256', typ: 'JWT' });
    expect(decodeSegment(encodedPayload)).toEqual({
      iss: 'Iv23test',
      iat: 1_777_777_717,
      exp: 1_777_778_317,
    });

    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${encodedHeader}.${encodedPayload}`);
    verifier.end();
    expect(verifier.verify(publicKey, Buffer.from(encodedSignature, 'base64url'))).toBe(true);
  });
});
