import { DurableObject } from "cloudflare:workers";

export interface Env {
  CHAT_COORD: DurableObjectNamespace<ChatCoord>;
  CHAT_COORD_INTERNAL_TOKEN?: string;
}

type LeaseState = {
  leaseId: string;
  startedAt: number;
  stopRequested: boolean;
};

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

  async acquire(leaseId: string): Promise<{ ok: true } | { ok: false; reason: string }> {
    const current = await this.readState();
    if (current && current.leaseId !== leaseId && !current.stopRequested) {
      // Stale leases older than 35 minutes are reclaimable (maxDuration + buffer).
      if (Date.now() - current.startedAt < 35 * 60_000) {
        return { ok: false, reason: "generation_in_progress" };
      }
    }
    await this.writeState({
      leaseId,
      startedAt: Date.now(),
      stopRequested: false,
    });
    // Auto-release if the holder never calls release (crash / timeout).
    await this.ctx.storage.setAlarm(Date.now() + 35 * 60_000);
    return { ok: true };
  }

  async release(leaseId: string): Promise<{ released: boolean }> {
    const current = await this.readState();
    if (!current || current.leaseId !== leaseId) {
      return { released: false };
    }
    await this.writeState(null);
    await this.ctx.storage.deleteAlarm();
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
    if (!current) {
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

  async alarm(): Promise<void> {
    await this.writeState(null);
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

    if (url.pathname === "/stop") {
      const result = await stub.requestStop();
      return json(result);
    }

    if (url.pathname === "/status") {
      const result = await stub.status();
      return json(result);
    }

    return json({ error: "not_found" }, 404);
  },
};
