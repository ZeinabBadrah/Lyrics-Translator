/**
 * Server-side DeepL client.
 *
 * This module only ever runs inside a Route Handler, because DeepL's API sends
 * no CORS headers and so cannot be called from a browser.
 *
 * It must never log, store, or otherwise retain an API key. Keys arrive in a
 * request body, are forwarded to DeepL, and are forgotten.
 */
import type { DeeplApiPlan, DeeplApiPlanSetting } from "@/types";

export const FREE_API_BASE = "https://api-free.deepl.com";
export const PRO_API_BASE = "https://api.deepl.com";

/** DeepL's documented limit on total request size. */
export const MAX_REQUEST_BYTES = 128 * 1024;

/**
 * How many bytes of lyrics we allow per request. Well under the real limit,
 * leaving room for the JSON envelope, the language parameters, and the context
 * string — none of which we want to have to measure precisely.
 */
export const REQUEST_BYTE_BUDGET = 96 * 1024;

/**
 * A belt-and-braces cap on lines per request. DeepL used to document a limit of
 * 50 texts and no longer does, but batching small keeps one failure from taking
 * a whole song down with it.
 */
export const MAX_TEXTS_PER_REQUEST = 50;

/**
 * How much surrounding text to send as context. Context is not billed against
 * the character quota, but it does count towards the request size, so it is
 * capped rather than unbounded. A whole song fits comfortably.
 */
export const MAX_CONTEXT_CHARS = 5000;

export class DeeplError extends Error {
  readonly status: number;
  readonly traceId?: string;

  constructor(message: string, status: number, traceId?: string) {
    super(message);
    this.name = "DeeplError";
    this.status = status;
    this.traceId = traceId;
  }
}

/**
 * Free API keys end in `:fx`; Pro keys do not. This is a documented property of
 * the key format, which is why the Settings page can default to detecting it.
 */
export function detectPlanFromKey(apiKey: string): DeeplApiPlan {
  return apiKey.trim().endsWith(":fx") ? "free" : "pro";
}

export function resolvePlan(
  apiKey: string,
  setting: DeeplApiPlanSetting = "auto",
): DeeplApiPlan {
  return setting === "auto" ? detectPlanFromKey(apiKey) : setting;
}

export function apiBaseForPlan(plan: DeeplApiPlan): string {
  return plan === "free" ? FREE_API_BASE : PRO_API_BASE;
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

/**
 * Splits lines into request-sized batches, preserving order.
 *
 * A single line longer than the whole budget gets its own batch rather than
 * being silently dropped or truncated: DeepL will reject it with a message
 * naming the real problem, which is more useful than us guessing.
 */
export function batchTexts(
  texts: string[],
  byteBudget = REQUEST_BYTE_BUDGET,
  maxPerBatch = MAX_TEXTS_PER_REQUEST,
): string[][] {
  const batches: string[][] = [];
  let current: string[] = [];
  let currentBytes = 0;

  for (const text of texts) {
    const bytes = byteLength(text);
    const wouldExceedBudget = current.length > 0 && currentBytes + bytes > byteBudget;
    const wouldExceedCount = current.length >= maxPerBatch;

    if (wouldExceedBudget || wouldExceedCount) {
      batches.push(current);
      current = [];
      currentBytes = 0;
    }

    current.push(text);
    currentBytes += bytes;
  }

  if (current.length > 0) {
    batches.push(current);
  }

  return batches;
}

/** Turns a DeepL HTTP failure into something worth showing a user. */
async function toDeeplError(response: Response): Promise<DeeplError> {
  const traceId = response.headers.get("X-Trace-ID") ?? undefined;

  let detail = "";
  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object" && "message" in body) {
      detail = String((body as { message: unknown }).message);
    }
  } catch {
    // DeepL does not always return JSON; the status code alone is enough.
  }

  const message = (() => {
    switch (response.status) {
      case 401:
      case 403:
        return "DeepL rejected the API key. Check it was copied in full, and that the Free/Pro setting matches the key.";
      case 404:
        return "DeepL could not find that endpoint. This usually means a Free key is being sent to the Pro API, or the other way round.";
      case 413:
        return "That request was too large for DeepL. Try translating fewer lines at once.";
      case 429:
        return "DeepL is rate-limiting the request. Wait a few seconds and try again.";
      case 456:
        return "This key's DeepL character quota for the current billing period is used up.";
      case 400:
        return detail
          ? `DeepL rejected the request: ${detail}`
          : "DeepL rejected the request. The language pair may not be supported.";
      case 500:
      case 502:
      case 503:
      case 504:
      case 529:
        return "DeepL is temporarily unavailable. Try again in a moment.";
      default:
        return detail || `DeepL returned an unexpected error (${response.status}).`;
    }
  })();

  return new DeeplError(message, response.status, traceId);
}

interface DeeplTranslateResponse {
  translations: Array<{ text: string; detected_source_language?: string }>;
}

export interface TranslateOptions {
  texts: string[];
  targetLang: string;
  /** Omit, or pass "auto", to let DeepL detect the source language. */
  sourceLang?: string;
  context?: string;
  apiKey: string;
  plan: DeeplApiPlan;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
}

export interface TranslateResult {
  translations: string[];
  detectedSourceLanguage?: string;
}

/**
 * Translates lines in as few requests as the size limit allows, returning them
 * in the original order.
 *
 * Batches run sequentially rather than in parallel. Lyrics are short enough
 * that it rarely costs more than one round trip, and it avoids tripping DeepL's
 * rate limiter on a long song.
 */
export async function translateTexts({
  texts,
  targetLang,
  sourceLang,
  context,
  apiKey,
  plan,
  fetchImpl = fetch,
}: TranslateOptions): Promise<TranslateResult> {
  if (texts.length === 0) {
    return { translations: [] };
  }

  const endpoint = `${apiBaseForPlan(plan)}/v2/translate`;
  const translations: string[] = [];
  let detectedSourceLanguage: string | undefined;

  for (const batch of batchTexts(texts)) {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: batch,
        target_lang: targetLang,
        // DeepL detects the source language when the parameter is absent.
        ...(sourceLang && sourceLang !== "auto"
          ? { source_lang: sourceLang }
          : {}),
        ...(context ? { context: context.slice(0, MAX_CONTEXT_CHARS) } : {}),
      }),
    });

    if (!response.ok) {
      throw await toDeeplError(response);
    }

    const payload = (await response.json()) as DeeplTranslateResponse;
    if (!Array.isArray(payload.translations)) {
      throw new DeeplError(
        "DeepL returned a response in an unexpected shape.",
        502,
      );
    }

    for (const translation of payload.translations) {
      translations.push(translation.text);
      detectedSourceLanguage ??= translation.detected_source_language;
    }
  }

  return detectedSourceLanguage
    ? { translations, detectedSourceLanguage }
    : { translations };
}

interface DeeplUsageResponse {
  character_count: number;
  character_limit: number;
}

/**
 * DeepL reports this value as the character limit for accounts that have none,
 * so it has to be special-cased rather than shown to the user.
 */
const UNLIMITED_SENTINEL = 1_000_000_000_000;

export async function fetchUsage({
  apiKey,
  plan,
  fetchImpl = fetch,
}: {
  apiKey: string;
  plan: DeeplApiPlan;
  fetchImpl?: typeof fetch;
}): Promise<{
  characterCount: number;
  characterLimit: number;
  unlimited: boolean;
}> {
  const response = await fetchImpl(`${apiBaseForPlan(plan)}/v2/usage`, {
    method: "GET",
    headers: { Authorization: `DeepL-Auth-Key ${apiKey}` },
  });

  if (!response.ok) {
    throw await toDeeplError(response);
  }

  const payload = (await response.json()) as DeeplUsageResponse;

  return {
    characterCount: payload.character_count,
    characterLimit: payload.character_limit,
    unlimited: payload.character_limit >= UNLIMITED_SENTINEL,
  };
}
