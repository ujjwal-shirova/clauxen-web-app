#!/usr/bin/env node
/**
 * Smoke-test Razorpay UPI QR Codes API (create → fetch → close).
 * Loads .env.local; never prints secrets.
 *
 * Usage: node scripts/ops/smoke-razorpay-upi-qr.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env) || !process.env[key]) {
      process.env[key] = val;
    }
  }
}

loadEnvLocal();

const keyId = process.env.RAZORPAY_KEY_ID || "";
const keySecret = process.env.RAZORPAY_KEY_SECRET || "";

if (!keyId || !keySecret) {
  console.error(
    "FAIL: RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET missing in env or .env.local",
  );
  process.exit(1);
}

if (!keyId.startsWith("rzp_live_") && !keyId.startsWith("rzp_test_")) {
  console.error("FAIL: RAZORPAY_KEY_ID does not look like a Razorpay key id");
  process.exit(1);
}

console.log(
  `Using key ${keyId.slice(0, 12)}… (mode=${keyId.startsWith("rzp_live_") ? "live" : "test"})`,
);

const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
const closeBy = Math.floor(Date.now() / 1000) + 15 * 60;

async function razorpay(path, init) {
  const res = await fetch(`https://api.razorpay.com${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

const { res: createRes, body: created } = await razorpay(
  "/v1/payments/qr_codes",
  {
    method: "POST",
    body: JSON.stringify({
      type: "upi_qr",
      name: "shirova smoke",
      usage: "single_use",
      fixed_amount: true,
      payment_amount: 100,
      description: "UPI QR smoke test — do not pay",
      close_by: closeBy,
      notes: { purpose: "smoke_test" },
    }),
  },
);

if (!createRes.ok) {
  console.error(
    "CREATE_FAIL",
    createRes.status,
    created?.error?.description || created?.error || created,
  );
  process.exit(2);
}

console.log("CREATE_OK", {
  id: created.id,
  status: created.status,
  hasImageUrl: Boolean(created.image_url),
  payment_amount: created.payment_amount,
});

const { res: fetchRes, body: fetched } = await razorpay(
  `/v1/payments/qr_codes/${created.id}`,
  { method: "GET" },
);
console.log("FETCH", fetchRes.status, "status=", fetched.status);

const { res: closeRes, body: closed } = await razorpay(
  `/v1/payments/qr_codes/${created.id}/close`,
  { method: "POST", body: "{}" },
);
console.log(
  "CLOSE",
  closeRes.status,
  "status=",
  closed.status || closed?.error?.description || "ok",
);

if (createRes.ok && fetchRes.ok) {
  console.log("SMOKE_PASS: UPI QR Codes API works on this account");
  process.exit(0);
}

process.exit(3);
