// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/translate/route";
import type { ApiErrorBody, TranslateResponseBody } from "@/types";

function post(body: unknown): Promise<Response> {
  return POST(
    new Request("http://localhost/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Replies as DeepL would, and records what it was sent. */
function stubDeepl(payload: unknown, status = 200) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify(payload), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );

  return calls;
}

describe("POST /api/translate validation", () => {
  it("rejects a body that is not JSON", async () => {
    const response = await post("not json at all");

    expect(response.status).toBe(400);
    const body = (await response.json()) as ApiErrorBody;
    expect(body.error).toMatch(/not valid JSON/);
  });

  it("rejects a missing text array", async () => {
    const response = await post({ targetLang: "DE", apiKey: "key" });

    expect(response.status).toBe(400);
    const body = (await response.json()) as ApiErrorBody;
    expect(body.error).toMatch(/"text" must be an array/);
  });

  it("rejects an empty text array", async () => {
    const response = await post({ text: [], targetLang: "DE", apiKey: "key" });

    expect(response.status).toBe(400);
  });

  it("rejects non-string entries in text", async () => {
    const response = await post({
      text: ["fine", 42],
      targetLang: "DE",
      apiKey: "key",
    });

    expect(response.status).toBe(400);
  });

  it("rejects a missing target language", async () => {
    const response = await post({ text: ["one"], apiKey: "key" });

    expect(response.status).toBe(400);
    const body = (await response.json()) as ApiErrorBody;
    expect(body.error).toMatch(/targetLang/);
  });

  it("explains that the app has no key of its own when none is sent", async () => {
    const response = await post({ text: ["one"], targetLang: "DE" });

    expect(response.status).toBe(400);
    const body = (await response.json()) as ApiErrorBody;
    expect(body.error).toMatch(/Settings page/);
  });

  it("rejects an unrecognised plan", async () => {
    const response = await post({
      text: ["one"],
      targetLang: "DE",
      apiKey: "key",
      apiPlan: "enterprise",
    });

    expect(response.status).toBe(400);
  });
});

describe("POST /api/translate success path", () => {
  it("returns translations in order", async () => {
    stubDeepl({
      translations: [
        { text: "Zeile eins", detected_source_language: "EN" },
        { text: "Zeile zwei", detected_source_language: "EN" },
      ],
    });

    const response = await post({
      text: ["line one", "line two"],
      targetLang: "DE",
      apiKey: "key:fx",
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as TranslateResponseBody;
    expect(body.translations).toEqual(["Zeile eins", "Zeile zwei"]);
    expect(body.detectedSourceLanguage).toBe("EN");
  });

  it("routes a :fx key to the free endpoint without being told the plan", async () => {
    const calls = stubDeepl({ translations: [{ text: "x" }] });

    await post({ text: ["one"], targetLang: "DE", apiKey: "abc:fx" });

    expect(calls[0].url).toContain("api-free.deepl.com");
  });

  it("routes a key without the :fx suffix to the pro endpoint", async () => {
    const calls = stubDeepl({ translations: [{ text: "x" }] });

    await post({ text: ["one"], targetLang: "DE", apiKey: "abc" });

    expect(calls[0].url).toBe("https://api.deepl.com/v2/translate");
  });

  it("lets an explicit plan override key detection", async () => {
    const calls = stubDeepl({ translations: [{ text: "x" }] });

    await post({
      text: ["one"],
      targetLang: "DE",
      apiKey: "abc:fx",
      apiPlan: "pro",
    });

    expect(calls[0].url).toContain("https://api.deepl.com");
  });

  it("never puts the key in the URL", async () => {
    const calls = stubDeepl({ translations: [{ text: "x" }] });

    await post({ text: ["one"], targetLang: "DE", apiKey: "super-secret:fx" });

    expect(calls[0].url).not.toContain("super-secret");
  });
});

describe("POST /api/translate failure path", () => {
  it("forwards DeepL's status and a readable message", async () => {
    stubDeepl({ message: "Authorization failure" }, 403);

    const response = await post({
      text: ["one"],
      targetLang: "DE",
      apiKey: "wrong",
    });

    expect(response.status).toBe(403);
    const body = (await response.json()) as ApiErrorBody;
    expect(body.error).toMatch(/rejected the API key/);
  });

  it("reports a network failure as a bad gateway rather than crashing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("network down");
      }),
    );

    const response = await post({
      text: ["one"],
      targetLang: "DE",
      apiKey: "key",
    });

    expect(response.status).toBe(502);
    const body = (await response.json()) as ApiErrorBody;
    expect(body.error).toMatch(/Could not reach DeepL/);
  });

  it("does not echo the API key back in an error response", async () => {
    stubDeepl({ message: "Authorization failure" }, 403);

    const response = await post({
      text: ["one"],
      targetLang: "DE",
      apiKey: "super-secret:fx",
    });

    expect(await response.text()).not.toContain("super-secret");
  });
});
