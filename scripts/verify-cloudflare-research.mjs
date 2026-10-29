#!/usr/bin/env node
/* eslint-disable security/detect-non-literal-fs-filename -- Fixed configuration file list. */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { parse } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
const config = { ...process.env };
for (const file of [".env.local", ".env.production", ".dev.vars"])
  if (existsSync(file)) Object.assign(config, parse(readFileSync(file)));
const origin = process.argv[2] || "https://www.clauxen.com";
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(
  config.NEXT_PUBLIC_SUPABASE_URL,
  config.SUPABASE_SERVICE_ROLE_KEY,
  opts,
);
const auth = createClient(
  config.NEXT_PUBLIC_SUPABASE_URL,
  config.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    config.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  opts,
);
let userId, path, headers;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function api(url, body) {
  const response = await fetch(`${origin}${url}`, {
    headers,
    method: body ? "POST" : "GET",
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  const result = await response.json();
  assert(response.ok, `API ${response.status}: ${JSON.stringify(result)}`);
  return result.data;
}
try {
  const email = `research-live-${randomUUID()}@example.test`,
    password = `Res!9${randomUUID()}`;
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  assert.ifError(created.error);
  userId = created.data.user.id;
  const signed = await auth.auth.signInWithPassword({ email, password });
  assert.ifError(signed.error);
  headers = {
    "content-type": "application/json",
    authorization: `Bearer ${signed.data.session.access_token}`,
  };
  const { chat } = await api("/api/v1/chats", {
    title: "Durable research API diagnostic",
  });
  const content =
    "[Deep research]\nResearch Cloudflare Queues delayed delivery. Present exactly three small tasks: find official documentation, verify the delay limit and retention, and write a brief cited comparison. This is a narrow research question; the final report only needs three paragraphs. Use web search to verify the documentation. Present the plan first, then finish the planning response.";
  const response = await fetch(`${origin}/api/v1/chats/${chat.id}/generate`, {
    method: "POST",
    headers,
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
    signal: AbortSignal.timeout(120000),
  });
  assert.equal(response.status, 200);
  const wire = await response.text();
  const events = wire
    .split("\n\n")
    .filter((frame) => frame.startsWith("data: "))
    .map((frame) => {
      try {
        return JSON.parse(frame.slice(6));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  const presented = events.find(
    (event) =>
      event.type === "tool_start" && event.name === "present_research_plan",
  );
  assert(presented, "model presents the native research tool");
  path = `/api/v1/chats/${chat.id}/research/${encodeURIComponent(presented.toolCallId)}`;
  let { plan } = await api(path);
  assert.equal(plan.status, "pending");
  assert.equal(plan.tasks.length, 3);
  console.log(
    JSON.stringify({
      milestone: "plan saved; browser request finished",
      status: plan.status,
      secondsUntilStart: Math.ceil(
        (Date.parse(plan.auto_start_at) - Date.now()) / 1000,
      ),
    }),
  );
  const deadline = Date.parse(plan.auto_start_at);
  // No stream, browser, or client-triggered start remains connected during this wait.
  while (Date.now() < deadline + 2000)
    await sleep(Math.min(10000, deadline + 2000 - Date.now()));
  for (let i = 0; i < 24; i++) {
    ({ plan } = await api(path));
    if (plan.status !== "pending") break;
    await sleep(2500);
  }
  assert(
    ["running", "starting", "complete"].includes(plan.status),
    `server auto-started: ${plan.status}`,
  );
  console.log(
    JSON.stringify({
      milestone: "server auto-started without browser",
      status: plan.status,
      deadlineLagMs: Date.now() - deadline,
    }),
  );
  if (plan.status !== "complete") {
    ({ plan } = await api(path, { action: "pause" }));
    assert.equal(plan.status, "paused");
    await sleep(6000);
    const detail = await api(`${path}?activity=1`);
    assert.equal(detail.plan.status, "paused");
    console.log(
      JSON.stringify({
        milestone: "pause persisted and activity reconnect works",
        hasSavedActivity: !!detail.activity,
      }),
    );
    ({ plan } = await api(path, { action: "resume" }));
    assert.equal(plan.status, "running");
  }
  for (let i = 0; i < 120; i++) {
    const detail = await api(`${path}?activity=1`);
    plan = detail.plan;
    if (i % 6 === 0)
      console.log(
        JSON.stringify({
          milestone: "research progress",
          status: plan.status,
          sources: plan.source_count,
          searchCalls: plan.search_count,
          tasks: plan.task_statuses,
        }),
      );
    if (["complete", "failed", "cancelled"].includes(plan.status)) break;
    await sleep(2500);
  }
  assert.equal(
    plan.status,
    "complete",
    `research finished: ${plan.error || plan.status}`,
  );
  assert(plan.source_count > 0, "actual Context.dev sources recorded");
  assert(plan.search_count > 0, "actual searches ran");
  const detail = await api(`${path}?activity=1`);
  assert(
    detail.activity?.content.length > 100,
    "saved final report available after reconnect",
  );
  let savedReport = null;
  for (let i = 0; i < 30; i++) {
    const ready = await api(path);
    if (ready.reportReady) {
      savedReport = (await api(`${path}/report`)).report;
      break;
    }
    await sleep(2000);
  }
  assert(savedReport, "completed Markdown report saved to private R2");
  assert(savedReport.markdown.length > 100, "entire final report available");
  assert(savedReport.citations.length > 0, "unique cited sources available");
  console.log(
    JSON.stringify({
      milestone: "private R2 report available",
      fileName: savedReport.fileName,
      citations: savedReport.citations.length,
      characters: savedReport.markdown.length,
    }),
  );
  console.log(
    JSON.stringify({
      milestone: "PASS: full durable research flow",
      sources: plan.source_count,
      searchCalls: plan.search_count,
      reportCharacters: detail.activity.content.length,
    }),
  );
} finally {
  if (path && headers) {
    try {
      await api(path, { action: "cancel" });
    } catch {}
  }
  if (userId) {
    const removed = await admin.auth.admin.deleteUser(userId);
    assert.ifError(removed.error);
    console.log("Dedicated research diagnostic identity removed");
  }
}
