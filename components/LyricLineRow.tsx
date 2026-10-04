import { Fragment, type KeyboardEvent } from "react";

import { isVerseBreak } from "@/lib/text";
import { splitWords, type WordRef } from "@/lib/words";
import type { LyricLine } from "@/types";

/**
 * Words are `<button>`s rather than `<span>`s so they are focusable and
 * announced as activatable, which is the only way a keyboard user can collect
 * vocabulary at all. The cost is one tab stop per word; a roving tabindex would
 * be the better long-term answer.
 */
const wordBase =
  "cursor-pointer rounded px-0.5 transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent";

export interface LyricLineRowProps {
  line: LyricLine;
  lineIndex: number;
  isSelected: (ref: WordRef) => boolean;
  /**
   * Whether this word is already collected — either on its own, or as part of a
   * saved phrase, which is why the position is needed as well as the text.
   */
  isSaved: (ref: WordRef, word: string) => boolean;
  /**
   * The last word of the settled selection, which hosts the Save control. Null
   * while a gesture is still in progress, so the button does not chase the
   * pointer mid-drag.
   */
  saveAnchor: WordRef | null;
  onSave: () => void;
  onWordKeyDown: (ref: WordRef, event: KeyboardEvent) => void;
}

/** One line of a song: the original, with its translation beneath. */
export function LyricLineRow({
  line,
  lineIndex,
  isSelected,
  isSaved,
  saveAnchor,
  onSave,
  onWordKeyDown,
}: LyricLineRowProps) {
  if (isVerseBreak(line.originalText)) {
    // A blank line in the pasted lyrics. Rendered as space rather than an empty
    // row so the verse structure of the song survives.
    return <div aria-hidden className="h-5" />;
  }

  const words = splitWords(line.originalText);

  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-base/7 font-medium">
        {words.map((word, wordIndex) => {
          const ref = { lineIndex, wordIndex };
          const selected = isSelected(ref);
          const saved = !selected && isSaved(ref, word);
          const showSave =
            saveAnchor?.lineIndex === lineIndex &&
            saveAnchor.wordIndex === wordIndex;

          return (
            <Fragment key={wordIndex}>
              {wordIndex > 0 && " "}
              {/*
                The wrapper is the positioning context for the Save control, so
                the browser places it under the right word and this component
                never has to measure the DOM. The control is a sibling of the
                word rather than a child because a button may not contain
                another interactive element.
              */}
              <span className="relative inline-block">
                <button
                  type="button"
                  data-line={lineIndex}
                  data-word={wordIndex}
                  aria-pressed={selected}
                  onKeyDown={(event) => onWordKeyDown(ref, event)}
                  className={`${wordBase} ${
                    selected
                      ? "bg-accent text-accent-foreground"
                      : saved
                        ? "bg-highlight text-highlight-foreground"
                        : "hover:bg-surface"
                  }`}
                >
                  {word}
                </button>
                {showSave && (
                  <button
                    type="button"
                    onPointerDown={(event) => {
                      // Keep the container's gesture handler from reading this
                      // as a fresh press on the lyrics.
                      event.stopPropagation();
                    }}
                    onClick={onSave}
                    className="absolute top-full left-0 z-10 mt-1 rounded-md bg-foreground px-2 py-1 text-xs font-medium whitespace-nowrap text-background shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    Save word
                  </button>
                )}
              </span>
            </Fragment>
          );
        })}
      </p>
      <p className="text-sm/6 text-muted">
        {line.translatedText || (
          <span className="italic">no translation returned</span>
        )}
      </p>
    </div>
  );
}

