/**
 * A merchant name reduced to what stays the same between visits: lower-case, no digits or punctuation,
 * single spaces. Category rules and recurring suggestions are keyed by it.
 */
export function merchantKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}
