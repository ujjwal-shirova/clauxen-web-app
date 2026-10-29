-- Retire the plugin/connector backend.
--
-- The marketplace is now a static catalog: plugin metadata and icons are
-- served from the app and CDN, with no per-user connections or OAuth tokens.

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.unschedule('clauxen_connector_cost_maintenance');
    exception when others then
      null;
    end;
  end if;
end $$;

drop function if exists private.run_connector_cost_maintenance();
drop function if exists private.claim_connector_oauth_transaction(text, text);
drop function if exists private.acquire_connector_refresh_lease(uuid, uuid, integer);
drop function if exists private.release_connector_refresh_lease(uuid, uuid);

drop function if exists public.plugin_oauth_complete(uuid, text, text, text, text, text, text, text, text[], text, text, text, text, timestamptz, text[]);
drop function if exists public.plugin_oauth_read_refresh(uuid);
drop function if exists public.plugin_oauth_rotate(uuid, text, text, text, timestamptz, text[]);

drop table if exists public.plugin_tool_calls cascade;
drop table if exists public.plugin_connection_capabilities cascade;
drop table if exists public.plugin_connection_tools cascade;
drop table if exists private.plugin_oauth_states cascade;
drop table if exists private.plugin_oauth_clients cascade;
drop table if exists private.plugin_oauth_tokens cascade;
drop table if exists private.plugin_mcp_api_keys cascade;
drop table if exists public.plugin_collections cascade;
drop table if exists public.plugin_connections cascade;

drop table if exists public.connector_action_approvals cascade;
drop table if exists public.connector_audit_events cascade;
drop table if exists public.connector_health_checks cascade;
drop table if exists public.connector_tool_permissions cascade;
drop table if exists public.connector_tools cascade;
drop table if exists private.connector_credentials cascade;
drop table if exists private.connector_oauth_transactions cascade;
drop table if exists private.connector_oauth_configs cascade;
drop table if exists public.connector_installations cascade;
drop table if exists public.connector_catalog cascade;

alter table public.profiles drop column if exists show_top_plugins;
alter table public.scheduled_tasks drop column if exists connector_ids;
