-- =============================================================================
-- Migration: 20260508106000_remove_pgtap_from_production
-- Purpose: Remove pgtap from hosted production; its helper views are visible to
--          API roles via extension-owned grants and are only needed for local DB
--          unit tests.
-- Prerequisites:
--   - pgtap may be installed from local dev or prior advisor cleanup attempts.
-- Apply-time behavior:
--   - DROP EXTENSION pgtap CASCADE; DROP SCHEMA pgtap CASCADE.
-- Security / RLS:
--   - Eliminates test-only schema from production attack surface.
-- Rollback guidance:
--   - CREATE EXTENSION pgtap in a non-production environment only.
-- =============================================================================

drop extension if exists pgtap cascade;

drop schema if exists pgtap cascade;
