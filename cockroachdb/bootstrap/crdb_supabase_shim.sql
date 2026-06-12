-- CockroachDB bootstrap: minimal Supabase-compatible surface so public DDL can apply.
-- Not a full GoTrue/Storage stack — stubs for FK targets, RLS roles, and storage.foldername().
-- Roles must be top-level statements (CRDB: CREATE ROLE inside DO is not supported).

CREATE ROLE IF NOT EXISTS anon NOLOGIN;
CREATE ROLE IF NOT EXISTS authenticated NOLOGIN;
CREATE ROLE IF NOT EXISTS service_role NOLOGIN;
CREATE ROLE IF NOT EXISTS dashboard_user NOLOGIN;
CREATE ROLE IF NOT EXISTS supabase_read_only_user NOLOGIN;

CREATE SCHEMA IF NOT EXISTS extensions;

CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE SQL
STABLE
AS $$
  SELECT NULL::uuid
$$;

CREATE SCHEMA IF NOT EXISTS storage;

CREATE TABLE IF NOT EXISTS storage.buckets (
  id text PRIMARY KEY,
  name text NOT NULL,
  public boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text NOT NULL REFERENCES storage.buckets (id) ON DELETE CASCADE,
  name text NOT NULL,
  owner uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bucket_id, name)
);

CREATE INDEX IF NOT EXISTS storage_objects_bucket_id_idx ON storage.objects (bucket_id);

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION storage.foldername(path text)
RETURNS text[]
LANGUAGE SQL
IMMUTABLE
STRICT
AS $$
  SELECT string_to_array(trim(both '/' FROM path), '/')
$$;
