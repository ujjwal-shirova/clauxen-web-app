-- MCP gallery plugins: store per-user installs, original MCP tool names,
-- and a stable lookup from ChatGPT plugin IDs onto connector_catalog.

alter table public.connector_catalog
  add column if not exists mcp_url text;

alter table public.connector_catalog
  drop constraint if exists connector_catalog_mcp_url_check;

alter table public.connector_catalog
  add constraint connector_catalog_mcp_url_check
  check (mcp_url is null or mcp_url ~ '^https://');

create unique index if not exists connector_catalog_plugin_id_uidx
on public.connector_catalog ((metadata->>'pluginId'))
where metadata ? 'pluginId';

create index if not exists connector_catalog_mcp_url_idx
on public.connector_catalog (mcp_url)
where mcp_url is not null;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'connector_tools'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%name ~%'
  loop
    execute format(
      'alter table public.connector_tools drop constraint if exists %I',
      constraint_name
    );
  end loop;
end
$$;

alter table public.connector_tools
  drop constraint if exists connector_tools_name_format_check;

alter table public.connector_tools
  add constraint connector_tools_name_format_check
  check (name ~ '^[a-z][a-z0-9_]{1,79}$');

comment on column public.connector_catalog.mcp_url is
  'Streamable HTTP MCP endpoint for gallery plugins. Tokens stay in private.connector_credentials.';
