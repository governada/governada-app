/**
 * Batch embedding generation with staleness detection.
 * Compares content hashes to skip unchanged entities.
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import type { ComposedDocument } from './types';
import { generateEmbeddings } from './provider';

/**
 * Store embeddings for composed documents, skipping unchanged ones.
 * Returns count of newly generated embeddings.
 */
export async function generateAndStoreEmbeddings(documents: ComposedDocument[]): Promise<number> {
  if (documents.length === 0) return 0;

  const supabase = getSupabaseAdmin();

  // Fetch existing embeddings for these entities to check content hashes
  const { data: existing } = await supabase
    .from('embeddings')
    .select('entity_type, entity_id, content_hash')
    .in('entity_type', [...new Set(documents.map((d) => d.entityType))])
    .in('entity_id', [...new Set(documents.map((d) => d.entityId))]);

  const existingMap = new Map(
    (existing ?? []).map(
      (e: { entity_type: string; entity_id: string; content_hash: string | null }) => [
        `${e.entity_type}:${e.entity_id}`,
        e.content_hash,
      ],
    ),
  );

  // Filter to only stale/new documents
  const staleDocuments = documents.filter((d) => {
    const key = `${d.entityType}:${d.entityId}`;
    return existingMap.get(key) !== d.contentHash;
  });

  if (staleDocuments.length === 0) return 0;

  logger.info('[Embeddings] Generating embeddings', {
    total: documents.length,
    stale: staleDocuments.length,
    skipped: documents.length - staleDocuments.length,
  });

  // Generate embeddings in batches of 100
  const BATCH_SIZE = 100;
  let generated = 0;

  for (let i = 0; i < staleDocuments.length; i += BATCH_SIZE) {
    const batch = staleDocuments.slice(i, i + BATCH_SIZE);
    const texts = batch.map((d) => d.text);
    const embeddings = await generateEmbeddings(texts);

    // Upsert each embedding (delete + insert for reliable upserts)
    for (let j = 0; j < batch.length; j++) {
      const doc = batch[j];
      const row = {
        entity_type: doc.entityType,
        entity_id: doc.entityId,
        embedding: JSON.stringify(embeddings[j]),
        content_hash: doc.contentHash,
        model_used: 'text-embedding-3-large',
        updated_at: new Date().toISOString(),
      };

      await supabase
        .from('embeddings')
        .delete()
        .eq('entity_type', row.entity_type)
        .eq('entity_id', row.entity_id);

      const { error } = await supabase.from('embeddings').insert(row);
      if (error) {
        logger.error('[Embeddings] Insert failed', {
          error: error.message,
          entityType: doc.entityType,
          entityId: doc.entityId,
        });
      }
    }

    generated += batch.length;
  }

  logger.info('[Embeddings] Generation complete', { generated });
  return generated;
}
