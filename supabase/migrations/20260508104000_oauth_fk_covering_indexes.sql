-- =============================================================================
-- Migration: 20260508104000_oauth_fk_covering_indexes
-- Purpose: Add non-partial btree indexes on oauth_* FK columns so Postgres can
--          efficiently maintain referential integrity on all rows (not only
--          "active" subsets covered by partial indexes elsewhere).
-- Prerequisites:
--   - public.oauth_authorization_codes, oauth_device_codes exist.
-- Apply-time behavior:
--   - CREATE INDEX IF NOT EXISTS on oauth_client_id for both tables.
-- Security / RLS:
--   - Index-only change; no grant or policy changes.
-- Rollback guidance:
--   - DROP INDEX oauth_authorization_codes_client_idx, oauth_device_codes_client_idx.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- FK covering indexes (Performance Advisor)
-- Partial "active token" indexes remain for hot lookups; these satisfy FK scans.
-- -----------------------------------------------------------------------------
create index if not exists oauth_authorization_codes_client_idx
on public.oauth_authorization_codes (oauth_client_id);

create index if not exists oauth_device_codes_client_idx
on public.oauth_device_codes (oauth_client_id);
