// @vitest-environment node
// Runs in Node rather than jsdom: this module only ever executes on the server,
// and it needs the real fetch/Response implementations.
import { describe, expect, it, vi } from "vitest";

import {
  DeeplError,
  FREE_API_BASE,
  MAX_TEXTS_PER_REQUEST,
  PRO_API_BASE,
  apiBaseForPlan,
  batchTexts,
  detectPlanFromKey,
  fetchUsage,
  resolvePlan,
  translateTexts,
} from "@/lib/deepl";

describe("detectPlanFromKey", () => {
  it("treats a key ending in :fx as Free", () => {
    expect(detectPlanFromKey("abc-123:fx")).toBe("free");
  });

  it("treats any other key as Pro", () => {
    expect(detectPlanFromKey("abc-123")).toBe("pro");
  });

  it("ignores surrounding whitespace from a careless paste", () => {
    expect(detectPlanFromKey("  abc-123:fx \n")).toBe("free");
  });
});

describe("resolvePlan", () => {
  it("detects the plan when the setting is auto", () => {
    expect(resolvePlan("abc:fx", "auto")).toBe("free");
  });

  it("defaults to detecting when no setting is given", () => {
    expect(resolvePlan("abc")).toBe("pro");
  });

  it("lets an explicit setting override detection", () => {
    expect(resolvePlan("abc:fx", "pro")).toBe("pro");
    expect(resolvePlan("abc", "free")).toBe("free");
  });
});

describe("apiBaseForPlan", () => {
  it("maps each plan to its own hostname", () => {
    expect(apiBaseForPlan("free")).toBe(FREE_API_BASE);
    expect(apiBaseForPlan("pro")).toBe(PRO_API_BASE);
  });
});

describe("batchTexts", () => {
  it("keeps everything in one batch when it fits", () => {
    expect(batchTexts(["one", "two", "three"])).toEqual([
      ["one", "two", "three"],
    ]);
  });

  it("splits once the byte budget is reached", () => {
    const batches = batchTexts(["aaaa", "bbbb", "cccc"], 8);

    expect(batches).toEqual([["aaaa", "bbbb"], ["cccc"]]);
  });

  it("splits once the per-batch count is reached", () => {
    const lines = Array.from({ length: 5 }, (_, index) => `line ${index}`);

    const batches = batchTexts(lines, 10_000, 2);

    expect(batches).toEqual([
      ["line 0", "line 1"],
      ["line 2", "line 3"],
      ["line 4"],
    ]);
  });

  it("preserves the original order across batches", () => {
    const lines = Array.from({ length: 10 }, (_, index) => `line ${index}`);

    expect(batchTexts(lines, 10_000, 3).flat()).toEqual(lines);
  });

  it("measures bytes rather than characters", () => {
    // Each emoji is four UTF-8 bytes, so two of them already exceed a budget
    // that would comfortably fit two ASCII characters.
    const batches = batchTexts(["😀", "😀"], 5);

    expect(batches).toHaveLength(2);
  });

  it("gives an oversized single line its own batch instead of dropping it", () => {
    const huge = "x".repeat(50);

    const batches = batchTexts(["small", huge, "small"], 10);

    expect(batches).toEqual([["small"], [huge], ["small"]]);
  });

  it("returns no batches for no input", () => {
    expect(batchTexts([])).toEqual([]);
  });
});

/** Builds a fetch stand-in that replies with the given DeepL payloads in turn. */
function stubFetch(
  responses: Array<{ status?: number; body: unknown; headers?: HeadersInit }>,
) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];

  const impl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const next = responses[calls.length - 1];
    return new Response(JSON.stringify(next.body), {
      status: next.status ?? 200,
      headers: { "Content-Type": "application/json", ...next.headers },
    });
  });

  return { impl: impl as unknown as typeof fetch, calls };
}

describe("translateTexts", () => {
  it("returns translations in order and reports the detected language", async () => {
    const { impl, calls } = stubFetch([
      {
        body: {
          translations: [
            { text: "eine erfundene Zeile", detected_source_language: "EN" },
            { text: "eine zweite Zeile", detected_source_language: "EN" },
          ],
        },
      },
    ]);

    const result = await translateTexts({
      texts: ["an invented line", "a second line"],
      targetLang: "DE",
      apiKey: "key:fx",
      plan: "free",
      fetchImpl: impl,
    });

    expect(result.translations).toEqual([
      "eine erfundene Zeile",
      "eine zweite Zeile",
    ]);
    expect(result.detectedSourceLanguage).toBe("EN");
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`${FREE_API_BASE}/v2/translate`);
  });

  it("sends the key in an Authorization header, never in the URL", async () => {
    const { impl, calls } = stubFetch([
      { body: { translations: [{ text: "x" }] } },
    ]);

    await translateTexts({
      texts: ["one"],
      targetLang: "DE",
      apiKey: "secret-key:fx",
      plan: "free",
      fetchImpl: impl,
    });

    const headers = calls[0].init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("DeepL-Auth-Key secret-key:fx");
    expect(calls[0].url).not.toContain("secret-key");
  });

  it("stitches multiple batches back into a single ordered list", async () => {
    // Long enough to cross MAX_TEXTS_PER_REQUEST and force three requests, so
    // this exercises the real batching rather than a test-only threshold.
    const lineCount = MAX_TEXTS_PER_REQUEST * 2 + 7;
    const lines = Array.from({ length: lineCount }, (_, i) => `line ${i}`);
    const expected = lines.map((_, i) => `Zeile ${i}`);

    const batchSizes = [
      MAX_TEXTS_PER_REQUEST,
      MAX_TEXTS_PER_REQUEST,
      lineCount - MAX_TEXTS_PER_REQUEST * 2,
    ];
    let offset = 0;
    const responses = batchSizes.map((size) => {
      const slice = expected.slice(offset, offset + size);
      offset += size;
      return { body: { translations: slice.map((text) => ({ text })) } };
    });

    const { impl, calls } = stubFetch(responses);

    const result = await translateTexts({
      texts: lines,
      targetLang: "DE",
      apiKey: "key",
      plan: "pro",
      fetchImpl: impl,
    });

    expect(calls).toHaveLength(3);
    expect(result.translations).toEqual(expected);
  });

  it("omits source_lang when the source is auto", async () => {
    const { impl, calls } = stubFetch([
      { body: { translations: [{ text: "x" }] } },
    ]);

    await translateTexts({
      texts: ["one"],
      targetLang: "DE",
      sourceLang: "auto",
      apiKey: "key",
      plan: "pro",
      fetchImpl: impl,
    });

    const body = JSON.parse(String(calls[0].init?.body));
    expect(body.source_lang).toBeUndefined();
    expect(body.target_lang).toBe("DE");
  });

  it("passes a context string through to DeepL", async () => {
    const { impl, calls } = stubFetch([
      { body: { translations: [{ text: "x" }] } },
    ]);

    await translateTexts({
      texts: ["one"],
      targetLang: "DE",
      context: "surrounding invented lines",
      apiKey: "key",
      plan: "pro",
      fetchImpl: impl,
    });

    const body = JSON.parse(String(calls[0].init?.body));
    expect(body.context).toBe("surrounding invented lines");
  });

  it("makes no request at all for an empty list", async () => {
    const { impl, calls } = stubFetch([]);

    const result = await translateTexts({
      texts: [],
      targetLang: "DE",
      apiKey: "key",
      plan: "pro",
      fetchImpl: impl,
    });

    expect(result.translations).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it("explains a rejected key rather than surfacing a status code", async () => {
    const { impl } = stubFetch([
      { status: 403, body: { message: "Authorization failure" } },
    ]);

    await expect(
      translateTexts({
        texts: ["one"],
        targetLang: "DE",
        apiKey: "wrong",
        plan: "pro",
        fetchImpl: impl,
      }),
    ).rejects.toThrow(/rejected the API key/);
  });

  it("explains an exhausted quota", async () => {
    const { impl } = stubFetch([{ status: 456, body: { message: "Quota" } }]);

    await expect(
      translateTexts({
        texts: ["one"],
        targetLang: "DE",
        apiKey: "key",
        plan: "pro",
        fetchImpl: impl,
      }),
    ).rejects.toThrow(/quota for the current billing period is used up/);
  });

  it("includes DeepL's own message for a bad request", async () => {
    const { impl } = stubFetch([
      { status: 400, body: { message: "target_lang not supported" } },
    ]);

    await expect(
      translateTexts({
        texts: ["one"],
        targetLang: "XX",
        apiKey: "key",
        plan: "pro",
        fetchImpl: impl,
      }),
    ).rejects.toThrow(/target_lang not supported/);
  });

  it("carries DeepL's trace id on the error", async () => {
    const { impl } = stubFetch([
      {
        status: 429,
        body: { message: "Too many requests" },
        headers: { "X-Trace-ID": "trace-abc" },
      },
    ]);

    const error = await translateTexts({
      texts: ["one"],
      targetLang: "DE",
      apiKey: "key",
      plan: "pro",
      fetchImpl: impl,
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(DeeplError);
    expect((error as DeeplError).traceId).toBe("trace-abc");
    expect((error as DeeplError).status).toBe(429);
  });

  it("rejects a response that is not shaped like a DeepL reply", async () => {
    const { impl } = stubFetch([{ body: { unexpected: true } }]);

    await expect(
      translateTexts({
        texts: ["one"],
        targetLang: "DE",
        apiKey: "key",
        plan: "pro",
        fetchImpl: impl,
      }),
    ).rejects.toThrow(/unexpected shape/);
  });
});

describe("fetchUsage", () => {
  it("maps DeepL's snake_case fields to the app's shape", async () => {
    const { impl, calls } = stubFetch([
      { body: { character_count: 1234, character_limit: 500_000 } },
    ]);

    const usage = await fetchUsage({
      apiKey: "key:fx",
      plan: "free",
      fetchImpl: impl,
    });

    expect(usage).toEqual({
      characterCount: 1234,
      characterLimit: 500_000,
      unlimited: false,
    });
    expect(calls[0].url).toBe(`${FREE_API_BASE}/v2/usage`);
  });

  it("recognises DeepL's sentinel for an unlimited account", async () => {
    const { impl } = stubFetch([
      { body: { character_count: 10, character_limit: 1_000_000_000_000 } },
    ]);

    const usage = await fetchUsage({
      apiKey: "key",
      plan: "pro",
      fetchImpl: impl,
    });

    expect(usage.unlimited).toBe(true);
  });

  it("reports a rejected key", async () => {
    const { impl } = stubFetch([{ status: 403, body: {} }]);

    await expect(
      fetchUsage({ apiKey: "wrong", plan: "pro", fetchImpl: impl }),
    ).rejects.toThrow(/rejected the API key/);
  });
});
