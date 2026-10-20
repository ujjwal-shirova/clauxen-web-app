-- Machine-only, read-only identity resolution for the first-party OAuth broker.
-- No Auth users, identities, sessions or policies are modified.
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'clauxen_oauth_reader') THEN
    CREATE ROLE clauxen_oauth_reader NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END $$;
GRANT clauxen_oauth_reader TO postgres WITH SET TRUE;
CREATE SCHEMA IF NOT EXISTS clauxen_auth;
REVOKE ALL ON SCHEMA clauxen_auth FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA clauxen_auth TO clauxen_oauth_reader;

-- SECURITY DEFINER is needed only to read the managed Auth tables with RLS.
-- The caller gets no direct access to those tables or to this private schema
-- over the Data API. The Worker calls this only after verifying provider OAuth.
CREATE OR REPLACE FUNCTION clauxen_auth.resolve_oauth_identity(p_provider text, p_subject text)
RETURNS TABLE(email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT u.email::text
  FROM auth.identities AS i
  JOIN auth.users AS u ON u.id = i.user_id
  WHERE p_provider IN ('github', 'gitlab')
    AND i.provider_id = p_subject
    AND i.provider IN (p_provider, 'custom:clauxen-' || p_provider)
  GROUP BY u.id, u.email
  LIMIT 2
$$;
REVOKE ALL ON FUNCTION clauxen_auth.resolve_oauth_identity(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION clauxen_auth.resolve_oauth_identity(text, text) TO clauxen_oauth_reader;
