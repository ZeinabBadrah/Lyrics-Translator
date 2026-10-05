/**
 * Turning the vocabulary list into files the user can keep.
 *
 * All the data lives in one browser's IndexedDB, so export is the only way to
 * move it to another device or keep a backup. The serialisers are pure
 * functions, with the browser-only download step kept separate so they can be
 * tested without a DOM.
 */
import type { VocabularyItem } from "@/types";

export const JSON_MIME_TYPE = "application/json";
/** `charset` is explicit because the data is full of non-ASCII letters. */
export const CSV_MIME_TYPE = "text/csv;charset=utf-8";

export const EXPORT_FORMAT_VERSION = 1;

interface ExportedItem {
  id: string;
  text: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  songTitle?: string;
  /** ISO 8601 rather than epoch milliseconds, so the file reads sensibly. */
  createdAt: string;
}

/**
 * `textLower` is deliberately left out: it is an index key derived from `text`,
 * not data in its own right, and exporting it would invite someone to edit the
 * two into disagreement.
 */
function toExportedItem(item: VocabularyItem): ExportedItem {
  return {
    id: item.id,
    text: item.text,
    translatedText: item.translatedText,
    sourceLanguage: item.sourceLanguage,
    targetLanguage: item.targetLanguage,
    ...(item.songTitle ? { songTitle: item.songTitle } : {}),
    createdAt: new Date(item.createdAt).toISOString(),
  };
}

/**
 * The export is wrapped in an envelope rather than being a bare array, so that
 * a future version can recognise the format it is reading. `now` is a parameter
 * so the output can be asserted on in tests.
 */
export function toJson(items: VocabularyItem[], now: Date = new Date()): string {
  return `${JSON.stringify(
    {
      app: "lyrics-translator",
      formatVersion: EXPORT_FORMAT_VERSION,
      exportedAt: now.toISOString(),
      itemCount: items.length,
      items: items.map(toExportedItem),
    },
    null,
    2,
  )}\n`;
}

const CSV_HEADERS = [
  "word",
  "translation",
  "from",
  "to",
  "song",
  "saved at",
] as const;

/**
 * Quotes a CSV field when it has to be, per RFC 4180.
 *
 * A field containing a comma, a double quote or a line break must be wrapped in
 * double quotes, and any double quote inside it doubled. Vocabulary from lyrics
 * contains all three — `don't say "goodbye", love` is one plausible phrase — so
 * joining with commas and hoping would produce a broken file.
 */
export function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsvRow(fields: readonly string[]): string {
  return fields.map(escapeCsvField).join(",");
}

export function toCsv(items: VocabularyItem[]): string {
  const rows = [
    toCsvRow(CSV_HEADERS),
    ...items.map((item) =>
      toCsvRow([
        item.text,
        item.translatedText,
        item.sourceLanguage,
        item.targetLanguage,
        item.songTitle ?? "",
        new Date(item.createdAt).toISOString(),
      ]),
    ),
  ];

  // CRLF is what RFC 4180 specifies, and what spreadsheet software expects.
  // The leading byte-order mark is there for Excel: without it Excel assumes a
  // legacy regional encoding and renders "Testübersetzung" as mojibake.
  return `\uFEFF${rows.join("\r\n")}\r\n`;
}

/** A dated filename, so repeated exports do not overwrite one another. */
export function exportFilename(
  extension: "json" | "csv",
  now: Date = new Date(),
): string {
  const date = now.toISOString().slice(0, 10);
  return `vocabulary-${date}.${extension}`;
}

/**
 * Hands a string to the browser as a file download.
 *
 * There is no way to write a file directly, so the trick is to wrap the text in
 * a Blob, mint a temporary URL pointing at it, and click an anchor carrying the
 * `download` attribute. Nothing is uploaded: the object URL refers to memory in
 * this tab.
 */
export function downloadTextFile(
  filename: string,
  mimeType: string,
  contents: string,
): void {
  const url = URL.createObjectURL(new Blob([contents], { type: mimeType }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;

  // Firefox historically ignored clicks on anchors outside the document.
  document.body.append(anchor);
  anchor.click();
  anchor.remove();

  // Revoking frees the memory, but doing it in the same tick has been known to
  // cancel the download before it starts.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
