import { describe, expect, it } from "vitest";

import { normalizeForIndex } from "@/lib/text";
import {
  clampToVerse,
  compareRefs,
  isWordInSelection,
  longestPhraseLength,
  orderSelection,
  refKey,
  savedPhraseRefs,
  savedWordKey,
  selectionContext,
  selectionText,
  splitWords,
  stripEdgePunctuation,
  verseBounds,
  verseSequences,
} from "@/lib/words";

describe("splitWords", () => {
  it("splits on whitespace and keeps punctuation attached", () => {
    expect(splitWords("hold on, friend")).toEqual(["hold", "on,", "friend"]);
  });

  it("ignores runs of whitespace and leading or trailing space", () => {
    expect(splitWords("  two   words  ")).toEqual(["two", "words"]);
  });

  it("returns nothing for a verse break", () => {
    expect(splitWords("")).toEqual([]);
  });
});

describe("stripEdgePunctuation", () => {
  it("removes punctuation from both ends", () => {
    expect(stripEdgePunctuation("(heart),")).toBe("heart");
  });

  it("keeps punctuation inside the word", () => {
    expect(stripEdgePunctuation("don't")).toBe("don't");
  });

  it("keeps punctuation between words of a phrase", () => {
    expect(stripEdgePunctuation("heart, and soul")).toBe("heart, and soul");
  });

  it("keeps a trailing apostrophe after a letter", () => {
    // Dropped-g spellings are their own words; "walkin" would be wrong.
    expect(stripEdgePunctuation("walkin'")).toBe("walkin'");
    expect(stripEdgePunctuation("walkin'.")).toBe("walkin'");
  });

  it("removes a trailing quote that does not follow a letter", () => {
    expect(stripEdgePunctuation("stay!'")).toBe("stay");
  });

  it("handles curly apostrophes", () => {
    expect(stripEdgePunctuation("lovin\u2019")).toBe("lovin\u2019");
  });

  it("returns an empty string when there is nothing but punctuation", () => {
    expect(stripEdgePunctuation("\u2014")).toBe("");
    expect(stripEdgePunctuation("...")).toBe("");
  });

  it("keeps digits", () => {
    expect(stripEdgePunctuation("(99)")).toBe("99");
  });
});

describe("compareRefs and orderSelection", () => {
  it("orders by line before word", () => {
    expect(
      compareRefs({ lineIndex: 0, wordIndex: 9 }, { lineIndex: 1, wordIndex: 0 }),
    ).toBeLessThan(0);
  });

  it("treats identical addresses as equal", () => {
    expect(
      compareRefs({ lineIndex: 2, wordIndex: 3 }, { lineIndex: 2, wordIndex: 3 }),
    ).toBe(0);
  });

  it("normalises a backwards drag into a forwards range", () => {
    const anchor = { lineIndex: 2, wordIndex: 1 };
    const focus = { lineIndex: 1, wordIndex: 0 };

    expect(orderSelection(anchor, focus)).toEqual({ start: focus, end: anchor });
    expect(orderSelection(focus, anchor)).toEqual({ start: focus, end: anchor });
  });
});

describe("isWordInSelection", () => {
  const selection = {
    start: { lineIndex: 0, wordIndex: 1 },
    end: { lineIndex: 1, wordIndex: 1 },
  };

  it("includes both endpoints", () => {
    expect(isWordInSelection({ lineIndex: 0, wordIndex: 1 }, selection)).toBe(true);
    expect(isWordInSelection({ lineIndex: 1, wordIndex: 1 }, selection)).toBe(true);
  });

  it("includes words on the far end of an intermediate line", () => {
    expect(isWordInSelection({ lineIndex: 0, wordIndex: 7 }, selection)).toBe(true);
  });

  it("excludes words before the start and after the end", () => {
    expect(isWordInSelection({ lineIndex: 0, wordIndex: 0 }, selection)).toBe(false);
    expect(isWordInSelection({ lineIndex: 1, wordIndex: 2 }, selection)).toBe(false);
  });

  it("selects nothing when there is no selection", () => {
    expect(isWordInSelection({ lineIndex: 0, wordIndex: 0 }, null)).toBe(false);
  });
});

describe("verseBounds", () => {
  const lines = ["a one", "a two", "", "b one", "b two", "b three"];

  it("spans the whole run of non-blank lines", () => {
    expect(verseBounds(lines, 0)).toEqual({ first: 0, last: 1 });
    expect(verseBounds(lines, 4)).toEqual({ first: 3, last: 5 });
  });

  it("copes with a single-line verse", () => {
    expect(verseBounds(["only", "", "other"], 0)).toEqual({ first: 0, last: 0 });
  });
});

describe("clampToVerse", () => {
  const lines = ["a one", "a two", "", "b one", "b two"];

  it("leaves a focus inside the same verse alone", () => {
    const focus = { lineIndex: 1, wordIndex: 1 };

    expect(clampToVerse(lines, { lineIndex: 0, wordIndex: 0 }, focus)).toEqual(focus);
  });

  it("stops a downward drag at the last word before the break", () => {
    expect(
      clampToVerse(lines, { lineIndex: 0, wordIndex: 0 }, { lineIndex: 4, wordIndex: 1 }),
    ).toEqual({ lineIndex: 1, wordIndex: 1 });
  });

  it("stops an upward drag at the first word after the break", () => {
    expect(
      clampToVerse(lines, { lineIndex: 4, wordIndex: 1 }, { lineIndex: 0, wordIndex: 0 }),
    ).toEqual({ lineIndex: 3, wordIndex: 0 });
  });
});

describe("selectionText", () => {
  const lines = ["hold the line,", "and wait for me", "", "another verse here"];

  it("reads a single word", () => {
    expect(
      selectionText(lines, {
        start: { lineIndex: 0, wordIndex: 1 },
        end: { lineIndex: 0, wordIndex: 1 },
      }),
    ).toBe("the");
  });

  it("trims punctuation from the end of a single word", () => {
    expect(
      selectionText(lines, {
        start: { lineIndex: 0, wordIndex: 2 },
        end: { lineIndex: 0, wordIndex: 2 },
      }),
    ).toBe("line");
  });

  it("joins a phrase within one line", () => {
    expect(
      selectionText(lines, {
        start: { lineIndex: 0, wordIndex: 0 },
        end: { lineIndex: 0, wordIndex: 1 },
      }),
    ).toBe("hold the");
  });

  it("joins a phrase across two lines with a single space", () => {
    expect(
      selectionText(lines, {
        start: { lineIndex: 0, wordIndex: 2 },
        end: { lineIndex: 1, wordIndex: 1 },
      }),
    ).toBe("line, and wait");
  });

  it("takes whole intermediate lines", () => {
    const three = ["one two", "three four", "five six"];

    expect(
      selectionText(three, {
        start: { lineIndex: 0, wordIndex: 1 },
        end: { lineIndex: 2, wordIndex: 0 },
      }),
    ).toBe("two three four five");
  });

  it("is empty with no selection", () => {
    expect(selectionText(lines, null)).toBe("");
  });
});

describe("selectionContext", () => {
  it("returns the untrimmed lines the selection sits in", () => {
    const lines = ["hold the line,", "and wait for me"];

    expect(
      selectionContext(lines, {
        start: { lineIndex: 0, wordIndex: 2 },
        end: { lineIndex: 1, wordIndex: 0 },
      }),
    ).toBe("hold the line,\nand wait for me");
  });
});

describe("savedWordKey", () => {
  it("lowercases and drops edge punctuation, matching the stored index", () => {
    expect(savedWordKey("Words,")).toBe("words");
  });
});

describe("verseSequences", () => {
  it("flattens each verse into reading order", () => {
    const lines = ["one two", "three", "", "four five"];

    expect(verseSequences(lines)).toEqual([
      [
        { lineIndex: 0, wordIndex: 0 },
        { lineIndex: 0, wordIndex: 1 },
        { lineIndex: 1, wordIndex: 0 },
      ],
      [
        { lineIndex: 3, wordIndex: 0 },
        { lineIndex: 3, wordIndex: 1 },
      ],
    ]);
  });

  it("produces no empty verses for runs of blank lines", () => {
    expect(verseSequences(["", "", "a", "", ""])).toEqual([
      [{ lineIndex: 2, wordIndex: 0 }],
    ]);
  });

  it("agrees with selectionText about the order of words", () => {
    // The sliding window relies on this: the flattened order must be the order
    // selectionText reads words in, or phrase matching would compare nonsense.
    const lines = ["hold the line,", "and wait for me"];
    const [verse] = verseSequences(lines);

    const joined = selectionText(lines, {
      start: verse[0],
      end: verse[verse.length - 1],
    });

    expect(joined).toBe("hold the line, and wait for me");
  });
});

describe("longestPhraseLength", () => {
  it("counts the words of the longest entry", () => {
    expect(longestPhraseLength(new Set(["river", "hold the line"]))).toBe(3);
  });

  it("returns 1 for an empty vocabulary", () => {
    expect(longestPhraseLength(new Set())).toBe(1);
  });
});

describe("savedPhraseRefs", () => {
  const lines = ["hold the line,", "and wait for me", "", "hold the line,"];

  function keysFor(...texts: string[]) {
    return new Set(texts.map((text) => normalizeForIndex(text)));
  }

  it("finds nothing when no phrases are saved", () => {
    expect(savedPhraseRefs(lines, keysFor("river")).size).toBe(0);
  });

  it("finds nothing when the vocabulary is empty", () => {
    expect(savedPhraseRefs(lines, new Set()).size).toBe(0);
  });

  it("marks every word of a saved phrase", () => {
    const found = savedPhraseRefs(lines, keysFor("hold the"));

    expect(found.has(refKey({ lineIndex: 0, wordIndex: 0 }))).toBe(true);
    expect(found.has(refKey({ lineIndex: 0, wordIndex: 1 }))).toBe(true);
    expect(found.has(refKey({ lineIndex: 0, wordIndex: 2 }))).toBe(false);
  });

  it("matches a phrase spanning two lines, punctuation and all", () => {
    const found = savedPhraseRefs(lines, keysFor("line, and wait"));

    expect(found.has(refKey({ lineIndex: 0, wordIndex: 2 }))).toBe(true);
    expect(found.has(refKey({ lineIndex: 1, wordIndex: 0 }))).toBe(true);
    expect(found.has(refKey({ lineIndex: 1, wordIndex: 1 }))).toBe(true);
    expect(found.has(refKey({ lineIndex: 1, wordIndex: 2 }))).toBe(false);
  });

  it("marks every occurrence of a repeated phrase", () => {
    const found = savedPhraseRefs(lines, keysFor("hold the line"));

    expect(found.has(refKey({ lineIndex: 0, wordIndex: 0 }))).toBe(true);
    expect(found.has(refKey({ lineIndex: 3, wordIndex: 0 }))).toBe(true);
    expect(found.size).toBe(6);
  });

  it("never matches across a verse break", () => {
    // "me hold" spans the blank line, so it is not a phrase in this song.
    expect(savedPhraseRefs(lines, keysFor("me hold")).size).toBe(0);
  });

  it("prefers the longest phrase starting at the same word", () => {
    const city = ["new york city lights"];

    const found = savedPhraseRefs(city, keysFor("new york", "new york city"));

    expect(found.has(refKey({ lineIndex: 0, wordIndex: 2 }))).toBe(true);
    expect(found.size).toBe(3);
  });

  it("ignores single-word entries, which are matched by text instead", () => {
    expect(savedPhraseRefs(lines, keysFor("hold")).size).toBe(0);
  });

  it("is case-insensitive", () => {
    const found = savedPhraseRefs(lines, keysFor("HOLD THE"));

    expect(found.has(refKey({ lineIndex: 0, wordIndex: 0 }))).toBe(true);
  });

  it("finds two different phrases in the same verse", () => {
    const found = savedPhraseRefs(lines, keysFor("hold the", "for me"));

    expect(found.has(refKey({ lineIndex: 0, wordIndex: 1 }))).toBe(true);
    expect(found.has(refKey({ lineIndex: 1, wordIndex: 2 }))).toBe(true);
    expect(found.has(refKey({ lineIndex: 1, wordIndex: 3 }))).toBe(true);
  });
});
