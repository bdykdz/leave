/** Sanitize comment — strip HTML tags, trim whitespace, limit to 1000 chars */
export function sanitizeComment(raw: string): string {
  return raw.replace(/<[^>]*>/g, '').trim().slice(0, 1000);
}
