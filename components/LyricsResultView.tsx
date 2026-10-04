import Link from "next/link";

import { LyricLineRow } from "@/components/LyricLineRow";
import { getLanguageName } from "@/lib/languages";
import type { Song } from "@/types";

/**
 * Reads a saved song.
 *
 * Takes a plain `Song`, which is the same shape whether it was translated a
 * second ago or loaded from storage months later — so this component serves
 * both without knowing which happened.
 */
export function LyricsResultView({ song }: { song: Song }) {
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

      <div className="flex flex-col gap-3">
        {song.lines.map((line) => (
          <LyricLineRow key={line.id} line={line} />
        ))}
      </div>

      <footer className="border-t border-border pt-6">
        <Link
          href="/"
          className="text-sm text-accent underline underline-offset-2"
        >
          Translate another song
        </Link>
      </footer>
    </article>
  );
}
