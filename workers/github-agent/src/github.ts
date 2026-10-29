import type { Client } from "pg";
import { getApp, type AppConfig, type AppCredentials } from "./database";
import { appJwt, HttpError, seal, unseal, digest } from "./security";
import { changeSchema } from "./contracts";

export async function github<T>(
  path: string,
  token: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  if (!path.startsWith("/") || path.startsWith("//"))
    throw new HttpError(400, "Invalid GitHub API path.");
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2026-03-10",
      "User-Agent": "Clauxen-Agent",
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new HttpError(
      response.status === 401 || response.status === 403
        ? 403
        : response.status === 404
          ? 404
          : response.status === 422
            ? 409
            : 502,
      response.status === 401
        ? "Reconnect your GitHub account."
        : response.status === 403
          ? "GitHub permission denied. Check repository access and organization approval."
          : response.status === 404
            ? "Repository or file unavailable to this connection."
            : "GitHub could not complete this operation. Check the branch and retry.",
    );
  }
  if (response.status === 204) return undefined as T;
  // GitHub JSON responses have bounded page sizes; file contents are size-checked separately.
  return (await response.json()) as T;
}
export type OAuthTokens = {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
};
export async function exchange(
  app: AppConfig & { credentials: AppCredentials },
  args: Record<string, string>,
): Promise<OAuthTokens> {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: app.client_id,
      client_secret: app.credentials.client_secret,
      ...args,
    }),
    signal: AbortSignal.timeout(15000),
  });
  const value = (await response.json()) as OAuthTokens & {
    expires_in?: number;
    error?: string;
  };
  if (!response.ok || value.error || !value.access_token)
    throw new HttpError(401, "GitHub authorization expired. Connect again.");
  return {
    access_token: value.access_token,
    refresh_token: value.refresh_token,
    expires_at: value.expires_in
      ? Date.now() + value.expires_in * 1000
      : undefined,
  };
}
export async function userConnection(
  db: Client,
  env: GithubAgentEnv,
  userId: string,
) {
  // Serialize refresh-token rotation for parallel mobile/web requests.
  await db.query("begin");
  try {
    const row = (
      await db.query<{
        tokens_sealed: string;
        login: string;
        github_user_id: string;
      }>(
        "select tokens_sealed,login,github_user_id::text from private.github_agent_connections where user_id=$1 for update",
        [userId],
      )
    ).rows[0];
    if (!row)
      throw new HttpError(
        409,
        "Connect GitHub at https://www.clauxen.com/github first.",
      );
    let tokens = await unseal<OAuthTokens>(
      env.SEAL_KEY,
      row.tokens_sealed,
      `user:${userId}`,
    );
    if (tokens.expires_at && tokens.expires_at < Date.now() + 60000) {
      if (!tokens.refresh_token)
        throw new HttpError(401, "Reconnect your GitHub account.");
      tokens = await exchange(await getApp(db, env), {
        grant_type: "refresh_token",
        refresh_token: tokens.refresh_token,
      });
      await db.query(
        "update private.github_agent_connections set tokens_sealed=$2,updated_at=now() where user_id=$1",
        [userId, await seal(env.SEAL_KEY, tokens, `user:${userId}`)],
      );
    }
    await db.query("commit");
    return { ...row, token: tokens.access_token };
  } catch (e) {
    await db.query("rollback");
    throw e;
  }
}
type Repository = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  permissions?: { push?: boolean };
  html_url: string;
};
export async function repositories(
  db: Client,
  env: GithubAgentEnv,
  userId: string,
  page: number,
) {
  const user = await userConnection(db, env, userId);
  const installs = await github<{
    installations: {
      id: number;
      account: { login: string };
      suspended_at: string | null;
    }[];
  }>(`/user/installations?per_page=100`, user.token);
  const result = [];
  for (const install of installs.installations
    .filter((i) => !i.suspended_at)
    .slice(0, 20)) {
    const repos = await github<{
      repositories: Repository[];
      total_count: number;
    }>(
      `/user/installations/${install.id}/repositories?per_page=100&page=${page}`,
      user.token,
    );
    result.push({
      installation_id: install.id,
      account: install.account.login,
      total_count: repos.total_count,
      repositories: repos.repositories,
    });
  }
  return { login: user.login, page, installations: result };
}
export async function repositoryAccess(
  db: Client,
  env: GithubAgentEnv,
  userId: string,
  owner: string,
  repo: string,
  write = false,
) {
  const user = await userConnection(db, env, userId);
  const path = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const record = await github<Repository>(path, user.token);
  if (write && !record.permissions?.push)
    throw new HttpError(403, "You need write access to this repository.");
  const app = await getApp(db, env),
    jwt = await appJwt(app.client_id, app.credentials.pem);
  const install = await github<{ id: number; suspended_at: string | null }>(
    `${path}/installation`,
    jwt,
  );
  const revoked = (
    await db.query(
      "select 1 from private.github_agent_installations where installation_id=$1 and (suspended or deleted)",
      [install.id],
    )
  ).rowCount;
  if (install.suspended_at || revoked)
    throw new HttpError(
      403,
      "The GitHub installation is suspended or removed.",
    );
  const access = await github<{ token: string }>(
    `/app/installations/${install.id}/access_tokens`,
    jwt,
    "POST",
    {
      repository_ids: [record.id],
      permissions: {
        contents: write ? "write" : "read",
        ...(write ? { pull_requests: "write" } : {}),
      },
    },
  );
  return { path, record, user, app, token: access.token };
}
export async function readRepository(
  db: Client,
  env: GithubAgentEnv,
  userId: string,
  args: Record<string, unknown>,
) {
  const parsed = changeSchema.pick({ owner: true, repo: true }).parse(args);
  const access = await repositoryAccess(
    db,
    env,
    userId,
    parsed.owner,
    parsed.repo,
  );
  const ref =
    typeof args.ref === "string" ? args.ref : access.record.default_branch;
  if (ref.length > 200) throw new HttpError(400, "Invalid ref.");
  const head = await github<{ sha: string }>(
    `${access.path}/commits/${encodeURIComponent(ref)}`,
    access.token,
  );
  if (!args.path) return { repository: access.record, head_sha: head.sha };
  const file = String(args.path);
  if (
    file.length > 500 ||
    file.startsWith("/") ||
    file.split("/").some((x) => x === ".." || x === ".")
  )
    throw new HttpError(400, "Invalid file path.");
  const value = await github<
    | {
        type: string;
        size: number;
        encoding: string;
        content?: string;
        sha: string;
      }
    | unknown[]
  >(
    `${access.path}/contents/${file.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(head.sha)}`,
    access.token,
  );
  if (Array.isArray(value)) return { head_sha: head.sha, entries: value };
  if (value.size > 200000 || value.encoding !== "base64")
    throw new HttpError(413, "File is too large or is not available as text.");
  return {
    head_sha: head.sha,
    path: file,
    sha: value.sha,
    content: Buffer.from(value.content ?? "", "base64").toString("utf8"),
  };
}
export async function createChange(
  db: Client,
  env: GithubAgentEnv,
  userId: string,
  input: unknown,
) {
  const args = changeSchema.parse(input);
  const access = await repositoryAccess(
    db,
    env,
    userId,
    args.owner,
    args.repo,
    true,
  );
  const branch = `clauxen/${args.request_id}`;
  const fingerprint = digest(JSON.stringify(args));
  const inserted = await db.query(
    `insert into private.github_agent_changes(user_id,request_id,repository,branch,result) values($1,$2,$3,$4,$5)
    on conflict(user_id,request_id) do nothing returning id`,
    [
      userId,
      args.request_id,
      access.record.full_name,
      branch,
      { request_fingerprint: fingerprint },
    ],
  );
  if (!inserted.rowCount) {
    const prior = (
      await db.query(
        "select status,result from private.github_agent_changes where user_id=$1 and request_id=$2",
        [userId, args.request_id],
      )
    ).rows[0];
    if (prior.result?.request_fingerprint !== fingerprint)
      throw new HttpError(
        409,
        "This request ID belongs to a different change.",
      );
    if (prior.status === "complete") {
      const { request_fingerprint: _fingerprint, ...result } = prior.result;
      return result;
    }
    throw new HttpError(
      409,
      "This change is already in progress or needs recovery. Do not repeat it with another request ID.",
    );
  }
  let branchCreated = false;
  try {
    const base = await github<{ object: { sha: string } }>(
      `${access.path}/git/ref/heads/${args.base_branch.split("/").map(encodeURIComponent).join("/")}`,
      access.token,
    );
    if (base.object.sha !== args.expected_head_sha)
      throw new HttpError(
        409,
        "The base branch changed. Read the latest files and prepare the change again.",
      );
    const parent = await github<{ tree: { sha: string } }>(
      `${access.path}/git/commits/${base.object.sha}`,
      access.token,
    );
    const tree = [];
    for (const file of args.files) {
      const blob = await github<{ sha: string }>(
        `${access.path}/git/blobs`,
        access.token,
        "POST",
        { content: file.content, encoding: "utf-8" },
      );
      tree.push({
        path: file.path,
        mode: "100644",
        type: "blob",
        sha: blob.sha,
      });
    }
    const treeObject = await github<{ sha: string }>(
      `${access.path}/git/trees`,
      access.token,
      "POST",
      { base_tree: parent.tree.sha, tree },
    );
    const bot = await github<{ id: number; login: string }>(
      `/users/${encodeURIComponent(access.app.slug + "[bot]")}`,
      access.token,
    );
    const message = `${args.title}\n\nCo-authored-by: ${access.user.login} <${access.user.github_user_id}+${access.user.login}@users.noreply.github.com>`;
    const commit = await github<{ sha: string }>(
      `${access.path}/git/commits`,
      access.token,
      "POST",
      {
        message,
        tree: treeObject.sha,
        parents: [base.object.sha],
        author: {
          name: "Clauxen Agent",
          email: `${bot.id}+${bot.login}@users.noreply.github.com`,
        },
        committer: {
          name: "Clauxen Agent",
          email: `${bot.id}+${bot.login}@users.noreply.github.com`,
        },
      },
    );
    await github(`${access.path}/git/refs`, access.token, "POST", {
      ref: `refs/heads/${branch}`,
      sha: commit.sha,
    });
    branchCreated = true;
    const pr = await github<{ html_url: string; number: number }>(
      `${access.path}/pulls`,
      access.token,
      "POST",
      {
        title: args.title,
        body: args.body,
        head: branch,
        base: args.base_branch,
        draft: true,
      },
    );
    const result = {
      branch,
      commit_sha: commit.sha,
      pull_request_url: pr.html_url,
      pull_request_number: pr.number,
    };
    await db.query(
      `update private.github_agent_changes set status='complete',result=$3 where user_id=$1 and request_id=$2`,
      [
        userId,
        args.request_id,
        { ...result, request_fingerprint: fingerprint },
      ],
    );
    return result;
  } catch (e) {
    await db.query(
      `update private.github_agent_changes set status='failed',result=$3 where user_id=$1 and request_id=$2`,
      [
        userId,
        args.request_id,
        {
          branch,
          branch_created: branchCreated,
          request_fingerprint: fingerprint,
          error:
            e instanceof HttpError
              ? e.message
              : "Operation interrupted; inspect the branch before retrying.",
        },
      ],
    );
    throw e;
  }
}
