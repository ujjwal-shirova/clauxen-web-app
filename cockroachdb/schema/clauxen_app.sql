-- =============================================================================
-- Clauxen unified application schema (CockroachDB)
-- Replaces the legacy 90+ table platform dump with a focused production schema.
-- =============================================================================
SET default_int_size = 4;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;

-- -----------------------------------------------------------------------------
-- Auth
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auth.users (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  email STRING NULL,
  password_hash STRING NULL,
  raw_user_meta_data JSONB NOT NULL DEFAULT '{}':::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  CONSTRAINT users_pkey PRIMARY KEY (id ASC)
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON auth.users (email ASC) WHERE email IS NOT NULL;

-- -----------------------------------------------------------------------------
-- Storage shim (metadata; blobs live in Cloudflare R2)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS storage.buckets (
  id STRING NOT NULL,
  name STRING NOT NULL,
  public BOOL NOT NULL DEFAULT false,
  CONSTRAINT buckets_pkey PRIMARY KEY (id ASC)
);

CREATE TABLE IF NOT EXISTS storage.objects (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  bucket_id STRING NOT NULL,
  name STRING NOT NULL,
  owner UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}':::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  CONSTRAINT objects_pkey PRIMARY KEY (id ASC),
  CONSTRAINT objects_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id) ON DELETE CASCADE,
  UNIQUE INDEX objects_bucket_id_name_key (bucket_id ASC, name ASC)
);

-- -----------------------------------------------------------------------------
-- Profiles & settings
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL,
  email STRING NULL,
  display_name STRING NULL,
  avatar_url STRING NULL,
  locale STRING NOT NULL DEFAULT 'en',
  timezone STRING NOT NULL DEFAULT 'UTC',
  default_workspace_id UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}':::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  CONSTRAINT profiles_pkey PRIMARY KEY (id ASC),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id UUID NOT NULL,
  email STRING NULL,
  settings JSONB NOT NULL DEFAULT '{}':::JSONB,
  theme STRING NOT NULL DEFAULT 'system',
  language STRING NOT NULL DEFAULT 'en',
  display_name STRING NULL,
  avatar_url STRING NULL,
  chat_model_id STRING NULL,
  response_style STRING NULL,
  memory_enabled BOOL NOT NULL DEFAULT true,
  web_search_enabled BOOL NOT NULL DEFAULT false,
  artifact_auto_open BOOL NOT NULL DEFAULT true,
  email_notifications BOOL NOT NULL DEFAULT true,
  product_updates BOOL NOT NULL DEFAULT true,
  data_training_opt_in BOOL NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  CONSTRAINT user_settings_pkey PRIMARY KEY (user_id ASC),
  CONSTRAINT user_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id UUID NOT NULL,
  email_notifications BOOL NOT NULL DEFAULT true,
  product_updates BOOL NOT NULL DEFAULT true,
  research_complete BOOL NOT NULL DEFAULT true,
  billing_alerts BOOL NOT NULL DEFAULT true,
  security_alerts BOOL NOT NULL DEFAULT true,
  settings JSONB NOT NULL DEFAULT '{}':::JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  CONSTRAINT notification_preferences_pkey PRIMARY KEY (user_id ASC),
  CONSTRAINT notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.user_security_events (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NULL,
  event_type STRING NOT NULL,
  ip_address INET NULL,
  user_agent STRING NULL,
  metadata JSONB NOT NULL DEFAULT '{}':::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  CONSTRAINT user_security_events_pkey PRIMARY KEY (id ASC)
);

-- -----------------------------------------------------------------------------
-- Workspaces
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  name STRING NOT NULL,
  slug STRING NULL,
  owner_id UUID NOT NULL,
  plan_id STRING NULL,
  metadata JSONB NOT NULL DEFAULT '{}':::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  CONSTRAINT workspaces_pkey PRIMARY KEY (id ASC),
  CONSTRAINT workspaces_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS workspaces_slug_key ON public.workspaces (slug ASC) WHERE slug IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.workspace_members (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role STRING NOT NULL DEFAULT 'member',
  status STRING NOT NULL DEFAULT 'active',
  joined_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  CONSTRAINT workspace_members_pkey PRIMARY KEY (id ASC),
  CONSTRAINT workspace_members_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE,
  CONSTRAINT workspace_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  UNIQUE INDEX workspace_members_workspace_user_key (workspace_id ASC, user_id ASC)
);

CREATE TABLE IF NOT EXISTS public.workspace_settings (
  workspace_id UUID NOT NULL,
  default_model_id STRING NULL,
  allowed_models STRING[] NOT NULL DEFAULT ARRAY[]:::STRING[],
  settings JSONB NOT NULL DEFAULT '{}':::JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  CONSTRAINT workspace_settings_pkey PRIMARY KEY (workspace_id ASC),
  CONSTRAINT workspace_settings_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE
);

-- -----------------------------------------------------------------------------
-- Projects
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  workspace_id UUID NULL,
  user_id UUID NOT NULL,
  name STRING NOT NULL,
  description STRING NULL,
  system_prompt STRING NULL,
  color STRING NULL,
  icon STRING NULL,
  status STRING NOT NULL DEFAULT 'active',
  metadata JSONB NOT NULL DEFAULT '{}':::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  CONSTRAINT projects_pkey PRIMARY KEY (id ASC),
  CONSTRAINT projects_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT projects_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS projects_user_id_updated_at_idx ON public.projects (user_id ASC, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.project_members (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role STRING NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  CONSTRAINT project_members_pkey PRIMARY KEY (id ASC),
  CONSTRAINT project_members_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE,
  CONSTRAINT project_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  UNIQUE INDEX project_members_project_user_key (project_id ASC, user_id ASC)
);

CREATE TABLE IF NOT EXISTS public.project_files (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  user_id UUID NOT NULL,
  filename STRING NOT NULL,
  file_type STRING NOT NULL,
  file_size INT4 NOT NULL,
  storage_bucket STRING NOT NULL,
  storage_path STRING NOT NULL,
  content_hash STRING NULL,
  status STRING NOT NULL DEFAULT 'processing',
  error_message STRING NULL,
  metadata JSONB NOT NULL DEFAULT '{}':::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  CONSTRAINT project_files_pkey PRIMARY KEY (id ASC),
  CONSTRAINT project_files_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE,
  CONSTRAINT project_files_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS project_files_project_id_idx ON public.project_files (project_id ASC);

-- -----------------------------------------------------------------------------
-- Chats & messages
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chats (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  workspace_id UUID NULL,
  project_id UUID NULL,
  chat_type STRING NOT NULL DEFAULT 'direct',
  title STRING NOT NULL DEFAULT 'New chat',
  status STRING NOT NULL DEFAULT 'active',
  model_id STRING NULL,
  system_prompt STRING NULL,
  web_search_enabled BOOL NOT NULL DEFAULT false,
  adaptive_thinking_enabled BOOL NOT NULL DEFAULT false,
  response_style STRING NULL,
  starred BOOL NOT NULL DEFAULT false,
  archived_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}':::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  CONSTRAINT chats_pkey PRIMARY KEY (id ASC),
  CONSTRAINT chats_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT chats_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS chats_user_id_updated_at_idx ON public.chats (user_id ASC, updated_at DESC);
CREATE INDEX IF NOT EXISTS chats_project_id_updated_at_idx ON public.chats (project_id ASC, updated_at DESC) WHERE project_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.chat_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role STRING NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  left_at TIMESTAMPTZ NULL,
  CONSTRAINT chat_participants_pkey PRIMARY KEY (id ASC),
  CONSTRAINT chat_participants_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id) ON DELETE CASCADE,
  CONSTRAINT chat_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  UNIQUE INDEX chat_participants_chat_user_key (chat_id ASC, user_id ASC)
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL,
  user_id UUID NULL,
  branch_id UUID NULL,
  parent_message_id UUID NULL,
  role STRING NOT NULL,
  status STRING NOT NULL DEFAULT 'complete',
  content STRING NULL,
  content_json JSONB NOT NULL DEFAULT '{}':::JSONB,
  token_count INT4 NOT NULL DEFAULT 0,
  model_id STRING NULL,
  metadata JSONB NOT NULL DEFAULT '{}':::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  CONSTRAINT chat_messages_pkey PRIMARY KEY (id ASC),
  CONSTRAINT chat_messages_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id) ON DELETE CASCADE,
  CONSTRAINT chat_messages_role_check CHECK (role IN ('user', 'assistant', 'system'))
);

CREATE INDEX IF NOT EXISTS chat_messages_chat_id_created_at_idx ON public.chat_messages (chat_id ASC, created_at ASC);

CREATE TABLE IF NOT EXISTS public.chat_message_parts (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL,
  type STRING NOT NULL,
  text STRING NULL,
  json JSONB NULL,
  file_id UUID NULL,
  artifact_id UUID NULL,
  tool_call_id UUID NULL,
  position INT4 NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  CONSTRAINT chat_message_parts_pkey PRIMARY KEY (id ASC),
  CONSTRAINT chat_message_parts_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.chat_messages(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.chat_branches (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL,
  root_message_id UUID NULL,
  parent_branch_id UUID NULL,
  title STRING NULL,
  created_from_message_id UUID NULL,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  CONSTRAINT chat_branches_pkey PRIMARY KEY (id ASC),
  CONSTRAINT chat_branches_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.chat_branch_states (
  chat_id STRING NOT NULL,
  user_id UUID NULL,
  active_path JSONB NOT NULL DEFAULT '[]':::JSONB,
  messages JSONB NOT NULL DEFAULT '[]':::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  CONSTRAINT chat_branch_states_pkey PRIMARY KEY (chat_id ASC)
);

CREATE TABLE IF NOT EXISTS public.conversation_shares (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL,
  user_id UUID NOT NULL,
  share_token_hash STRING NOT NULL,
  visibility STRING NOT NULL DEFAULT 'link',
  include_artifacts BOOL NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ NULL,
  revoked_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}':::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  CONSTRAINT conversation_shares_pkey PRIMARY KEY (id ASC),
  CONSTRAINT conversation_shares_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id) ON DELETE CASCADE,
  CONSTRAINT conversation_shares_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS conversation_shares_token_hash_idx ON public.conversation_shares (share_token_hash ASC) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS public.pinned_chats (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL,
  user_id UUID NOT NULL,
  position INT4 NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  CONSTRAINT pinned_chats_pkey PRIMARY KEY (id ASC),
  CONSTRAINT pinned_chats_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id) ON DELETE CASCADE,
  CONSTRAINT pinned_chats_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  UNIQUE INDEX pinned_chats_chat_user_key (chat_id ASC, user_id ASC)
);

-- -----------------------------------------------------------------------------
-- RAG & file processing
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.document_chunks (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID NULL,
  project_file_id UUID NULL,
  source_type STRING NOT NULL DEFAULT 'project_file',
  source_id UUID NULL,
  chunk_index INT4 NOT NULL,
  content STRING NOT NULL,
  token_count INT4 NOT NULL DEFAULT 0,
  embedding FLOAT8[] NULL,
  metadata JSONB NOT NULL DEFAULT '{}':::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  CONSTRAINT document_chunks_pkey PRIMARY KEY (id ASC),
  CONSTRAINT document_chunks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT document_chunks_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE,
  CONSTRAINT document_chunks_project_file_id_fkey FOREIGN KEY (project_file_id) REFERENCES public.project_files(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS document_chunks_project_id_idx ON public.document_chunks (project_id ASC);
CREATE INDEX IF NOT EXISTS document_chunks_project_file_id_idx ON public.document_chunks (project_file_id ASC);

CREATE TABLE IF NOT EXISTS public.file_processing_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL,
  user_id UUID NOT NULL,
  job_type STRING NOT NULL,
  status STRING NOT NULL DEFAULT 'pending',
  error JSONB NULL,
  result JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  completed_at TIMESTAMPTZ NULL,
  CONSTRAINT file_processing_jobs_pkey PRIMARY KEY (id ASC),
  CONSTRAINT file_processing_jobs_file_id_fkey FOREIGN KEY (file_id) REFERENCES public.project_files(id) ON DELETE CASCADE
);

-- -----------------------------------------------------------------------------
-- User files library (non-project uploads)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_files (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  workspace_id UUID NULL,
  project_id UUID NULL,
  original_name STRING NOT NULL,
  mime_type STRING NULL,
  size_bytes INT8 NOT NULL,
  storage_bucket STRING NOT NULL,
  storage_path STRING NOT NULL,
  content_hash STRING NULL,
  status STRING NOT NULL DEFAULT 'ready',
  metadata JSONB NOT NULL DEFAULT '{}':::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  CONSTRAINT user_files_pkey PRIMARY KEY (id ASC),
  CONSTRAINT user_files_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS user_files_user_id_idx ON public.user_files (user_id ASC);

-- -----------------------------------------------------------------------------
-- Customize: instructions, memories, connectors
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.instruction_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  workspace_id UUID NULL,
  title STRING NOT NULL,
  instructions STRING NOT NULL,
  traits JSONB NOT NULL DEFAULT '{}':::JSONB,
  is_default BOOL NOT NULL DEFAULT false,
  status STRING NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  CONSTRAINT instruction_profiles_pkey PRIMARY KEY (id ASC),
  CONSTRAINT instruction_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.user_skills (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name STRING NOT NULL,
  description STRING NOT NULL DEFAULT '',
  storage_bucket STRING NOT NULL,
  storage_prefix STRING NOT NULL,
  source_format STRING NOT NULL,
  primary_object_key STRING NULL,
  manifest JSONB NOT NULL DEFAULT '{}':::JSONB,
  status STRING NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  CONSTRAINT user_skills_pkey PRIMARY KEY (id ASC),
  CONSTRAINT user_skills_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS user_skills_user_id_idx ON public.user_skills (user_id ASC);

CREATE TABLE IF NOT EXISTS public.user_memories (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  workspace_id UUID NULL,
  source_message_id UUID NULL,
  memory_type STRING NOT NULL DEFAULT 'fact',
  summary STRING NOT NULL,
  confidence DECIMAL(5,4) NOT NULL DEFAULT 1.0,
  status STRING NOT NULL DEFAULT 'active',
  pinned BOOL NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}':::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  CONSTRAINT user_memories_pkey PRIMARY KEY (id ASC),
  CONSTRAINT user_memories_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.memory_events (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  memory_id UUID NULL,
  user_id UUID NOT NULL,
  event_type STRING NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}':::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  CONSTRAINT memory_events_pkey PRIMARY KEY (id ASC)
);

CREATE TABLE IF NOT EXISTS public.connector_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  key STRING NOT NULL,
  name STRING NOT NULL,
  provider STRING NOT NULL,
  auth_type STRING NOT NULL,
  scopes STRING[] NOT NULL DEFAULT ARRAY[]:::STRING[],
  config_schema JSONB NOT NULL DEFAULT '{}':::JSONB,
  status STRING NOT NULL DEFAULT 'active',
  metadata JSONB NOT NULL DEFAULT '{}':::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  CONSTRAINT connector_catalog_pkey PRIMARY KEY (id ASC),
  UNIQUE INDEX connector_catalog_key_key (key ASC)
);

CREATE TABLE IF NOT EXISTS public.connector_installations (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  connector_id UUID NOT NULL,
  user_id UUID NOT NULL,
  workspace_id UUID NULL,
  status STRING NOT NULL DEFAULT 'active',
  settings JSONB NOT NULL DEFAULT '{}':::JSONB,
  last_synced_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  CONSTRAINT connector_installations_pkey PRIMARY KEY (id ASC),
  CONSTRAINT connector_installations_connector_id_fkey FOREIGN KEY (connector_id) REFERENCES public.connector_catalog(id) ON DELETE CASCADE,
  CONSTRAINT connector_installations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- -----------------------------------------------------------------------------
-- Artifacts
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.artifacts (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  workspace_id UUID NULL,
  chat_id UUID NULL,
  message_id UUID NULL,
  title STRING NOT NULL,
  kind STRING NOT NULL,
  status STRING NOT NULL DEFAULT 'active',
  current_version_id UUID NULL,
  storage_bucket STRING NULL,
  storage_path STRING NULL,
  metadata JSONB NOT NULL DEFAULT '{}':::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  CONSTRAINT artifacts_pkey PRIMARY KEY (id ASC),
  CONSTRAINT artifacts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.artifact_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  artifact_id UUID NOT NULL,
  version_number INT4 NOT NULL,
  storage_bucket STRING NOT NULL,
  storage_path STRING NOT NULL,
  content_hash STRING NULL,
  metadata JSONB NOT NULL DEFAULT '{}':::JSONB,
  created_by_message_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  CONSTRAINT artifact_versions_pkey PRIMARY KEY (id ASC),
  CONSTRAINT artifact_versions_artifact_id_fkey FOREIGN KEY (artifact_id) REFERENCES public.artifacts(id) ON DELETE CASCADE
);

-- -----------------------------------------------------------------------------
-- Inference & tools
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tool_calls (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NULL,
  workspace_id UUID NULL,
  chat_id UUID NULL,
  message_id UUID NULL,
  tool_name STRING NOT NULL,
  provider STRING NULL,
  input JSONB NOT NULL DEFAULT '{}':::JSONB,
  output JSONB NULL,
  status STRING NOT NULL DEFAULT 'complete',
  error JSONB NULL,
  latency_ms INT4 NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  CONSTRAINT tool_calls_pkey PRIMARY KEY (id ASC)
);

CREATE TABLE IF NOT EXISTS public.model_usage_events (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NULL,
  workspace_id UUID NULL,
  chat_id UUID NULL,
  message_id UUID NULL,
  provider STRING NOT NULL,
  model_id STRING NOT NULL,
  input_tokens INT4 NOT NULL DEFAULT 0,
  output_tokens INT4 NOT NULL DEFAULT 0,
  total_tokens INT4 NULL,
  cost_amount DECIMAL(12,6) NULL,
  currency STRING NOT NULL DEFAULT 'USD',
  latency_ms INT4 NULL,
  metadata JSONB NOT NULL DEFAULT '{}':::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  CONSTRAINT model_usage_events_pkey PRIMARY KEY (id ASC)
);

CREATE TABLE IF NOT EXISTS public.inference_gateway_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  gateway STRING NOT NULL,
  provider STRING NOT NULL,
  mode STRING NOT NULL,
  model STRING NOT NULL,
  status STRING NOT NULL,
  prompt_message_count INT4 NOT NULL DEFAULT 0,
  prompt_character_count INT4 NOT NULL DEFAULT 0,
  response_character_count INT4 NOT NULL DEFAULT 0,
  latency_ms INT4 NULL,
  error_code STRING NULL,
  error_message STRING NULL,
  metadata JSONB NOT NULL DEFAULT '{}':::JSONB,
  request_started_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  request_finished_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  CONSTRAINT inference_gateway_requests_pkey PRIMARY KEY (id ASC)
);

-- -----------------------------------------------------------------------------
-- Billing
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.plans (
  id STRING NOT NULL,
  name STRING NOT NULL,
  display_name STRING NOT NULL,
  price_paise_monthly INT4 NOT NULL DEFAULT 0,
  price_paise_yearly INT4 NOT NULL DEFAULT 0,
  currency STRING NOT NULL DEFAULT 'INR',
  token_grant INT4 NOT NULL DEFAULT 0,
  limits JSONB NOT NULL DEFAULT '{}':::JSONB,
  features JSONB NOT NULL DEFAULT '{}':::JSONB,
  is_active BOOL NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  CONSTRAINT plans_pkey PRIMARY KEY (id ASC)
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  workspace_id UUID NULL,
  plan_id STRING NULL,
  provider STRING NOT NULL DEFAULT 'razorpay',
  provider_subscription_id STRING NULL,
  status STRING NOT NULL DEFAULT 'active',
  billing_cycle STRING NULL,
  current_period_start TIMESTAMPTZ NULL,
  current_period_end TIMESTAMPTZ NULL,
  cancel_at_period_end BOOL NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}':::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  CONSTRAINT subscriptions_pkey PRIMARY KEY (id ASC),
  CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.user_balances (
  user_id UUID NOT NULL,
  tokens_total INT4 NOT NULL DEFAULT 5000,
  tokens_consumed INT4 NOT NULL DEFAULT 0,
  tokens_remaining INT4 NOT NULL DEFAULT 5000,
  status STRING NOT NULL DEFAULT 'trial',
  workspace_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  CONSTRAINT user_balances_pkey PRIMARY KEY (user_id ASC),
  CONSTRAINT user_balances_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.token_transactions (
  id STRING NOT NULL,
  user_id UUID NOT NULL,
  amount INT4 NOT NULL,
  type STRING NOT NULL,
  source STRING NOT NULL,
  model_id STRING NULL,
  metadata JSONB NOT NULL DEFAULT '{}':::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  CONSTRAINT token_transactions_pkey PRIMARY KEY (id ASC),
  CONSTRAINT token_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.billing_orders (
  id STRING NOT NULL,
  razorpay_order_id STRING NOT NULL,
  razorpay_payment_id STRING NULL,
  user_id UUID NOT NULL,
  user_email STRING NULL,
  plan_id STRING NOT NULL,
  plan_name STRING NOT NULL,
  billing_cycle STRING NOT NULL,
  status STRING NOT NULL DEFAULT 'created',
  currency STRING NOT NULL DEFAULT 'INR',
  subtotal_paise INT4 NOT NULL DEFAULT 0,
  tax_paise INT4 NOT NULL DEFAULT 0,
  amount_paise INT4 NOT NULL DEFAULT 0,
  tokens INT4 NOT NULL DEFAULT 0,
  receipt STRING NOT NULL,
  razorpay_status STRING NOT NULL DEFAULT 'created',
  metadata JSONB NOT NULL DEFAULT '{}':::JSONB,
  paid_at TIMESTAMPTZ NULL,
  fulfilled_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  CONSTRAINT billing_orders_pkey PRIMARY KEY (id ASC)
);

CREATE UNIQUE INDEX IF NOT EXISTS billing_orders_razorpay_order_id_key ON public.billing_orders (razorpay_order_id ASC);

CREATE TABLE IF NOT EXISTS public.billing_payments (
  id STRING NOT NULL,
  order_id STRING NOT NULL,
  user_id UUID NOT NULL,
  amount_paise INT4 NOT NULL,
  currency STRING NOT NULL DEFAULT 'INR',
  status STRING NOT NULL,
  method STRING NULL,
  source STRING NOT NULL DEFAULT 'razorpay',
  captured_at TIMESTAMPTZ NULL,
  fulfilled_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  CONSTRAINT billing_payments_pkey PRIMARY KEY (id ASC)
);

CREATE TABLE IF NOT EXISTS public.razorpay_webhook_events (
  id STRING NOT NULL,
  event_id STRING NOT NULL,
  event STRING NOT NULL,
  status STRING NOT NULL,
  order_id STRING NULL,
  payment_id STRING NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  CONSTRAINT razorpay_webhook_events_pkey PRIMARY KEY (id ASC)
);

-- -----------------------------------------------------------------------------
-- Research
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.research_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  provider STRING NOT NULL,
  provider_run_id STRING NOT NULL,
  objective STRING NOT NULL,
  processor STRING NOT NULL,
  status STRING NOT NULL DEFAULT 'pending',
  result JSONB NULL,
  error JSONB NULL,
  workspace_id UUID NULL,
  chat_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  CONSTRAINT research_runs_pkey PRIMARY KEY (id ASC)
);

CREATE TABLE IF NOT EXISTS public.research_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  research_run_id UUID NOT NULL,
  url STRING NOT NULL,
  title STRING NULL,
  publisher STRING NULL,
  published_at TIMESTAMPTZ NULL,
  excerpt STRING NULL,
  metadata JSONB NOT NULL DEFAULT '{}':::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  CONSTRAINT research_sources_pkey PRIMARY KEY (id ASC),
  CONSTRAINT research_sources_research_run_id_fkey FOREIGN KEY (research_run_id) REFERENCES public.research_runs(id) ON DELETE CASCADE
);

-- -----------------------------------------------------------------------------
-- Ops
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  workspace_id UUID NULL,
  name STRING NOT NULL,
  key_hash STRING NOT NULL,
  key_prefix STRING NOT NULL,
  scopes STRING[] NOT NULL DEFAULT ARRAY[]:::STRING[],
  last_used_at TIMESTAMPTZ NULL,
  expires_at TIMESTAMPTZ NULL,
  revoked_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  CONSTRAINT api_keys_pkey PRIMARY KEY (id ASC),
  CONSTRAINT api_keys_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NULL,
  workspace_id UUID NULL,
  actor_type STRING NOT NULL DEFAULT 'user',
  action STRING NOT NULL,
  target_type STRING NULL,
  target_id STRING NULL,
  ip_address INET NULL,
  user_agent STRING NULL,
  metadata JSONB NOT NULL DEFAULT '{}':::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id ASC)
);

CREATE TABLE IF NOT EXISTS public.feature_flags (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  key STRING NOT NULL,
  description STRING NULL,
  enabled BOOL NOT NULL DEFAULT false,
  rollout JSONB NOT NULL DEFAULT '{}':::JSONB,
  conditions JSONB NOT NULL DEFAULT '{}':::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  CONSTRAINT feature_flags_pkey PRIMARY KEY (id ASC),
  UNIQUE INDEX feature_flags_key_key (key ASC)
);

CREATE TABLE IF NOT EXISTS public.rate_limits (
  id STRING NOT NULL,
  identifier STRING NOT NULL,
  window_start INT4 NOT NULL,
  count INT4 NOT NULL DEFAULT 0,
  last_request INT8 NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now():::TIMESTAMPTZ,
  CONSTRAINT rate_limits_pkey PRIMARY KEY (id ASC)
);

-- -----------------------------------------------------------------------------
-- Seed storage buckets (R2 bucket names mirrored in DB)
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public) VALUES
  ('clauxen-images', 'clauxen-images', false),
  ('clauxen-documents', 'clauxen-documents', false),
  ('clauxen-artifacts', 'clauxen-artifacts', false),
  ('clauxen-skills', 'clauxen-skills', false),
  ('clauxen-chat-archives', 'clauxen-chat-archives', false),
  ('clauxen-user-files', 'clauxen-user-files', false)
ON CONFLICT (id) DO NOTHING;
