"use client";

import { SongLibrary } from "@/components/SongLibrary";
import { PageHeading } from "@/components/ui";

/**
 * Every song translated on this device.
 *
 * A Client Component because the library lives in IndexedDB, which only exists
 * in the browser.
 */
export default function SongsPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
      <PageHeading
        title="My songs"
        description="Songs you have translated, most recent first. They are stored in this browser only, so they will not appear on your other devices."
      />
      <SongLibrary />
    </main>
  );
}
