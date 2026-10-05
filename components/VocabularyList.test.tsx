import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { VocabularyList } from "@/components/VocabularyList";
import {
  addVocabularyItem,
  closeDb,
  getAllVocabulary,
  saveSong,
} from "@/lib/db";
import type { SongInput, VocabularyItemInput } from "@/types";

const downloadTextFile = vi.hoisted(() => vi.fn());
vi.mock("@/lib/export", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/export")>()),
  downloadTextFile,
}));

// All fixture text is invented. Never put real song lyrics in tests.
const song: SongInput = {
  id: "song-1",
  title: "Morgenlicht",
  artist: "Die Erfundenen",
  sourceLanguage: "EN",
  targetLanguage: "DE",
  lines: [{ id: "l1", originalText: "a river", translatedText: "ein Fluss" }],
};

function entry(overrides: Partial<VocabularyItemInput> = {}): VocabularyItemInput {
  return {
    text: "river",
    translatedText: "Fluss",
    sourceLanguage: "EN",
    targetLanguage: "DE",
    songId: "song-1",
    songTitle: "Morgenlicht",
    ...overrides,
  };
}

/** The rows, in the order they appear. */
function rows() {
  return screen.getAllByRole("listitem");
}

beforeEach(async () => {
  await closeDb();
  globalThis.indexedDB = new IDBFactory();
  downloadTextFile.mockReset();
});

describe("VocabularyList", () => {
  it("explains what to do when nothing has been saved", async () => {
    render(<VocabularyList />);

    expect(await screen.findByText(/Nothing saved yet/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "translate a song" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("lists saved entries with their translation and languages", async () => {
    await addVocabularyItem(entry());

    render(<VocabularyList />);

    const row = await screen.findByRole("listitem");
    expect(within(row).getByText("river")).toBeInTheDocument();
    expect(within(row).getByText("Fluss")).toBeInTheDocument();
    expect(within(row).getByText(/English to German/)).toBeInTheDocument();
  });

  it("shows newest first", async () => {
    // The timestamps have to be made distinct: two entries saved in the same
    // millisecond have no defined order. Only Date is faked, because faking the
    // timer APIs hangs fake-indexeddb.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    await addVocabularyItem(entry({ text: "older" }));
    vi.setSystemTime(new Date("2026-01-02T00:00:00.000Z"));
    await addVocabularyItem(entry({ text: "newer" }));
    vi.useRealTimers();

    render(<VocabularyList />);

    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(rows()[0]).toHaveTextContent("newer");
    expect(rows()[1]).toHaveTextContent("older");
  });

  it("counts the entries", async () => {
    await addVocabularyItem(entry({ text: "one" }));
    await addVocabularyItem(entry({ text: "two" }));

    render(<VocabularyList />);

    expect(await screen.findByText("2 entries.")).toBeInTheDocument();
  });

  it("links to the song an entry came from", async () => {
    await saveSong(song);
    await addVocabularyItem(entry());

    render(<VocabularyList />);

    expect(
      await screen.findByRole("link", { name: "Morgenlicht" }),
    ).toHaveAttribute("href", "/song/song-1");
  });

  it("keeps a deleted song's title as plain text rather than a broken link", async () => {
    // No song saved, so the id on the entry points at nothing.
    await addVocabularyItem(entry());

    render(<VocabularyList />);

    expect(await screen.findByText("Morgenlicht")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Morgenlicht" }),
    ).not.toBeInTheDocument();
  });

  describe("search", () => {
    beforeEach(async () => {
      await addVocabularyItem(
        entry({ text: "river", translatedText: "Fluss", songTitle: "Morgenlicht" }),
      );
      await addVocabularyItem(
        entry({ text: "mountain", translatedText: "Berg", songTitle: "Abendlied" }),
      );
    });

    async function search(term: string) {
      render(<VocabularyList />);
      await waitFor(() => expect(rows()).toHaveLength(2));
      await userEvent.type(screen.getByLabelText("Search vocabulary"), term);
    }

    it("filters by the word", async () => {
      await search("riv");

      await waitFor(() => expect(rows()).toHaveLength(1));
      expect(rows()[0]).toHaveTextContent("river");
    });

    it("filters by the translation", async () => {
      await search("Berg");

      await waitFor(() => expect(rows()).toHaveLength(1));
      expect(rows()[0]).toHaveTextContent("mountain");
    });

    it("filters by the song title", async () => {
      await search("Abend");

      await waitFor(() => expect(rows()).toHaveLength(1));
      expect(rows()[0]).toHaveTextContent("mountain");
    });

    it("ignores case", async () => {
      await search("RIVER");

      await waitFor(() => expect(rows()).toHaveLength(1));
    });

    it("says how many of the total are shown", async () => {
      await search("river");

      expect(await screen.findByText(/1 of 2 shown/)).toBeInTheDocument();
    });

    it("says so when nothing matches", async () => {
      await search("nothingmatches");

      expect(
        await screen.findByText(/Nothing matches/),
      ).toBeInTheDocument();
    });
  });

  describe("editing", () => {
    beforeEach(async () => {
      await addVocabularyItem(entry());
    });

    it("edits the translation", async () => {
      render(<VocabularyList />);
      await userEvent.click(await screen.findByRole("button", { name: "Edit" }));

      const field = screen.getByLabelText("Translation");
      await userEvent.clear(field);
      await userEvent.type(field, "der Strom");
      await userEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(async () => {
        expect((await getAllVocabulary())[0].translatedText).toBe("der Strom");
      });
      expect(await screen.findByText("der Strom")).toBeInTheDocument();
    });

    it("edits the word itself, and reindexes it for lookups", async () => {
      render(<VocabularyList />);
      await userEvent.click(await screen.findByRole("button", { name: "Edit" }));

      const field = screen.getByLabelText("Word or phrase");
      await userEvent.clear(field);
      await userEvent.type(field, "Stream");
      await userEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(async () => {
        const saved = (await getAllVocabulary())[0];
        expect(saved.text).toBe("Stream");
        // The derived index key must follow the text, or search breaks.
        expect(saved.textLower).toBe("stream");
      });
    });

    it("refuses to save an empty field", async () => {
      render(<VocabularyList />);
      await userEvent.click(await screen.findByRole("button", { name: "Edit" }));

      await userEvent.clear(screen.getByLabelText("Translation"));
      await userEvent.click(screen.getByRole("button", { name: "Save" }));

      expect(
        await screen.findByText(/Both the word and its translation/i),
      ).toBeInTheDocument();
      expect((await getAllVocabulary())[0].translatedText).toBe("Fluss");
    });

    it("discards changes on cancel", async () => {
      render(<VocabularyList />);
      await userEvent.click(await screen.findByRole("button", { name: "Edit" }));

      await userEvent.clear(screen.getByLabelText("Translation"));
      await userEvent.type(screen.getByLabelText("Translation"), "wrong");
      await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(await screen.findByText("Fluss")).toBeInTheDocument();
      expect((await getAllVocabulary())[0].translatedText).toBe("Fluss");
    });

    it("only edits one row at a time", async () => {
      await addVocabularyItem(entry({ text: "mountain" }));
      render(<VocabularyList />);

      await waitFor(() => expect(rows()).toHaveLength(2));
      await userEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]);

      expect(screen.getAllByLabelText("Word or phrase")).toHaveLength(1);
    });
  });

  describe("deleting", () => {
    beforeEach(async () => {
      await addVocabularyItem(entry());
    });

    it("asks for confirmation first", async () => {
      render(<VocabularyList />);

      await userEvent.click(
        await screen.findByRole("button", { name: "Delete river" }),
      );

      expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
      expect(await getAllVocabulary()).toHaveLength(1);
    });

    it("deletes once confirmed", async () => {
      render(<VocabularyList />);
      await userEvent.click(
        await screen.findByRole("button", { name: "Delete river" }),
      );

      await userEvent.click(screen.getByRole("button", { name: "Delete" }));

      await waitFor(async () => expect(await getAllVocabulary()).toHaveLength(0));
      expect(await screen.findByText(/Nothing saved yet/i)).toBeInTheDocument();
    });

    it("keeps the entry when the confirmation is cancelled", async () => {
      render(<VocabularyList />);
      await userEvent.click(
        await screen.findByRole("button", { name: "Delete river" }),
      );

      await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(await screen.findByText("river")).toBeInTheDocument();
      expect(await getAllVocabulary()).toHaveLength(1);
    });
  });

  describe("export", () => {
    beforeEach(async () => {
      await addVocabularyItem(entry({ text: "river" }));
      await addVocabularyItem(entry({ text: "mountain" }));
    });

    it("downloads JSON with a dated filename", async () => {
      render(<VocabularyList />);
      await waitFor(() => expect(rows()).toHaveLength(2));

      await userEvent.click(screen.getByRole("button", { name: "Export JSON" }));

      expect(downloadTextFile).toHaveBeenCalledTimes(1);
      const [filename, mimeType, contents] = downloadTextFile.mock.calls[0];
      expect(filename).toMatch(/^vocabulary-\d{4}-\d{2}-\d{2}\.json$/);
      expect(mimeType).toBe("application/json");
      expect(JSON.parse(contents).itemCount).toBe(2);
    });

    it("downloads CSV", async () => {
      render(<VocabularyList />);
      await waitFor(() => expect(rows()).toHaveLength(2));

      await userEvent.click(screen.getByRole("button", { name: "Export CSV" }));

      const [filename, mimeType, contents] = downloadTextFile.mock.calls[0];
      expect(filename).toMatch(/\.csv$/);
      expect(mimeType).toBe("text/csv;charset=utf-8");
      expect(contents).toContain("river");
      expect(contents).toContain("mountain");
    });

    it("exports only what the search has left showing", async () => {
      render(<VocabularyList />);
      await waitFor(() => expect(rows()).toHaveLength(2));
      await userEvent.type(screen.getByLabelText("Search vocabulary"), "river");
      await waitFor(() => expect(rows()).toHaveLength(1));

      await userEvent.click(screen.getByRole("button", { name: "Export JSON" }));

      const parsed = JSON.parse(downloadTextFile.mock.calls[0][2]);
      expect(parsed.itemCount).toBe(1);
      expect(parsed.items[0].text).toBe("river");
    });

    it("cannot be pressed when the search matches nothing", async () => {
      render(<VocabularyList />);
      await waitFor(() => expect(rows()).toHaveLength(2));
      await userEvent.type(screen.getByLabelText("Search vocabulary"), "zzzz");

      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Export JSON" })).toBeDisabled(),
      );
      expect(screen.getByRole("button", { name: "Export CSV" })).toBeDisabled();
    });
  });
});
