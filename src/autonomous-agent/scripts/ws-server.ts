/**
 * Standalone WebSocket server for the autonomous agent.
 * Run: npm run autonomous-agent:ws
 */
import { WebSocketServer, type WebSocket } from "ws";
import { autonomousAgentConfig, resolveAutonomousAgentModel } from "@/autonomous-agent/server/config";
import {
  appendUserMessage,
  createConversation,
  getConversation,
} from "@/autonomous-agent/server/store/conversation-store";
import {
  getEventsSinceIndex,
  getLatestRunForConversation,
} from "@/autonomous-agent/server/store/event-log";
import { runConversationTurn } from "@/autonomous-agent/server/stream/conversation-turn";
import { createSnapshotEvent } from "@/autonomous-agent/server/stream/transport";
import type { StreamClientMessage } from "@/autonomous-agent/types/conversation";
import { stamp } from "@/autonomous-agent/types/events";

const port = autonomousAgentConfig.wsPort;
const { model, baseUrl } = resolveAutonomousAgentModel();

const wss = new WebSocketServer({ port });

function sendJson(ws: WebSocket, data: unknown) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function createWsSink(ws: WebSocket) {
  return {
    send(event: Parameters<typeof JSON.stringify>[0]) {
      sendJson(ws, event);
    },
    isOpen() {
      return ws.readyState === ws.OPEN;
    },
  };
}

async function replayEvents(
  ws: WebSocket,
  conversationId: string,
  fromIndex: number,
) {
  const latestRun = getLatestRunForConversation(conversationId);
  if (!latestRun) return;
  const replay = getEventsSinceIndex(latestRun.runId, fromIndex);
  if (replay.length > 0) {
    sendJson(
      ws,
      createSnapshotEvent(conversationId, latestRun.runId, replay),
    );
  }
}

wss.on("connection", (ws) => {
  ws.on("message", async (raw) => {
    let msg: StreamClientMessage;
    try {
      msg = JSON.parse(raw.toString()) as StreamClientMessage;
    } catch {
      sendJson(
        ws,
        stamp({
          type: "RunError",
          conversationId: "unknown",
          message: "Invalid message JSON",
        }),
      );
      return;
    }

    if (msg.type === "subscribe") {
      await replayEvents(ws, msg.conversationId, msg.lastEventIndex ?? 0);
      return;
    }

    if (msg.type === "resume") {
      await replayEvents(ws, msg.conversationId, 0);
      return;
    }

    if (msg.type === "user_message") {
      let conversationId = msg.conversationId;
      if (!conversationId || !getConversation(conversationId)) {
        const created = createConversation();
        conversationId = created.id;
        sendJson(ws, { type: "conversation_created", conversationId });
      }

      const conv = getConversation(conversationId);
      if (conv?.status === "running") {
        sendJson(
          ws,
          stamp({
            type: "RunError",
            conversationId,
            message: "Run already in progress",
          }),
        );
        return;
      }

      appendUserMessage(conversationId, msg.content);
      const sink = createWsSink(ws);

      try {
        await runConversationTurn(conversationId, sink, { model, baseUrl });
      } catch (err) {
        sendJson(
          ws,
          stamp({
            type: "RunError",
            conversationId,
            message: err instanceof Error ? err.message : String(err),
          }),
        );
      }
    }
  });
});

console.log(`Autonomous agent WebSocket server listening on ws://localhost:${port}`);
