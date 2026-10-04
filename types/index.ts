/** DeepL offers two API tiers on different hostnames. Free keys end in `:fx`. */
export type DeeplApiPlan = "free" | "pro";

export type ThemePreference = "system" | "light" | "dark";

/** A single line of lyrics paired with its translation. */
export interface LyricLine {
  id: string;
  originalText: string;
  translatedText: string;
}

export interface Song {
  id: string;
  title: string;
  /**
   * `title` lowercased and trimmed. Stored rather than derived because
   * IndexedDB can only index values that physically exist in the record.
   */
  titleLower: string;
  artist?: string;
  /** DeepL source language code, or "auto" when DeepL detected it. */
  sourceLanguage: string;
  /** DeepL target language code, e.g. "DE". */
  targetLanguage: string;
  lines: LyricLine[];
  createdAt: number;
  updatedAt: number;
}

/**
 * What a caller provides to save a song. Timestamps and the index field are
 * derived by the data layer; `id` is optional and only supplied when
 * overwriting an existing song.
 */
export type SongInput = Omit<
  Song,
  "id" | "titleLower" | "createdAt" | "updatedAt"
> & { id?: string };

export interface VocabularyItem {
  id: string;
  /** The word or phrase as it appeared in the lyrics. */
  text: string;
  /** `text` lowercased and trimmed, for lookups. See `Song.titleLower`. */
  textLower: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  /** The song this was collected from, if any. */
  songId?: string;
  /**
   * Denormalised on purpose: deleting a song must not make its vocabulary
   * items meaningless.
   */
  songTitle?: string;
  createdAt: number;
}

export type VocabularyItemInput = Omit<
  VocabularyItem,
  "id" | "textLower" | "createdAt"
>;

export interface Settings {
  deeplApiKey: string;
  deeplApiPlan: DeeplApiPlan;
  defaultTargetLanguage: string;
  theme: ThemePreference;
}
