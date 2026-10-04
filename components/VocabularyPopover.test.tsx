import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { VocabularyPopover } from "@/components/VocabularyPopover";
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
      originalText: "a river of invented words",
      translatedText: "ein Fluss erfundener Worte",
    },
  ],
  createdAt: 0,
  updatedAt: 0,
};

function renderPopover(overrides: { text?: string } = {}) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(
    <VocabularyPopover
      text={overrides.text ?? "river"}
      context="a river of invented words"
      song={song}
      onClose={onClose}
      onSaved={onSaved}
    />,
  );
  return { onClose, onSaved };
}

function translationField() {
  return screen.getByLabelText("Translation");
}

beforeEach(async () => {
  await closeDb();
  globalThis.indexedDB = new IDBFactory();
  requestTranslation.mockReset();
  requestTranslation.mockResolvedValue({ translations: ["Fluss"] });
  await saveSettings({ deeplApiKey: "test-key:fx" });
});

describe("VocabularyPopover", () => {
  it("asks DeepL for a fresh translation as soon as it opens", async () => {
    renderPopover();

    await waitFor(() => expect(translationField()).toHaveValue("Fluss"));
    expect(requestTranslation).toHaveBeenCalledTimes(1);
  });

  it("sends the surrounding lines as context and the song's languages", async () => {
    renderPopover();

    await waitFor(() => expect(requestTranslation).toHaveBeenCalled());
    expect(requestTranslation).toHaveBeenCalledWith(
      expect.objectContaining({
        text: ["river"],
        context: "a river of invented words",
        sourceLang: "EN",
        targetLang: "DE",
      }),
    );
  });

  it("omits the source language when the song's was auto-detected", async () => {
    render(
      <VocabularyPopover
        text="river"
        context="a river of invented words"
        song={{ ...song, sourceLanguage: "auto" }}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    await waitFor(() => expect(requestTranslation).toHaveBeenCalled());
    expect(requestTranslation.mock.calls[0][0]).not.toHaveProperty("sourceLang");
  });

  it("saves the word with the song it came from", async () => {
    const { onSaved, onClose } = renderPopover();
    await waitFor(() => expect(translationField()).toHaveValue("Fluss"));

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();

    const items = await getAllVocabulary();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      text: "river",
      translatedText: "Fluss",
      songId: "song-1",
      songTitle: "Morgenlicht",
      targetLanguage: "DE",
    });
  });

  it("keeps an edited translation rather than DeepL's suggestion", async () => {
    renderPopover();
    await waitFor(() => expect(translationField()).toHaveValue("Fluss"));

    await userEvent.clear(translationField());
    await userEvent.type(translationField(), "der Strom");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(async () => {
      const items = await getAllVocabulary();
      expect(items[0]?.translatedText).toBe("der Strom");
    });
  });

  it("edits the existing entry instead of saving a duplicate", async () => {
    await addVocabularyItem({
      text: "river",
      translatedText: "Fluss",
      sourceLanguage: "EN",
      targetLanguage: "DE",
    });

    renderPopover();

    await waitFor(() =>
      expect(screen.getByText(/saved this already/i)).toBeInTheDocument(),
    );
    // No point spending quota re-translating something already collected.
    expect(requestTranslation).not.toHaveBeenCalled();

    await userEvent.clear(translationField());
    await userEvent.type(translationField(), "der Strom");
    await userEvent.click(screen.getByRole("button", { name: "Update" }));

    await waitFor(async () => {
      const items = await getAllVocabulary();
      expect(items).toHaveLength(1);
      expect(items[0].translatedText).toBe("der Strom");
    });
  });

  it("treats the same word in another target language as a new entry", async () => {
    await addVocabularyItem({
      text: "river",
      translatedText: "rivière",
      sourceLanguage: "EN",
      targetLanguage: "FR",
    });

    renderPopover();

    await waitFor(() => expect(requestTranslation).toHaveBeenCalled());
    expect(screen.queryByText(/saved this already/i)).not.toBeInTheDocument();
  });

  it("still lets the word be saved by hand when translation fails", async () => {
    requestTranslation.mockRejectedValue(new Error("DeepL rejected the API key."));
    renderPopover();

    await waitFor(() =>
      expect(screen.getByText("DeepL rejected the API key.")).toBeInTheDocument(),
    );

    await userEvent.type(translationField(), "Fluss");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(async () => {
      expect((await getAllVocabulary())[0]?.translatedText).toBe("Fluss");
    });
  });

  it("explains itself and skips DeepL when there is no API key", async () => {
    await saveSettings({ deeplApiKey: "" });

    renderPopover();

    await waitFor(() =>
      expect(screen.getByText(/No DeepL API key yet/i)).toBeInTheDocument(),
    );
    expect(requestTranslation).not.toHaveBeenCalled();
  });

  it("refuses to save an empty translation", async () => {
    requestTranslation.mockResolvedValue({ translations: [""] });
    const { onSaved } = renderPopover();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save" })).toBeEnabled(),
    );
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText(/Add a translation before saving/i)).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
    expect(await getAllVocabulary()).toHaveLength(0);
  });

  it("closes on Escape", async () => {
    const { onClose } = renderPopover();
    await waitFor(() => expect(translationField()).toHaveValue("Fluss"));

    await userEvent.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalled();
  });
});
