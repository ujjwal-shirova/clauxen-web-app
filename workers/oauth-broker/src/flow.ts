import { DurableObject } from "cloudflare:workers";
import type { Pending, Claims, Provider } from "./protocol";

/** One object per random login attempt. Every state transition is atomic. */
export class OAuthFlow extends DurableObject<BrokerEnv> {
  constructor(ctx: DurableObjectState, env: BrokerEnv) {
    super(ctx, env);
    this.ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS flow (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL)");
  }
  async init(pending: Pending): Promise<void> {
    this.ctx.storage.sql.exec("INSERT INTO flow(id,data) VALUES(1,?)", JSON.stringify({ phase: "pending", pending, expires: pending.expires }));
    await this.ctx.storage.setAlarm(pending.expires);
  }
  private read(): Record<string, any> | null {
    const rows = this.ctx.storage.sql.exec<{ data: string }>("SELECT data FROM flow WHERE id=1").toArray();
    if (!rows.length) return null;
    const data = JSON.parse(rows[0].data);
    return data.expires > Date.now() ? data : null;
  }
  private write(data: unknown) { this.ctx.storage.sql.exec("UPDATE flow SET data=? WHERE id=1", JSON.stringify(data)); }
  async take(cookieHash: string): Promise<Pending | null> {
    const data = this.read();
    if (!data || data.phase !== "pending" || data.pending.cookieHash !== cookieHash) return null;
    this.write({ phase: "verifying", provider: data.pending.provider, challenge: data.pending.challenge, expires: data.expires });
    return data.pending;
  }
  async complete(codeHash: string, claims: Claims): Promise<void> {
    const data = this.read();
    if (!data || data.phase !== "verifying") throw new Error("Invalid flow phase");
    this.write({ ...data, phase: "code", codeHash, claims, expires: Math.min(data.expires, Date.now() + 60_000) });
  }
  async exchange(codeHash: string, challenge: string, provider: Provider, tokenHash: string): Promise<boolean> {
    const data = this.read();
    if (!data || data.phase !== "code" || data.codeHash !== codeHash || data.challenge !== challenge || data.provider !== provider) return false;
    this.write({ phase: "token", provider, tokenHash, claims: data.claims, expires: Date.now() + 60_000 });
    return true;
  }
  async userinfo(tokenHash: string, provider: Provider): Promise<Claims | null> {
    const data = this.read();
    return data?.phase === "token" && data.tokenHash === tokenHash && data.provider === provider ? data.claims : null;
  }
  async alarm() { await this.ctx.storage.deleteAll(); }
}
