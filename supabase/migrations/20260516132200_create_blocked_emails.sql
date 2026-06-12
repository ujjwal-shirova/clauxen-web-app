-- =============================================================================
-- Migration: 20260516132200_create_blocked_emails
-- Purpose: Store disposable/blocked email domains for signup verification.
--          Domains are seeded from src/backend/email-verifier/disposable.txt.
-- Prerequisites:
--   - Seed script scripts/seed-blocked-email-domains.ts (run after apply).
-- Apply-time behavior:
--   - Creates public."blocked-emails" (quoted identifier preserves hyphen).
--   - Enables RLS; revokes client roles; grants SELECT to service_role only.
-- Security / RLS:
--   - RLS enabled with no permissive policies: anon/authenticated cannot read.
--   - Backend signup flow queries via service_role to reject blocked domains.
-- Rollback guidance:
--   - DROP TABLE public."blocked-emails";
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Table: blocked-emails
-- -----------------------------------------------------------------------------
create table if not exists public."blocked-emails" (
  domain text primary key
);

comment on table public."blocked-emails" is
  'Disposable, temporary, and blocked email domains loaded from src/backend/email-verifier/disposable.txt.';

comment on column public."blocked-emails".domain is
  'Email domain portion after @ that should not be allowed during account creation.';

-- -----------------------------------------------------------------------------
-- Access control: backend-only reads
-- -----------------------------------------------------------------------------
alter table public."blocked-emails" enable row level security;

revoke all on table public."blocked-emails" from anon;
revoke all on table public."blocked-emails" from authenticated;

grant select on table public."blocked-emails" to service_role;
