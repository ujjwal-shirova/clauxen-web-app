import { z } from "zod";
import { manifest } from "./contracts";
import { withDb, getApp, putState, takeState } from "./database";
import {
  HttpError,
  digest,
  equal,
  readBody,
  seal,
  verifyWebhook,
  escapeHtml,
} from "./security";
import { requireUser, bridgeCookie, cookies, sameOrigin } from "./auth";
import { connectionPage, setupPage, page } from "./pages";
import {
  createChange,
  exchange,
  github,
  readRepository,
  repositories,
  type OAuthTokens,
} from "./github";

const json = (data: unknown, status = 200, headers: HeadersInit = {}) =>
  Response.json(
    { data },
    { status, headers: { "Cache-Control": "no-store", ...headers } },
  );
const redirect = (url: string, cookie?: string) =>
  new Response(null, {
    status: 303,
    headers: {
      Location: url,
      "Cache-Control": "no-store",
      ...(cookie ? { "Set-Cookie": cookie } : {}),
    },
  });
const flowCookie = (name: string, value: string) =>
  `__Host-clauxen-github-${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`;
const uuid = z.uuid();

export default {
  async fetch(request: Request, env: GithubAgentEnv): Promise<Response> {
    const url = new URL(request.url),
      path = url.pathname;
    try {
      if (path === "/api/v1/github/health" && request.method === "GET")
        return json({ service: "clauxen-github-agent", ok: true });
      if (request.method === "POST") sameOrigin(request, env);
      if (path === "/github/setup" && request.method === "GET")
        return setupPage();
      if (
        (path === "/github" || path === "/github/") &&
        request.method === "GET"
      )
        return connectionPage();
      if (path === "/github/register" && request.method === "GET") {
        return await withDb(env, async (db) => {
          const state = url.searchParams.get("state") ?? "";
          const valid = await db.query(
            "select 1 from private.github_agent_states where hash=$1 and purpose='registration' and expires_at>now()",
            [digest(state)],
          );
          if (!valid.rowCount)
            throw new HttpError(
              400,
              "Registration link expired. Prepare it again.",
            );
          const form = `<h1>Register Clauxen Agent</h1><p>Owner: <strong>shirova-ai</strong>. Repository contents and pull requests: read and write. Metadata: read only. You choose repositories separately when installing.</p><form method="post" action="https://github.com/organizations/shirova-ai/settings/apps/new?state=${escapeHtml(state)}"><input type="hidden" name="manifest" value="${escapeHtml(JSON.stringify(manifest(env.APP_ORIGIN)))}"><button class="primary" type="submit">Review on GitHub</button></form>`;
          const response = page("Register Clauxen Agent", form);
          response.headers.set(
            "Set-Cookie",
            flowCookie("registration", digest(state)),
          );
          return response;
        });
      }
      if (!path.startsWith("/api/v1/github/"))
        throw new HttpError(404, "Not found.");
      if (
        !(
          await env.RATE_LIMIT.limit({
            key: request.headers.get("cf-connecting-ip") ?? "unknown",
          })
        ).success
      )
        throw new HttpError(429, "Please wait and try again.");
      return await withDb(env, async (db) => {
        if (
          path === "/api/v1/github/manifest/start" &&
          request.method === "POST"
        ) {
          if (
            !equal(
              request.headers.get("authorization") ?? "",
              `Bearer ${env.SETUP_TOKEN}`,
            )
          )
            throw new HttpError(403, "Setup authorization required.");
          if (
            (await db.query("select 1 from private.github_agent_app")).rowCount
          )
            throw new HttpError(409, "Clauxen Agent is already registered.");
          const state = await putState(db, env, "registration", null, {});
          return json(
            {
              review_url: env.APP_ORIGIN + "/github/register?state=" + state,
              registration_url: `https://github.com/organizations/shirova-ai/settings/apps/new?state=${state}`,
              manifest: manifest(env.APP_ORIGIN),
            },
            200,
            { "Set-Cookie": flowCookie("registration", digest(state)) },
          );
        }
        if (
          path === "/api/v1/github/manifest/callback" &&
          request.method === "GET"
        ) {
          const state = url.searchParams.get("state") ?? "",
            code = url.searchParams.get("code") ?? "";
          if (
            !code ||
            !state ||
            !equal(
              cookies(request).get("__Host-clauxen-github-registration") ?? "",
              digest(state),
            )
          )
            throw new HttpError(
              400,
              "Registration browser session did not match. Start again.",
            );
          await takeState(db, env, state, "registration");
          const result = await fetch(
            `https://api.github.com/app-manifests/${encodeURIComponent(code)}/conversions`,
            {
              method: "POST",
              headers: {
                Accept: "application/vnd.github+json",
                "User-Agent": "Clauxen-Agent",
              },
              signal: AbortSignal.timeout(20000),
            },
          );
          const app = (await result.json()) as {
            id: number;
            slug: string;
            client_id: string;
            client_secret: string;
            pem: string;
            webhook_secret: string;
            owner: { login: string };
          };
          if (
            !result.ok ||
            !app.pem ||
            !app.client_secret ||
            !app.webhook_secret
          )
            throw new HttpError(
              502,
              "GitHub App registration could not be completed.",
            );
          if (app.owner?.login?.toLowerCase() !== "shirova-ai")
            throw new HttpError(
              403,
              "The GitHub App must be owned by shirova-ai.",
            );
          await db.query(
            `insert into private.github_agent_app(singleton,app_id,slug,client_id,credentials_sealed) values(true,$1,$2,$3,$4)`,
            [
              app.id,
              app.slug,
              app.client_id,
              await seal(
                env.SEAL_KEY,
                {
                  pem: app.pem,
                  client_secret: app.client_secret,
                  webhook_secret: app.webhook_secret,
                },
                "app",
              ),
            ],
          );
          return page(
            "Clauxen Agent registered",
            `<h1>Clauxen Agent is registered.</h1><p>The GitHub App belongs to Shirova AI. Its credentials are encrypted on the shared backend.</p><a class="button primary" href="/github">Connect your GitHub account</a><a class="button" href="https://github.com/organizations/shirova-ai/settings/apps/${encodeURIComponent(app.slug)}">App settings and logo</a>`,
          );
        }
        if (path === "/api/v1/github/webhook" && request.method === "POST") {
          const app = await getApp(db, env),
            body = await readBody(request, 2 * 1024 * 1024);
          if (
            !(await verifyWebhook(
              app.credentials.webhook_secret,
              body,
              request.headers.get("x-hub-signature-256") ?? "",
            ))
          )
            throw new HttpError(401, "Invalid webhook signature.");
          const delivery = uuid.parse(request.headers.get("x-github-delivery"));
          const event = request.headers.get("x-github-event") ?? "";
          const payload = JSON.parse(body) as {
            action?: string;
            installation?: {
              id: number;
              account: { login: string };
              suspended_at?: string | null;
            };
          };
          await db.query("begin");
          try {
            const fresh = await db.query(
              "insert into private.github_agent_deliveries(delivery_id,event) values($1,$2) on conflict do nothing returning delivery_id",
              [delivery, event],
            );
            if (
              fresh.rowCount &&
              ["installation", "installation_repositories"].includes(event) &&
              payload.installation
            ) {
              const i = payload.installation;
              // Fetch authoritative state instead of trusting delivery order for suspension changes.
              let suspended = !!i.suspended_at,
                deleted = payload.action === "deleted";
              if (!deleted) {
                const { appJwt } = await import("./security");
                try {
                  const live = await github<{ suspended_at: string | null }>(
                    `/app/installations/${i.id}`,
                    await appJwt(app.client_id, app.credentials.pem),
                  );
                  suspended = !!live.suspended_at;
                } catch (e) {
                  if (e instanceof HttpError && e.status === 404)
                    deleted = true;
                  else throw e;
                }
              }
              await db.query(
                `insert into private.github_agent_installations(installation_id,account_login,suspended,deleted) values($1,$2,$3,$4)
        on conflict(installation_id) do update set account_login=excluded.account_login,suspended=excluded.suspended,deleted=excluded.deleted,updated_at=now()`,
                [i.id, i.account.login, suspended, deleted],
              );
            }
            await db.query("commit");
          } catch (e) {
            await db.query("rollback");
            throw e;
          }
          return json({ received: true });
        }
        if (
          path === "/api/v1/github/browser-session" &&
          request.method === "POST"
        ) {
          const { launch } = z
            .object({ launch: z.string().min(20).max(200) })
            .parse(JSON.parse(await readBody(request, 1000)));
          const state = await takeState(db, env, launch, "launch");
          if (!state.userId) throw new HttpError(401, "Invalid launch.");
          return json({ connected: true }, 200, {
            "Set-Cookie": await bridgeCookie(state.userId, env),
          });
        }
        if (
          path === "/api/v1/github/oauth/callback" &&
          request.method === "GET"
        ) {
          const state = url.searchParams.get("state") ?? "",
            code = url.searchParams.get("code") ?? "";
          if (
            !code ||
            !state ||
            !equal(
              cookies(request).get("__Host-clauxen-github-oauth") ?? "",
              digest(state),
            )
          )
            throw new HttpError(
              400,
              "GitHub connection session did not match. Start again.",
            );
          const pending = await takeState<{ verifier: string }>(
            db,
            env,
            state,
            "oauth",
          );
          if (!pending.userId)
            throw new HttpError(401, "Invalid connection session.");
          const app = await getApp(db, env);
          const tokens: OAuthTokens = await exchange(app, {
            code,
            code_verifier: pending.data.verifier,
            redirect_uri: env.APP_ORIGIN + "/api/v1/github/oauth/callback",
          });
          const user = await github<{ id: number; login: string }>(
            "/user",
            tokens.access_token,
          );
          await db.query(
            `insert into private.github_agent_connections(user_id,github_user_id,login,tokens_sealed) values($1,$2,$3,$4)
      on conflict(user_id) do update set github_user_id=excluded.github_user_id,login=excluded.login,tokens_sealed=excluded.tokens_sealed,updated_at=now()`,
            [
              pending.userId,
              user.id,
              user.login,
              await seal(env.SEAL_KEY, tokens, `user:${pending.userId}`),
            ],
          );
          return redirect(
            env.APP_ORIGIN + "/github",
            await bridgeCookie(pending.userId, env),
          );
        }
        let userId: string;
        if (
          path === "/api/v1/github/internal/execute" &&
          request.method === "POST"
        ) {
          if (
            !equal(
              request.headers.get("x-clauxen-internal-token") ?? "",
              env.INTERNAL_TOKEN,
            )
          )
            throw new HttpError(403, "Internal authorization required.");
          const input = z
            .object({
              user_id: uuid,
              operation: z.enum(["repositories", "read", "create_change"]),
              arguments: z.record(z.string(), z.unknown()),
            })
            .parse(JSON.parse(await readBody(request)));
          userId = input.user_id;
          const result =
            input.operation === "repositories"
              ? await repositories(db, env, userId, 1)
              : input.operation === "read"
                ? await readRepository(db, env, userId, input.arguments)
                : await createChange(db, env, userId, input.arguments);
          return json(result);
        }
        userId = await requireUser(request, env);
        if (path === "/api/v1/github/status" && request.method === "GET") {
          const app = (
            await db.query(
              "select slug from private.github_agent_app where singleton",
            )
          ).rows[0];
          const account = (
            await db.query(
              "select login from private.github_agent_connections where user_id=$1",
              [userId],
            )
          ).rows[0];
          return json({
            configured: !!app,
            connected: !!account,
            login: account?.login ?? null,
            install_url: app
              ? `https://github.com/apps/${app.slug}/installations/new`
              : null,
          });
        }
        if (path === "/api/v1/github/launch" && request.method === "POST") {
          const launch = await putState(db, env, "launch", userId, {});
          return json({ url: env.APP_ORIGIN + "/github#launch=" + launch });
        }
        if (
          path === "/api/v1/github/oauth/start" &&
          request.method === "POST"
        ) {
          const app = await getApp(db, env),
            verifier = crypto.randomUUID() + crypto.randomUUID();
          const state = await putState(db, env, "oauth", userId, { verifier });
          const challenge = Buffer.from(
            await crypto.subtle.digest(
              "SHA-256",
              new TextEncoder().encode(verifier),
            ),
          ).toString("base64url");
          const target = new URL("https://github.com/login/oauth/authorize");
          target.search = new URLSearchParams({
            client_id: app.client_id,
            redirect_uri: env.APP_ORIGIN + "/api/v1/github/oauth/callback",
            state,
            code_challenge: challenge,
            code_challenge_method: "S256",
          }).toString();
          return json({ url: target.href }, 200, {
            "Set-Cookie": flowCookie("oauth", digest(state)),
          });
        }
        if (path === "/api/v1/github/repositories" && request.method === "GET")
          return json(
            await repositories(
              db,
              env,
              userId,
              z.coerce
                .number()
                .int()
                .min(1)
                .max(100)
                .parse(url.searchParams.get("page") ?? 1),
            ),
          );
        if (path === "/api/v1/github/read" && request.method === "POST")
          return json(
            await readRepository(
              db,
              env,
              userId,
              JSON.parse(await readBody(request, 5000)),
            ),
          );
        if (path === "/api/v1/github/changes" && request.method === "POST")
          return json(
            await createChange(
              db,
              env,
              userId,
              JSON.parse(await readBody(request)),
            ),
          );
        if (path === "/api/v1/github/disconnect" && request.method === "POST") {
          // Forget the local grant. The GitHub installation remains under the owner's control.
          await db.query(
            "delete from private.github_agent_connections where user_id=$1",
            [userId],
          );
          await db.query(
            "delete from private.github_agent_states where user_id=$1",
            [userId],
          );
          return json({ disconnected: true });
        }
        throw new HttpError(404, "Not found.");
      });
    } catch (e) {
      const status =
        e instanceof HttpError
          ? e.status
          : e instanceof z.ZodError || e instanceof SyntaxError
            ? 400
            : 500;
      const message =
        e instanceof HttpError
          ? e.message
          : status === 400
            ? "Invalid request."
            : "GitHub integration is temporarily unavailable.";
      if (status === 500)
        console.error(
          JSON.stringify({
            service: "clauxen-github-agent",
            event: "request_failed",
            path,
            error_type: e instanceof Error ? e.name : "unknown",
            error_frames: e instanceof Error ? e.stack?.split("\n").slice(1, 5).filter((line) => /^\s+at /.test(line)) : [],
          }),
        );
      return Response.json(
        { error: { code: `github_${status}`, message } },
        { status, headers: { "Cache-Control": "no-store" } },
      );
    }
  },
} satisfies ExportedHandler<GithubAgentEnv>;
