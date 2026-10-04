import { describe, expect, it } from "vitest";

import { zipLines } from "@/lib/lyrics";
import { parseLyricLines, translatableLines } from "@/lib/text";

describe("zipLines", () => {
  it("pairs each line with its translation", () => {
    const lines = zipLines(["one", "two"], ["eins", "zwei"]);

    expect(lines.map((line) => [line.originalText, line.translatedText])).toEqual(
      [
        ["one", "eins"],
        ["two", "zwei"],
      ],
    );
  });

  it("gives every line a distinct id", () => {
    const lines = zipLines(["one", "two", "three"], ["eins", "zwei", "drei"]);

    expect(new Set(lines.map((line) => line.id)).size).toBe(3);
  });

  it("restores verse breaks without consuming a translation", () => {
    // The break was never sent to DeepL, so "zwei" belongs to "two", not to
    // the break. This is the misalignment the function exists to prevent.
    const lines = zipLines(["one", "", "two"], ["eins", "zwei"]);

    expect(lines).toHaveLength(3);
    expect(lines[1].originalText).toBe("");
    expect(lines[1].translatedText).toBe("");
    expect(lines[2].originalText).toBe("two");
    expect(lines[2].translatedText).toBe("zwei");
  });

  it("stays aligned across several breaks", () => {
    const parsed = ["a", "", "b", "", "c"];

    const lines = zipLines(parsed, ["A", "B", "C"]);

    expect(lines.map((line) => line.translatedText)).toEqual([
      "A",
      "",
      "B",
      "",
      "C",
    ]);
  });

  it("leaves a line blank rather than crashing if translations run short", () => {
    const lines = zipLines(["one", "two"], ["eins"]);

    expect(lines[1].translatedText).toBe("");
  });

  it("round-trips a realistic paste", () => {
    const pasted = [
      "an invented opening line",
      "a second invented line",
      "",
      "the invented chorus",
      "repeated once more",
    ].join("\n");

    const parsed = parseLyricLines(pasted);
    const toTranslate = translatableLines(parsed);
    const translations = toTranslate.map((line) => `[de] ${line}`);

    const lines = zipLines(parsed, translations);

    expect(lines).toHaveLength(5);
    expect(lines[2].originalText).toBe("");
    for (const line of lines) {
      if (line.originalText === "") {
        expect(line.translatedText).toBe("");
      } else {
        expect(line.translatedText).toBe(`[de] ${line.originalText}`);
      }
    }
  });
});
