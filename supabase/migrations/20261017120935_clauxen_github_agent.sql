-- Server-only integration state. No GitHub credentials are exposed through the Data API.
create table private.github_agent_app (
  singleton boolean primary key default true check (singleton),
  app_id bigint not null unique,
  slug text not null,
  client_id text not null,
  credentials_sealed text not null,
  created_at timestamptz not null default now()
);
create table private.github_agent_states (
  hash text primary key,
  purpose text not null check (purpose in ('registration','oauth','launch')),
  user_id uuid references auth.users(id) on delete cascade,
  data_sealed text not null,
  expires_at timestamptz not null
);
create index github_agent_states_expiry_idx on private.github_agent_states(expires_at);
create index github_agent_states_user_idx on private.github_agent_states(user_id);
create table private.github_agent_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  github_user_id bigint not null,
  login text not null,
  tokens_sealed text not null,
  updated_at timestamptz not null default now()
);
create table private.github_agent_installations (
  installation_id bigint primary key,
  account_login text not null,
  suspended boolean not null default false,
  deleted boolean not null default false,
  updated_at timestamptz not null default now()
);
create table private.github_agent_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  repository text not null,
  branch text not null,
  status text not null default 'pending' check (status in ('pending','complete','failed')),
  result jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, request_id)
);
create index github_agent_changes_user_created_idx on private.github_agent_changes(user_id, created_at desc);
create table private.github_agent_deliveries (
  delivery_id uuid primary key,
  event text not null,
  received_at timestamptz not null default now()
);
alter table private.github_agent_app enable row level security;
alter table private.github_agent_states enable row level security;
alter table private.github_agent_connections enable row level security;
alter table private.github_agent_installations enable row level security;
alter table private.github_agent_changes enable row level security;
alter table private.github_agent_deliveries enable row level security;
revoke all on private.github_agent_app, private.github_agent_states,
  private.github_agent_connections, private.github_agent_installations,
  private.github_agent_changes, private.github_agent_deliveries from public, anon, authenticated;
