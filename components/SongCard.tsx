import Link from "next/link";

import { Button } from "@/components/ui";
import { getLanguageName } from "@/lib/languages";
import { isVerseBreak } from "@/lib/text";
import type { Song } from "@/types";

export interface SongCardProps {
  song: Song;
  /** How many vocabulary entries came from this song. */
  wordCount: number;
  confirmingDelete: boolean;
  busy: boolean;
  error?: string;
  onStartDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}

const dateFormat = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
});

/** Blank lines are layout, not lyrics, so they are not worth counting. */
function countLyricLines(song: Song): number {
  return song.lines.filter((line) => !isVerseBreak(line.originalText)).length;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function SongCard({
  song,
  wordCount,
  confirmingDelete,
  busy,
  error,
  onStartDelete,
  onCancelDelete,
  onConfirmDelete,
}: SongCardProps) {
  if (confirmingDelete) {
    return (
      <li className="flex flex-col gap-3 rounded-lg border border-danger/40 bg-danger/5 p-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm">
            Delete <span className="font-medium">{song.title}</span>? The lyrics
            and translation will be gone for good.
          </p>
          {/*
            Said plainly because it is the one thing a user would hesitate over:
            the words are the work, and they are not what is being deleted.
          */}
          <p className="text-sm text-muted">
            {wordCount > 0
              ? `The ${plural(wordCount, "word", "words")} you collected from it will be kept in your vocabulary.`
              : "You have not collected any words from it."}
          </p>
        </div>

        {error && <p className="text-xs text-danger">{error}</p>}

        <div className="flex gap-2">
          <Button variant="danger" disabled={busy} onClick={onConfirmDelete}>
            {busy ? "Deleting…" : "Delete song"}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={onCancelDelete}>
            Cancel
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-start sm:gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Link
          href={`/song/${song.id}`}
          className="font-medium break-words text-accent underline underline-offset-2"
        >
          {song.title}
        </Link>
        {song.artist && (
          <p className="text-sm break-words text-muted">{song.artist}</p>
        )}
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <span>
            {getLanguageName(song.sourceLanguage)} to{" "}
            {getLanguageName(song.targetLanguage)}
          </span>
          <span aria-hidden>·</span>
          <span>{plural(countLyricLines(song), "line", "lines")}</span>
          <span aria-hidden>·</span>
          <span>
            {wordCount === 0
              ? "no words collected"
              : `${plural(wordCount, "word", "words")} collected`}
          </span>
          <span aria-hidden>·</span>
          <span>{dateFormat.format(new Date(song.updatedAt))}</span>
        </p>
      </div>

      <div className="flex shrink-0 gap-2">
        <Button
          variant="ghost"
          onClick={onStartDelete}
          aria-label={`Delete ${song.title}`}
        >
          Delete
        </Button>
      </div>
    </li>
  );
}
