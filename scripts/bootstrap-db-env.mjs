#!/usr/bin/env node
/** Sets DATABASE_URL from Vercel Supabase POSTGRES_* vars before Prisma/Next build. */
const blank = (v) => !v?.trim() || /^YOUR_|change-me/i.test(v);
const url =
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL;
if (!blank(url) && blank(process.env.DATABASE_URL)) {
  process.env.DATABASE_URL = url.trim();
}
