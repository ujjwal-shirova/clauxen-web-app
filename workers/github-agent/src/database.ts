import { Client } from "pg";
import { digest, HttpError, randomToken, seal, unseal } from "./security";
export async function withDb<T>(
  env: GithubAgentEnv,
  run: (db: Client) => Promise<T>,
) {
  const db = new Client({
    connectionString: env.HYPERDRIVE.connectionString,
    connectionTimeoutMillis: 8000,
    statement_timeout: 15000,
  });
  await db.connect();
  try {
    return await run(db);
  } finally {
    await db.end();
  }
}
export async function putState(
  db: Client,
  env: GithubAgentEnv,
  purpose: "registration" | "oauth" | "launch",
  user: string | null,
  data: unknown,
) {
  const token = randomToken(),
    hash = digest(token);
  await db.query(
    "delete from private.github_agent_states where expires_at < now()",
  );
  await db.query(
    `insert into private.github_agent_states(hash,purpose,user_id,data_sealed,expires_at) values($1,$2,$3,$4,now()+interval '10 minutes')`,
    [hash, purpose, user, await seal(env.SEAL_KEY, data, `state:${hash}`)],
  );
  return token;
}
export async function takeState<T>(
  db: Client,
  env: GithubAgentEnv,
  token: string,
  purpose: string,
) {
  const hash = digest(token);
  const result = await db.query(
    `delete from private.github_agent_states where hash=$1 and purpose=$2 and expires_at > now() returning user_id,data_sealed`,
    [hash, purpose],
  );
  if (!result.rows[0])
    throw new HttpError(
      400,
      "This connection link expired or was already used. Start again.",
    );
  return {
    userId: result.rows[0].user_id as string | null,
    data: await unseal<T>(
      env.SEAL_KEY,
      result.rows[0].data_sealed,
      `state:${hash}`,
    ),
  };
}
export type AppConfig = {
  app_id: string;
  client_id: string;
  slug: string;
  credentials_sealed: string;
};
export type AppCredentials = {
  pem: string;
  client_secret: string;
  webhook_secret: string;
};
export async function getApp(db: Client, env: GithubAgentEnv) {
  const row = (
    await db.query<AppConfig>(
      "select app_id::text,client_id,slug,credentials_sealed from private.github_agent_app where singleton=true",
    )
  ).rows[0];
  if (!row)
    throw new HttpError(
      503,
      "Clauxen Agent is awaiting GitHub App registration.",
    );
  return {
    ...row,
    credentials: await unseal<AppCredentials>(
      env.SEAL_KEY,
      row.credentials_sealed,
      "app",
    ),
  };
}
