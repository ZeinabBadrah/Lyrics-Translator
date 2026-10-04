/**
 * Word-level geometry for lyrics.
 *
 * Everything here is a pure function over `string[]` lines, so the selection
 * rules can be tested without rendering a song or simulating a pointer. The
 * React layer in `useWordSelection` only holds state; the decisions live here.
 */
import { isVerseBreak, normalizeForIndex } from "@/lib/text";

/** A word's address: which line, and which word within that line. */
export interface WordRef {
  lineIndex: number;
  wordIndex: number;
}

/** An inclusive range of words, always ordered so `start` precedes `end`. */
export interface WordSelection {
  start: WordRef;
  end: WordRef;
}

/**
 * Splits a line into display words on whitespace alone.
 *
 * Punctuation stays attached, because the word has to be rendered exactly as
 * the user pasted it — stripping happens later, only on what gets saved.
 */
export function splitWords(line: string): string[] {
  return line.split(/\s+/).filter((word) => word.length > 0);
}

const LEADING_PUNCTUATION = /^[^\p{L}\p{N}]+/u;
const TRAILING_PUNCTUATION = /[^\p{L}\p{N}]+$/u;
const APOSTROPHES = ["'", "\u2019"];

/**
 * Drops punctuation from the outside of a selection while leaving the inside
 * untouched, so `heart,` saves as `heart` but `don't` and `rock 'n' roll`
 * survive intact.
 *
 * A trailing apostrophe is kept when a letter precedes it: in lyrics `walkin'`
 * is the word, and `walkin` would be a different (and wrong) dictionary entry.
 */
export function stripEdgePunctuation(value: string): string {
  const inner = value.trim().replace(LEADING_PUNCTUATION, "");
  const core = inner.replace(TRAILING_PUNCTUATION, "");
  if (core.length === 0) {
    return "";
  }

  const next = inner.charAt(core.length);
  if (APOSTROPHES.includes(next) && /\p{L}$/u.test(core)) {
    return core + next;
  }
  return core;
}

/** Orders two addresses: negative when `a` comes first, 0 when identical. */
export function compareRefs(a: WordRef, b: WordRef): number {
  if (a.lineIndex !== b.lineIndex) {
    return a.lineIndex - b.lineIndex;
  }
  return a.wordIndex - b.wordIndex;
}

/**
 * Turns a drag's anchor and current position into an ordered range, so that
 * dragging backwards up the page selects the same words as dragging forwards.
 */
export function orderSelection(anchor: WordRef, focus: WordRef): WordSelection {
  return compareRefs(anchor, focus) <= 0
    ? { start: anchor, end: focus }
    : { start: focus, end: anchor };
}

export function isWordInSelection(
  ref: WordRef,
  selection: WordSelection | null,
): boolean {
  if (!selection) {
    return false;
  }
  return (
    compareRefs(selection.start, ref) <= 0 && compareRefs(ref, selection.end) <= 0
  );
}

/**
 * The run of consecutive non-blank lines containing `lineIndex` — in other
 * words, the verse it belongs to.
 */
export function verseBounds(
  lines: string[],
  lineIndex: number,
): { first: number; last: number } {
  let first = lineIndex;
  while (first > 0 && !isVerseBreak(lines[first - 1] ?? "")) {
    first -= 1;
  }

  let last = lineIndex;
  while (last < lines.length - 1 && !isVerseBreak(lines[last + 1] ?? "")) {
    last += 1;
  }

  return { first, last };
}

/**
 * Holds a drag inside the anchor's verse.
 *
 * Phrases may span consecutive lines, but a blank line means the next words
 * belong to a different verse and almost certainly a different sentence, so a
 * long drag stops at the break instead of joining unrelated text.
 */
export function clampToVerse(
  lines: string[],
  anchor: WordRef,
  focus: WordRef,
): WordRef {
  const { first, last } = verseBounds(lines, anchor.lineIndex);

  if (focus.lineIndex < first) {
    return { lineIndex: first, wordIndex: 0 };
  }
  if (focus.lineIndex > last) {
    const words = splitWords(lines[last] ?? "");
    return { lineIndex: last, wordIndex: Math.max(0, words.length - 1) };
  }
  return focus;
}

/**
 * The text a selection stands for: its words in reading order, lines joined by
 * a single space, with punctuation trimmed from the two ends.
 */
export function selectionText(
  lines: string[],
  selection: WordSelection | null,
): string {
  if (!selection) {
    return "";
  }

  const parts: string[] = [];
  for (
    let lineIndex = selection.start.lineIndex;
    lineIndex <= selection.end.lineIndex;
    lineIndex += 1
  ) {
    const words = splitWords(lines[lineIndex] ?? "");
    const from =
      lineIndex === selection.start.lineIndex ? selection.start.wordIndex : 0;
    const to =
      lineIndex === selection.end.lineIndex
        ? selection.end.wordIndex
        : words.length - 1;
    parts.push(...words.slice(from, to + 1));
  }

  return stripEdgePunctuation(parts.join(" "));
}

/**
 * The lines a selection touches, used as DeepL `context`: it sharpens the
 * translation of an isolated word without being translated or billed itself.
 */
export function selectionContext(
  lines: string[],
  selection: WordSelection | null,
): string {
  if (!selection) {
    return "";
  }
  return lines
    .slice(selection.start.lineIndex, selection.end.lineIndex + 1)
    .join("\n");
}

// ---------------------------------------------------------------------------
// Matching saved vocabulary back onto the lyrics
// ---------------------------------------------------------------------------

/** A `WordRef` flattened into something a Set can hold. */
export function refKey(ref: WordRef): string {
  return `${ref.lineIndex}:${ref.wordIndex}`;
}

/**
 * The lookup key for a single word, matching how `addVocabularyItem` indexes
 * what it stores. Both sides must normalise identically or saved words would
 * silently fail to match.
 */
export function savedWordKey(word: string): string {
  return normalizeForIndex(stripEdgePunctuation(word));
}

/**
 * Every word of the song in reading order, split into verses.
 *
 * Flattening makes phrase matching a plain sliding window, and grouping by
 * verse means a phrase can never be matched across a blank line — the same
 * boundary `clampToVerse` enforces while selecting.
 */
export function verseSequences(lines: string[]): WordRef[][] {
  const verses: WordRef[][] = [];
  let current: WordRef[] = [];

  lines.forEach((line, lineIndex) => {
    if (isVerseBreak(line)) {
      if (current.length > 0) {
        verses.push(current);
        current = [];
      }
      return;
    }

    splitWords(line).forEach((_, wordIndex) => {
      current.push({ lineIndex, wordIndex });
    });
  });

  if (current.length > 0) {
    verses.push(current);
  }
  return verses;
}

/** The longest saved entry, in words, which bounds how far matching looks. */
export function longestPhraseLength(savedKeys: Set<string>): number {
  let longest = 1;
  for (const key of savedKeys) {
    longest = Math.max(longest, key.split(" ").length);
  }
  return longest;
}

/**
 * Finds every word that is part of a saved multi-word phrase, so phrases can be
 * highlighted in place rather than being invisible until re-selected.
 *
 * Single words are matched separately by `savedWordKey`; this only looks for
 * runs of two or more, longest first, so that a saved "new york city" wins over
 * a saved "new york" starting at the same word.
 */
export function savedPhraseRefs(
  lines: string[],
  savedKeys: Set<string>,
): Set<string> {
  const covered = new Set<string>();
  const longest = longestPhraseLength(savedKeys);
  if (savedKeys.size === 0 || longest < 2) {
    return covered;
  }

  for (const verse of verseSequences(lines)) {
    let index = 0;
    while (index < verse.length) {
      const maxLength = Math.min(longest, verse.length - index);
      let matched = 0;

      for (let length = maxLength; length >= 2; length -= 1) {
        const text = normalizeForIndex(
          selectionText(lines, {
            start: verse[index],
            end: verse[index + length - 1],
          }),
        );
        if (text && savedKeys.has(text)) {
          matched = length;
          break;
        }
      }

      if (matched === 0) {
        index += 1;
        continue;
      }

      for (let offset = 0; offset < matched; offset += 1) {
        covered.add(refKey(verse[index + offset]));
      }
      // Carry on after the run, so overlapping phrases do not double-match.
      index += matched;
    }
  }

  return covered;
}
