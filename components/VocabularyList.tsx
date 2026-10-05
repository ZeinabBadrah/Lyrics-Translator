"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  VocabularyRow,
  type VocabularyDraft,
} from "@/components/VocabularyRow";
import { Alert, Button, TextInput } from "@/components/ui";
import { deleteVocabularyItem, getAllSongs, getAllVocabulary, updateVocabularyItem } from "@/lib/db";
import {
  CSV_MIME_TYPE,
  JSON_MIME_TYPE,
  downloadTextFile,
  exportFilename,
  toCsv,
  toJson,
} from "@/lib/export";
import { normalizeForIndex } from "@/lib/text";
import type { VocabularyItem } from "@/types";

export function VocabularyList() {
  const [items, setItems] = useState<VocabularyItem[] | null>(null);
  const [songIds, setSongIds] = useState<Set<string>>(new Set());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<VocabularyDraft | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // The songs are fetched alongside so a deleted song's title can be shown as
    // plain text rather than a link to a page that no longer exists.
    void Promise.all([getAllVocabulary(), getAllSongs()])
      .then(([vocabulary, songs]) => {
        if (cancelled) return;
        setItems(vocabulary);
        setSongIds(new Set(songs.map((song) => song.id)));
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadError(
          error instanceof Error
            ? error.message
            : "Your vocabulary could not be loaded.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const filtered = useMemo(() => {
    if (!items) {
      return [];
    }

    const needle = normalizeForIndex(query);
    if (!needle) {
      return items;
    }

    return items.filter(
      (item) =>
        item.textLower.includes(needle) ||
        normalizeForIndex(item.translatedText).includes(needle) ||
        normalizeForIndex(item.songTitle ?? "").includes(needle),
    );
  }, [items, query]);

  function resetRowState() {
    setEditingId(null);
    setDraft(null);
    setConfirmingId(null);
    setBusyId(null);
    setRowError(null);
  }

  function startEdit(item: VocabularyItem) {
    setConfirmingId(null);
    setRowError(null);
    setEditingId(item.id);
    setDraft({ text: item.text, translatedText: item.translatedText });
  }

  async function saveEdit() {
    if (!editingId || !draft) {
      return;
    }

    if (!draft.text.trim() || !draft.translatedText.trim()) {
      setRowError("Both the word and its translation need some text.");
      return;
    }

    setBusyId(editingId);
    setRowError(null);
    try {
      await updateVocabularyItem(editingId, draft);
      resetRowState();
      setReloadToken((token) => token + 1);
    } catch (error) {
      setBusyId(null);
      setRowError(
        error instanceof Error ? error.message : "That change could not be saved.",
      );
    }
  }

  async function confirmDelete() {
    if (!confirmingId) {
      return;
    }

    setBusyId(confirmingId);
    setRowError(null);
    try {
      await deleteVocabularyItem(confirmingId);
      resetRowState();
      setReloadToken((token) => token + 1);
    } catch (error) {
      setBusyId(null);
      setRowError(
        error instanceof Error ? error.message : "That entry could not be deleted.",
      );
    }
  }

  if (loadError) {
    return <Alert tone="error">{loadError}</Alert>;
  }

  if (!items) {
    return <p className="text-sm text-muted">Loading your vocabulary…</p>;
  }

  if (items.length === 0) {
    return (
      <Alert tone="info">
        Nothing saved yet. Open a song and click a word to collect it —{" "}
        <Link href="/" className="text-accent underline underline-offset-2">
          translate a song
        </Link>{" "}
        to start.
      </Alert>
    );
  }

  const filtering = normalizeForIndex(query).length > 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <TextInput
          type="search"
          value={query}
          placeholder="Search words, translations and songs"
          aria-label="Search vocabulary"
          onChange={(event) => setQuery(event.target.value)}
          className="sm:max-w-xs"
        />

        <div className="flex gap-2 sm:ml-auto">
          <Button
            variant="secondary"
            disabled={filtered.length === 0}
            onClick={() =>
              downloadTextFile(
                exportFilename("json"),
                JSON_MIME_TYPE,
                toJson(filtered),
              )
            }
          >
            Export JSON
          </Button>
          <Button
            variant="secondary"
            disabled={filtered.length === 0}
            onClick={() =>
              downloadTextFile(
                exportFilename("csv"),
                CSV_MIME_TYPE,
                toCsv(filtered),
              )
            }
          >
            Export CSV
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted" role="status">
        {filtering
          ? `${filtered.length} of ${items.length} shown. Export covers the ${filtered.length} shown.`
          : `${items.length} ${items.length === 1 ? "entry" : "entries"}.`}
      </p>

      {filtered.length === 0 ? (
        <Alert tone="info">Nothing matches “{query.trim()}”.</Alert>
      ) : (
        <ul className="flex flex-col gap-3">
          {filtered.map((item) => (
            <VocabularyRow
              key={item.id}
              item={item}
              songExists={item.songId ? songIds.has(item.songId) : false}
              draft={editingId === item.id ? draft : null}
              confirmingDelete={confirmingId === item.id}
              busy={busyId === item.id}
              error={
                (editingId === item.id || confirmingId === item.id) && rowError
                  ? rowError
                  : undefined
              }
              onDraftChange={setDraft}
              onStartEdit={() => startEdit(item)}
              onCancelEdit={resetRowState}
              onSaveEdit={() => void saveEdit()}
              onStartDelete={() => {
                setEditingId(null);
                setDraft(null);
                setRowError(null);
                setConfirmingId(item.id);
              }}
              onCancelDelete={resetRowState}
              onConfirmDelete={() => void confirmDelete()}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
