import { describe, expect, it } from "vitest";

import {
  escapeCsvField,
  exportFilename,
  toCsv,
  toCsvRow,
  toJson,
} from "@/lib/export";
import type { VocabularyItem } from "@/types";

// All fixture text is invented. Never put real song lyrics in tests.
function item(overrides: Partial<VocabularyItem> = {}): VocabularyItem {
  return {
    id: "item-1",
    text: "river",
    textLower: "river",
    translatedText: "Fluss",
    sourceLanguage: "EN",
    targetLanguage: "DE",
    songTitle: "Morgenlicht",
    createdAt: Date.UTC(2026, 0, 15, 9, 30, 0),
    ...overrides,
  };
}

const NOW = new Date("2026-02-01T12:00:00.000Z");

describe("escapeCsvField", () => {
  it("leaves an ordinary value alone", () => {
    expect(escapeCsvField("river")).toBe("river");
  });

  it("quotes a value containing a comma", () => {
    expect(escapeCsvField("heart, and soul")).toBe('"heart, and soul"');
  });

  it("quotes and doubles an embedded double quote", () => {
    expect(escapeCsvField('say "goodbye"')).toBe('"say ""goodbye"""');
  });

  it("quotes a value containing a line break", () => {
    expect(escapeCsvField("two\nlines")).toBe('"two\nlines"');
    expect(escapeCsvField("two\r\nlines")).toBe('"two\r\nlines"');
  });

  it("leaves an apostrophe alone, since it needs no escaping", () => {
    expect(escapeCsvField("don't")).toBe("don't");
  });

  it("handles an empty value", () => {
    expect(escapeCsvField("")).toBe("");
  });
});

describe("toCsvRow", () => {
  it("joins fields with commas", () => {
    expect(toCsvRow(["a", "b", "c"])).toBe("a,b,c");
  });

  it("escapes only the fields that need it", () => {
    expect(toCsvRow(["plain", "has, comma", "plain"])).toBe(
      'plain,"has, comma",plain',
    );
  });
});

describe("toCsv", () => {
  it("starts with a byte-order mark so Excel reads it as UTF-8", () => {
    expect(toCsv([])).toMatch(/^\uFEFF/);
  });

  it("writes a header row even with no items", () => {
    expect(toCsv([])).toBe("\uFEFFword,translation,from,to,song,saved at\r\n");
  });

  it("separates rows with CRLF, as the CSV spec requires", () => {
    const csv = toCsv([item()]);

    expect(csv.split("\r\n")).toHaveLength(3); // header, one row, trailing
  });

  it("writes one row per item in the order given", () => {
    const csv = toCsv([item({ text: "first" }), item({ text: "second" })]);
    const rows = csv.replace(/^\uFEFF/, "").trim().split("\r\n");

    expect(rows[1]).toContain("first");
    expect(rows[2]).toContain("second");
  });

  it("writes the fields in the documented order", () => {
    const csv = toCsv([item()]);
    const row = csv.replace(/^\uFEFF/, "").split("\r\n")[1];

    expect(row).toBe(
      "river,Fluss,EN,DE,Morgenlicht,2026-01-15T09:30:00.000Z",
    );
  });

  it("leaves the song column empty for an item with no song", () => {
    const csv = toCsv([item({ songTitle: undefined })]);
    const row = csv.replace(/^\uFEFF/, "").split("\r\n")[1];

    expect(row).toBe("river,Fluss,EN,DE,,2026-01-15T09:30:00.000Z");
  });

  it("keeps a phrase containing a comma in a single field", () => {
    // The whole point of escaping: this must not become two columns.
    const csv = toCsv([item({ text: "heart, and soul" })]);
    const row = csv.replace(/^\uFEFF/, "").split("\r\n")[1];

    expect(row).toBe(
      '"heart, and soul",Fluss,EN,DE,Morgenlicht,2026-01-15T09:30:00.000Z',
    );
  });

  it("preserves non-ASCII letters as they are", () => {
    const csv = toCsv([item({ translatedText: "Testübersetzung" })]);

    expect(csv).toContain("Testübersetzung");
  });
});

describe("toJson", () => {
  it("wraps the items in an envelope naming the app and format", () => {
    const parsed = JSON.parse(toJson([item()], NOW));

    expect(parsed).toMatchObject({
      app: "lyrics-translator",
      formatVersion: 1,
      exportedAt: "2026-02-01T12:00:00.000Z",
      itemCount: 1,
    });
  });

  it("exports the fields a reader would need", () => {
    const parsed = JSON.parse(toJson([item()], NOW));

    expect(parsed.items[0]).toEqual({
      id: "item-1",
      text: "river",
      translatedText: "Fluss",
      sourceLanguage: "EN",
      targetLanguage: "DE",
      songTitle: "Morgenlicht",
      createdAt: "2026-01-15T09:30:00.000Z",
    });
  });

  it("omits the derived index key, which is not data", () => {
    const parsed = JSON.parse(toJson([item()], NOW));

    expect(parsed.items[0]).not.toHaveProperty("textLower");
  });

  it("omits the song entirely when there was none", () => {
    const parsed = JSON.parse(toJson([item({ songTitle: undefined })], NOW));

    expect(parsed.items[0]).not.toHaveProperty("songTitle");
  });

  it("handles an empty list", () => {
    const parsed = JSON.parse(toJson([], NOW));

    expect(parsed.itemCount).toBe(0);
    expect(parsed.items).toEqual([]);
  });

  it("produces valid JSON even for text full of quotes and newlines", () => {
    const awkward = 'she said "stop",\nthen left';

    const parsed = JSON.parse(toJson([item({ text: awkward })], NOW));

    expect(parsed.items[0].text).toBe(awkward);
  });

  it("ends with a newline, as text files should", () => {
    expect(toJson([], NOW).endsWith("\n")).toBe(true);
  });
});

describe("exportFilename", () => {
  it("dates the file so repeated exports do not collide", () => {
    expect(exportFilename("csv", NOW)).toBe("vocabulary-2026-02-01.csv");
    expect(exportFilename("json", NOW)).toBe("vocabulary-2026-02-01.json");
  });
});
