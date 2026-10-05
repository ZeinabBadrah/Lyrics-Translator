"use client";

import { VocabularyList } from "@/components/VocabularyList";
import { PageHeading } from "@/components/ui";

/**
 * Everything collected from every song.
 *
 * A Client Component because the list lives in IndexedDB, which only exists in
 * the browser.
 */
export default function VocabularyPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
      <PageHeading
        title="Vocabulary"
        description="Words and phrases you have collected. Everything here is stored in this browser only, so export a copy if you want to keep it."
      />
      <VocabularyList />
    </main>
  );
}
