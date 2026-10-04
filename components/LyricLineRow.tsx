import { isVerseBreak } from "@/lib/text";
import type { LyricLine } from "@/types";

/**
 * One line of a song: the original, with its translation beneath.
 *
 * Kept deliberately small because Stage 4 adds word-level selection here, and
 * nothing else should need to change when it does.
 */
export function LyricLineRow({ line }: { line: LyricLine }) {
  if (isVerseBreak(line.originalText)) {
    // A blank line in the pasted lyrics. Rendered as space rather than an empty
    // row so the verse structure of the song survives.
    return <div aria-hidden className="h-5" />;
  }

  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-base/7 font-medium">{line.originalText}</p>
      <p className="text-sm/6 text-muted">
        {line.translatedText || (
          <span className="italic">no translation returned</span>
        )}
      </p>
    </div>
  );
}
