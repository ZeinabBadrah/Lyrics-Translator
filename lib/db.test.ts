import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_SETTINGS,
  addVocabularyItem,
  closeDb,
  deleteSong,
  deleteVocabularyItem,
  getAllSongs,
  getAllVocabulary,
  getSettings,
  getSong,
  getSongByTitle,
  getVocabularyBySong,
  getVocabularyByText,
  getVocabularyTextSet,
  saveSettings,
  saveSong,
  updateSong,
  updateVocabularyItem,
} from "@/lib/db";
import type { SongInput } from "@/types";

// All fixture text is invented. Never put real song lyrics in tests.
const songFixture: SongInput = {
  title: "Morgenlicht",
  artist: "Die Erfundenen",
  sourceLanguage: "EN",
  targetLanguage: "DE",
  lines: [
    { id: "line-1", originalText: "a river of invented words", translatedText: "ein Fluss erfundener Worte" },
    { id: "line-2", originalText: "nothing here is a real song", translatedText: "nichts hier ist ein echtes Lied" },
  ],
};

beforeEach(async () => {
  await closeDb();
  // A fresh factory gives each test an empty database, so tests cannot leak
  // state into one another or depend on execution order.
  globalThis.indexedDB = new IDBFactory();
});

afterEach(() => {
  vi.useRealTimers();
});

/** Fakes only Date, leaving the timer APIs fake-indexeddb relies on alone. */
function freezeTimeAt(iso: string) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(iso));
}

describe("saveSong", () => {
  it("assigns an id, timestamps, and a normalised title", async () => {
    const saved = await saveSong(songFixture);

    expect(saved.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(saved.titleLower).toBe("morgenlicht");
    expect(saved.createdAt).toBe(saved.updatedAt);
    expect(saved.lines).toHaveLength(2);
  });

  it("trims the title and artist", async () => {
    const saved = await saveSong({
      ...songFixture,
      title: "  Morgenlicht  ",
      artist: "  Die Erfundenen  ",
    });

    expect(saved.title).toBe("Morgenlicht");
    expect(saved.artist).toBe("Die Erfundenen");
  });

  it("omits an artist that is blank or whitespace only", async () => {
    const saved = await saveSong({ ...songFixture, artist: "   " });

    expect(saved.artist).toBeUndefined();
  });

  it("is retrievable by id", async () => {
    const saved = await saveSong(songFixture);

    await expect(getSong(saved.id)).resolves.toEqual(saved);
  });

  it("overwrites in place when given an existing id, keeping createdAt", async () => {
    freezeTimeAt("2026-01-01T00:00:00Z");
    const first = await saveSong(songFixture);

    freezeTimeAt("2026-01-02T00:00:00Z");
    const second = await saveSong({
      ...songFixture,
      id: first.id,
      lines: [{ id: "line-1", originalText: "corrected line", translatedText: "korrigierte Zeile" }],
    });

    expect(second.id).toBe(first.id);
    expect(second.createdAt).toBe(first.createdAt);
    expect(second.updatedAt).toBeGreaterThan(first.updatedAt);
    expect(second.lines).toHaveLength(1);
    await expect(getAllSongs()).resolves.toHaveLength(1);
  });
});

describe("getSongByTitle", () => {
  it("matches regardless of case and surrounding whitespace", async () => {
    await saveSong(songFixture);

    const found = await getSongByTitle("  mOrGeNlIcHt ");

    expect(found?.title).toBe("Morgenlicht");
  });

  it("returns undefined when nothing matches", async () => {
    await saveSong(songFixture);

    await expect(getSongByTitle("Unsaved Title")).resolves.toBeUndefined();
  });

  it("uses the artist to tell apart two songs sharing a title", async () => {
    await saveSong({ ...songFixture, artist: "First Invented Band" });
    await saveSong({ ...songFixture, artist: "Second Invented Band" });

    const found = await getSongByTitle("Morgenlicht", "second invented band");

    expect(found?.artist).toBe("Second Invented Band");
  });

  it("returns undefined when the title matches but the artist does not", async () => {
    await saveSong(songFixture);

    await expect(
      getSongByTitle("Morgenlicht", "Somebody Else"),
    ).resolves.toBeUndefined();
  });

  it("prefers an entry saved without an artist when no artist is given", async () => {
    await saveSong({ ...songFixture, artist: "Die Erfundenen" });
    await saveSong({ ...songFixture, artist: undefined });

    const found = await getSongByTitle("Morgenlicht");

    expect(found?.artist).toBeUndefined();
  });
});

describe("getAllSongs", () => {
  it("returns the most recently updated song first", async () => {
    freezeTimeAt("2026-01-01T00:00:00Z");
    await saveSong({ ...songFixture, title: "Older" });

    freezeTimeAt("2026-02-01T00:00:00Z");
    await saveSong({ ...songFixture, title: "Newer" });

    const titles = (await getAllSongs()).map((song) => song.title);

    expect(titles).toEqual(["Newer", "Older"]);
  });

  it("returns an empty array when nothing is saved", async () => {
    await expect(getAllSongs()).resolves.toEqual([]);
  });
});

describe("updateSong", () => {
  it("recomputes the title index when the title changes", async () => {
    const saved = await saveSong(songFixture);

    const updated = await updateSong(saved.id, { title: "  Abendlicht " });

    expect(updated.title).toBe("Abendlicht");
    expect(updated.titleLower).toBe("abendlicht");
    await expect(getSongByTitle("abendlicht")).resolves.toBeDefined();
    await expect(getSongByTitle("morgenlicht")).resolves.toBeUndefined();
  });

  it("removes the artist when set to an empty string", async () => {
    const saved = await saveSong(songFixture);

    const updated = await updateSong(saved.id, { artist: "" });

    expect(updated.artist).toBeUndefined();
  });

  it("leaves unmentioned fields alone", async () => {
    const saved = await saveSong(songFixture);

    const updated = await updateSong(saved.id, { targetLanguage: "FR" });

    expect(updated.targetLanguage).toBe("FR");
    expect(updated.lines).toEqual(saved.lines);
    expect(updated.artist).toBe("Die Erfundenen");
  });

  it("rejects an unknown id", async () => {
    await expect(updateSong("does-not-exist", { title: "x" })).rejects.toThrow(
      /No song with id/,
    );
  });
});

describe("deleteSong", () => {
  it("removes the song", async () => {
    const saved = await saveSong(songFixture);

    await deleteSong(saved.id);

    await expect(getSong(saved.id)).resolves.toBeUndefined();
  });

  it("keeps vocabulary collected from the song, including its title", async () => {
    const saved = await saveSong(songFixture);
    await addVocabularyItem({
      text: "Fluss",
      translatedText: "river",
      sourceLanguage: "DE",
      targetLanguage: "EN",
      songId: saved.id,
      songTitle: saved.title,
    });

    await deleteSong(saved.id);

    const remaining = await getAllVocabulary();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].songTitle).toBe("Morgenlicht");
  });
});

describe("vocabulary", () => {
  it("normalises and trims the saved text", async () => {
    const item = await addVocabularyItem({
      text: "  Der Fluss  ",
      translatedText: "  the river  ",
      sourceLanguage: "DE",
      targetLanguage: "EN",
    });

    expect(item.text).toBe("Der Fluss");
    expect(item.textLower).toBe("der fluss");
    expect(item.translatedText).toBe("the river");
  });

  it("returns items newest first", async () => {
    freezeTimeAt("2026-01-01T00:00:00Z");
    await addVocabularyItem({
      text: "erste",
      translatedText: "first",
      sourceLanguage: "DE",
      targetLanguage: "EN",
    });

    freezeTimeAt("2026-01-05T00:00:00Z");
    await addVocabularyItem({
      text: "zweite",
      translatedText: "second",
      sourceLanguage: "DE",
      targetLanguage: "EN",
    });

    const texts = (await getAllVocabulary()).map((item) => item.text);

    expect(texts).toEqual(["zweite", "erste"]);
  });

  it("looks items up by text, ignoring case", async () => {
    await addVocabularyItem({
      text: "Fluss",
      translatedText: "river",
      sourceLanguage: "DE",
      targetLanguage: "EN",
    });

    const found = await getVocabularyByText("  FLUSS ");

    expect(found).toHaveLength(1);
    expect(found[0].translatedText).toBe("river");
  });

  it("exposes every saved text as a normalised set", async () => {
    await addVocabularyItem({
      text: "Fluss",
      translatedText: "river",
      sourceLanguage: "DE",
      targetLanguage: "EN",
    });
    await addVocabularyItem({
      text: "Der Kalte Wind",
      translatedText: "the cold wind",
      sourceLanguage: "DE",
      targetLanguage: "EN",
    });

    const set = await getVocabularyTextSet();

    expect(set.has("fluss")).toBe(true);
    expect(set.has("der kalte wind")).toBe(true);
    expect(set.has("nicht gespeichert")).toBe(false);
  });

  it("groups items by the song they came from", async () => {
    const song = await saveSong(songFixture);
    await addVocabularyItem({
      text: "Fluss",
      translatedText: "river",
      sourceLanguage: "DE",
      targetLanguage: "EN",
      songId: song.id,
      songTitle: song.title,
    });
    await addVocabularyItem({
      text: "ohne Lied",
      translatedText: "without a song",
      sourceLanguage: "DE",
      targetLanguage: "EN",
    });

    const fromSong = await getVocabularyBySong(song.id);

    expect(fromSong).toHaveLength(1);
    expect(fromSong[0].text).toBe("Fluss");
  });

  it("updates a translation and reindexes a changed text", async () => {
    const item = await addVocabularyItem({
      text: "Fluss",
      translatedText: "rivr",
      sourceLanguage: "DE",
      targetLanguage: "EN",
    });

    const updated = await updateVocabularyItem(item.id, {
      translatedText: "  river  ",
      text: "Flüsse",
    });

    expect(updated.translatedText).toBe("river");
    expect(updated.textLower).toBe("flüsse");
    await expect(getVocabularyByText("flüsse")).resolves.toHaveLength(1);
  });

  it("rejects updating an unknown id", async () => {
    await expect(
      updateVocabularyItem("does-not-exist", { translatedText: "x" }),
    ).rejects.toThrow(/No vocabulary item with id/);
  });

  it("deletes an item", async () => {
    const item = await addVocabularyItem({
      text: "Fluss",
      translatedText: "river",
      sourceLanguage: "DE",
      targetLanguage: "EN",
    });

    await deleteVocabularyItem(item.id);

    await expect(getAllVocabulary()).resolves.toEqual([]);
  });
});

describe("settings", () => {
  it("returns defaults before anything is saved", async () => {
    await expect(getSettings()).resolves.toEqual(DEFAULT_SETTINGS);
  });

  it("stores a partial change and leaves the rest at defaults", async () => {
    const saved = await saveSettings({ deeplApiKey: "test-key:fx" });

    expect(saved.deeplApiKey).toBe("test-key:fx");
    expect(saved.defaultTargetLanguage).toBe("DE");
    await expect(getSettings()).resolves.toEqual(saved);
  });

  it("merges successive partial changes rather than replacing", async () => {
    await saveSettings({ deeplApiKey: "test-key:fx" });
    await saveSettings({ theme: "dark" });

    const settings = await getSettings();

    expect(settings.deeplApiKey).toBe("test-key:fx");
    expect(settings.theme).toBe("dark");
  });

  it("keeps only one settings record", async () => {
    await saveSettings({ deeplApiPlan: "pro" });
    await saveSettings({ deeplApiPlan: "free" });

    await expect(getSettings()).resolves.toMatchObject({
      deeplApiPlan: "free",
    });
  });
});
