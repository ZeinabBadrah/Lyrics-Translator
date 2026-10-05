import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SongLibrary } from "@/components/SongLibrary";
import {
  addVocabularyItem,
  closeDb,
  getAllSongs,
  getAllVocabulary,
  saveSong,
} from "@/lib/db";
import type { SongInput } from "@/types";

// All fixture text is invented. Never put real song lyrics in tests.
function songFixture(overrides: Partial<SongInput> = {}): SongInput {
  return {
    title: "Morgenlicht",
    artist: "Die Erfundenen",
    sourceLanguage: "EN",
    targetLanguage: "DE",
    lines: [
      { id: "l1", originalText: "a river of invented words", translatedText: "ein Fluss" },
      { id: "l2", originalText: "", translatedText: "" },
      { id: "l3", originalText: "nothing real here", translatedText: "nichts Echtes" },
    ],
    ...overrides,
  };
}

function cards() {
  return screen.getAllByRole("listitem");
}

beforeEach(async () => {
  await closeDb();
  globalThis.indexedDB = new IDBFactory();
});

describe("SongLibrary", () => {
  it("explains what to do when there are no songs", async () => {
    render(<SongLibrary />);

    expect(await screen.findByText(/No songs yet/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Paste some lyrics" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("shows a song's title, artist and languages", async () => {
    await saveSong(songFixture());

    render(<SongLibrary />);

    const card = await screen.findByRole("listitem");
    expect(within(card).getByRole("link", { name: "Morgenlicht" })).toBeInTheDocument();
    expect(within(card).getByText("Die Erfundenen")).toBeInTheDocument();
    expect(within(card).getByText(/English to German/)).toBeInTheDocument();
  });

  it("links to the song's reading page", async () => {
    const saved = await saveSong(songFixture());

    render(<SongLibrary />);

    expect(await screen.findByRole("link", { name: "Morgenlicht" })).toHaveAttribute(
      "href",
      `/song/${saved.id}`,
    );
  });

  it("counts lyric lines without counting verse breaks", async () => {
    // Three stored lines, one of which is a blank separator.
    await saveSong(songFixture());

    render(<SongLibrary />);

    expect(await screen.findByText(/2 lines/)).toBeInTheDocument();
  });

  it("says when no words have been collected", async () => {
    await saveSong(songFixture());

    render(<SongLibrary />);

    expect(await screen.findByText(/no words collected/)).toBeInTheDocument();
  });

  it("counts the words collected from the song", async () => {
    const saved = await saveSong(songFixture());
    await addVocabularyItem({
      text: "river",
      translatedText: "Fluss",
      sourceLanguage: "EN",
      targetLanguage: "DE",
      songId: saved.id,
    });
    await addVocabularyItem({
      text: "words",
      translatedText: "Worte",
      sourceLanguage: "EN",
      targetLanguage: "DE",
      songId: saved.id,
    });

    render(<SongLibrary />);

    expect(await screen.findByText(/2 words collected/)).toBeInTheDocument();
  });

  it("uses the singular for a single line and a single word", async () => {
    const saved = await saveSong(
      songFixture({ lines: [{ id: "l1", originalText: "one", translatedText: "eins" }] }),
    );
    await addVocabularyItem({
      text: "one",
      translatedText: "eins",
      sourceLanguage: "EN",
      targetLanguage: "DE",
      songId: saved.id,
    });

    render(<SongLibrary />);

    expect(await screen.findByText(/1 line/)).toBeInTheDocument();
    expect(screen.getByText(/1 word collected/)).toBeInTheDocument();
  });

  it("shows the most recently translated song first", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    await saveSong(songFixture({ title: "Older" }));
    vi.setSystemTime(new Date("2026-01-02T00:00:00.000Z"));
    await saveSong(songFixture({ title: "Newer" }));
    vi.useRealTimers();

    render(<SongLibrary />);

    await waitFor(() => expect(cards()).toHaveLength(2));
    expect(cards()[0]).toHaveTextContent("Newer");
    expect(cards()[1]).toHaveTextContent("Older");
  });

  it("counts the songs", async () => {
    await saveSong(songFixture({ title: "One" }));
    await saveSong(songFixture({ title: "Two" }));

    render(<SongLibrary />);

    expect(await screen.findByText("2 songs.")).toBeInTheDocument();
  });

  describe("search", () => {
    beforeEach(async () => {
      await saveSong(songFixture({ title: "Morgenlicht", artist: "Die Erfundenen" }));
      await saveSong(songFixture({ title: "Abendlied", artist: "Niemand" }));
    });

    async function search(term: string) {
      render(<SongLibrary />);
      await waitFor(() => expect(cards()).toHaveLength(2));
      await userEvent.type(screen.getByLabelText("Search songs"), term);
    }

    it("filters by title", async () => {
      await search("abend");

      await waitFor(() => expect(cards()).toHaveLength(1));
      expect(cards()[0]).toHaveTextContent("Abendlied");
    });

    it("filters by artist", async () => {
      await search("Erfundenen");

      await waitFor(() => expect(cards()).toHaveLength(1));
      expect(cards()[0]).toHaveTextContent("Morgenlicht");
    });

    it("says how many of the total are shown", async () => {
      await search("abend");

      expect(await screen.findByText("1 of 2 shown.")).toBeInTheDocument();
    });

    it("says so when nothing matches", async () => {
      await search("zzzz");

      expect(await screen.findByText(/Nothing matches/)).toBeInTheDocument();
    });
  });

  describe("deleting", () => {
    it("asks for confirmation first", async () => {
      await saveSong(songFixture());
      render(<SongLibrary />);

      await userEvent.click(
        await screen.findByRole("button", { name: "Delete Morgenlicht" }),
      );

      expect(screen.getByText(/gone for good/i)).toBeInTheDocument();
      expect(await getAllSongs()).toHaveLength(1);
    });

    it("promises that collected words will be kept, and counts them", async () => {
      const saved = await saveSong(songFixture());
      await addVocabularyItem({
        text: "river",
        translatedText: "Fluss",
        sourceLanguage: "EN",
        targetLanguage: "DE",
        songId: saved.id,
      });
      render(<SongLibrary />);

      await userEvent.click(
        await screen.findByRole("button", { name: "Delete Morgenlicht" }),
      );

      expect(
        screen.getByText(/The 1 word you collected from it will be kept/i),
      ).toBeInTheDocument();
    });

    it("says plainly when there is no vocabulary to keep", async () => {
      await saveSong(songFixture());
      render(<SongLibrary />);

      await userEvent.click(
        await screen.findByRole("button", { name: "Delete Morgenlicht" }),
      );

      expect(
        screen.getByText(/have not collected any words/i),
      ).toBeInTheDocument();
    });

    it("deletes the song but keeps its vocabulary", async () => {
      // The whole point of the stage: the words are the work, and they survive.
      const saved = await saveSong(songFixture());
      await addVocabularyItem({
        text: "river",
        translatedText: "Fluss",
        sourceLanguage: "EN",
        targetLanguage: "DE",
        songId: saved.id,
        songTitle: saved.title,
      });
      render(<SongLibrary />);

      await userEvent.click(
        await screen.findByRole("button", { name: "Delete Morgenlicht" }),
      );
      await userEvent.click(screen.getByRole("button", { name: "Delete song" }));

      await waitFor(async () => expect(await getAllSongs()).toHaveLength(0));
      const remaining = await getAllVocabulary();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].songTitle).toBe("Morgenlicht");
      expect(await screen.findByText(/No songs yet/i)).toBeInTheDocument();
    });

    it("keeps the song when the confirmation is cancelled", async () => {
      await saveSong(songFixture());
      render(<SongLibrary />);

      await userEvent.click(
        await screen.findByRole("button", { name: "Delete Morgenlicht" }),
      );
      await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(
        await screen.findByRole("link", { name: "Morgenlicht" }),
      ).toBeInTheDocument();
      expect(await getAllSongs()).toHaveLength(1);
    });

    it("only asks about one song at a time", async () => {
      await saveSong(songFixture({ title: "One" }));
      await saveSong(songFixture({ title: "Two" }));
      render(<SongLibrary />);

      await waitFor(() => expect(cards()).toHaveLength(2));
      await userEvent.click(screen.getByRole("button", { name: "Delete One" }));

      expect(screen.getAllByRole("button", { name: "Delete song" })).toHaveLength(1);
    });
  });
});
