#!/usr/bin/env node
import pg from "pg";
import { loadEnv } from "./load-env.mjs";

loadEnv();

const url = process.env.COCKROACH_DATABASE_URL?.trim();
if (!url) {
  console.error("COCKROACH_DATABASE_URL is required.");
  process.exit(1);
}

/** Keep in sync with src/lib/plans-catalog.ts */
const YEARLY_DISCOUNT = 0.2;
const yearlyFromMonthly = (monthlyPaise) =>
  Math.round(monthlyPaise * 12 * (1 - YEARLY_DISCOUNT));

const plans = [
  {
    id: "go",
    name: "go",
    display_name: "Go",
    monthly: 9900,
    yearly: yearlyFromMonthly(9900),
    tokens: 50_000,
  },
  {
    id: "plus",
    name: "plus",
    display_name: "Plus",
    monthly: 199900,
    yearly: yearlyFromMonthly(199900),
    tokens: 500_000,
  },
  {
    id: "pro",
    name: "pro",
    display_name: "Pro",
    monthly: 499900,
    yearly: yearlyFromMonthly(499900),
    tokens: 1_000_000,
  },
  {
    id: "max5x",
    name: "max5x",
    display_name: "Max 5x",
    monthly: 999900,
    yearly: 0,
    tokens: 2_000_000,
  },
  {
    id: "max20x",
    name: "max20x",
    display_name: "Max 20x",
    monthly: 1999900,
    yearly: 0,
    tokens: 4_000_000,
  },
  {
    id: "business-workspace",
    name: "business-workspace",
    display_name: "Business workspace",
    monthly: 180000,
    yearly: yearlyFromMonthly(180000),
    tokens: 1_000_000,
  },
];

const pool = new pg.Pool({
  connectionString: url,
  ssl: url.includes("sslmode=disable") ? false : { rejectUnauthorized: false },
});

for (const plan of plans) {
  await pool.query(
    `insert into public.plans (id, name, display_name, price_paise_monthly, price_paise_yearly, token_grant, is_active)
     values ($1, $2, $3, $4, $5, $6, true)
     on conflict (id) do update set
       display_name = excluded.display_name,
       price_paise_monthly = excluded.price_paise_monthly,
       price_paise_yearly = excluded.price_paise_yearly,
       token_grant = excluded.token_grant,
       is_active = true`,
    [
      plan.id,
      plan.name,
      plan.display_name,
      plan.monthly,
      plan.yearly,
      plan.tokens,
    ],
  );
  console.log(`Seeded plan: ${plan.id}`);
}

await pool.end();
