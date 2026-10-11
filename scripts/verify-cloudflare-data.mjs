#!/usr/bin/env node
// Uses a temporary confirmed fixture account; sends no email and invokes no AI/payment provider.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { parse } from "dotenv";
import { createClient } from "@supabase/supabase-js";

const env = parse(readFileSync(".dev.vars"));
const origin = process.argv[2] || "https://clauxen-app.shirova.workers.dev";
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const auth = createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const email = `cf-migration-${randomUUID()}@example.test`;
const password = `Fixture!9${randomUUID()}`;
let userId, fileId, headers;
async function call(path, method = "GET", body) {
  const response = await fetch(origin + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  const result = await response.json();
  assert(
    response.ok,
    `${path}: ${response.status} ${JSON.stringify(result.error)}`,
  );
  console.log(
    `${method} ${path.replace(/\/[^/]+(?=\/url$)/, "/[fileId]")}: ${response.status}`,
  );
  return result.data;
}
try {
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
  await call("/api/v1/auth/session");
  await call("/api/v1/settings");
  await call("/api/v1/chats", "POST", {
    title: "Cloudflare migration fixture",
  });
  await call("/api/v1/chats");
  const content = "Cloudflare native R2 migration fixture";
  const presign = await call("/api/v1/files/presign", "POST", {
    originalName: "cloudflare-fixture.txt",
    mimeType: "text/plain",
    sizeBytes: content.length,
  });
  fileId = presign.fileId;
  assert.equal(
    new URL(presign.uploadUrl).origin,
    origin,
    "upload uses Cloudflare, independently of Vercel DNS",
  );
  const upload = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: { "content-type": "text/plain" },
    body: content,
  });
  assert.equal(upload.status, 204, await upload.text());
  await call("/api/v1/files/complete", "POST", {
    fileId,
    sizeBytes: content.length,
  });
  const download = await call(`/api/v1/files/${fileId}/url`);
  const downloaded = await fetch(download.downloadUrl ?? download.url);
  assert.equal(downloaded.status, 200);
  assert.equal(await downloaded.text(), content);
  await call(`/api/v1/files/${fileId}`, "DELETE");
  fileId = undefined;
  console.log(
    "Passed authenticated sessions, Hyperdrive reads/writes and native R2 upload/download/delete",
  );
} finally {
  if (fileId && headers)
    await call(`/api/v1/files/${fileId}`, "DELETE").catch(() =>
      console.error("Fixture file cleanup failed"),
    );
  if (userId) {
    const deleted = await admin.auth.admin.deleteUser(userId);
    assert.ifError(deleted.error);
    console.log("Fixture user and cascading records removed");
  }
}
