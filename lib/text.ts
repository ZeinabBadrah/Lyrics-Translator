/**
 * Normalises a string for use as an IndexedDB index key, so that lookups are
 * case- and whitespace-insensitive. Runs of internal whitespace collapse to a
 * single space.
 */
export function normalizeForIndex(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * An empty line marks a verse break. Blank lines are the only structure a
 * plain-text lyric sheet has, so they are kept rather than discarded — but they
 * are never sent to DeepL, since there is nothing there to translate.
 */
export const VERSE_BREAK = "";

export function isVerseBreak(line: string): boolean {
  return line === VERSE_BREAK;
}

/**
 * Splits pasted lyrics into lines, preserving verse breaks as empty strings.
 *
 * Runs of blank lines collapse to a single break, and breaks at the very start
 * or end are dropped, so that sloppy copy-and-paste does not produce a song
 * with a gaping hole at the top.
 */
export function parseLyricLines(lyrics: string): string[] {
  const trimmed = lyrics
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(
      (line, index, lines) =>
        // Collapse consecutive blanks by keeping only the first of a run.
        !isVerseBreak(line) || !isVerseBreak(lines[index - 1] ?? VERSE_BREAK),
    );

  while (trimmed.length > 0 && isVerseBreak(trimmed[trimmed.length - 1])) {
    trimmed.pop();
  }

  return trimmed;
}

/** Just the lines with words in them — what actually gets translated. */
export function translatableLines(lines: string[]): string[] {
  return lines.filter((line) => !isVerseBreak(line));
}
