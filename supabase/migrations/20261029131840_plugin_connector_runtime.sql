-- Server-only connector runtime. Credentials never enter a Data API RPC.
create schema if not exists private;

create table private.plugin_connector_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plugin_id text not null check (plugin_id in ('github','gmail','google-calendar','google-drive','notion','slack','outlook','outlook-calendar','onedrive','sharepoint','teams','linear','atlassian-mcp','airtable','asana','todoist','dropbox','figma','zoom','hubspot')),
  account_label text not null check (length(account_label) <= 200),
  status text not null default 'active' check (status in ('active','reauthorization_required')),
  granted_scopes text[] not null default '{}',
  metadata jsonb not null default '{}' check (octet_length(metadata::text) <= 65536),
  credentials_sealed text not null check (length(credentials_sealed) <= 360000),
  revision bigint not null default 1,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, plugin_id),
  unique (id, user_id)
);
create index plugin_connector_connections_user_status_idx on private.plugin_connector_connections(user_id, status);

create table private.plugin_connector_oauth_states (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  plugin_id text not null,
  state_hash text not null unique check (length(state_hash) = 64),
  browser_hash text not null check (length(browser_hash) = 64),
  data_sealed text not null check (length(data_sealed) <= 360000),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '10 minutes',
  check (expires_at = created_at + interval '10 minutes'),
  unique (user_id)
);
create index plugin_connector_oauth_states_expiry_idx on private.plugin_connector_oauth_states(expires_at);

create table private.plugin_connector_actions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null,
  connection_revision bigint not null,
  plugin_id text not null,
  tool_name text not null check (length(tool_name) <= 128),
  title text not null check (length(title) <= 200),
  schema_hash text not null check (length(schema_hash) = 64),
  request_hash text not null check (length(request_hash) = 64),
  arguments_sealed text check (length(arguments_sealed) <= 360000),
  result_sealed text check (length(result_sealed) <= 360000),
  status text not null default 'pending' check (status in ('pending','approved','running','complete','failed','unknown')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '15 minutes',
  updated_at timestamptz not null default now(),
  foreign key (connection_id, user_id) references private.plugin_connector_connections(id, user_id) on delete cascade,
  check (expires_at = created_at + interval '15 minutes')
);
create index plugin_connector_actions_connection_user_idx on private.plugin_connector_actions(connection_id, user_id);
create index plugin_connector_actions_user_status_idx on private.plugin_connector_actions(user_id, status, created_at desc);
create index plugin_connector_actions_expiry_idx on private.plugin_connector_actions(expires_at);
create unique index plugin_connector_actions_pending_dedupe_idx on private.plugin_connector_actions(user_id, request_hash) where status = 'pending';

alter table private.plugin_connector_connections enable row level security;
alter table private.plugin_connector_oauth_states enable row level security;
alter table private.plugin_connector_actions enable row level security;
-- No client policies: the privileged direct-pg backend explicitly filters every access by owner.
revoke all on table private.plugin_connector_connections, private.plugin_connector_oauth_states,
  private.plugin_connector_actions from public, anon, authenticated;
