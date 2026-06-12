/**
 * Shared SQL transforms for CockroachDB (used by apply runner and upload bundle prep).
 * See: https://www.cockroachlabs.com/docs/stable/int — INT defaults to INT8 on CRDB;
 * use SET default_int_size = 4 or explicit INT4 for Postgres-like INTEGER semantics.
 */

/** Dollar-quote–aware split on semicolons (handles $$ and $tag$). */
export function splitSqlStatements(sql) {
  const stmts = [];
  let buf = "";
  let i = 0;
  let dollarTag = null;
  let inLineComment = false;
  let inBlockComment = false;
  let inSingle = false;

  const pushBuf = () => {
    const t = buf.trim();
    if (t) stmts.push(t);
    buf = "";
  };

  while (i < sql.length) {
    const c = sql[i];
    const next = sql[i + 1];

    if (inLineComment) {
      buf += c;
      if (c === "\n") inLineComment = false;
      i++;
      continue;
    }
    if (inBlockComment) {
      buf += c;
      if (c === "*" && next === "/") {
        buf += next;
        i += 2;
        inBlockComment = false;
        continue;
      }
      i++;
      continue;
    }
    if (inSingle) {
      buf += c;
      if (c === "'" && next === "'") {
        buf += next;
        i += 2;
        continue;
      }
      if (c === "'") inSingle = false;
      i++;
      continue;
    }

    if (dollarTag) {
      if (sql.startsWith(dollarTag, i)) {
        buf += dollarTag;
        i += dollarTag.length;
        dollarTag = null;
        continue;
      }
      buf += c;
      i++;
      continue;
    }

    if (c === "-" && next === "-") {
      inLineComment = true;
      buf += c + next;
      i += 2;
      continue;
    }
    if (c === "/" && next === "*") {
      inBlockComment = true;
      buf += c + next;
      i += 2;
      continue;
    }
    if (c === "'") {
      inSingle = true;
      buf += c;
      i++;
      continue;
    }
    if (c === "$") {
      const rest = sql.slice(i);
      const m = rest.match(/^\$([A-Za-z0-9_]*)\$/);
      if (m) {
        dollarTag = m[0];
        buf += dollarTag;
        i += dollarTag.length;
        continue;
      }
    }

    if (c === ";") {
      pushBuf();
      i++;
      continue;
    }

    buf += c;
    i++;
  }
  pushBuf();
  return stmts;
}

function preprocessPlatformExtensionIdentityExpansion(sql) {
  let s = sql;

  s = s.replace(
    /-- Extension bootstrap \(idempotent CREATE EXTENSION loop\)[\s\S]*?\bend \$\$;\s*\n/im,
    "-- CRDB: extension bootstrap omitted\n\n",
  );

  s = s.replace(
    /-- Full-text search: accent-insensitive[\s\S]*?\bend \$\$;\s*\n/im,
    "-- CRDB: unaccent / clauxen_unaccent config omitted\n\n",
  );

  s = s.replace(
    /-- Generated STORED tsvector columns[\s\S]*?document_chunks_content_unaccent_gin_idx[\s\S]*?;/im,
    "-- CRDB: generated tsvector FTS columns + GIN indexes omitted\n",
  );

  s = s.replace(
    /-- PGMQ: durable worker queues[\s\S]*?\bend \$\$;\s*\n/im,
    "-- CRDB: PGMQ queue creation omitted\n\n",
  );

  s = s.replace(
    /-- Schema privilege hardening[\s\S]*?declare\s*\n\s*v_schema text;[\s\S]*?\bend \$\$;\s*\n/im,
    "-- CRDB: dynamic schema privilege hardening omitted\n\n",
  );

  s = s.replace(
    /-- pgAudit:[\s\S]*?if exists \(select 1 from pg_extension where extname = 'pgaudit'\)[\s\S]*?end \$\$;\s*\n/im,
    "-- CRDB: pgaudit role bootstrap omitted\n\n",
  );

  s = s.replace(
    /do \$\$\s*\nbegin\s*\n\s*if exists \(select 1 from pg_roles where rolname = 'clauxen_pgaudit'\)[\s\S]*?\bend \$\$;\s*\n/im,
    "-- CRDB: pgaudit grants / role settings omitted\n\n",
  );

  s = s.replace(
    /-- Optional fuzzy search indexes \(pg_trgm\)[\s\S]*?\bend \$\$;\s*\n/im,
    "-- CRDB: optional pg_trgm indexes omitted\n\n",
  );

  s = s.replace(/\bdomain extensions\.citext\b/gi, "text");

  s = s.replace(
    /create or replace function private\.enqueue_clauxen_job\([\s\S]*?\n\$\$;\r?\n\r?\ncomment on function private\.enqueue_clauxen_job/is,
    `create or replace function private.enqueue_clauxen_job(
  p_queue_name text,
  p_payload jsonb,
  p_delay_seconds integer default 0
)
returns bigint
language plpgsql
security definer
as $enqueue$
begin
  raise notice 'enqueue_clauxen_job: PGMQ not available on CockroachDB; returning 0';
  return 0::bigint;
end;
$enqueue$;

comment on function private.enqueue_clauxen_job`,
  );

  s = s.replace(
    /create or replace function public\.search_user_messages\([\s\S]*?\n\$\$;\r?\n\r?\ncomment on function public\.search_user_messages/is,
    `create or replace function public.search_user_messages(
  p_query text,
  p_limit integer default 20
)
returns table (
  message_id uuid,
  chat_id uuid,
  title text,
  role text,
  content text,
  created_at timestamptz
)
language sql
security definer
as $search$
  select
    null::uuid as message_id,
    null::uuid as chat_id,
    null::text as title,
    null::text as role,
    null::text as content,
    null::timestamptz as created_at
  where false;
$search$;

comment on function public.search_user_messages`,
  );

  return s;
}

/** Expand PL/pgSQL FOREACH … EXECUTE FORMAT loops (unsupported on CockroachDB). */
function expandForeachDoBlocks(sql) {
  let s = sql;

  // foreach t in array array['a', 'b'] loop execute format('alter table public.%I enable row level security', t);
  s = s.replace(
    /do \$\$\s*declare\s+\w+\s+text;\s*begin\s*foreach\s+(\w+)\s+in\s+array\s+array\[([\s\S]*?)\]\s*loop\s*execute format\('alter table public\.%I enable row level security',\s*\1\);\s*end loop;\s*end\s*\$\$/gi,
    (_, _var, arrBody) => {
      const tables = [...arrBody.matchAll(/'([^']+)'/g)].map((m) => m[1]);
      return tables
        .map((t) => `alter table public.${t} enable row level security;`)
        .join("\n");
    },
  );

  // foreach v_table in array v_tables loop … (v_tables := array[...])
  s = s.replace(
    /do \$\$\s*declare\s+(\w+)\s+text;\s*(\w+)\s+text\[\]\s*:=\s*array\[([\s\S]*?)\];\s*begin\s*foreach\s+\1\s+in\s+array\s+\2\s+loop([\s\S]*?)end loop;\s*end\s*\$\$/gi,
    (_, _v, _arrName, arrBody, loopBody) => {
      const items = [...arrBody.matchAll(/'([^']+)'/g)].map((m) => m[1]);
      if (/enable row level security/.test(loopBody)) {
        const lines = items.map(
          (t) => `alter table public.${t} enable row level security;`,
        );
        if (/alter publication supabase_realtime/.test(loopBody)) {
          return "-- CRDB: omitted foreach publication + RLS block\n";
        }
        return lines.join("\n");
      }
      if (/alter publication supabase_realtime/.test(loopBody)) {
        return "-- CRDB: omitted foreach publication block\n";
      }
      return "-- CRDB: omitted PL/pgSQL FOREACH block\n";
    },
  );

  // foreach v_signature in array v_signatures loop revoke/grant on functions
  s = s.replace(
    /do \$\$\s*declare\s+(\w+)\s+text;\s*(\w+)\s+text\[\]\s*:=\s*array\[([\s\S]*?)\];\s*begin\s*foreach\s+\1\s+in\s+array\s+\2\s+loop\s*execute format\('revoke all on function %s from public',\s*\1\);\s*execute format\('revoke all on function %s from anon',\s*\1\);\s*execute format\('revoke all on function %s from authenticated',\s*\1\);\s*execute format\('grant execute on function %s to service_role',\s*\1\);\s*end loop;\s*end\s*\$\$/gi,
    (_, _v, _arrName, arrBody) => {
      const sigs = [...arrBody.matchAll(/'([^']+)'/g)].map((m) => m[1]);
      return sigs
        .flatMap((sig) => [
          `revoke all on function ${sig} from public;`,
          `revoke all on function ${sig} from anon;`,
          `revoke all on function ${sig} from authenticated;`,
          `grant execute on function ${sig} to service_role;`,
        ])
        .join("\n");
    },
  );

  // foreach v_schema in array array['net', ...] loop revoke schema usage
  s = s.replace(
    /do \$\$\s*declare\s+\w+\s+text;\s*begin\s*foreach\s+\w+\s+in\s+array\s+array\[([\s\S]*?)\]\s*loop[\s\S]*?end loop;\s*end\s*\$\$/gi,
    (_, arrBody) => {
      const schemas = [...arrBody.matchAll(/'([^']+)'/g)].map((m) => m[1]);
      return schemas
        .map(
          (schema) =>
            `-- CRDB: schema privilege hardening for ${schema} omitted (no matching Supabase extension schema)\n`,
        )
        .join("");
    },
  );

  // Remaining FOREACH inside DO blocks
  s = s.replace(
    /do \$\$[\s\S]*?\bforeach\b[\s\S]*?end\s*\$\$/gi,
    "-- CRDB: omitted PL/pgSQL FOREACH block (unimplemented on CockroachDB)\n",
  );

  return s;
}

/** Expand FOR r IN SELECT … information_schema loops (dynamic trigger attachment). */
function expandInformationSchemaForLoops(sql) {
  return sql.replace(
    /do \$\$\s*declare\s+r record;\s*begin\s*for r in\s*select table_name[\s\S]*?where table_schema = 'public'[\s\S]*?table_name in \(([\s\S]*?)\)[\s\S]*?loop\s*perform public\.ensure_updated_at_trigger\(format\('public\.%I', r\.table_name\)::regclass\);\s*end loop;\s*end\s*\$\$/gi,
    (_, tableList) => {
      const tables = [...tableList.matchAll(/'([^']+)'/g)].map((m) => m[1]);
      return tables
        .map(
          (t) =>
            `select public.ensure_updated_at_trigger(format('public.%I', '${t}')::regclass);`,
        )
        .join("\n");
    },
  );
}

/** CockroachDB: strip short aliases outside policies (policies handled in fixCrdbRlsPolicies). */
export function fixCrdbRlsSubqueryAliases(sql) {
  return sql;
}

/** CockroachDB RLS: fully-qualified table names in policies (no short aliases). */
export function fixCrdbRlsPolicies(sql) {
  return sql.replace(/create policy[\s\S]*?;/gi, (block) => {
    let b = block;
    const aliasTables = [
      ["workspace_members", "wm"],
      ["workspaces", "w"],
      ["assistant_profiles", "a"],
    ];
    for (const [table, alias] of aliasTables) {
      b = b.replace(
        new RegExp(`from\\s+public\\.${table}\\s+${alias}\\b`, "gi"),
        `from public.${table}`,
      );
      b = b.replace(new RegExp(`\\b${alias}\\.`, "g"), `public.${table}.`);
    }
    b = b.replace(/\bworkspaces\.(id|owner_id)\b/g, "public.workspaces.$1");
    b = b.replace(
      /\bworkspace_members\.(workspace_id|user_id|status)\b/g,
      "public.workspace_members.$1",
    );
    b = b.replace(
      /\bassistant_profiles\.(workspace_id|id)\b/g,
      "public.assistant_profiles.$1",
    );
    return b;
  });
}

/** CockroachDB: CREATE TYPE inside DO $$ is not supported — hoist to top level. */
export function expandEnumDoBlocks(sql) {
  return sql.replace(
    /do \$\$\s*begin\s*create type (public\.\w+) as enum\s*\(([\s\S]*?)\)\s*;\s*exception when duplicate_object then null;\s*end \$\$/gi,
    (_, typeName, values) =>
      `CREATE TYPE IF NOT EXISTS ${typeName} AS ENUM (${values.trim()});`,
  );
}

export function preprocessMigration(sql, filename) {
  let s = sql;

  s = expandEnumDoBlocks(s);
  s = expandForeachDoBlocks(s);
  s = expandInformationSchemaForLoops(s);
  s = fixCrdbRlsSubqueryAliases(s);
  s = fixCrdbRlsPolicies(s);

  if (filename.includes("platform_primitives")) {
    s = s.replace(
      /create or replace function public\.handle_new_user\(\)[\s\S]*?comment on function public\.handle_new_user/is,
      `create or replace function public.handle_new_user()
returns trigger
language plpgsql
as $tr$
begin
  return new;
end;
$tr$;

comment on function public.handle_new_user`,
    );
    s = s.replace(
      /create trigger on_auth_user_created[\s\S]*?execute function public\.handle_new_user\(\)\s*;/gi,
      "-- CRDB: auth.users signup trigger omitted (GoTrue stub; use bootstrap_existing_auth_users)\n",
    );
    s = s.replace(
      /^select public\.bootstrap_existing_auth_users\(\)\s*;/gim,
      "-- CRDB: run bootstrap_existing_auth_users() manually after seeding auth.users if needed\n",
    );
  }

  if (filename.includes("platform_extension_identity_expansion")) {
    s = preprocessPlatformExtensionIdentityExpansion(s);
  }

  if (filename.includes("performance_advisor_rls_cleanup")) {
    s = s.replace(
      /do\s+\$\$[\s\S]*?\bfrom\s+pg_policies\b[\s\S]*?\$\$\s*;/im,
      "-- CRDB: omitted bulk policy rewrite via pg_policies (not portable)\n",
    );
  }

  s = s.replace(/\bexecute function\b/gi, "EXECUTE FUNCTION");
  s = s.replace(/\bexecute procedure\b/gi, "EXECUTE PROCEDURE");

  s = s.replace(
    /^\s*create extension if not exists pgcrypto\s*;\s*$/gim,
    "-- omitted on CRDB: pgcrypto (digest/gen_random_bytes are builtins)\n",
  );

  s = s.replace(
    /create extension if not exists pgcrypto with schema extensions\s*;/gi,
    "-- omitted on CRDB: pgcrypto extension; digest() is builtin\n",
  );

  s = s.replace(
    /^\s*create extension if not exists vector\s*;\s*$/gim,
    "-- omitted on CRDB: native VECTOR type (no pgvector extension)\n",
  );

  s = s.replace(
    /create or replace function public\.ensure_updated_at_trigger\(p_table regclass\)\s*returns void\s*language plpgsql\s*as \$\$[\s\S]*?end;\s*\$\$/i,
    `create or replace function public.ensure_updated_at_trigger(p_table regclass)
returns void
language plpgsql
as $$$$
begin
  -- CockroachDB compatibility: dynamic trigger DDL in PL/pgSQL is not supported.
  -- Tables with explicit triggers keep them; bulk trigger attachment is skipped.
  return;
end;
$$$$`,
  );

  s = s.replace(/\bvector\s*\(\s*(\d+)\s*\)/gi, "VECTOR($1)");
  s = s.replace(/\bextensions\.vector\s*\(\s*(\d+)\s*\)/gi, "VECTOR($1)");

  s = s.replace(
    /public\.match_document_chunks\(extensions\.vector,\s*integer,\s*jsonb\)/gi,
    "public.match_document_chunks(VECTOR(1536), integer, jsonb)",
  );

  s = s.replace(
    /^\s*alter table(\s+if\s+exists)?\s+[^;]*\breplica identity\b[^;]*;\s*$/gim,
    "-- omitted on CRDB: REPLICA IDENTITY\n",
  );

  s = s.replace(
    /execute format\s*\(\s*'alter table public\.%I replica identity full'\s*,\s*v_table\s*\)\s*;/gi,
    "execute 'select 1'; -- replica identity omitted on CRDB\n",
  );

  s = s.replace(/\blanguage sql\s*\n\s*volatile\b/gi, "LANGUAGE SQL\nVOLATILE");

  s = s.replace(
    /\r?\n\s*set search_path\s*=[^\r\n]+\r?\n(\s*as\s*\$\$)/gi,
    "\n$1",
  );

  s = s.replace(
    /alter function[\s\S]{0,1200}?\bset search_path\s*=\s*[^;]+;/gi,
    "-- omitted on CRDB: ALTER FUNCTION ... SET search_path\n",
  );
  s = s.replace(
    /^\s*comment on\b[\s\S]*?;\s*$/gim,
    "-- omitted on CRDB: COMMENT ON metadata\n",
  );

  s = s.replace(/\bif found then\b/gi, "if (v_txn).id is not null then");
  s = s.replace(
    /(select \* into v_order from public\.billing_orders where razorpay_order_id = p_order_id for update;\s*)if not found then/gi,
    "$1if (v_order).id is null then",
  );
  s = s.replace(
    /(select \* into v_plan from public\.plans where id = v_order\.plan_id and is_active = true;\s*)if not found then/gi,
    "$1if (v_plan).id is null then",
  );
  s = s.replace(
    /(select \* into v_gift\s+from public\.gift_codes\s+where id = p_gift_id\s+for update;\s*)if not found then/gi,
    "$1if (v_gift).id is null then",
  );
  s = s.replace(
    /(select \* into v_gift\s+from public\.gift_codes\s+where code_hash = public\.hash_gift_code\(p_code\)\s+for update;\s*)if not found then/gi,
    "$1if (v_gift).id is null then",
  );
  s = s.replace(
    /perform 1 from public\.plans where id = v_order\.plan_id and is_active = true;\s*if not found then/gi,
    "if not exists (select 1 from public.plans where id = v_order.plan_id and is_active = true) then",
  );
  s = s.replace(
    /return query select ('(?:already_fulfilled|fulfilled)'::text), p_order_id, p_payment_id, v_order\.tokens;/gi,
    "status := $1; order_id := p_order_id; payment_id := p_payment_id; tokens_added := v_order.tokens; return next;",
  );
  s = s.replace(
    /return query select ('(?:already_fulfilled|fulfilled)'::text), p_order_id, p_payment_id, v_order\.tokens, v_subscription_id, v_order\.gift_id;/gi,
    "status := $1; order_id := p_order_id; payment_id := p_payment_id; tokens_added := v_order.tokens; subscription_id := v_subscription_id; gift_id := v_order.gift_id; return next;",
  );
  s = s.replace(
    /return query select ('redeemed'::text), v_gift\.id, v_subscription_id, v_gift\.token_grant, v_period_end;/gi,
    "status := $1; gift_id := v_gift.id; subscription_id := v_subscription_id; tokens_added := v_gift.token_grant; expires_at := v_period_end; return next;",
  );
  s = s.replace(/\bperform\s+/gi, "select ");
  s = s.replace(
    /execute format\('update public\.%I set %I = coalesce\(%I, 0\) \+ \$1, updated_at = now\(\) where id = \$2', p_table_name, p_field_name, p_field_name\)\s+using p_amount, p_row_id;/gi,
    "execute format('update public.%I set %I = coalesce(%I, 0) + %L, updated_at = now() where id = %L', p_table_name, p_field_name, p_field_name, p_amount, p_row_id);",
  );
  s = s.replace(
    /execute format\('update public\.%I set %I = coalesce\(%I, 0\) \+ %L, updated_at = now\(\) where id = %L', p_table_name, p_field_name, p_field_name, p_amount, p_row_id\);/gi,
    "raise exception 'increment_numeric_field is not available on CockroachDB; update explicit tables from application code';",
  );
  s = s.replace(/\bv_([A-Za-z0-9_]+)\.([A-Za-z_][A-Za-z0-9_]*)/g, "(v_$1).$2");

  s = s.replace(
    /^\s*alter publication supabase_realtime[^;]*;\s*$/gim,
    "-- omitted on CRDB: supabase_realtime\n",
  );

  s = s.replace(
    /^\s*create publication supabase_realtime[^;]*;\s*$/gim,
    "-- omitted on CRDB: create publication\n",
  );

  s = s.replace(
    /do\s+\$\$\s*begin\s+alter publication supabase_realtime add table[\s\S]*?end\s+\$\$\s*;/gi,
    "-- omitted on CRDB: ALTER PUBLICATION supabase_realtime (wrapped DO)\n",
  );

  s = s.replace(
    /\bnotify\s+pgrst\s*,\s*'reload schema'\s*;/gi,
    "-- omitted on CRDB: NOTIFY pgrst (PostgREST)\n",
  );

  if (
    filename.includes("supabase_extreme_performance_hardening") ||
    filename.includes("supabase_low_compute_maintenance_split")
  ) {
    s = s.replace(
      /^\s*create extension if not exists pg_cron[^;]*;\s*$/gim,
      "-- omit pg_cron\n",
    );
    s = s.replace(/(?:perform|select)\s+cron\.[^;]+;/gim, "-- omit cron\n");
  }

  return s;
}

/** Extra transforms for manual CockroachDB Cloud SQL upload bundles. */
export function preprocessCrdbUploadSql(sql, filename) {
  let s = preprocessMigration(sql, filename);

  s = s.replace(
    /\bnotify\s+pgrst\s*,[^;]+;/gi,
    "-- omitted on CRDB: NOTIFY pgrst (PostgREST)\n",
  );

  return s;
}

export function isIndexStatement(stmt) {
  const normalized = stmt
    .replace(/^\s*--.*$/gm, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return (
    normalized.startsWith("create index") ||
    normalized.startsWith("create unique index")
  );
}

/** Safe to send multiple statements in one round-trip (CRDB: no mixed backfill DDL). */
export function canBatchStatement(stmt) {
  if (/\$\$/.test(stmt)) return false;
  if (/\$[A-Za-z][A-Za-z0-9_]*\$/.test(stmt)) return false;
  const normalized = stmt
    .replace(/^\s*--.*$/gm, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (!normalized || normalized.startsWith("--")) return false;
  if (
    normalized.startsWith("alter table") ||
    normalized.startsWith("create policy") ||
    normalized.startsWith("drop policy") ||
    normalized.startsWith("create or replace function") ||
    normalized.startsWith("create type") ||
    normalized.startsWith("insert into") ||
    normalized.includes("enable row level security")
  ) {
    return false;
  }
  return (
    normalized.startsWith("create table") ||
    normalized.startsWith("create schema") ||
    normalized.startsWith("create role") ||
    normalized.startsWith("grant ") ||
    normalized.startsWith("revoke ")
  );
}

export function isSchemaOnlyStatement(stmt) {
  const normalized = stmt
    .replace(/^\s*--.*$/gm, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  if (!normalized) return false;

  return (
    normalized.startsWith("create schema") ||
    normalized.startsWith("create type") ||
    normalized.startsWith("create table") ||
    normalized.startsWith("alter table") ||
    normalized.startsWith("create sequence") ||
    normalized.startsWith("alter sequence") ||
    normalized.startsWith("create role") ||
    normalized.startsWith("grant ") ||
    normalized.startsWith("revoke ") ||
    normalized.startsWith("drop database") ||
    normalized.startsWith("create database")
  );
}
