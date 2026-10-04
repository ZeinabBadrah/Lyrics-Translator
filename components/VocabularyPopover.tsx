"use client";

import { useEffect, useRef, useState } from "react";

import { requestTranslation } from "@/lib/api-client";
import {
  addVocabularyItem,
  getSettings,
  getVocabularyByText,
  updateVocabularyItem,
} from "@/lib/db";
import { Alert, Button, Field, TextInput } from "@/components/ui";
import type { Song, VocabularyItem } from "@/types";

export interface VocabularyPopoverProps {
  /** The selected word or phrase, punctuation already trimmed. */
  text: string;
  /** The lines it came from, passed to DeepL as unbilled context. */
  context: string;
  song: Song;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Collects one word or phrase into the vocabulary list.
 *
 * Centred as a dialog rather than floated beside the selection: a popover
 * anchored to a word near the edge of a narrow screen has nowhere to go, and
 * this avoids measuring and re-measuring positions.
 */
export function VocabularyPopover({
  text,
  context,
  song,
  onClose,
  onSaved,
}: VocabularyPopoverProps) {
  const [loading, setLoading] = useState(true);
  const [existing, setExisting] = useState<VocabularyItem | undefined>();
  const [translation, setTranslation] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const matches = await getVocabularyByText(text);
        if (cancelled) return;

        // Only an entry in the language this song is being read in counts as a
        // duplicate; the same word saved into another language is its own entry.
        const found = matches.find(
          (item) => item.targetLanguage === song.targetLanguage,
        );
        if (found) {
          setExisting(found);
          setTranslation(found.translatedText);
          setNotice("You saved this already. Editing the saved entry.");
          return;
        }

        const settings = await getSettings();
        if (cancelled) return;

        if (!settings.deeplApiKey) {
          setNotice(
            "No DeepL API key yet, so there is nothing to translate with. You can still type a translation yourself.",
          );
          return;
        }

        const result = await requestTranslation({
          text: [text],
          targetLang: song.targetLanguage,
          // A word on its own is ambiguous; the surrounding lines usually
          // resolve it, and context is not billed.
          context,
          apiKey: settings.deeplApiKey,
          apiPlan: settings.deeplApiPlan,
          ...(song.sourceLanguage === "auto"
            ? {}
            : { sourceLang: song.sourceLanguage }),
        });
        if (cancelled) return;

        setTranslation(result.translations[0] ?? "");
      } catch (caught) {
        if (cancelled) return;
        // A failed lookup is not fatal: the user can still type a translation.
        setError(
          caught instanceof Error
            ? caught.message
            : "Could not translate this word.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [text, context, song.targetLanguage, song.sourceLanguage]);

  useEffect(() => {
    if (!loading) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [loading]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function save() {
    if (!translation.trim()) {
      setError("Add a translation before saving, so the entry is worth having.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (existing) {
        await updateVocabularyItem(existing.id, {
          translatedText: translation,
        });
      } else {
        await addVocabularyItem({
          text,
          translatedText: translation,
          sourceLanguage: song.sourceLanguage,
          targetLanguage: song.targetLanguage,
          songId: song.id,
          songTitle: song.title,
        });
      }
      onSaved();
      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not save this word. Your browser may be blocking storage.",
      );
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 p-4 sm:items-center"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="vocab-popover-title"
        className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-border bg-background p-5 shadow-xl"
      >
        <div className="flex flex-col gap-1">
          <h2 id="vocab-popover-title" className="text-xs text-muted uppercase">
            {existing ? "Edit saved word" : "Save to vocabulary"}
          </h2>
          <p className="text-lg font-medium break-words">{text}</p>
        </div>

        {notice && <Alert tone="info">{notice}</Alert>}
        {error && <Alert tone="error">{error}</Alert>}

        <Field
          label="Translation"
          htmlFor="vocab-translation"
          hint={
            loading
              ? "Asking DeepL…"
              : "Edit it if DeepL picked the wrong sense of the word."
          }
        >
          <TextInput
            id="vocab-translation"
            ref={inputRef}
            value={translation}
            disabled={loading}
            placeholder={loading ? "" : "Type the translation"}
            onChange={(event) => setTranslation(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void save();
              }
            }}
          />
        </Field>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={loading || saving}>
            {saving ? "Saving…" : existing ? "Update" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
