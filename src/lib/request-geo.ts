/** Two-letter ISO 3166-1 alpha-2 country code from edge/CDN request headers. */
export function resolveRequestCountryCode(
  headers: Headers | { get(name: string): string | null },
): string | undefined {
  const raw =
    headers.get("x-vercel-ip-country") ??
    headers.get("cf-ipcountry") ??
    headers.get("x-country-code");

  if (!raw) return undefined;

  const code = raw.trim().toUpperCase().slice(0, 2);
  return /^[A-Z]{2}$/.test(code) ? code : undefined;
}
