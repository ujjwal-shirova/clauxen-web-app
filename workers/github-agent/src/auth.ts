import { combineChunks, stringFromBase64URL } from "@supabase/ssr";
import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
import { HttpError } from "./security";
export function cookies(request: Request) {
  return new Map(
    (request.headers.get("cookie") ?? "").split(";").map((p) => {
      const i = p.indexOf("=");
      return [p.slice(0, i).trim(), p.slice(i + 1)];
    }),
  );
}
export async function requireUser(request: Request, env: GithubAgentEnv) {
  const cookie = cookies(request);
  let token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) {
    const key = `sb-${new URL(env.SUPABASE_URL).hostname.split(".")[0]}-auth-token`;
    const raw = await combineChunks(key, (n) => cookie.get(n) ?? null);
    if (raw) {
      try {
        token = JSON.parse(
          raw.startsWith("base64-") ? stringFromBase64URL(raw.slice(7)) : raw,
        ).access_token;
      } catch {
        /* invalid session */
      }
    }
  }
  if (token) {
    try {
      const issuer = env.SUPABASE_URL.replace(/\/$/, "") + "/auth/v1";
      const { payload } = await jwtVerify(
        token,
        createRemoteJWKSet(new URL(issuer + "/.well-known/jwks.json")),
        {
          issuer,
          audience: "authenticated",
          algorithms: ["ES256", "RS256"],
          requiredClaims: ["sub", "exp"],
        },
      );
      if (
        payload.role !== "authenticated" ||
        payload.is_anonymous === true ||
        !payload.sub
      )
        throw new Error("invalid");
      return payload.sub;
    } catch {
      throw new HttpError(401, "Sign in to Clauxen to connect GitHub.");
    }
  }
  const bridge = cookie.get("__Host-clauxen-github");
  if (bridge) {
    try {
      const { payload } = await jwtVerify(
        bridge,
        Buffer.from(env.SEAL_KEY, "base64"),
        {
          issuer: "clauxen-github-agent",
          audience: "github-connect",
          algorithms: ["HS256"],
          requiredClaims: ["sub", "exp"],
        },
      );
      if (payload.sub) return payload.sub;
    } catch {
      /* expired bridge */
    }
  }
  throw new HttpError(401, "Sign in to Clauxen to connect GitHub.");
}
export async function bridgeCookie(userId: string, env: GithubAgentEnv) {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer("clauxen-github-agent")
    .setAudience("github-connect")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(Buffer.from(env.SEAL_KEY, "base64"));
  return `__Host-clauxen-github=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=300`;
}
export function sameOrigin(request: Request, env: GithubAgentEnv) {
  const origin = request.headers.get("origin");
  if (origin && origin !== env.APP_ORIGIN)
    throw new HttpError(403, "Cross-origin request rejected.");
  if (request.headers.get("sec-fetch-site") === "cross-site")
    throw new HttpError(403, "Cross-site request rejected.");
}
