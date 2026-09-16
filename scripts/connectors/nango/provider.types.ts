/**
 * Provider recipe types harvested from NangoHQ/nango (Elastic License 2.0).
 * Source: packages/types/lib/providers/provider.ts plus the small auth/proxy
 * types it imported. Kept self-contained so Clauxen does not depend on Nango.
 */

export type EndpointMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export type AuthModeType =
  | "OAUTH1"
  | "OAUTH2"
  | "OAUTH2_CC"
  | "BASIC"
  | "API_KEY"
  | "CUSTOM"
  | "APP"
  | "NONE"
  | "TBA"
  | "JWT"
  | "BILL"
  | "TWO_STEP"
  | "SIGNATURE"
  | "MCP_OAUTH2"
  | "MCP_OAUTH2_GENERIC"
  | "INSTALL_PLUGIN"
  | "AWS_SIGV4";

export type OAuthAuthorizationMethodType = "body" | "header";
export type OAuthBodyFormatType = "form" | "json" | "query";

export interface RetryHeaderConfig {
  at?: string[] | string;
  after?: string[] | string;
  remaining?: string;
  error_code?: string[];
  in_body?: {
    path: string;
    value?: string;
    strategy: "at" | "after";
  };
}

export interface PaginationBase {
  limit?: number | string;
  response_path?: string;
  limit_name_in_request: string;
  in_body?: boolean;
}

export interface CursorPagination extends PaginationBase {
  type: "cursor";
  cursor_path_in_response: string;
  cursor_name_in_request: string;
}

export interface LinkPagination extends PaginationBase {
  type: "link";
  link_rel_in_response_header?: string;
  link_path_in_response_body?: string;
}

export interface OffsetPagination extends PaginationBase {
  type: "offset";
  offset_name_in_request: string;
  offset_start_value?: number;
  offset_calculation_method?: "per-page" | "by-response-size";
}

export interface TokenUrlObject {
  OAUTH1?: string;
  OAUTH2?: string;
  OAUTH2CC?: string;
  BASIC?: string;
  API_KEY?: string;
  CUSTOM?: string;
  APP?: string;
  NONE?: string;
}

export interface ProviderAlias {
  alias?: string;
  proxy: {
    base_url?: string;
  };
}

export interface SimplifiedJSONSchema {
  type: "string";
  title: string;
  description: string;
  example?: string;
  pattern?: string;
  optional?: boolean;
  format?: "hostname" | "uri" | "uuid" | "email";
  order: number;
  default_value?: string;
  hidden?: string;
  prefix?: string;
  suffix?: string;
  doc_section?: string;
  secret?: string;
  automated: boolean;
  enum?: string[];
  warnings?: Record<string, string>;
  visible_when?: { field: string; equals: string };
}

export type ProxyBodyValue = string | { [key: string]: ProxyBodyValue };

export interface BaseProvider {
  display_name: string;
  auth_mode: AuthModeType;
  installation?: "outbound";
  proxy?: {
    base_url: string;
    headers?: Record<string, string>;
    connection_config?: Record<string, string>;
    query?: Record<string, string>;
    body?: Record<string, ProxyBodyValue>;
    retry?: RetryHeaderConfig;
    decompress?: boolean;
    forward_headers_on_redirect?: boolean;
    paginate?: LinkPagination | CursorPagination | OffsetPagination;
    verification?: {
      method: EndpointMethod;
      endpoints: string[];
      base_url_override?: string;
      headers?: Record<string, string>;
      data?: unknown;
    };
  };
  authorization_url?: string;
  authorization_url_skip_encode?: string[];
  authorization_url_skip_empty?: boolean;
  access_token_url?: string;
  authorization_params?: Record<string, string>;
  authorization_code_param_in_callback?: string;
  scope_separator?: string;
  default_scopes?: string[];
  token_url?: string | TokenUrlObject;
  token_url_skip_encode?: string[];
  token_params?: Record<string, string>;
  authorization_url_replacements?: Record<string, string>;
  redirect_uri_metadata?: string[];
  token_response_metadata?: string[];
  webhook_response_metadata?: string[];
  authorization_code_param_in_webhook?: string;
  docs: string;
  docs_connect?: string;
  setup_guide_url?: string;
  token_expiration_buffer?: number;
  webhook_routing_script?: string;
  webhook_user_defined_secret?: boolean;
  webhook_allowed_query_params?: string[];
  post_connection_script?: string;
  pre_connection_deletion_script?: string;
  credentials_verification_script?: string;
  categories?: string[];
  connection_configuration?: string[];
  connection_config?: Record<string, SimplifiedJSONSchema>;
  credentials?: Record<string, SimplifiedJSONSchema>;
  integration_config?: Record<string, SimplifiedJSONSchema>;
  assertion_option?: Record<string, SimplifiedJSONSchema>;
  authorization_url_fragment?: string;
  body_format?: OAuthBodyFormatType;
  require_client_certificate?: boolean;
  token_request_auth_method?: "basic" | "custom" | "private_key_jwt";
  available_scopes?: string[];
}

export interface ProviderOAuth2 extends BaseProvider {
  auth_mode: "OAUTH2";
  disable_pkce?: boolean;
  token_params?: {
    grant_type?: "authorization_code" | "client_credentials";
  };
  refresh_params?: {
    grant_type: "refresh_token";
  };
  authorization_method?: OAuthAuthorizationMethodType;
  alternate_access_token_response_path?: string;
  refresh_url?: string;
  expires_in_unit?: "milliseconds";
}

export interface ProviderOAuth1 extends BaseProvider {
  auth_mode: "OAUTH1";
  request_url: string;
  request_params?: Record<string, string>;
  request_http_method?: "GET" | "PUT" | "POST";
  token_http_method?: "GET" | "PUT" | "POST";
  signature_method: "HMAC-SHA1" | "RSA-SHA1" | "PLAINTEXT";
}

export interface ProviderCustom extends Omit<ProviderOAuth2, "auth_mode"> {
  auth_mode: "CUSTOM";
  token_url: {
    OAUTH2: string;
    APP: string;
  };
}

export type McpOAuth2ClientRegistration = "dynamic" | "static" | "cimd";

export interface ProviderMcpOAUTH2 extends Omit<BaseProvider, "body_format"> {
  auth_mode: "MCP_OAUTH2";
  registration_url?: string;
  client_registration: McpOAuth2ClientRegistration;
  registration_params?: Record<string, string | string[]>;
}

export interface ProviderMcpOAuth2Generic extends Omit<BaseProvider, "body_format"> {
  auth_mode: "MCP_OAUTH2_GENERIC";
  mcp_server_url?: string;
}

export interface ProviderJwt extends BaseProvider {
  auth_mode: "JWT";
  signature: {
    protocol: "RSA" | "HMAC" | "EC";
    hmac_secret_encoding?: "hex" | "utf8";
  };
  token: {
    signing_key: string;
    expires_in_ms: number;
    header: {
      alg: string;
      typ?: string;
      kid?: string;
    };
    payload: {
      aud?: string;
      iss?: string;
      sub?: string;
      scope?: string | string[];
    };
  };
}

export interface ProviderBill extends BaseProvider {
  auth_mode: "BILL";
}

export interface ProviderGithubApp extends BaseProvider {
  auth_mode: "APP";
  token_url: string;
}

export interface ProviderTwoStep extends Omit<BaseProvider, "body_format"> {
  auth_mode: "TWO_STEP";
  signature?: {
    protocol: "RSA";
  };
  token?: {
    signing_key: string;
    expires_in_ms: number;
    header: {
      alg: string;
      typ?: string;
    };
    payload: {
      iss?: string;
      scope?: string;
      aud?: string;
      sub?: string;
    };
  };
  token_request_method?: "GET";
  token_headers?: Record<string, string>;
  refresh_url?: string;
  refresh_token_params?: Record<string, string>;
  refresh_token_headers?: Record<string, string>;
  token_response: {
    token: string;
    token_expiration?: string;
    token_expiration_strategy?: "expireAt" | "expireIn";
    refresh_token?: string;
  };
  token_response_headers?: string[];
  additional_steps?: {
    body_format?: "json" | "form";
    token_params?: Record<string, string>;
    token_headers?: Record<string, string>;
    token_url: string;
    token_request_method?: "GET";
  }[];
  assertion?: {
    type?: "saml" | "jwt";
    key?: string;
    issuer?: string;
    lifetimeInSeconds?: number;
    audiences?: string | string[];
    attributes?: Record<
      string,
      string | number | boolean | (string | number | boolean)[]
    >;
    sessionIndex?: string;
    recipient?: string;
    header?: Record<string, string>;
    payload?: Record<string, string>;
    singleUse?: boolean;
  };
  assertion_option?: Record<string, SimplifiedJSONSchema>;
  token_expires_in_ms?: number;
  proxy_header_authorization?: string;
  body_format?: "xml" | "json" | "form";
}

export interface ProviderSignature extends BaseProvider {
  auth_mode: "SIGNATURE";
  signature: {
    protocol: "WSSE";
  };
  token: {
    expires_in_ms: number;
  };
}

export interface ProviderAwsSigV4 extends BaseProvider {
  auth_mode: "AWS_SIGV4";
}

export interface ProviderApiKey extends BaseProvider {
  auth_mode: "API_KEY";
}

export interface ProviderInstallPlugin extends BaseProvider {
  auth_mode: "INSTALL_PLUGIN";
  auth_type: "BASIC";
}

export type Provider =
  | BaseProvider
  | ProviderOAuth1
  | ProviderOAuth2
  | ProviderJwt
  | ProviderTwoStep
  | ProviderSignature
  | ProviderAwsSigV4
  | ProviderApiKey
  | ProviderBill
  | ProviderGithubApp
  | ProviderCustom
  | ProviderMcpOAUTH2
  | ProviderMcpOAuth2Generic
  | ProviderInstallPlugin;
