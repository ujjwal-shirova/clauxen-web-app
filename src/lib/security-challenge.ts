/**
 * Detect Cloudflare / Vercel browser-verification HTML that interrupts
 * normal JSON/SSE API traffic.
 */
export function looksLikeSecurityChallenge(
  response: Response,
  bodyText = "",
): boolean {
  const contentType = response.headers.get("content-type") ?? "";
  const trimmed = bodyText.trimStart();
  const cfMitigated = response.headers.get("cf-mitigated") ?? "";
  return (
    response.status === 403 ||
    response.status === 429 ||
    response.status === 503 ||
    contentType.includes("text/html") ||
    trimmed.startsWith("<!DOCTYPE") ||
    trimmed.startsWith("<html") ||
    /just a moment|checking your browser|cf-browser-verification|challenge-platform|cf-challenge|vercel security checkpoint|vercel-challenge|attention required|enable javascript and cookies/i.test(
      bodyText,
    ) ||
    /challenge|managed_challenge/i.test(cfMitigated)
  );
}

/** True when a generate response is usable SSE, not a challenge page. */
export function isEventStreamResponse(response: Response): boolean {
  const contentType = response.headers.get("content-type") ?? "";
  return contentType.includes("text/event-stream") && response.ok;
}
