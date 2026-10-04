import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LyricsResultView } from "@/components/LyricsResultView";
import {
  addVocabularyItem,
  closeDb,
  getAllVocabulary,
  saveSettings,
} from "@/lib/db";
import type { Song } from "@/types";

const requestTranslation = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api-client", () => ({ requestTranslation }));

// All fixture text is invented. Never put real song lyrics in tests.
const song: Song = {
  id: "song-1",
  title: "Morgenlicht",
  titleLower: "morgenlicht",
  artist: "Die Erfundenen",
  sourceLanguage: "EN",
  targetLanguage: "DE",
  lines: [
    {
      id: "line-1",
      originalText: "a river of invented words,",
      translatedText: "ein Fluss erfundener Worte",
    },
    { id: "line-2", originalText: "", translatedText: "" },
    {
      id: "line-3",
      originalText: "nothing real here",
      translatedText: "nichts Echtes hier",
    },
  ],
  createdAt: 0,
  updatedAt: 0,
};

function word(name: string) {
  return screen.getByRole("button", { name });
}

/** Selects a word the way a keyboard user would. */
async function pressWord(name: string) {
  word(name).focus();
  await userEvent.keyboard("{Enter}");
}

beforeEach(async () => {
  await closeDb();
  globalThis.indexedDB = new IDBFactory();
  requestTranslation.mockReset();
  requestTranslation.mockResolvedValue({ translations: ["Fluss"] });
  await saveSettings({ deeplApiKey: "test-key:fx" });
});

describe("LyricsResultView", () => {
  it("shows the song's details and both languages", () => {
    render(<LyricsResultView song={song} />);

    expect(screen.getByRole("heading", { name: "Morgenlicht" })).toBeInTheDocument();
    expect(screen.getByText("Die Erfundenen")).toBeInTheDocument();
    expect(screen.getByText("English to German")).toBeInTheDocument();
  });

  it("renders every word as its own control and keeps punctuation visible", () => {
    render(<LyricsResultView song={song} />);

    expect(word("river")).toBeInTheDocument();
    // The display keeps the comma even though the saved form will not.
    expect(word("words,")).toBeInTheDocument();
  });

  it("shows the translation under the original", () => {
    render(<LyricsResultView song={song} />);

    expect(screen.getByText("ein Fluss erfundener Worte")).toBeInTheDocument();
  });

  it("marks a word as selected and offers to save it", async () => {
    render(<LyricsResultView song={song} />);

    await pressWord("river");

    expect(word("river")).toHaveAttribute("aria-pressed", "true");
    expect(word("of")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Save word" })).toBeInTheDocument();
  });

  it("opens the save dialog from the Save word button", async () => {
    render(<LyricsResultView song={song} />);

    await pressWord("river");
    await userEvent.click(screen.getByRole("button", { name: "Save word" }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Save to vocabulary")).toBeInTheDocument();
  });

  it("opens the save dialog when the selected word is pressed again", async () => {
    render(<LyricsResultView song={song} />);

    await pressWord("river");
    await pressWord("river");

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("strips edge punctuation from what gets offered for saving", async () => {
    render(<LyricsResultView song={song} />);

    await pressWord("words,");
    await pressWord("words,");

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("words");
    await waitFor(() =>
      expect(requestTranslation).toHaveBeenCalledWith(
        expect.objectContaining({ text: ["words"] }),
      ),
    );
  });

  it("moves the selection when a different word is pressed", async () => {
    render(<LyricsResultView song={song} />);

    await pressWord("river");
    await pressWord("invented");

    expect(word("river")).toHaveAttribute("aria-pressed", "false");
    expect(word("invented")).toHaveAttribute("aria-pressed", "true");
  });

  it("saves a word and then highlights it in the lyrics", async () => {
    render(<LyricsResultView song={song} />);

    await pressWord("river");
    await userEvent.click(screen.getByRole("button", { name: "Save word" }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() =>
      expect(screen.getByLabelText("Translation")).toHaveValue("Fluss"),
    );
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect((await getAllVocabulary())[0]?.text).toBe("river");
    // The selection is dropped so the saved highlight is what remains.
    await waitFor(() =>
      expect(word("river")).toHaveAttribute("aria-pressed", "false"),
    );
    await waitFor(() => expect(word("river").className).toContain("bg-highlight"));
  });

  it("highlights words already in the vocabulary on first render", async () => {
    await addVocabularyItem({
      text: "river",
      translatedText: "Fluss",
      sourceLanguage: "EN",
      targetLanguage: "DE",
    });

    render(<LyricsResultView song={song} />);

    await waitFor(() => expect(word("river").className).toContain("bg-highlight"));
    expect(word("of").className).not.toContain("bg-highlight");
  });

  it("highlights every word of a saved phrase", async () => {
    await addVocabularyItem({
      text: "invented words",
      translatedText: "erfundene Worte",
      sourceLanguage: "EN",
      targetLanguage: "DE",
    });

    render(<LyricsResultView song={song} />);

    await waitFor(() =>
      expect(word("invented").className).toContain("bg-highlight"),
    );
    expect(word("words,").className).toContain("bg-highlight");
    // The word before the phrase is not part of it.
    expect(word("of").className).not.toContain("bg-highlight");
  });

  it("does not highlight a phrase that straddles a verse break", async () => {
    // "song nothing" would span the blank line, so it is not a phrase here.
    await addVocabularyItem({
      text: "words nothing",
      translatedText: "irrelevant",
      sourceLanguage: "EN",
      targetLanguage: "DE",
    });

    render(<LyricsResultView song={song} />);

    await waitFor(() => expect(word("nothing")).toBeInTheDocument());
    expect(word("words,").className).not.toContain("bg-highlight");
    expect(word("nothing").className).not.toContain("bg-highlight");
  });

  it("matches a saved word regardless of case or trailing punctuation", async () => {
    await addVocabularyItem({
      text: "Words",
      translatedText: "Worte",
      sourceLanguage: "EN",
      targetLanguage: "DE",
    });

    render(<LyricsResultView song={song} />);

    await waitFor(() => expect(word("words,").className).toContain("bg-highlight"));
  });

  it("renders a verse break as a gap rather than an empty line of words", () => {
    render(<LyricsResultView song={song} />);

    // The line after the break still renders word by word...
    expect(word("nothing")).toBeInTheDocument();
    expect(screen.getByText("nichts Echtes hier")).toBeInTheDocument();
    // ...while the break itself contributes no words and no "missing
    // translation" placeholder.
    expect(screen.queryAllByText("no translation returned")).toHaveLength(0);
  });

  it("will not extend a selection across a verse break", async () => {
    render(<LyricsResultView song={song} />);

    // Pressing a word in the next verse starts a new selection rather than
    // joining two unrelated verses into one phrase.
    await pressWord("river");
    await pressWord("nothing");

    expect(word("river")).toHaveAttribute("aria-pressed", "false");
    expect(word("nothing")).toHaveAttribute("aria-pressed", "true");
  });

  it("clears the selection on Escape", async () => {
    render(<LyricsResultView song={song} />);

    await pressWord("river");
    expect(screen.getByRole("button", { name: "Save word" })).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");

    expect(word("river")).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.queryByRole("button", { name: "Save word" }),
    ).not.toBeInTheDocument();
  });
});
