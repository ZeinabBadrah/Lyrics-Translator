import Link from "next/link";

import { Button, TextInput } from "@/components/ui";
import { getLanguageName } from "@/lib/languages";
import type { VocabularyItem } from "@/types";

export interface VocabularyDraft {
  text: string;
  translatedText: string;
}

export interface VocabularyRowProps {
  item: VocabularyItem;
  /** False once the song has been deleted, which leaves the title as plain text. */
  songExists: boolean;
  /** The in-progress edit, owned by the list so only one row can be editing. */
  draft: VocabularyDraft | null;
  confirmingDelete: boolean;
  busy: boolean;
  error?: string;
  onDraftChange: (draft: VocabularyDraft) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onStartDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}

const dateFormat = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
});

export function VocabularyRow({
  item,
  songExists,
  draft,
  confirmingDelete,
  busy,
  error,
  onDraftChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onStartDelete,
  onCancelDelete,
  onConfirmDelete,
}: VocabularyRowProps) {
  if (draft) {
    return (
      <li className="flex flex-col gap-3 rounded-lg border border-accent/40 bg-surface p-4">
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            onSaveEdit();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs text-muted">
              Word or phrase
              <TextInput
                value={draft.text}
                autoFocus
                disabled={busy}
                onChange={(event) =>
                  onDraftChange({ ...draft, text: event.target.value })
                }
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Translation
              <TextInput
                value={draft.translatedText}
                disabled={busy}
                onChange={(event) =>
                  onDraftChange({
                    ...draft,
                    translatedText: event.target.value,
                  })
                }
              />
            </label>
          </div>

          {error && <p className="text-xs text-danger">{error}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={onCancelEdit}
            >
              Cancel
            </Button>
          </div>
        </form>
      </li>
    );
  }

  if (confirmingDelete) {
    return (
      <li className="flex flex-col gap-3 rounded-lg border border-danger/40 bg-danger/5 p-4">
        <p className="text-sm">
          Delete <span className="font-medium">{item.text}</span>? This cannot be
          undone.
        </p>
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="flex gap-2">
          <Button variant="danger" disabled={busy} onClick={onConfirmDelete}>
            {busy ? "Deleting…" : "Delete"}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={onCancelDelete}>
            Cancel
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border p-4 sm:flex-row sm:items-start sm:gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="font-medium break-words">{item.text}</p>
        <p className="text-sm break-words text-muted">{item.translatedText}</p>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <span>
            {getLanguageName(item.sourceLanguage)} to{" "}
            {getLanguageName(item.targetLanguage)}
          </span>
          {item.songTitle && (
            <>
              <span aria-hidden>·</span>
              {songExists && item.songId ? (
                <Link
                  href={`/song/${item.songId}`}
                  className="text-accent underline underline-offset-2"
                >
                  {item.songTitle}
                </Link>
              ) : (
                // The title is stored on the item, so it outlives the song.
                <span>{item.songTitle}</span>
              )}
            </>
          )}
          <span aria-hidden>·</span>
          <span>{dateFormat.format(new Date(item.createdAt))}</span>
        </p>
      </div>

      <div className="flex shrink-0 gap-2">
        <Button variant="secondary" onClick={onStartEdit}>
          Edit
        </Button>
        <Button
          variant="ghost"
          onClick={onStartDelete}
          aria-label={`Delete ${item.text}`}
        >
          Delete
        </Button>
      </div>
    </li>
  );
}
