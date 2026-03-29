/**
 * Static list of Cardano Constitution articles.
 *
 * Used by validation passes to verify that AI-generated constitutional
 * citations reference real articles (deterministic, no LLM needed).
 *
 * Source: Cardano Constitution ratified December 2024.
 * Update this list if the constitution is amended.
 */

export const CONSTITUTION_ARTICLES: ReadonlySet<string> = new Set([
  'Article I',
  'Article II',
  'Article III',
  'Article IV',
  'Article V',
  'Article VI',
  'Article VII',
  'Article VIII',
  'Article IX',
  // Preamble is sometimes cited
  'Preamble',
  // Appendices
  'Appendix I',
  'Appendix II',
]);

/**
 * Check if an article reference matches a known constitutional article.
 * Handles variations like "Article III, Section 5" or "Article III Section 5".
 */
export function isValidArticleRef(ref: string): boolean {
  // Exact match
  if (CONSTITUTION_ARTICLES.has(ref)) return true;
  // Match base article from "Article X, Section Y" or "Article X Section Y"
  const baseMatch = ref.match(/^(Article\s+[IVX]+|Preamble|Appendix\s+[IVX]+)/i);
  if (!baseMatch) return false;
  // Normalize: "article iii" -> "Article III"
  const normalized = baseMatch[1]
    .replace(/^(article|appendix)/i, (m) => m.charAt(0).toUpperCase() + m.slice(1).toLowerCase())
    .replace(/\s+([ivx]+)$/i, (_, roman) => ' ' + roman.toUpperCase());
  return CONSTITUTION_ARTICLES.has(normalized);
}

/**
 * Filter an array of article assessments/citations to only those
 * referencing real constitutional articles.
 */
export function filterValidArticles<T extends { article: string }>(items: T[]): T[] {
  return items.filter((item) => isValidArticleRef(item.article));
}
