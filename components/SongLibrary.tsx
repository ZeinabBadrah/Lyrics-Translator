"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { SongCard } from "@/components/SongCard";
import { Alert, TextInput } from "@/components/ui";
import {
  deleteSong,
  getAllSongs,
  getVocabularyCountsBySong,
} from "@/lib/db";
import { normalizeForIndex } from "@/lib/text";
import type { Song } from "@/types";

export function SongLibrary() {
  const [songs, setSongs] = useState<Song[] | null>(null);
  const [wordCounts, setWordCounts] = useState<Map<string, number>>(new Map());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [query, setQuery] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([getAllSongs(), getVocabularyCountsBySong()])
      .then(([allSongs, counts]) => {
        if (cancelled) return;
        setSongs(allSongs);
        setWordCounts(counts);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadError(
          error instanceof Error
            ? error.message
            : "Your songs could not be loaded.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const filtered = useMemo(() => {
    if (!songs) {
      return [];
    }

    const needle = normalizeForIndex(query);
    if (!needle) {
      return songs;
    }

    return songs.filter(
      (song) =>
        song.titleLower.includes(needle) ||
        normalizeForIndex(song.artist ?? "").includes(needle),
    );
  }, [songs, query]);

  async function confirmDelete() {
    if (!confirmingId) {
      return;
    }

    setBusyId(confirmingId);
    setRowError(null);
    try {
      await deleteSong(confirmingId);
      setConfirmingId(null);
      setBusyId(null);
      setReloadToken((token) => token + 1);
    } catch (error) {
      setBusyId(null);
      setRowError(
        error instanceof Error ? error.message : "That song could not be deleted.",
      );
    }
  }

  if (loadError) {
    return <Alert tone="error">{loadError}</Alert>;
  }

  if (!songs) {
    return <p className="text-sm text-muted">Loading your songs…</p>;
  }

  if (songs.length === 0) {
    return (
      <Alert tone="info">
        No songs yet.{" "}
        <Link href="/" className="text-accent underline underline-offset-2">
          Paste some lyrics
        </Link>{" "}
        to translate your first one.
      </Alert>
    );
  }

  const filtering = normalizeForIndex(query).length > 0;

  return (
    <div className="flex flex-col gap-5">
      <TextInput
        type="search"
        value={query}
        placeholder="Search by title or artist"
        aria-label="Search songs"
        onChange={(event) => setQuery(event.target.value)}
        className="sm:max-w-xs"
      />

      <p className="text-xs text-muted" role="status">
        {filtering
          ? `${filtered.length} of ${songs.length} shown.`
          : `${songs.length} ${songs.length === 1 ? "song" : "songs"}.`}
      </p>

      {filtered.length === 0 ? (
        <Alert tone="info">Nothing matches “{query.trim()}”.</Alert>
      ) : (
        <ul className="flex flex-col gap-3">
          {filtered.map((song) => (
            <SongCard
              key={song.id}
              song={song}
              wordCount={wordCounts.get(song.id) ?? 0}
              confirmingDelete={confirmingId === song.id}
              busy={busyId === song.id}
              error={confirmingId === song.id ? (rowError ?? undefined) : undefined}
              onStartDelete={() => {
                setRowError(null);
                setConfirmingId(song.id);
              }}
              onCancelDelete={() => {
                setRowError(null);
                setConfirmingId(null);
              }}
              onConfirmDelete={() => void confirmDelete()}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
