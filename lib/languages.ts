/**
 * DeepL's supported languages, as a hardcoded snapshot.
 *
 * Hardcoded rather than fetched so the dropdowns work before a key is entered
 * and cost no API calls. DeepL publishes the authoritative list at its
 * `/v3/languages` endpoint; if a language is missing here, add it there first
 * and copy the code across.
 *
 * Source and target lists differ because several languages only accept a
 * regional variant as a target: DeepL needs to know whether to write British or
 * American English, but detects either as plain "EN".
 */

export interface Language {
  /** The code DeepL expects, uppercase as the v2 translate endpoint wants it. */
  code: string;
  name: string;
}

/** Sentinel for "let DeepL work it out", which means omitting `source_lang`. */
export const AUTO_DETECT = "auto";

export const SOURCE_LANGUAGES: readonly Language[] = [
  { code: "AR", name: "Arabic" },
  { code: "BG", name: "Bulgarian" },
  { code: "CS", name: "Czech" },
  { code: "DA", name: "Danish" },
  { code: "DE", name: "German" },
  { code: "EL", name: "Greek" },
  { code: "EN", name: "English" },
  { code: "ES", name: "Spanish" },
  { code: "ET", name: "Estonian" },
  { code: "FI", name: "Finnish" },
  { code: "FR", name: "French" },
  { code: "HE", name: "Hebrew" },
  { code: "HU", name: "Hungarian" },
  { code: "ID", name: "Indonesian" },
  { code: "IT", name: "Italian" },
  { code: "JA", name: "Japanese" },
  { code: "KO", name: "Korean" },
  { code: "LT", name: "Lithuanian" },
  { code: "LV", name: "Latvian" },
  { code: "NB", name: "Norwegian Bokmål" },
  { code: "NL", name: "Dutch" },
  { code: "PL", name: "Polish" },
  { code: "PT", name: "Portuguese" },
  { code: "RO", name: "Romanian" },
  { code: "RU", name: "Russian" },
  { code: "SK", name: "Slovak" },
  { code: "SL", name: "Slovenian" },
  { code: "SV", name: "Swedish" },
  { code: "TH", name: "Thai" },
  { code: "TR", name: "Turkish" },
  { code: "UK", name: "Ukrainian" },
  { code: "VI", name: "Vietnamese" },
  { code: "ZH", name: "Chinese" },
] as const;

export const TARGET_LANGUAGES: readonly Language[] = [
  { code: "AR", name: "Arabic" },
  { code: "BG", name: "Bulgarian" },
  { code: "CS", name: "Czech" },
  { code: "DA", name: "Danish" },
  { code: "DE", name: "German" },
  { code: "EL", name: "Greek" },
  { code: "EN-GB", name: "English (British)" },
  { code: "EN-US", name: "English (American)" },
  { code: "ES", name: "Spanish" },
  { code: "ET", name: "Estonian" },
  { code: "FI", name: "Finnish" },
  { code: "FR", name: "French" },
  { code: "HE", name: "Hebrew" },
  { code: "HU", name: "Hungarian" },
  { code: "ID", name: "Indonesian" },
  { code: "IT", name: "Italian" },
  { code: "JA", name: "Japanese" },
  { code: "KO", name: "Korean" },
  { code: "LT", name: "Lithuanian" },
  { code: "LV", name: "Latvian" },
  { code: "NB", name: "Norwegian Bokmål" },
  { code: "NL", name: "Dutch" },
  { code: "PL", name: "Polish" },
  { code: "PT-BR", name: "Portuguese (Brazilian)" },
  { code: "PT-PT", name: "Portuguese (European)" },
  { code: "RO", name: "Romanian" },
  { code: "RU", name: "Russian" },
  { code: "SK", name: "Slovak" },
  { code: "SL", name: "Slovenian" },
  { code: "SV", name: "Swedish" },
  { code: "TH", name: "Thai" },
  { code: "TR", name: "Turkish" },
  { code: "UK", name: "Ukrainian" },
  { code: "VI", name: "Vietnamese" },
  { code: "ZH-HANS", name: "Chinese (simplified)" },
  { code: "ZH-HANT", name: "Chinese (traditional)" },
] as const;

/**
 * A human-readable name for a language code, falling back to the code itself so
 * an unrecognised value from storage still displays as something.
 */
export function getLanguageName(code: string): string {
  if (code === AUTO_DETECT) return "Auto-detect";

  const match =
    TARGET_LANGUAGES.find((language) => language.code === code) ??
    SOURCE_LANGUAGES.find((language) => language.code === code);

  return match?.name ?? code;
}
