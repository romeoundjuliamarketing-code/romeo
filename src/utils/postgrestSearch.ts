const MAX_LENGTH = 64;

/**
 * Makes user input safe for a PostgREST `.or()` filter with ilike patterns.
 * Filter syntax characters become `_` (ilike: exactly one character), so
 * "St. Pauli" or "O'Brien" still match but cannot add filter clauses.
 * Wildcards and escapes are dropped.
 */
export function sanitizeSearchTerm(input: string): string {
  const cleaned = input
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/[%*\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_LENGTH)
    .trim();
  // Nothing searchable left (only punctuation) → treat as empty query.
  if (!/[\p{L}\p{N}]/u.test(cleaned)) return '';
  return cleaned.replace(/[,().:'"]/g, '_');
}
