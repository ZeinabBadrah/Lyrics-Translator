import { createId } from "@/lib/id";
import { isVerseBreak } from "@/lib/text";
import type { LyricLine } from "@/types";

/**
 * Rebuilds the full line list, putting each translation back against its
 * original and restoring the verse breaks that were never sent to DeepL.
 *
 * Worth its own tested function: getting the alignment wrong would shift every
 * translation in a song by one line, which is obvious to a reader and
 * completely invisible to the code that produced it.
 */
export function zipLines(
  parsedLines: string[],
  translations: string[],
): LyricLine[] {
  let translationIndex = 0;

  return parsedLines.map((originalText) => {
    if (isVerseBreak(originalText)) {
      return { id: createId(), originalText: "", translatedText: "" };
    }

    return {
      id: createId(),
      originalText,
      translatedText: translations[translationIndex++] ?? "",
    };
  });
}
