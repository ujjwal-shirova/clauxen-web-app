/**
 * RFC 8252 loopback redirect validation for the Clauxen Code CLI.
 * Accepts http://127.0.0.1:<port>/callback and http://[::1]:<port>/callback
 * (and the marker URIs without port stored in oauth_client_redirect_uris).
 */
export function isAllowedLoopbackRedirect(redirectUri: string): boolean {
  let url: URL;
  try {
    url = new URL(redirectUri);
  } catch {
    return false;
  }

  if (url.protocol !== "http:") return false;
  if (url.pathname !== "/callback") return false;
  if (url.search || url.hash) return false;

  const host = url.hostname.toLowerCase();
  if (host === "127.0.0.1" || host === "[::1]" || host === "::1") {
    // Port optional (marker URI) or any ephemeral port.
    return true;
  }
  return false;
}

export function normalizeRedirectUri(redirectUri: string): string {
  return redirectUri.trim();
}
