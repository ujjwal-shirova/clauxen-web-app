#!/usr/bin/env node
/* eslint-disable security/detect-non-literal-fs-filename -- Paths come from a fixed local configuration list. */
// Real API smoke test. Uses a dedicated fixture identity; prints no credentials.
import assert from "node:assert/strict";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { parse } from "dotenv";
import { createClient } from "@supabase/supabase-js";

const config = { ...process.env };
for (const file of [".env.local", ".env.production", ".dev.vars"])
  if (existsSync(file)) Object.assign(config, parse(readFileSync(file)));
const origin = process.argv[2] || "https://clauxen-app.shirova.workers.dev";
const disconnect = process.argv.includes("--disconnect");
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(
  config.NEXT_PUBLIC_SUPABASE_URL,
  config.SUPABASE_SERVICE_ROLE_KEY,
  options,
);
const auth = createClient(
  config.NEXT_PUBLIC_SUPABASE_URL,
  config.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    config.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  options,
);
let userId;
try {
  const email = `latency-${randomUUID()}@example.test`;
  const password = `Lat!9${randomUUID()}`;
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  assert.ifError(created.error);
  userId = created.data.user.id;
  const signed = await auth.auth.signInWithPassword({ email, password });
  assert.ifError(signed.error);
  const headers = {
    "content-type": "application/json",
    authorization: `Bearer ${signed.data.session.access_token}`,
  };
  const chatResponse = await fetch(`${origin}/api/v1/chats`, {
    method: "POST",
    headers,
    body: JSON.stringify({ title: "API latency diagnostic" }),
    signal: AbortSignal.timeout(30_000),
  });
  assert.equal(chatResponse.status, 201, "fixture chat creation");
  const {
    data: { chat },
  } = await chatResponse.json();
  const content = "Reply with exactly OK. Do not call tools.";
  const started = Date.now();
  const response = await fetch(`${origin}/api/v1/chats/${chat.id}/generate`, {
    method: "POST",
    headers,
    signal: AbortSignal.timeout(90_000),
    body: JSON.stringify({
      messages: [{ role: "user", content }],
      chatModel: "virgil",
      extendedThinking: false,
      generateChatTitle: false,
      turn: {
        content,
        userClientId: `usr-${randomUUID()}`,
        assistantClientId: `asst-${randomUUID()}`,
      },
    }),
  });
  const results = {
    origin,
    status: response.status,
    headersMs: Date.now() - started,
    serverTiming: response.headers.get("server-timing"),
    jobId: response.headers.get("x-generation-job-id"),
    firstContentMs: null,
    eventTypes: [],
    answer: "",
    disconnected: false,
  };
  console.log(
    JSON.stringify({
      status: results.status,
      headersMs: results.headersMs,
      serverTiming: results.serverTiming,
    }),
  );
  assert.equal(response.status, 200, "foreground must start directly");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (disconnect) {
      await reader.cancel();
      results.disconnected = true;
      break;
    }
    pending += decoder.decode(value, { stream: true });
    let boundary;
    while ((boundary = pending.indexOf("\n\n")) >= 0) {
      const frame = pending.slice(0, boundary);
      pending = pending.slice(boundary + 2);
      const data = frame
        .split("\n")
        .find((line) => line.startsWith("data: "))
        ?.slice(6);
      if (!data || data === "[DONE]") continue;
      const event = JSON.parse(data);
      if (!results.eventTypes.includes(event.type))
        results.eventTypes.push(event.type);
      if (
        [
          "answer_delta",
          "text_delta",
          "narration_delta",
          "thinking_delta",
        ].includes(event.type) &&
        results.firstContentMs === null
      )
        results.firstContentMs = Date.now() - started;
      if (event.type === "answer_delta")
        results.answer += event.delta ?? event.text ?? "";
      if (event.type === "answer_finalize")
        results.answer = event.text ?? results.answer;
      if (event.type === "error")
        throw new Error(`Generation error: ${event.error ?? event.message}`);
    }
  }
  results.totalMs = Date.now() - started;
  assert(
    disconnect || results.firstContentMs !== null,
    "provider content arrives in direct stream",
  );
  for (let attempt = 0; attempt < 45; attempt++) {
    const status = await fetch(
      `${origin}/api/v1/chats/${chat.id}/generate/status`,
      { headers, signal: AbortSignal.timeout(15_000) },
    );
    assert.equal(status.status, 200);
    const { data } = await status.json();
    if (!data.active) {
      results.settled = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  assert(results.settled, "durable job settles");
  const history = await fetch(`${origin}/api/v1/chats/${chat.id}/messages`, {
    headers,
  });
  const { data } = await history.json();
  assert(
    data.messages.some(
      (message) =>
        message.role === "assistant" && message.content?.includes("OK"),
    ),
    "answer is saved",
  );
  writeFileSync(
    "tmp/cloudflare-chat-check.json",
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results));
} finally {
  if (userId) {
    const removed = await admin.auth.admin.deleteUser(userId);
    assert.ifError(removed.error);
    console.log("Dedicated diagnostic identity removed");
  }
}
