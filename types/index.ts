/** DeepL offers two API tiers on different hostnames. Free keys end in `:fx`. */
export type DeeplApiPlan = "free" | "pro";

/**
 * What the user picks in Settings. "auto" derives the plan from the key's
 * format, which is right often enough that the explicit choices only exist as
 * an escape hatch.
 */
export type DeeplApiPlanSetting = DeeplApiPlan | "auto";

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
  deeplApiPlan: DeeplApiPlanSetting;
  defaultTargetLanguage: string;
  theme: ThemePreference;
}

// ---------------------------------------------------------------------------
// The contract between the browser and this app's own API routes
// ---------------------------------------------------------------------------

export interface TranslateRequestBody {
  /** Lines to translate. Order is preserved in the response. */
  text: string[];
  /** DeepL source language code. Omit to let DeepL detect it. */
  sourceLang?: string;
  targetLang: string;
  /**
   * Surrounding text that improves translation quality without being
   * translated itself and without counting towards the character quota.
   */
  context?: string;
  apiKey: string;
  /** Omit to derive the plan from the key's format. */
  apiPlan?: DeeplApiPlanSetting;
}

export interface TranslateResponseBody {
  /** Translations, in the same order as the submitted text. */
  translations: string[];
  /** What DeepL detected, when `sourceLang` was not specified. */
  detectedSourceLanguage?: string;
}

export interface UsageRequestBody {
  apiKey: string;
  apiPlan?: DeeplApiPlanSetting;
}

export interface UsageResponseBody {
  characterCount: number;
  characterLimit: number;
  /** DeepL reports an absurdly large limit when the account has none. */
  unlimited: boolean;
}

export interface ApiErrorBody {
  error: string;
  /** DeepL's request identifier, useful when contacting their support. */
  traceId?: string;
}
