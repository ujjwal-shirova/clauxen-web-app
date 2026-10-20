export type Provider = "github" | "gitlab";
export const ORIGIN = "https://auth.clauxen.com";
export const CALLBACK = `${ORIGIN}/auth/v1/callback`;
export const SUPABASE_CALLBACK = "https://ntplcfsbcyhiqklkbldk.supabase.co/auth/v1/callback";
export const customProvider = (provider: Provider) => `custom:clauxen-${provider}`;
export const clientId = (provider: Provider) => `clauxen-${provider}`;
export const enabled = (provider: string | null, providers: string) =>
  (provider === "github" || provider === "gitlab") && providers.split(",").includes(provider);
export const random = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
export const validSecret = (value: string) => /^[A-Za-z0-9_-]{43}$/.test(value);
export async function hash(value: string): Promise<string> {
  return btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
export async function equal(a: string, b: string): Promise<boolean> {
  const ah = await hash(a), bh = await hash(b);
  let difference = 0;
  for (let i = 0; i < ah.length; i++) difference |= ah.charCodeAt(i) ^ bh.charCodeAt(i);
  return difference === 0;
}
export class OAuthError extends Error {
  constructor(readonly status: number, readonly code: string) { super(code); }
}
export function ensure(condition: unknown, status = 400, code = "invalid_request"): asserts condition {
  if (!condition) throw new OAuthError(status, code);
}
export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store, private", "Pragma": "no-cache", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" } });
}
export function redirect(location: URL | string) {
  return new Response(null, { status: 302, headers: { Location: String(location), "Cache-Control": "no-store, private", "Referrer-Policy": "no-referrer" } });
}
export async function boundedText(response: Response | Request, limit = 32_768): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  let bytes = 0, result = "";
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) { await reader.cancel(); throw new OAuthError(413, "payload_too_large"); }
      result += decoder.decode(value, { stream: true });
    }
    return result + decoder.decode();
  } finally { reader.releaseLock(); }
}
export function unique(params: URLSearchParams) {
  for (const key of new Set(params.keys())) ensure(params.getAll(key).length === 1);
}
export interface Claims {
  sub: string; email: string; email_verified: true; name: string;
  preferred_username: string; picture: string; provider_id: string;
}
export interface Pending {
  provider: Provider; state: string; challenge: string; verifier: string;
  cookieHash: string; expires: number;
}
export interface FlowStore {
  init(pending: Pending): Promise<void>;
  take(cookieHash: string): Promise<Pending | null>;
  complete(codeHash: string, claims: Claims): Promise<void>;
  exchange(codeHash: string, challenge: string, provider: Provider, tokenHash: string): Promise<boolean>;
  userinfo(tokenHash: string, provider: Provider): Promise<Claims | null>;
}
