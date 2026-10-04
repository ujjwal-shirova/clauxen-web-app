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

/** Default request budget — a hung request must surface as an error, never an infinite spinner. */
const DEFAULT_TIMEOUT_MS = 60_000;

let refreshInflight: Promise<boolean> | null = null;

/**
 * Refresh the browser Supabase session once for all concurrent callers.
 * The server verifies JWTs locally and never refreshes, so an expired access
 * token yields 401 and the browser (which owns the refresh token) rotates it.
 */
export function refreshBrowserSessionSingleflight(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (!refreshInflight) {
    refreshInflight = (async () => {
      try {
        const { createClient } = await import("@/utils/supabase/client");
        const { data, error } = await createClient().auth.refreshSession();
        if (error || !data.session) return false;
        const { clearSupabaseAccessTokenSingleflight } = await import(
          "@/lib/supabase-session-singleflight"
        );
        clearSupabaseAccessTokenSingleflight();
        return true;
      } catch {
        return false;
      } finally {
        setTimeout(() => {
          refreshInflight = null;
        }, 0);
      }
    })();
  }
  return refreshInflight;
}

function withTimeout(init: RequestInit, timeoutMs: number): RequestInit {
  const timeout = AbortSignal.timeout(timeoutMs);
  return {
    ...init,
    signal: init.signal ? AbortSignal.any([init.signal, timeout]) : timeout,
  };
}

/**
 * Browser API fetch. Retries once on Vercel challenge HTML so a transient
 * checkpoint does not tear down in-app settings/chat, and once on 401 after a
 * session refresh.
 */
export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...rest } = init ?? {};
  const requestInit: RequestInit = {
    ...rest,
    credentials: "include",
    headers: {
      // Let the browser set the multipart boundary for FormData bodies.
      ...(rest.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      Accept: "application/json",
      ...(rest.headers ?? {}),
    },
  };

  let response = await fetch(path, withTimeout(requestInit, timeoutMs));
  let bodyText = await response.text();

  if (looksLikeSecurityChallenge(response, bodyText)) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    response = await fetch(path, withTimeout(requestInit, timeoutMs));
    bodyText = await response.text();
  }

  if (response.status === 401 && (await refreshBrowserSessionSingleflight())) {
    response = await fetch(path, withTimeout(requestInit, timeoutMs));
    bodyText = await response.text();
  }

  return parseApiPayload<T>(response, bodyText);
}
