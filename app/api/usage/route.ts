import { DeeplError, fetchUsage, resolvePlan } from "@/lib/deepl";
import type { ApiErrorBody, UsageResponseBody } from "@/types";

/**
 * Reports how much of the key's monthly character allowance has been used.
 *
 * POST rather than GET, despite being a read: a GET would have to carry the API
 * key in the query string, where it would end up in browser history, proxy logs
 * and server access logs. Request bodies are not logged by default anywhere in
 * that chain.
 */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Request body was not valid JSON.", 400);
  }

  const candidate = (body ?? {}) as Record<string, unknown>;

  if (typeof candidate.apiKey !== "string" || !candidate.apiKey.trim()) {
    return errorResponse("No DeepL API key was supplied.", 400);
  }

  const apiPlan = candidate.apiPlan;
  if (
    apiPlan !== undefined &&
    apiPlan !== "auto" &&
    apiPlan !== "free" &&
    apiPlan !== "pro"
  ) {
    return errorResponse('"apiPlan" must be "auto", "free", or "pro".', 400);
  }

  try {
    const usage = await fetchUsage({
      apiKey: candidate.apiKey,
      plan: resolvePlan(candidate.apiKey, apiPlan),
    });

    const payload: UsageResponseBody = usage;
    return Response.json(payload);
  } catch (error) {
    if (error instanceof DeeplError) {
      return errorResponse(error.message, error.status, error.traceId);
    }

    return errorResponse("Could not reach DeepL.", 502);
  }
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
