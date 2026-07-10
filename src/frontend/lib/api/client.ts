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

function looksLikeSecurityChallenge(response: Response, bodyText: string) {
  const contentType = response.headers.get("content-type") ?? "";
  return (
    response.status === 429 ||
    contentType.includes("text/html") ||
    bodyText.trimStart().startsWith("<!DOCTYPE") ||
    bodyText.includes("Vercel Security Checkpoint")
  );
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const bodyText = await response.text();

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
