import { FeatureExtractionPipeline, pipeline } from '@huggingface/transformers';

/**
 * Turns text into a "meaning vector": 384 numbers where sentences that mean
 * similar things get similar numbers.
 *
 * Runs a small model locally (no API key, works offline once downloaded).
 * The first call downloads and loads the model, which takes a few seconds,
 * so the API warms it up at startup. This lives outside a NestJS service so
 * the seed script can use it too.
 */

const DEFAULT_MODEL = 'Xenova/all-MiniLM-L6-v2';

// Loading the model is slow, so keep one copy for the whole process. Storing
// the promise (not the result) means two callers arriving at once share one load.
let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

const loadExtractor = (): Promise<FeatureExtractionPipeline> => {
  extractorPromise ??= pipeline(
    'feature-extraction',
    process.env.EMBEDDING_MODEL || DEFAULT_MODEL,
  ) as Promise<FeatureExtractionPipeline>;
  return extractorPromise;
};

/** Load the model now rather than on the first message. */
export const warmUpEmbeddings = async (): Promise<void> => {
  await loadExtractor();
};

/**
 * Embed one piece of text.
 *
 * "Mean pooling" averages the model's per-word output into one vector for the
 * whole sentence. "Normalize" scales it to length 1, so the cosine similarity
 * of two vectors is just how much they point the same way.
 */
export const embedText = async (text: string): Promise<number[]> => {
  const extractor = await loadExtractor();
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data as Float32Array);
};

/**
 * Format a vector the way pgvector expects it in SQL: "[0.1,0.2,...]".
 * Pass the result as a query parameter and cast it with `::vector`.
 */
export const toVectorLiteral = (vector: readonly number[]): string => `[${vector.join(',')}]`;
