/**
 * Normalises a string for use as an IndexedDB index key, so that lookups are
 * case- and whitespace-insensitive. Runs of internal whitespace collapse to a
 * single space.
 */
export function normalizeForIndex(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Splits pasted lyrics into lines, dropping blank ones. */
export function splitIntoLines(lyrics: string): string[] {
  return lyrics
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
