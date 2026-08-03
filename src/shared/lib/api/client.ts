import { looksLikeSecurityChallenge } from "@/lib/security-challenge";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code = "api_error") {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function parseApiPayload<T>(response: Response, bodyText: string): Promise<T> {
  if (looksLikeSecurityChallenge(response, bodyText)) {
    throw new ApiError(
      "Security check in progress. Please retry in a moment.",
      response.status === 200 ? 429 : response.status,
      "security_challenge",
    );
  }

  let payload: {
    data?: T;
    error?: { message?: string; code?: string };
  } = {};
  try {
    payload = bodyText ? (JSON.parse(bodyText) as typeof payload) : {};
  } catch {
    throw new ApiError(
      "Invalid JSON response.",
      response.status,
      "invalid_json",
    );
  }

  if (!response.ok) {
    throw new ApiError(
      payload.error?.message ?? "Request failed.",
      response.status,
      payload.error?.code ?? "api_error",
    );
  }

  if (payload.data === undefined) {
    throw new ApiError("Empty response.", response.status, "empty_response");
  }

  return payload.data;
}

/**
 * Browser API fetch. Retries once on Vercel challenge HTML so a transient
 * checkpoint does not tear down in-app settings/chat.
 */
export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const requestInit: RequestInit = {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  };

  let response = await fetch(path, requestInit);
  let bodyText = await response.text();

  if (looksLikeSecurityChallenge(response, bodyText)) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    response = await fetch(path, requestInit);
    bodyText = await response.text();
  }

  return parseApiPayload<T>(response, bodyText);
}
