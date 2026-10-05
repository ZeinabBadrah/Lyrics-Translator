"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { LyricLineRow } from "@/components/LyricLineRow";
import { VocabularyPopover } from "@/components/VocabularyPopover";
import { getVocabularyTextSet } from "@/lib/db";
import { getLanguageName } from "@/lib/languages";
import { useWordSelection } from "@/lib/useWordSelection";
import {
  refKey,
  savedPhraseRefs,
  savedWordKey,
  type WordRef,
} from "@/lib/words";
import type { Song } from "@/types";

/** How long a finger must rest on a word before it starts selecting. */
const LONG_PRESS_MS = 400;
/** Movement beyond this is the user scrolling, not pressing. */
const MOVE_TOLERANCE_PX = 10;

type Gesture =
  /** A mouse drag, selecting from the moment of the press. */
  | { kind: "mouse" }
  /** A finger resting on a word, waiting to see if it is a press or a scroll. */
  | { kind: "armed"; ref: WordRef; x: number; y: number; timer: number }
  /** A finger that held still long enough and is now selecting. */
  | { kind: "touch" }
  /** A press that landed inside the existing selection, which reopens it. */
  | { kind: "reopen"; x: number; y: number };

function refFromElement(element: Element | null | undefined): WordRef | null {
  const word = element?.closest<HTMLElement>("[data-word]");
  if (!word) {
    return null;
  }

  const lineIndex = Number(word.dataset.line);
  const wordIndex = Number(word.dataset.word);
  if (!Number.isInteger(lineIndex) || !Number.isInteger(wordIndex)) {
    return null;
  }
  return { lineIndex, wordIndex };
}

/**
 * Reads a saved song and collects vocabulary from it.
 *
 * Takes a plain `Song`, which is the same shape whether it was translated a
 * second ago or loaded from storage months later — so this component serves
 * both without knowing which happened.
 */
export function LyricsResultView({ song }: { song: Song }) {
  const lines = useMemo(
    () => song.lines.map((line) => line.originalText),
    [song.lines],
  );
  const selection = useWordSelection(lines);
  // Pulled out because the Escape listener should not be torn down and rebuilt
  // on every render, and only this callback is stable.
  const clearSelection = selection.clear;
  const [savedWords, setSavedWords] = useState<Set<string>>(new Set());
  const [savedWordsToken, setSavedWordsToken] = useState(0);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [touchSelecting, setTouchSelecting] = useState(false);
  const gesture = useRef<Gesture | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Bumping the token re-runs the lookup, which is how a save refreshes the
  // highlights without this component having to guess what was stored.
  useEffect(() => {
    let cancelled = false;

    void getVocabularyTextSet()
      .then((words) => {
        if (!cancelled) setSavedWords(words);
      })
      .catch(() => {
        // Highlighting is a convenience; failing to load it must not stop the
        // song being read.
      });

    return () => {
      cancelled = true;
    };
  }, [savedWordsToken]);

  // Scanning the song for saved phrases is only worth redoing when the song or
  // the vocabulary changes, not on every pointer move.
  const phraseRefs = useMemo(
    () => savedPhraseRefs(lines, savedWords),
    [lines, savedWords],
  );

  const isSaved = useCallback(
    (ref: WordRef, word: string) =>
      savedWords.has(savedWordKey(word)) || phraseRefs.has(refKey(ref)),
    [savedWords, phraseRefs],
  );

  const endGesture = useCallback(() => {
    const current = gesture.current;
    if (current?.kind === "armed") {
      window.clearTimeout(current.timer);
    }
    gesture.current = null;
  }, []);

  // Clear the timer if the component goes away mid-press.
  useEffect(() => endGesture, [endGesture]);

  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape" && !popoverOpen) {
        clearSelection();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [popoverOpen, clearSelection]);

  /**
   * While a touch selection is live, scrolling has to be suppressed or the page
   * slides out from under the finger. React registers its own touch handlers
   * passively, and a passive listener is not allowed to call preventDefault, so
   * this one is attached by hand.
   */
  useEffect(() => {
    const node = containerRef.current;
    if (!touchSelecting || !node) {
      return;
    }

    const block = (event: TouchEvent) => event.preventDefault();
    node.addEventListener("touchmove", block, { passive: false });
    return () => node.removeEventListener("touchmove", block);
  }, [touchSelecting]);

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const ref = refFromElement(event.target as Element);
    if (!ref) {
      // A press on the background puts the selection away.
      endGesture();
      clearSelection();
      return;
    }

    // Capturing means later moves and the release arrive here even once the
    // pointer has left the word it started on.
    event.currentTarget.setPointerCapture(event.pointerId);

    if (selection.isSelected(ref) && !selection.dragging) {
      gesture.current = { kind: "reopen", x: event.clientX, y: event.clientY };
      return;
    }

    if (event.pointerType === "mouse") {
      selection.begin(ref);
      gesture.current = { kind: "mouse" };
      return;
    }

    // Touch and pen: hold still and it becomes a selection you can drag; move
    // straight away and it was a scroll all along.
    const timer = window.setTimeout(() => {
      selection.begin(ref);
      setTouchSelecting(true);
      gesture.current = { kind: "touch" };
    }, LONG_PRESS_MS);

    gesture.current = {
      kind: "armed",
      ref,
      x: event.clientX,
      y: event.clientY,
      timer,
    };
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const current = gesture.current;
    if (!current) {
      return;
    }

    if (current.kind === "armed" || current.kind === "reopen") {
      const travelled = Math.hypot(
        event.clientX - current.x,
        event.clientY - current.y,
      );
      if (travelled > MOVE_TOLERANCE_PX) {
        endGesture();
      }
      return;
    }

    // The event target is whatever the gesture began on, so ask the document
    // what is actually under the pointer now. This is what makes dragging work
    // on touch, where events never retarget on their own.
    const ref = refFromElement(
      document.elementFromPoint(event.clientX, event.clientY),
    );
    if (ref) {
      selection.extend(ref);
    }
  }

  function onPointerEnd() {
    const current = gesture.current;
    endGesture();
    setTouchSelecting(false);

    if (!current) {
      return;
    }

    if (current.kind === "reopen") {
      setPopoverOpen(true);
      return;
    }

    if (current.kind === "armed") {
      // A quick tap that never became a drag: select the single word.
      selection.begin(current.ref);
    }

    selection.finish();
  }

  function onWordKeyDown(ref: WordRef, event: KeyboardEvent) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    // Stop the browser turning this into a click, which would run the handler
    // a second time.
    event.preventDefault();

    if (selection.isSelected(ref) && !selection.dragging) {
      setPopoverOpen(true);
      return;
    }
    selection.begin(ref);
    selection.finish();
  }

  const saveAnchor =
    selection.selection && !selection.dragging && !popoverOpen
      ? selection.selection.end
      : null;

  return (
    <article className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{song.title}</h1>
        {song.artist && <p className="text-sm text-muted">{song.artist}</p>}
        <p className="text-xs text-muted">
          {getLanguageName(song.sourceLanguage)} to{" "}
          {getLanguageName(song.targetLanguage)}
        </p>
      </header>

      <p className="text-xs text-muted">
        Click a word, or drag across several, then press Save word. On a phone,
        hold a word to start selecting.
      </p>

      <div
        ref={containerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        // select-none keeps the browser's own text selection from fighting the
        // drag; the callout rule stops iOS popping its copy menu on long press.
        className="flex flex-col gap-3 select-none"
        style={{
          touchAction: touchSelecting ? "none" : undefined,
          WebkitTouchCallout: "none",
        }}
      >
        {song.lines.map((line, lineIndex) => (
          <LyricLineRow
            key={line.id}
            line={line}
            lineIndex={lineIndex}
            isSelected={selection.isSelected}
            isSaved={isSaved}
            saveAnchor={saveAnchor}
            onSave={() => setPopoverOpen(true)}
            onWordKeyDown={onWordKeyDown}
          />
        ))}
      </div>

      <footer className="flex flex-wrap gap-x-4 gap-y-2 border-t border-border pt-6">
        <Link
          href="/songs"
          className="text-sm text-accent underline underline-offset-2"
        >
          My songs
        </Link>
        <Link
          href="/"
          className="text-sm text-accent underline underline-offset-2"
        >
          Translate another song
        </Link>
      </footer>

      {popoverOpen && selection.text && (
        <VocabularyPopover
          text={selection.text}
          context={selection.context}
          song={song}
          onClose={() => setPopoverOpen(false)}
          onSaved={() => {
            setSavedWordsToken((token) => token + 1);
            clearSelection();
          }}
        />
      )}
    </article>
  );
}
