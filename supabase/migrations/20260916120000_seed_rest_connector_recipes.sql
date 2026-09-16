-- Idempotent REST connector recipes (GitHub, Slack, Notion, Gmail, Drive, Figma).
with upserted as (
  insert into public.connector_catalog (
    key, name, provider, auth_type, protocol, scopes, status,
    documentation_url, capabilities, metadata
  ) values (
    'github', 'GitHub', 'github',
    'oauth2', 'rest', ARRAY['repo', 'read:user', 'user:email'], 'active',
    'https://docs.github.com/en/rest', '["repos","issues","pulls","search"]'::jsonb,
    '{"oauth":{"key":"github","authorizationEndpoint":"https://github.com/login/oauth/authorize","tokenEndpoint":"https://github.com/login/oauth/access_token","refreshUrl":null,"revocationEndpoint":null,"apiBaseUrl":"https://api.github.com","clientAuthMethod":"client_secret_post","supportsPkce":true,"scopeSeparator":" ","authorizationParams":{},"tokenParams":{}}}'::jsonb
  )
  on conflict (key) do update set
    name = excluded.name,
    provider = excluded.provider,
    auth_type = 'oauth2',
    protocol = 'rest',
    scopes = excluded.scopes,
    status = excluded.status,
    documentation_url = excluded.documentation_url,
    capabilities = excluded.capabilities,
    metadata = coalesce(public.connector_catalog.metadata, '{}'::jsonb) || excluded.metadata,
    updated_at = now()
  returning id
)
insert into public.connector_tools (
  connector_id, name, title, description, input_schema,
  http_method, path_template, request_config, risk_level,
  requires_confirmation, is_enabled, metadata
)
select
  upserted.id,
  v.name, v.title, v.description, v.input_schema::jsonb,
  v.http_method, v.path_template, v.request_config::jsonb, v.risk_level,
  v.requires_confirmation, true, '{"source":"clauxen-recipe"}'::jsonb
from upserted
cross join (values
('get_authenticated_user', 'Get authenticated user', 'Return the GitHub account that authorized this connection.', '{"type":"object","properties":{},"additionalProperties":false}', 'GET', '/user', '{"headers":{"accept":"application/vnd.github+json","x-github-api-version":"2022-11-28"}}', 'read', false),('list_repos', 'List repositories', 'List repositories for the authenticated GitHub user.', '{"type":"object","properties":{"per_page":{"type":"integer","minimum":1,"maximum":100},"page":{"type":"integer","minimum":1},"sort":{"type":"string","enum":["created","updated","pushed","full_name"]},"type":{"type":"string","enum":["all","owner","public","private","member"]}},"additionalProperties":false}', 'GET', '/user/repos', '{"headers":{"accept":"application/vnd.github+json","x-github-api-version":"2022-11-28"}}', 'read', false),('list_issues', 'List repository issues', 'List issues in a GitHub repository.', '{"type":"object","required":["owner","repo"],"properties":{"owner":{"type":"string"},"repo":{"type":"string"},"state":{"type":"string","enum":["open","closed","all"]},"per_page":{"type":"integer","minimum":1,"maximum":100}},"additionalProperties":false}', 'GET', '/repos/{owner}/{repo}/issues', '{"headers":{"accept":"application/vnd.github+json","x-github-api-version":"2022-11-28"}}', 'read', false),('create_issue', 'Create issue', 'Create an issue in a GitHub repository.', '{"type":"object","required":["owner","repo","title"],"properties":{"owner":{"type":"string"},"repo":{"type":"string"},"title":{"type":"string"},"body":{"type":"string"},"labels":{"type":"array","items":{"type":"string"}}},"additionalProperties":false}', 'POST', '/repos/{owner}/{repo}/issues', '{"headers":{"accept":"application/vnd.github+json","x-github-api-version":"2022-11-28"}}', 'write', true),('search_issues', 'Search issues and pull requests', 'Search GitHub issues and pull requests with a query string.', '{"type":"object","required":["q"],"properties":{"q":{"type":"string"},"per_page":{"type":"integer","minimum":1,"maximum":100}},"additionalProperties":false}', 'GET', '/search/issues', '{"headers":{"accept":"application/vnd.github+json","x-github-api-version":"2022-11-28"}}', 'read', false)
) as v(name, title, description, input_schema, http_method, path_template, request_config, risk_level, requires_confirmation)
on conflict (connector_id, name) do update set
  title = excluded.title,
  description = excluded.description,
  input_schema = excluded.input_schema,
  http_method = excluded.http_method,
  path_template = excluded.path_template,
  request_config = excluded.request_config,
  risk_level = excluded.risk_level,
  requires_confirmation = excluded.requires_confirmation,
  is_enabled = true,
  metadata = excluded.metadata,
  updated_at = now();


with upserted as (
  insert into public.connector_catalog (
    key, name, provider, auth_type, protocol, scopes, status,
    documentation_url, capabilities, metadata
  ) values (
    'slack', 'Slack', 'slack',
    'oauth2', 'rest', ARRAY['channels:read', 'channels:history', 'chat:write', 'users:read', 'users:read.email'], 'active',
    'https://docs.slack.dev/reference/methods', '["channels","messages","users"]'::jsonb,
    '{"oauth":{"key":"slack","authorizationEndpoint":"https://slack.com/oauth/v2/authorize","tokenEndpoint":"https://slack.com/api/oauth.v2.access","refreshUrl":null,"revocationEndpoint":null,"apiBaseUrl":"https://slack.com/api","clientAuthMethod":"client_secret_post","supportsPkce":false,"scopeSeparator":",","authorizationParams":{},"tokenParams":{}}}'::jsonb
  )
  on conflict (key) do update set
    name = excluded.name,
    provider = excluded.provider,
    auth_type = 'oauth2',
    protocol = 'rest',
    scopes = excluded.scopes,
    status = excluded.status,
    documentation_url = excluded.documentation_url,
    capabilities = excluded.capabilities,
    metadata = coalesce(public.connector_catalog.metadata, '{}'::jsonb) || excluded.metadata,
    updated_at = now()
  returning id
)
insert into public.connector_tools (
  connector_id, name, title, description, input_schema,
  http_method, path_template, request_config, risk_level,
  requires_confirmation, is_enabled, metadata
)
select
  upserted.id,
  v.name, v.title, v.description, v.input_schema::jsonb,
  v.http_method, v.path_template, v.request_config::jsonb, v.risk_level,
  v.requires_confirmation, true, '{"source":"clauxen-recipe"}'::jsonb
from upserted
cross join (values
('list_conversations', 'List conversations', 'List Slack channels the connected workspace can see.', '{"type":"object","properties":{"limit":{"type":"integer","minimum":1,"maximum":200},"types":{"type":"string"},"cursor":{"type":"string"}},"additionalProperties":false}', 'GET', '/conversations.list', '{}', 'read', false),('list_users', 'List users', 'List users in the connected Slack workspace.', '{"type":"object","properties":{"limit":{"type":"integer","minimum":1,"maximum":200},"cursor":{"type":"string"}},"additionalProperties":false}', 'GET', '/users.list', '{}', 'read', false),('post_message', 'Post message', 'Post a message to a Slack channel.', '{"type":"object","required":["channel","text"],"properties":{"channel":{"type":"string"},"text":{"type":"string"},"thread_ts":{"type":"string"}},"additionalProperties":false}', 'POST', '/chat.postMessage', '{}', 'write', true)
) as v(name, title, description, input_schema, http_method, path_template, request_config, risk_level, requires_confirmation)
on conflict (connector_id, name) do update set
  title = excluded.title,
  description = excluded.description,
  input_schema = excluded.input_schema,
  http_method = excluded.http_method,
  path_template = excluded.path_template,
  request_config = excluded.request_config,
  risk_level = excluded.risk_level,
  requires_confirmation = excluded.requires_confirmation,
  is_enabled = true,
  metadata = excluded.metadata,
  updated_at = now();


with upserted as (
  insert into public.connector_catalog (
    key, name, provider, auth_type, protocol, scopes, status,
    documentation_url, capabilities, metadata
  ) values (
    'notion', 'Notion', 'notion',
    'oauth2', 'rest', '{}'::text[], 'active',
    'https://developers.notion.com/reference', '["search","pages","databases"]'::jsonb,
    '{"oauth":{"key":"notion","authorizationEndpoint":"https://api.notion.com/v1/oauth/authorize","tokenEndpoint":"https://api.notion.com/v1/oauth/token","refreshUrl":null,"revocationEndpoint":null,"apiBaseUrl":"https://api.notion.com","clientAuthMethod":"client_secret_basic","supportsPkce":true,"scopeSeparator":" ","authorizationParams":{"owner":"user"},"tokenParams":{}}}'::jsonb
  )
  on conflict (key) do update set
    name = excluded.name,
    provider = excluded.provider,
    auth_type = 'oauth2',
    protocol = 'rest',
    scopes = excluded.scopes,
    status = excluded.status,
    documentation_url = excluded.documentation_url,
    capabilities = excluded.capabilities,
    metadata = coalesce(public.connector_catalog.metadata, '{}'::jsonb) || excluded.metadata,
    updated_at = now()
  returning id
)
insert into public.connector_tools (
  connector_id, name, title, description, input_schema,
  http_method, path_template, request_config, risk_level,
  requires_confirmation, is_enabled, metadata
)
select
  upserted.id,
  v.name, v.title, v.description, v.input_schema::jsonb,
  v.http_method, v.path_template, v.request_config::jsonb, v.risk_level,
  v.requires_confirmation, true, '{"source":"clauxen-recipe"}'::jsonb
from upserted
cross join (values
('search', 'Search workspace', 'Search pages and databases in the connected Notion workspace.', '{"type":"object","properties":{"query":{"type":"string"},"page_size":{"type":"integer","minimum":1,"maximum":100}},"additionalProperties":false}', 'POST', '/v1/search', '{"headers":{"accept":"application/json","notion-version":"2022-06-28"}}', 'read', false),('get_page', 'Get page', 'Fetch a Notion page by id.', '{"type":"object","required":["page_id"],"properties":{"page_id":{"type":"string"}},"additionalProperties":false}', 'GET', '/v1/pages/{page_id}', '{"headers":{"accept":"application/json","notion-version":"2022-06-28"}}', 'read', false)
) as v(name, title, description, input_schema, http_method, path_template, request_config, risk_level, requires_confirmation)
on conflict (connector_id, name) do update set
  title = excluded.title,
  description = excluded.description,
  input_schema = excluded.input_schema,
  http_method = excluded.http_method,
  path_template = excluded.path_template,
  request_config = excluded.request_config,
  risk_level = excluded.risk_level,
  requires_confirmation = excluded.requires_confirmation,
  is_enabled = true,
  metadata = excluded.metadata,
  updated_at = now();


with upserted as (
  insert into public.connector_catalog (
    key, name, provider, auth_type, protocol, scopes, status,
    documentation_url, capabilities, metadata
  ) values (
    'gmail', 'Gmail', 'google',
    'oauth2', 'rest', ARRAY['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send'], 'active',
    'https://developers.google.com/gmail/api/reference/rest', '["messages","send"]'::jsonb,
    '{"oauth":{"key":"google-mail","authorizationEndpoint":"https://accounts.google.com/o/oauth2/v2/auth","tokenEndpoint":"https://oauth2.googleapis.com/token","refreshUrl":null,"revocationEndpoint":null,"apiBaseUrl":"https://gmail.googleapis.com","clientAuthMethod":"client_secret_post","supportsPkce":true,"scopeSeparator":" ","authorizationParams":{"access_type":"offline","prompt":"consent"},"tokenParams":{}}}'::jsonb
  )
  on conflict (key) do update set
    name = excluded.name,
    provider = excluded.provider,
    auth_type = 'oauth2',
    protocol = 'rest',
    scopes = excluded.scopes,
    status = excluded.status,
    documentation_url = excluded.documentation_url,
    capabilities = excluded.capabilities,
    metadata = coalesce(public.connector_catalog.metadata, '{}'::jsonb) || excluded.metadata,
    updated_at = now()
  returning id
)
insert into public.connector_tools (
  connector_id, name, title, description, input_schema,
  http_method, path_template, request_config, risk_level,
  requires_confirmation, is_enabled, metadata
)
select
  upserted.id,
  v.name, v.title, v.description, v.input_schema::jsonb,
  v.http_method, v.path_template, v.request_config::jsonb, v.risk_level,
  v.requires_confirmation, true, '{"source":"clauxen-recipe"}'::jsonb
from upserted
cross join (values
('list_messages', 'List messages', 'List Gmail messages for the connected account.', '{"type":"object","properties":{"q":{"type":"string"},"maxResults":{"type":"integer","minimum":1,"maximum":100},"pageToken":{"type":"string"}},"additionalProperties":false}', 'GET', '/gmail/v1/users/me/messages', '{}', 'sensitive', true),('get_message', 'Get message', 'Fetch a Gmail message by id.', '{"type":"object","required":["id"],"properties":{"id":{"type":"string"},"format":{"type":"string","enum":["minimal","full","metadata","raw"]}},"additionalProperties":false}', 'GET', '/gmail/v1/users/me/messages/{id}', '{}', 'sensitive', true)
) as v(name, title, description, input_schema, http_method, path_template, request_config, risk_level, requires_confirmation)
on conflict (connector_id, name) do update set
  title = excluded.title,
  description = excluded.description,
  input_schema = excluded.input_schema,
  http_method = excluded.http_method,
  path_template = excluded.path_template,
  request_config = excluded.request_config,
  risk_level = excluded.risk_level,
  requires_confirmation = excluded.requires_confirmation,
  is_enabled = true,
  metadata = excluded.metadata,
  updated_at = now();


with upserted as (
  insert into public.connector_catalog (
    key, name, provider, auth_type, protocol, scopes, status,
    documentation_url, capabilities, metadata
  ) values (
    'google-drive', 'Google Drive', 'google',
    'oauth2', 'rest', ARRAY['https://www.googleapis.com/auth/drive.readonly'], 'active',
    'https://developers.google.com/drive/api/reference/rest/v3', '["files","search"]'::jsonb,
    '{"oauth":{"key":"google-drive","authorizationEndpoint":"https://accounts.google.com/o/oauth2/v2/auth","tokenEndpoint":"https://oauth2.googleapis.com/token","refreshUrl":null,"revocationEndpoint":null,"apiBaseUrl":"https://www.googleapis.com","clientAuthMethod":"client_secret_post","supportsPkce":true,"scopeSeparator":" ","authorizationParams":{"access_type":"offline","prompt":"consent"},"tokenParams":{}}}'::jsonb
  )
  on conflict (key) do update set
    name = excluded.name,
    provider = excluded.provider,
    auth_type = 'oauth2',
    protocol = 'rest',
    scopes = excluded.scopes,
    status = excluded.status,
    documentation_url = excluded.documentation_url,
    capabilities = excluded.capabilities,
    metadata = coalesce(public.connector_catalog.metadata, '{}'::jsonb) || excluded.metadata,
    updated_at = now()
  returning id
)
insert into public.connector_tools (
  connector_id, name, title, description, input_schema,
  http_method, path_template, request_config, risk_level,
  requires_confirmation, is_enabled, metadata
)
select
  upserted.id,
  v.name, v.title, v.description, v.input_schema::jsonb,
  v.http_method, v.path_template, v.request_config::jsonb, v.risk_level,
  v.requires_confirmation, true, '{"source":"clauxen-recipe"}'::jsonb
from upserted
cross join (values
('list_files', 'List files', 'List Google Drive files for the connected account.', '{"type":"object","properties":{"q":{"type":"string"},"pageSize":{"type":"integer","minimum":1,"maximum":100},"pageToken":{"type":"string"},"fields":{"type":"string"}},"additionalProperties":false}', 'GET', '/drive/v3/files', '{}', 'read', false),('get_file', 'Get file', 'Fetch Google Drive file metadata by id.', '{"type":"object","required":["fileId"],"properties":{"fileId":{"type":"string"},"fields":{"type":"string"}},"additionalProperties":false}', 'GET', '/drive/v3/files/{fileId}', '{}', 'read', false)
) as v(name, title, description, input_schema, http_method, path_template, request_config, risk_level, requires_confirmation)
on conflict (connector_id, name) do update set
  title = excluded.title,
  description = excluded.description,
  input_schema = excluded.input_schema,
  http_method = excluded.http_method,
  path_template = excluded.path_template,
  request_config = excluded.request_config,
  risk_level = excluded.risk_level,
  requires_confirmation = excluded.requires_confirmation,
  is_enabled = true,
  metadata = excluded.metadata,
  updated_at = now();


with upserted as (
  insert into public.connector_catalog (
    key, name, provider, auth_type, protocol, scopes, status,
    documentation_url, capabilities, metadata
  ) values (
    'figma', 'Figma', 'figma',
    'oauth2', 'rest', ARRAY['files:read'], 'beta',
    'https://developers.figma.com/docs/rest-api', '["files","comments"]'::jsonb,
    '{"oauth":{"key":"figma","authorizationEndpoint":"https://www.figma.com/oauth","tokenEndpoint":"https://api.figma.com/v1/oauth/token","refreshUrl":"https://api.figma.com/v1/oauth/refresh","revocationEndpoint":null,"apiBaseUrl":"https://api.figma.com","clientAuthMethod":"client_secret_basic","supportsPkce":false,"scopeSeparator":",","authorizationParams":{},"tokenParams":{}}}'::jsonb
  )
  on conflict (key) do update set
    name = excluded.name,
    provider = excluded.provider,
    auth_type = 'oauth2',
    protocol = 'rest',
    scopes = excluded.scopes,
    status = excluded.status,
    documentation_url = excluded.documentation_url,
    capabilities = excluded.capabilities,
    metadata = coalesce(public.connector_catalog.metadata, '{}'::jsonb) || excluded.metadata,
    updated_at = now()
  returning id
)
insert into public.connector_tools (
  connector_id, name, title, description, input_schema,
  http_method, path_template, request_config, risk_level,
  requires_confirmation, is_enabled, metadata
)
select
  upserted.id,
  v.name, v.title, v.description, v.input_schema::jsonb,
  v.http_method, v.path_template, v.request_config::jsonb, v.risk_level,
  v.requires_confirmation, true, '{"source":"clauxen-recipe"}'::jsonb
from upserted
cross join (values
('get_me', 'Get current user', 'Return the Figma user that authorized this connection.', '{"type":"object","properties":{},"additionalProperties":false}', 'GET', '/v1/me', '{}', 'read', false),('get_file', 'Get file', 'Fetch a Figma file by key.', '{"type":"object","required":["file_key"],"properties":{"file_key":{"type":"string"}},"additionalProperties":false}', 'GET', '/v1/files/{file_key}', '{}', 'read', false)
) as v(name, title, description, input_schema, http_method, path_template, request_config, risk_level, requires_confirmation)
on conflict (connector_id, name) do update set
  title = excluded.title,
  description = excluded.description,
  input_schema = excluded.input_schema,
  http_method = excluded.http_method,
  path_template = excluded.path_template,
  request_config = excluded.request_config,
  risk_level = excluded.risk_level,
  requires_confirmation = excluded.requires_confirmation,
  is_enabled = true,
  metadata = excluded.metadata,
  updated_at = now();
