import { DurableObject } from "cloudflare:workers";

export interface Env {
  CHAT_COORD: DurableObjectNamespace<ChatCoord>;
  CHAT_COORD_INTERNAL_TOKEN?: string;
  /** Origin that archives a finished live turn into Supabase. */
  APP_ORIGIN?: string;
}

const TURN_ARCHIVE_AFTER_MS = 24 * 60 * 60 * 1000;
const TURN_STALE_MS = 3 * 60 * 1000;

export type LiveTurnStatus = "running" | "complete" | "failed" | "cancelled";

export type LiveTurnRecord = {
  chatId: string;
  userId: string;
  assistantId: string;
  status: LiveTurnStatus;
  answer: string;
  contentJson: unknown;
  updatedAt: number;
  archiveAt: number | null;
};

type LeaseState = {
  leaseId: string;
  startedAt: number;
  expiresAt: number;
  stopRequested: boolean;
};

const LEASE_TTL_MS = 60_000;

export class ChatCoord extends DurableObject<Env> {
  private async readState(): Promise<LeaseState | null> {
    return (await this.ctx.storage.get<LeaseState>("lease")) ?? null;
  }

  private async writeState(state: LeaseState | null): Promise<void> {
    if (!state) {
      await this.ctx.storage.delete("lease");
      return;
    }
    await this.ctx.storage.put("lease", state);
  }

  private async readTurn(): Promise<LiveTurnRecord | null> {
    return (await this.ctx.storage.get<LiveTurnRecord>("turn")) ?? null;
  }

  private async writeTurn(turn: LiveTurnRecord | null): Promise<void> {
    if (!turn) {
      await this.ctx.storage.delete("turn");
      return;
    }
    await this.ctx.storage.put("turn", turn);
  }

  /** Lease expiry and the 24h Supabase archive share one alarm. */
  private async scheduleAlarm(): Promise<void> {
    const times: number[] = [];
    const lease = await this.readState();
    if (lease) {
      times.push(lease.expiresAt ?? lease.startedAt + LEASE_TTL_MS);
    }
    const turn = await this.readTurn();
    if (turn?.status === "running") {
      times.push(Date.now() + 60_000);
    } else if (turn?.archiveAt) {
      times.push(turn.archiveAt);
    }
    if (times.length === 0) {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    await this.ctx.storage.setAlarm(Math.min(...times));
  }

  private async clearLease(): Promise<void> {
    await this.writeState(null);
    await this.scheduleAlarm();
  }

  async acquire(
    leaseId: string,
  ): Promise<{ ok: true } | { ok: false; reason: string }> {
    const current = await this.readState();
    if (current && current.leaseId !== leaseId && !current.stopRequested) {
      // Holders renew while alive. A crashed/timed-out Vercel invocation is
      // reclaimable within one minute instead of blocking the chat for 35m.
      const expiresAt = current.expiresAt ?? current.startedAt + LEASE_TTL_MS;
      if (Date.now() < expiresAt) {
        return { ok: false, reason: "generation_in_progress" };
      }
    }
    const now = Date.now();
    await this.writeState({
      leaseId,
      startedAt: now,
      expiresAt: now + LEASE_TTL_MS,
      stopRequested: false,
    });
    // Auto-release if the holder never calls release (crash / timeout).
    await this.scheduleAlarm();
    return { ok: true };
  }

  async heartbeat(
    leaseId: string,
  ): Promise<{ renewed: boolean; reason?: string }> {
    const current = await this.readState();
    if (!current || current.leaseId !== leaseId) {
      return { renewed: false, reason: "generation_lease_lost" };
    }
    if (current.stopRequested) {
      return { renewed: false, reason: "generation_stop_requested" };
    }
    const expiresAt = Date.now() + LEASE_TTL_MS;
    await this.writeState({ ...current, expiresAt });
    await this.scheduleAlarm();
    return { renewed: true };
  }

  async release(leaseId: string): Promise<{ released: boolean }> {
    const current = await this.readState();
    if (!current || current.leaseId !== leaseId) {
      return { released: false };
    }
    await this.clearLease();
    return { released: true };
  }

  async requestStop(): Promise<{ stopRequested: boolean; hadLease: boolean }> {
    const current = await this.readState();
    if (!current) {
      return { stopRequested: false, hadLease: false };
    }
    await this.writeState({ ...current, stopRequested: true });
    return { stopRequested: true, hadLease: true };
  }

  async status(): Promise<{
    active: boolean;
    stopRequested: boolean;
    leaseId: string | null;
    startedAt: number | null;
  }> {
    const current = await this.readState();
    const expiresAt = current
      ? (current.expiresAt ?? current.startedAt + LEASE_TTL_MS)
      : 0;
    if (!current || Date.now() >= expiresAt) {
      if (current) await this.clearLease();
      return {
        active: false,
        stopRequested: false,
        leaseId: null,
        startedAt: null,
      };
    }
    return {
      active: true,
      stopRequested: current.stopRequested,
      leaseId: current.leaseId,
      startedAt: current.startedAt,
    };
  }

  async putTurn(
    input: Omit<LiveTurnRecord, "updatedAt" | "archiveAt">,
  ): Promise<{ ok: true; archiveAt: number | null }> {
    const now = Date.now();
    const answer = input.answer.slice(0, 120_000);
    const terminal = input.status !== "running";
    const turn: LiveTurnRecord = {
      chatId: input.chatId,
      userId: input.userId,
      assistantId: input.assistantId,
      status: input.status,
      answer,
      contentJson: input.contentJson ?? null,
      updatedAt: now,
      archiveAt: terminal ? now + TURN_ARCHIVE_AFTER_MS : null,
    };
    await this.writeTurn(turn);
    await this.scheduleAlarm();
    return { ok: true, archiveAt: turn.archiveAt };
  }

  async readTurnPublic(): Promise<LiveTurnRecord | null> {
    const turn = await this.readTurn();
    if (!turn) return null;
    if (
      turn.status === "running" &&
      Date.now() - turn.updatedAt > TURN_STALE_MS
    ) {
      const stalled: LiveTurnRecord = {
        ...turn,
        status: "failed",
        archiveAt: Date.now() + TURN_ARCHIVE_AFTER_MS,
        updatedAt: Date.now(),
      };
      await this.writeTurn(stalled);
      await this.scheduleAlarm();
      return stalled;
    }
    return turn;
  }

  private async archiveTurn(turn: LiveTurnRecord): Promise<boolean> {
    const token = this.env.CHAT_COORD_INTERNAL_TOKEN?.trim();
    if (!token) return false;
    const origin = (this.env.APP_ORIGIN?.trim() || "https://www.clauxen.com").replace(
      /\/+$/,
      "",
    );
    try {
      const response = await fetch(
        `${origin}/api/v1/internal/live-turns/archive`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-clauxen-internal": token,
          "user-agent": "ClauxenChatCoord/1.0 (+https://clauxen.com)",
        },
        body: JSON.stringify(turn),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async alarm(): Promise<void> {
    const now = Date.now();
    const lease = await this.readState();
    if (lease) {
      const expiresAt = lease.expiresAt ?? lease.startedAt + LEASE_TTL_MS;
      if (now >= expiresAt) await this.writeState(null);
    }

    const turn = await this.readTurn();
    if (turn?.status === "running" && now - turn.updatedAt > TURN_STALE_MS) {
      await this.writeTurn({
        ...turn,
        status: "failed",
        archiveAt: now + TURN_ARCHIVE_AFTER_MS,
        updatedAt: now,
      });
    }

    const due = await this.readTurn();
    if (
      due &&
      due.status !== "running" &&
      due.archiveAt != null &&
      now >= due.archiveAt
    ) {
      const archived = await this.archiveTurn(due);
      if (archived) {
        await this.writeTurn(null);
      } else {
        await this.writeTurn({
          ...due,
          archiveAt: now + 15 * 60 * 1000,
        });
      }
    }

    await this.scheduleAlarm();
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function unauthorized(): Response {
  return json({ error: "unauthorized" }, 401);
}

function requireInternal(request: Request, env: Env): boolean {
  const token = env.CHAT_COORD_INTERNAL_TOKEN?.trim();
  if (!token) return false;
  return request.headers.get("x-clauxen-internal") === token;
}

function stubId(chatId: string, env: Env) {
  return env.CHAT_COORD.idFromName(chatId);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return json({ ok: true, service: "clauxen-chat-coord" });
    }

    if (!requireInternal(request, env)) {
      return unauthorized();
    }

    if (request.method !== "POST") {
      return json({ error: "method_not_allowed" }, 405);
    }

    let body: {
      chatId?: string;
      leaseId?: string;
      assistantId?: string;
      userId?: string;
      status?: LiveTurnStatus;
      answer?: string;
      contentJson?: unknown;
    } = {};
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return json({ error: "invalid_json" }, 400);
    }

    const chatId = typeof body.chatId === "string" ? body.chatId.trim() : "";
    if (!chatId || chatId.length > 200) {
      return json({ error: "invalid_chat_id" }, 400);
    }

    const stub = env.CHAT_COORD.get(stubId(chatId, env));

    if (url.pathname === "/lease") {
      const leaseId =
        typeof body.leaseId === "string" && body.leaseId.trim()
          ? body.leaseId.trim()
          : "";
      if (!leaseId || leaseId.length > 200) {
        return json({ error: "invalid_lease_id" }, 400);
      }
      const result = await stub.acquire(leaseId);
      if (!result.ok) {
        return json({ error: result.reason, ok: false }, 409);
      }
      return json({ ok: true, leaseId });
    }

    if (url.pathname === "/release") {
      const leaseId =
        typeof body.leaseId === "string" ? body.leaseId.trim() : "";
      if (!leaseId) return json({ error: "invalid_lease_id" }, 400);
      const result = await stub.release(leaseId);
      return json(result);
    }

    if (url.pathname === "/heartbeat") {
      const leaseId =
        typeof body.leaseId === "string" ? body.leaseId.trim() : "";
      if (!leaseId) return json({ error: "invalid_lease_id" }, 400);
      const result = await stub.heartbeat(leaseId);
      return result.renewed
        ? json({ ok: true, renewed: true })
        : json({ ok: false, error: result.reason }, 409);
    }

    if (url.pathname === "/stop") {
      const result = await stub.requestStop();
      return json(result);
    }

    if (url.pathname === "/status") {
      const result = await stub.status();
      return json(result);
    }

    if (url.pathname === "/turn") {
      const snapshot = body as LiveTurnRecord;
      if (
        !snapshot.assistantId ||
        !snapshot.userId ||
        (snapshot.status !== "running" &&
          snapshot.status !== "complete" &&
          snapshot.status !== "failed" &&
          snapshot.status !== "cancelled")
      ) {
        return json({ error: "invalid_turn" }, 400);
      }
      const result = await stub.putTurn({
        ...snapshot,
        chatId,
        answer: typeof snapshot.answer === "string" ? snapshot.answer : "",
      });
      return json(result);
    }

    if (url.pathname === "/turn/read") {
      const turn = await stub.readTurnPublic();
      return json({ ok: true, turn });
    }

    return json({ error: "not_found" }, 404);
  },
};
