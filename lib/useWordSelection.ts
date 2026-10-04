import { useCallback, useMemo, useState } from "react";

import {
  clampToVerse,
  isWordInSelection,
  orderSelection,
  selectionContext,
  selectionText,
  type WordRef,
  type WordSelection,
} from "@/lib/words";

interface DragState {
  /** Where the gesture started. Stays fixed for the whole drag. */
  anchor: WordRef;
  /** Where the pointer is now, already clamped to the anchor's verse. */
  focus: WordRef;
  dragging: boolean;
}

export interface WordSelectionApi {
  /** The current range, ordered, or null when nothing is selected. */
  selection: WordSelection | null;
  /** True while a gesture is in progress, so the UI can hold back its controls. */
  dragging: boolean;
  /** The selected words as savable text, punctuation trimmed from the ends. */
  text: string;
  /** The full lines the selection sits in, for DeepL's `context` parameter. */
  context: string;
  isSelected: (ref: WordRef) => boolean;
  begin: (ref: WordRef) => void;
  extend: (ref: WordRef) => void;
  finish: () => void;
  clear: () => void;
}

/**
 * The word-selection state machine, kept separate from any markup.
 *
 * A selection survives the end of the gesture on purpose: the user highlights
 * first and confirms second, so `finish` only lowers the `dragging` flag rather
 * than clearing the range.
 *
 * `lines` should be referentially stable across renders — memoise it in the
 * caller — since the callbacks are rebuilt whenever it changes.
 */
export function useWordSelection(lines: string[]): WordSelectionApi {
  const [state, setState] = useState<DragState | null>(null);

  const begin = useCallback((ref: WordRef) => {
    setState({ anchor: ref, focus: ref, dragging: true });
  }, []);

  const extend = useCallback(
    (ref: WordRef) => {
      setState((previous) => {
        if (!previous?.dragging) {
          return previous;
        }
        const focus = clampToVerse(lines, previous.anchor, ref);
        // Skip the update when the pointer is still over the same word, so a
        // slow drag across one word does not re-render on every pixel.
        if (
          focus.lineIndex === previous.focus.lineIndex &&
          focus.wordIndex === previous.focus.wordIndex
        ) {
          return previous;
        }
        return { ...previous, focus };
      });
    },
    [lines],
  );

  const finish = useCallback(() => {
    setState((previous) =>
      previous?.dragging ? { ...previous, dragging: false } : previous,
    );
  }, []);

  const clear = useCallback(() => {
    setState(null);
  }, []);

  const selection = useMemo(
    () => (state ? orderSelection(state.anchor, state.focus) : null),
    [state],
  );

  const isSelected = useCallback(
    (ref: WordRef) => isWordInSelection(ref, selection),
    [selection],
  );

  return {
    selection,
    dragging: state?.dragging ?? false,
    text: useMemo(() => selectionText(lines, selection), [lines, selection]),
    context: useMemo(() => selectionContext(lines, selection), [lines, selection]),
    isSelected,
    begin,
    extend,
    finish,
    clear,
  };
}
