#!/usr/bin/env tsx
/**
 * Seed public."blocked-emails" from src/server/email-verifier/disposable.txt.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run supabase:blocked-emails:seed
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const listPath = path.join(
  repoRoot,
  "src",
  "server",
  "email-verifier",
  "disposable.txt",
);

function loadDomains(): string[] {
  const raw = fs.readFileSync(listPath, "utf8");
  const domains = new Set<string>();
  for (const line of raw.split(/\r?\n/)) {
    const domain = line.trim().toLowerCase();
    if (!domain || domain.startsWith("#")) continue;
    domains.add(domain);
  }
  return [...domains];
}

async function main() {
  const url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceKey) {
    console.error(
      "Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.",
    );
    process.exit(1);
  }

  const domains = loadDomains();
  if (domains.length === 0) {
    console.error(`No domains found in ${listPath}`);
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const batchSize = 500;
  let inserted = 0;
  for (let i = 0; i < domains.length; i += batchSize) {
    const batch = domains.slice(i, i + batchSize).map((domain) => ({ domain }));
    const { error } = await supabase.from("blocked-emails").upsert(batch, {
      onConflict: "domain",
      ignoreDuplicates: false,
    });
    if (error) {
      console.error("Upsert failed:", error.message);
      process.exit(1);
    }
    inserted += batch.length;
  }

  console.log(
    `Seeded ${inserted} blocked domains from src/server/email-verifier/disposable.txt`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
