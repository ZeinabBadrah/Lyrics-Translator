import { describe, expect, it } from "vitest";

import { normalizeForIndex, splitIntoLines } from "@/lib/text";

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

describe("splitIntoLines", () => {
  it("splits on newlines and drops blank lines", () => {
    const pasted = "first invented line\n\nsecond invented line\n";

    expect(splitIntoLines(pasted)).toEqual([
      "first invented line",
      "second invented line",
    ]);
  });

  it("handles Windows line endings", () => {
    expect(splitIntoLines("line one\r\nline two")).toEqual([
      "line one",
      "line two",
    ]);
  });

  it("trims surrounding whitespace on each line", () => {
    expect(splitIntoLines("   padded line   \n  another  ")).toEqual([
      "padded line",
      "another",
    ]);
  });

  it("returns an empty array for empty input", () => {
    expect(splitIntoLines("   \n  \n")).toEqual([]);
  });
});
