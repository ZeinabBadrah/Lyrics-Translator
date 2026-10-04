import { DeeplError, resolvePlan, translateTexts } from "@/lib/deepl";
import type {
  ApiErrorBody,
  TranslateRequestBody,
  TranslateResponseBody,
} from "@/types";

/**
 * Relays a translation request to DeepL.
 *
 * This route exists for exactly one reason: DeepL's API sends no CORS headers,
 * so a browser cannot call it directly. Everything else about the app is
 * client-side.
 *
 * The API key arrives in the request body and is forwarded to DeepL. It is
 * never read from the server's own environment, never written anywhere, and
 * never logged — including in error paths, which is why failures report DeepL's
 * message and trace id rather than echoing the request.
 */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Request body was not valid JSON.", 400);
  }

  const parsed = parseBody(body);
  if ("error" in parsed) {
    return errorResponse(parsed.error, 400);
  }

  try {
    const result = await translateTexts({
      texts: parsed.value.text,
      targetLang: parsed.value.targetLang,
      sourceLang: parsed.value.sourceLang,
      context: parsed.value.context,
      apiKey: parsed.value.apiKey,
      plan: resolvePlan(parsed.value.apiKey, parsed.value.apiPlan),
    });

    const payload: TranslateResponseBody = result;
    return Response.json(payload);
  } catch (error) {
    if (error instanceof DeeplError) {
      return errorResponse(error.message, error.status, error.traceId);
    }

    return errorResponse(
      "Could not reach DeepL. Check your network connection and try again.",
      502,
    );
  }
}

function parseBody(
  body: unknown,
): { value: TranslateRequestBody } | { error: string } {
  if (typeof body !== "object" || body === null) {
    return { error: "Request body must be a JSON object." };
  }

  const candidate = body as Record<string, unknown>;

  if (
    !Array.isArray(candidate.text) ||
    !candidate.text.every((line) => typeof line === "string")
  ) {
    return { error: '"text" must be an array of strings.' };
  }

  if (candidate.text.length === 0) {
    return { error: '"text" must contain at least one line.' };
  }

  if (typeof candidate.targetLang !== "string" || !candidate.targetLang) {
    return { error: '"targetLang" is required.' };
  }

  if (typeof candidate.apiKey !== "string" || !candidate.apiKey.trim()) {
    return {
      error:
        "No DeepL API key was supplied. Add one on the Settings page — the app has no key of its own.",
    };
  }

  if (
    candidate.apiPlan !== undefined &&
    candidate.apiPlan !== "auto" &&
    candidate.apiPlan !== "free" &&
    candidate.apiPlan !== "pro"
  ) {
    return { error: '"apiPlan" must be "auto", "free", or "pro".' };
  }

  return {
    value: {
      text: candidate.text,
      targetLang: candidate.targetLang,
      sourceLang:
        typeof candidate.sourceLang === "string"
          ? candidate.sourceLang
          : undefined,
      context:
        typeof candidate.context === "string" ? candidate.context : undefined,
      apiKey: candidate.apiKey,
      apiPlan: candidate.apiPlan,
    },
  };
}

function errorResponse(
  message: string,
  status: number,
  traceId?: string,
): Response {
  const payload: ApiErrorBody = traceId
    ? { error: message, traceId }
    : { error: message };

  return Response.json(payload, { status });
}
