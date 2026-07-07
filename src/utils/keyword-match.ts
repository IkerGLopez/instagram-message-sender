/**
 * Case-insensitive keyword detection with word-boundary enforcement.
 *
 * A comment triggers only when the full keyword appears as a whole word,
 * delimited by whitespace, punctuation, start-of-string, or end-of-string.
 * Partial-word matches never trigger.
 *
 * Example: keyword="BASUSTA"
 *   "BASUSTA"             → true
 *   "basusta"             → true
 *   "quiero BASUSTA ya"   → true
 *   "BASUSTA!"            → true
 *   "BASUST"              → false (partial word)
 *   "BASUSTAS"            → false (partial word)
 */

/**
 * Returns true when `text` contains `keyword` as a whole word,
 * matching case-insensitively. Rejects partial-word matches.
 *
 * The keyword is escaped before constructing the regex so that special
 * regex characters in the keyword are treated as literals.
 */
export function matchesKeyword(text: string, keyword: string): boolean {
  if (!keyword) return false;

  // Escape special regex characters in the keyword
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // \b enforces word boundaries; 'i' flag for case-insensitive matching
  const regex = new RegExp(`\\b${escaped}\\b`, 'i');
  return regex.test(text);
}
