"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import {
  Alert,
  Button,
  Field,
  PageHeading,
  Select,
  TextArea,
  TextInput,
} from "@/components/ui";
import { requestTranslation } from "@/lib/api-client";
import { getSettings, getSongByTitle, saveSong } from "@/lib/db";
import { MAX_CONTEXT_CHARS } from "@/lib/deepl";
import { AUTO_DETECT, SOURCE_LANGUAGES, TARGET_LANGUAGES } from "@/lib/languages";
import { zipLines } from "@/lib/lyrics";
import {
  normalizeForIndex,
  parseLyricLines,
  translatableLines,
} from "@/lib/text";
import type { Settings, Song } from "@/types";

/** How long to wait after typing before looking a title up in storage. */
const LOOKUP_DEBOUNCE_MS = 300;

export function LyricsInputForm() {
  const router = useRouter();
  const titleId = useId();
  const artistId = useId();
  const lyricsId = useId();
  const sourceId = useId();
  const targetId = useId();

  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState(AUTO_DETECT);
  const [targetLanguage, setTargetLanguage] = useState("DE");

  const [settings, setSettings] = useState<Settings>();
  const [existing, setExisting] = useState<Song>();
  const [translating, setTranslating] = useState(false);
  const [error, setError] = useState<string>();

  // Whether the user has changed the target language themselves. Until they
  // have, it tracks whatever Settings says.
  const targetTouched = useRef(false);

  useEffect(() => {
    let cancelled = false;

    void getSettings()
      .then((loaded) => {
        if (cancelled) return;
        setSettings(loaded);
        if (!targetTouched.current) {
          setTargetLanguage(loaded.defaultTargetLanguage);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(
            "Could not read your settings from this browser's storage. " +
              "Translation needs your DeepL API key, so it will not work until that is fixed.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Look the title up as the user types, so they are told about a song they
  // have already translated before pasting the lyrics again.
  useEffect(() => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      void getSongByTitle(trimmedTitle, artist.trim() || undefined)
        .then((found) => {
          if (!cancelled) setExisting(found);
        })
        .catch(() => {
          // A failed lookup only costs the shortcut; it must not block input.
        });
    }, LOOKUP_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [title, artist]);

  const hasApiKey = Boolean(settings?.deeplApiKey.trim());
  const parsedLines = parseLyricLines(lyrics);
  const lineCount = translatableLines(parsedLines).length;

  /**
   * The looked-up song, but only while it still corresponds to what is typed.
   *
   * Derived rather than cleared in the effect, because the lookup is debounced:
   * for a few hundred milliseconds after an edit, `existing` holds the result
   * for the *previous* title. Acting on that would overwrite the wrong song on
   * save, so the match is re-checked against the current input every render.
   */
  const typedArtist = normalizeForIndex(artist);
  const matched =
    existing &&
    normalizeForIndex(existing.title) === normalizeForIndex(title) &&
    (!typedArtist || normalizeForIndex(existing.artist ?? "") === typedArtist)
      ? existing
      : undefined;

  const geniusSearchUrl = `https://genius.com/search?q=${encodeURIComponent(
    [title.trim(), artist.trim()].filter(Boolean).join(" "),
  )}`;

  async function handleTranslate(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);

    if (!title.trim()) {
      setError("Give the song a title so you can find it again later.");
      return;
    }

    if (lineCount === 0) {
      setError("Paste the lyrics you want translated.");
      return;
    }

    if (!settings || !hasApiKey) {
      setError("Add your DeepL API key in Settings first.");
      return;
    }

    setTranslating(true);
    try {
      const toTranslate = translatableLines(parsedLines);

      const { translations, detectedSourceLanguage } = await requestTranslation({
        text: toTranslate,
        targetLang: targetLanguage,
        sourceLang: sourceLanguage === AUTO_DETECT ? undefined : sourceLanguage,
        // DeepL translates each line independently, so without this a line like
        // "and then she left" has nothing to go on. Context is not billed.
        context: toTranslate.join("\n").slice(0, MAX_CONTEXT_CHARS),
        apiKey: settings.deeplApiKey,
        apiPlan: settings.deeplApiPlan,
      });

      if (translations.length !== toTranslate.length) {
        throw new Error(
          "DeepL returned a different number of lines than were sent. Nothing was saved.",
        );
      }

      const saved = await saveSong({
        // Reusing the id overwrites the previous translation in place, which
        // keeps any vocabulary already collected from this song attached to it.
        id: matched?.id,
        title,
        artist: artist.trim() || undefined,
        sourceLanguage:
          sourceLanguage === AUTO_DETECT
            ? (detectedSourceLanguage ?? AUTO_DETECT)
            : sourceLanguage,
        targetLanguage,
        lines: zipLines(parsedLines, translations),
      });

      router.push(`/song/${saved.id}`);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Something went wrong while translating.",
      );
      setTranslating(false);
    }
  }

  return (
    <form onSubmit={handleTranslate} className="flex flex-col gap-6">
      <PageHeading
        title="Translate a song"
        description="Paste lyrics you already have. Nothing is uploaded anywhere except to DeepL for translation."
      />

      {settings && !hasApiKey && (
        <Alert tone="info">
          You need a DeepL API key before anything can be translated.{" "}
          <Link
            href="/settings"
            className="text-accent underline underline-offset-2"
          >
            Add one in Settings
          </Link>
          . Your lyrics will still be here when you come back if you open that
          in a new tab.
        </Alert>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Song title" htmlFor={titleId}>
          <TextInput
            id={titleId}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Morgenlicht"
            autoComplete="off"
          />
        </Field>

        <Field label="Artist" htmlFor={artistId} hint="Optional.">
          <TextInput
            id={artistId}
            value={artist}
            onChange={(event) => setArtist(event.target.value)}
            autoComplete="off"
          />
        </Field>
      </div>

      {matched && (
        <Alert tone="info">
          You have already translated <strong>{matched.title}</strong>
          {matched.artist ? ` by ${matched.artist}` : ""}.{" "}
          <Link
            href={`/song/${matched.id}`}
            className="text-accent underline underline-offset-2"
          >
            Open it
          </Link>
          , or paste the lyrics again below to replace it.
        </Alert>
      )}

      <Field
        label="Lyrics"
        htmlFor={lyricsId}
        hint={
          <>
            One line per lyric line. Blank lines are kept as verse breaks.
            {lineCount > 0 && ` ${lineCount} line${lineCount === 1 ? "" : "s"} to translate.`}
            {title.trim() && (
              <>
                {" "}
                <a
                  href={geniusSearchUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent underline underline-offset-2"
                >
                  Find lyrics on Genius
                </a>{" "}
                to copy yourself.
              </>
            )}
          </>
        }
      >
        <TextArea
          id={lyricsId}
          value={lyrics}
          onChange={(event) => setLyrics(event.target.value)}
          rows={12}
          spellCheck={false}
          placeholder={"Paste the lyrics here,\none line at a time."}
          className="font-mono"
        />
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field
          label="Lyrics are in"
          htmlFor={sourceId}
          hint="DeepL is good at working this out."
        >
          <Select
            id={sourceId}
            value={sourceLanguage}
            onChange={(event) => setSourceLanguage(event.target.value)}
          >
            <option value={AUTO_DETECT}>Auto-detect</option>
            {SOURCE_LANGUAGES.map((language) => (
              <option key={language.code} value={language.code}>
                {language.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Translate into"
          htmlFor={targetId}
          hint={
            <>
              Defaults to your choice in{" "}
              <Link
                href="/settings"
                className="text-accent underline underline-offset-2"
              >
                Settings
              </Link>
              .
            </>
          }
        >
          <Select
            id={targetId}
            value={targetLanguage}
            onChange={(event) => {
              targetTouched.current = true;
              setTargetLanguage(event.target.value);
            }}
          >
            {TARGET_LANGUAGES.map((language) => (
              <option key={language.code} value={language.code}>
                {language.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <div>
        <Button type="submit" disabled={translating || !hasApiKey}>
          {translating ? "Translating…" : "Translate"}
        </Button>
      </div>
    </form>
  );
}

