import { describe, expect, it } from "vitest";

import {
  normalizeForIndex,
  parseLyricLines,
  translatableLines,
} from "@/lib/text";

describe("normalizeForIndex", () => {
  it("lowercases and trims", () => {
    expect(normalizeForIndex("  Morgenlicht  ")).toBe("morgenlicht");
  });

  it("collapses runs of internal whitespace", () => {
    expect(normalizeForIndex("der   kalte \t Fluss")).toBe("der kalte fluss");
  });

  it("leaves non-ASCII letters intact", () => {
    expect(normalizeForIndex("STRASSENLÄRM")).toBe("strassenlärm");
  });
});

describe("parseLyricLines", () => {
  it("splits on newlines and trims each line", () => {
    expect(parseLyricLines("  first invented line  \nsecond line")).toEqual([
      "first invented line",
      "second line",
    ]);
  });

  it("keeps a blank line as a verse break", () => {
    expect(parseLyricLines("verse one\n\nverse two")).toEqual([
      "verse one",
      "",
      "verse two",
    ]);
  });

  it("collapses a run of blank lines into a single break", () => {
    expect(parseLyricLines("verse one\n\n\n\nverse two")).toEqual([
      "verse one",
      "",
      "verse two",
    ]);
  });

  it("drops a leading break so the song does not start with a gap", () => {
    expect(parseLyricLines("\n\nverse one")).toEqual(["verse one"]);
  });

  it("drops trailing breaks left by a stray newline", () => {
    expect(parseLyricLines("verse one\n\n\n")).toEqual(["verse one"]);
  });

  it("handles Windows line endings", () => {
    expect(parseLyricLines("line one\r\n\r\nline two")).toEqual([
      "line one",
      "",
      "line two",
    ]);
  });

  it("treats a whitespace-only line as a break, not as content", () => {
    expect(parseLyricLines("line one\n   \t \nline two")).toEqual([
      "line one",
      "",
      "line two",
    ]);
  });

  it("returns nothing for input that is entirely blank", () => {
    expect(parseLyricLines("   \n  \n")).toEqual([]);
  });
});

describe("translatableLines", () => {
  it("excludes verse breaks", () => {
    expect(translatableLines(["one", "", "two"])).toEqual(["one", "two"]);
  });

  it("leaves a list without breaks untouched", () => {
    expect(translatableLines(["one", "two"])).toEqual(["one", "two"]);
  });
});
