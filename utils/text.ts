/**
 * Strip markdown syntax to produce plain text for truncated previews.
 * Handles links, bold/italic, headers, images, and code.
 */
export function stripMarkdown(md: string): string {
  return md
    .replace(/!\[.*?\]\(.*?\)/g, '') // images
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1') // links → link text
    .replace(/#{1,6}\s+/g, '') // headers
    .replace(/(\*{1,3}|_{1,3})(.*?)\1/g, '$2') // bold/italic
    .replace(/`{1,3}[^`]*`{1,3}/g, '') // inline/block code
    .replace(/>\s?/g, '') // blockquotes
    .replace(/[-*+]\s/g, '') // unordered list markers
    .replace(/\d+\.\s/g, '') // ordered list markers
    .replace(/\n{2,}/g, ' ') // collapse multi-newlines
    .replace(/\n/g, ' ') // remaining newlines
    .trim();
}
