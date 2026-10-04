"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";

import { LyricsResultView } from "@/components/LyricsResultView";
import { Alert } from "@/components/ui";
import { getSong } from "@/lib/db";
import type { Song } from "@/types";

type LoadState =
  | { status: "loading" }
  | { status: "found"; song: Song }
  | { status: "missing" }
  | { status: "failed"; message: string };

/**
 * A saved song.
 *
 * A Client Component because the song lives in IndexedDB, which only exists in
 * the browser. There is nothing for the server to render beyond the shell.
 */
export default function SongPage({ params }: PageProps<"/song/[id]">) {
  const { id } = use(params);
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    void getSong(id)
      .then((song) => {
        if (cancelled) return;
        setState(song ? { status: "found", song } : { status: "missing" });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          status: "failed",
          message:
            error instanceof Error
              ? error.message
              : "This song could not be loaded.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-10 sm:px-6">
      {state.status === "loading" && (
        <p className="text-sm text-muted">Loading song…</p>
      )}

      {state.status === "found" && <LyricsResultView song={state.song} />}

      {state.status === "missing" && (
        <div className="flex flex-col gap-4">
          <Alert tone="info">
            No saved song has this address. It may have been deleted, or saved
            in a different browser — songs live on the device that translated
            them.
          </Alert>
          <Link
            href="/"
            className="text-sm text-accent underline underline-offset-2"
          >
            Translate a song
          </Link>
        </div>
      )}

      {state.status === "failed" && <Alert tone="error">{state.message}</Alert>}
    </main>
  );
}
