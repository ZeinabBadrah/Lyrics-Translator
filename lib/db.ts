import { type DBSchema, type IDBPDatabase, openDB } from "idb";

import { createId } from "@/lib/id";
import { normalizeForIndex } from "@/lib/text";
import type {
  Settings,
  Song,
  SongInput,
  VocabularyItem,
  VocabularyItemInput,
} from "@/types";

export const DB_NAME = "lyrics-translator-db";
export const DB_VERSION = 1;

/** The `settings` store holds exactly one record, under this key. */
const SETTINGS_KEY = "app";

export const DEFAULT_SETTINGS: Settings = {
  deeplApiKey: "",
  deeplApiPlan: "free",
  defaultTargetLanguage: "DE",
  theme: "system",
};

interface LyricsTranslatorDB extends DBSchema {
  songs: {
    key: string;
    value: Song;
    indexes: { titleLower: string; updatedAt: number };
  };
  vocabulary: {
    key: string;
    value: VocabularyItem;
    indexes: { textLower: string; createdAt: number; songId: string };
  };
  settings: {
    key: string;
    value: Settings;
  };
}

let dbPromise: Promise<IDBPDatabase<LyricsTranslatorDB>> | null = null;

/**
 * Opens the database, creating or migrating it as needed. The connection is
 * cached, so calling this repeatedly is cheap.
 */
export function getDb(): Promise<IDBPDatabase<LyricsTranslatorDB>> {
  if (typeof indexedDB === "undefined") {
    throw new Error(
      "IndexedDB is unavailable. The data layer only runs in the browser — " +
        "make sure the calling component is a Client Component.",
    );
  }

  if (!dbPromise) {
    dbPromise = openDB<LyricsTranslatorDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // Deliberately not an `if/else`: a browser upgrading from an older
        // version falls through every step it has not run yet.
        if (oldVersion < 1) {
          const songs = db.createObjectStore("songs", { keyPath: "id" });
          songs.createIndex("titleLower", "titleLower");
          songs.createIndex("updatedAt", "updatedAt");

          const vocabulary = db.createObjectStore("vocabulary", {
            keyPath: "id",
          });
          vocabulary.createIndex("textLower", "textLower");
          vocabulary.createIndex("createdAt", "createdAt");
          vocabulary.createIndex("songId", "songId");

          // No keyPath: the single settings record is stored under an
          // explicit out-of-line key.
          db.createObjectStore("settings");
        }
      },
    });
  }

  return dbPromise;
}

/** Closes the cached connection. Needed by tests, and when deleting the database. */
export async function closeDb(): Promise<void> {
  if (!dbPromise) return;

  const db = await dbPromise;
  db.close();
  dbPromise = null;
}

// ---------------------------------------------------------------------------
// Songs
// ---------------------------------------------------------------------------

/**
 * Inserts a song, or overwrites an existing one when `input.id` is supplied.
 * Overwriting preserves `createdAt` and the id, so vocabulary items collected
 * from the song stay linked to it.
 */
export async function saveSong(input: SongInput): Promise<Song> {
  const db = await getDb();
  const existing = input.id ? await db.get("songs", input.id) : undefined;
  const now = Date.now();
  const artist = input.artist?.trim();

  const song: Song = {
    id: existing?.id ?? input.id ?? createId(),
    title: input.title.trim(),
    titleLower: normalizeForIndex(input.title),
    ...(artist ? { artist } : {}),
    sourceLanguage: input.sourceLanguage,
    targetLanguage: input.targetLanguage,
    lines: input.lines,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await db.put("songs", song);
  return song;
}

export async function getSong(id: string): Promise<Song | undefined> {
  const db = await getDb();
  return db.get("songs", id);
}

/**
 * Finds a saved song by title, most recently updated first.
 *
 * When `artist` is given, only a song by that artist matches — two different
 * songs can share a title. When it is omitted, an entry saved without an
 * artist is preferred before falling back to any match.
 */
export async function getSongByTitle(
  title: string,
  artist?: string,
): Promise<Song | undefined> {
  const db = await getDb();
  const matches = (
    await db.getAllFromIndex("songs", "titleLower", normalizeForIndex(title))
  ).sort((a, b) => b.updatedAt - a.updatedAt);

  if (matches.length === 0) return undefined;

  const wantedArtist = artist?.trim();
  if (!wantedArtist) {
    return matches.find((song) => !song.artist) ?? matches[0];
  }

  return matches.find(
    (song) =>
      song.artist !== undefined &&
      normalizeForIndex(song.artist) === normalizeForIndex(wantedArtist),
  );
}

/** All songs, most recently updated first. */
export async function getAllSongs(): Promise<Song[]> {
  const db = await getDb();
  const songs = await db.getAllFromIndex("songs", "updatedAt");
  return songs.reverse();
}

/** Applies a partial change to a song. Throws if the song does not exist. */
export async function updateSong(
  id: string,
  patch: Partial<Omit<SongInput, "id">>,
): Promise<Song> {
  const db = await getDb();
  const existing = await db.get("songs", id);
  if (!existing) {
    throw new Error(`No song with id "${id}"`);
  }

  const merged: Song = {
    ...existing,
    ...patch,
    updatedAt: Date.now(),
  };

  if (patch.title !== undefined) {
    merged.title = patch.title.trim();
    merged.titleLower = normalizeForIndex(patch.title);
  }

  if (patch.artist !== undefined) {
    const artist = patch.artist.trim();
    if (artist) {
      merged.artist = artist;
    } else {
      delete merged.artist;
    }
  }

  await db.put("songs", merged);
  return merged;
}

/**
 * Deletes a song. Vocabulary collected from it is intentionally left alone —
 * each item keeps its denormalised `songTitle`, so it still makes sense.
 */
export async function deleteSong(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("songs", id);
}

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

export async function addVocabularyItem(
  input: VocabularyItemInput,
): Promise<VocabularyItem> {
  const db = await getDb();

  const item: VocabularyItem = {
    id: createId(),
    text: input.text.trim(),
    textLower: normalizeForIndex(input.text),
    translatedText: input.translatedText.trim(),
    sourceLanguage: input.sourceLanguage,
    targetLanguage: input.targetLanguage,
    ...(input.songId ? { songId: input.songId } : {}),
    ...(input.songTitle ? { songTitle: input.songTitle } : {}),
    createdAt: Date.now(),
  };

  await db.put("vocabulary", item);
  return item;
}

/** All vocabulary items, newest first. */
export async function getAllVocabulary(): Promise<VocabularyItem[]> {
  const db = await getDb();
  const items = await db.getAllFromIndex("vocabulary", "createdAt");
  return items.reverse();
}

export async function getVocabularyItem(
  id: string,
): Promise<VocabularyItem | undefined> {
  const db = await getDb();
  return db.get("vocabulary", id);
}

/** Every item matching the given text, ignoring case and surrounding whitespace. */
export async function getVocabularyByText(
  text: string,
): Promise<VocabularyItem[]> {
  const db = await getDb();
  return db.getAllFromIndex("vocabulary", "textLower", normalizeForIndex(text));
}

/**
 * The normalised text of every saved item, for marking already-collected words
 * while reading a song.
 */
export async function getVocabularyTextSet(): Promise<Set<string>> {
  const db = await getDb();
  const items = await db.getAll("vocabulary");
  return new Set(items.map((item) => item.textLower));
}

export async function updateVocabularyItem(
  id: string,
  patch: Partial<VocabularyItemInput>,
): Promise<VocabularyItem> {
  const db = await getDb();
  const existing = await db.get("vocabulary", id);
  if (!existing) {
    throw new Error(`No vocabulary item with id "${id}"`);
  }

  const merged: VocabularyItem = { ...existing, ...patch };

  if (patch.text !== undefined) {
    merged.text = patch.text.trim();
    merged.textLower = normalizeForIndex(patch.text);
  }

  if (patch.translatedText !== undefined) {
    merged.translatedText = patch.translatedText.trim();
  }

  await db.put("vocabulary", merged);
  return merged;
}

export async function deleteVocabularyItem(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("vocabulary", id);
}

/** Vocabulary collected from one song, newest first. */
export async function getVocabularyBySong(
  songId: string,
): Promise<VocabularyItem[]> {
  const db = await getDb();
  const items = await db.getAllFromIndex("vocabulary", "songId", songId);
  return items.sort((a, b) => b.createdAt - a.createdAt);
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/**
 * Current settings, with defaults filled in for anything missing. Merging over
 * the defaults means a field added in a later release reads sensibly for users
 * whose stored record predates it, without a schema migration.
 */
export async function getSettings(): Promise<Settings> {
  const db = await getDb();
  const stored = await db.get("settings", SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...stored };
}

/** Applies a partial change to the settings record and returns the result. */
export async function saveSettings(
  patch: Partial<Settings>,
): Promise<Settings> {
  const db = await getDb();
  const current = await getSettings();
  const next: Settings = { ...current, ...patch };
  await db.put("settings", next, SETTINGS_KEY);
  return next;
}
