/**
 * CIP-100 rationale document builder and Blake2b hashing.
 * Produces JSON-LD documents compliant with CIP-100 for governance vote anchors.
 */

import { blake2bHex } from 'blakejs';

// ---------------------------------------------------------------------------
// CIP-100 JSON-LD envelope
// ---------------------------------------------------------------------------

const CIP100_CONTEXT = {
  '@language': 'en-us',
  CIP100: 'https://github.com/cardano-foundation/CIPs/blob/master/CIP-0100/README.md#',
  hashAlgorithm: 'CIP100:hashAlgorithm',
  body: {
    '@id': 'CIP100:body',
    '@context': {
      references: {
        '@id': 'CIP100:references',
        '@container': '@set',
        '@context': {
          GovernanceMetadataReference: 'CIP100:GovernanceMetadataReference',
          Other: 'CIP100:Other',
          label: 'CIP100:reference-label',
          uri: 'CIP100:reference-uri',
          referenceHash: {
            '@id': 'CIP100:referenceHash',
            '@context': {
              hashDigest: 'CIP100:hashDigest',
              hashAlgorithm: 'CIP100:hashAlgorithm',
            },
          },
        },
      },
      comment: 'CIP100:comment',
    },
  },
  authors: {
    '@id': 'CIP100:authors',
    '@container': '@set',
    '@context': {
      name: 'http://xmlns.com/foaf/0.1/name',
      witness: {
        '@id': 'CIP100:witness',
        '@context': {
          witnessAlgorithm: 'CIP100:witnessAlgorithm',
          publicKey: 'CIP100:publicKey',
          signature: 'CIP100:signature',
        },
      },
    },
  },
};

export interface Cip100Document {
  '@context': typeof CIP100_CONTEXT;
  hashAlgorithm: string;
  body: {
    comment: string;
    references?: Array<{
      '@type': string;
      label: string;
      uri: string;
    }>;
  };
  authors?: Array<{
    name?: string;
  }>;
}

/**
 * Build a CIP-100 compliant JSON-LD rationale document.
 */
export function buildCip100Document(rationaleText: string, drepId?: string): Cip100Document {
  const doc: Cip100Document = {
    '@context': CIP100_CONTEXT,
    hashAlgorithm: 'blake2b-256',
    body: {
      comment: rationaleText,
    },
  };

  if (drepId) {
    doc.authors = [{ name: drepId }];
  }

  return doc;
}

/**
 * Compute the Blake2b-256 hash of a CIP-100 document.
 * The hash is computed over the canonical JSON serialization.
 */
export function hashRationale(document: Cip100Document): string {
  const canonical = JSON.stringify(document);
  return blake2bHex(canonical, undefined, 32);
}

/**
 * Build a CIP-100 document and compute its hash in one call.
 */
export function buildAndHashRationale(
  rationaleText: string,
  drepId?: string,
): { document: Cip100Document; contentHash: string } {
  const document = buildCip100Document(rationaleText, drepId);
  const contentHash = hashRationale(document);
  return { document, contentHash };
}
