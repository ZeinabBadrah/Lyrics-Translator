/**
 * Browser-side wrappers around this app's own API routes.
 *
 * Centralised so that every caller gets the same error handling: a failed
 * request throws an Error whose message is already fit to show a user, because
 * the routes return human-readable messages rather than status codes alone.
 */
import type {
  ApiErrorBody,
  Settings,
  TranslateRequestBody,
  TranslateResponseBody,
  UsageResponseBody,
} from "@/types";

async function postJson<TResponse>(
  path: string,
  body: unknown,
): Promise<TResponse> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(
      "Could not reach the app's server. Check your connection and try again.",
    );
  }

  if (!response.ok) {
    const fallback = `Request failed (${response.status}).`;
    let message = fallback;
    try {
      const payload = (await response.json()) as ApiErrorBody;
      message = payload.error || fallback;
    } catch {
      // Keep the fallback; an unparseable error body is not worth reporting.
    }
    throw new Error(message);
  }

  return (await response.json()) as TResponse;
}

export function requestTranslation(
  body: TranslateRequestBody,
): Promise<TranslateResponseBody> {
  return postJson<TranslateResponseBody>("/api/translate", body);
}

export function requestUsage(
  apiKey: string,
  apiPlan: Settings["deeplApiPlan"],
): Promise<UsageResponseBody> {
  return postJson<UsageResponseBody>("/api/usage", { apiKey, apiPlan });
}
