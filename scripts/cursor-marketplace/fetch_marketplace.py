#!/usr/bin/env python3
"""
Fetch the complete Cursor Plugin Marketplace (https://cursor.com/marketplace),
including every plugin's metadata and its MCP server configuration (.mcp.json),
and save the result as a single JSON file.

Data sources
------------
1. POST https://cursor.com/api/dashboard/list-marketplace-plugins
   Unauthenticated, cursor-paginated (pageSize / pageToken -> nextPageToken/hasMore).
   Returns full plugin metadata: description, publisher, git source, skills,
   commands, hooks, rules, subagents, MCP server descriptors, categories, etc.

2. GitHub Contents API (GET /repos/{owner}/{repo}/contents/{path}?ref={sha})
   Used to download each plugin's pinned `.mcp.json` (the plugin repo snapshot
   referenced by `gitUrl` + `gitRef` + `gitPath`) so the real MCP transport
   details (HTTP url / stdio command) can be extracted.
   Authenticated via the local `gh` CLI token when available (5000 req/hour),
   otherwise falls back to unauthenticated requests (60 req/hour).

Usage
-----
    python3 fetch_marketplace.py [--output FILE] [--no-mcp-config]
        [--workers N] [--marketplace-id ID]

Output: a JSON object with top-level keys
    source, generatedAt, apiEndpoints, summary, plugins[]
"""

from __future__ import annotations

import argparse
import base64
import concurrent.futures as futures
import datetime
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

CURSOR_API = "https://cursor.com/api/dashboard/list-marketplace-plugins"
GET_PLUGIN_API = "https://cursor.com/api/dashboard/get-plugin"
MARKETPLACE_URL = "https://cursor.com/marketplace"

LIST_HEADERS = {"Content-Type": "application/json", "User-Agent": "cursor-marketplace-scraper/1.0"}


# --------------------------------------------------------------------------- #
# Cursor marketplace API
# --------------------------------------------------------------------------- #
def list_all_plugins(page_size: int = 100, marketplace_id: int | None = None) -> list[dict]:
    """Paginate the public marketplace listing until hasMore is false."""
    plugins: list[dict] = []
    page_token: str | None = None
    pages = 0
    while True:
        body: dict = {
            "pageSize": page_size,
            "excludeCloudAgentPlugins": False,
        }
        if marketplace_id is not None:
            body["marketplaceId"] = marketplace_id
        if page_token:
            body["pageToken"] = page_token

        req = urllib.request.Request(
            CURSOR_API, data=json.dumps(body).encode(), headers=LIST_HEADERS
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.load(resp)

        plugins.extend(data.get("plugins", []))
        pages += 1
        print(f"  listed {len(plugins)} plugins (page {pages})", file=sys.stderr)
        page_token = data.get("nextPageToken")
        if not data.get("hasMore") or not page_token:
            return plugins


# --------------------------------------------------------------------------- #
# GitHub helpers
# --------------------------------------------------------------------------- #
def gh_token() -> str | None:
    """Reuse the local `gh` CLI token when available (pure read usage)."""
    try:
        out = subprocess.run(
            ["gh", "auth", "token"], capture_output=True, text=True, timeout=10
        )
        token = out.stdout.strip()
        return token or None
    except Exception:
        return None


GITHUB_TOKEN = None  # set in main()


def _github_get(url: str) -> tuple[int, bytes]:
    headers = {"User-Agent": "cursor-marketplace-scraper/1.0"}
    if GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def _raw_get(owner: str, name: str, ref: str, path: str) -> tuple[int, bytes]:
    """Fetch a file from raw.githubusercontent (separate rate-limit pool from
    the REST API, and does not require auth for public repos). Retries 429s."""
    url = f"https://raw.githubusercontent.com/{owner}/{name}/{ref}/{path}"
    for attempt in range(3):
        status, body = _github_get(url)
        if status != 429:
            return status, body
        time.sleep(2 ** (attempt + 1))
    return status, body


CACHE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".mcp_config_cache.json")
_cache: dict[str, str | None] = {}  # key -> raw file body (None = confirmed 404)


def _cache_load() -> None:
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE) as f:
                _cache.update(json.load(f))
        except Exception:
            pass


def _cache_save() -> None:
    try:
        with open(CACHE_FILE, "w") as f:
            json.dump(_cache, f)
    except Exception:
        pass


def fetch_json_file(owner: str, name: str, git_ref: str, path: str) -> tuple[dict | None, bool]:
    """Fetch + decode a JSON file from GitHub at a pinned ref, falling back to
    the default branch when the pinned ref no longer exists (e.g. force-push).
    Returns (doc, used_default_branch)."""
    ref = git_ref or "HEAD"
    if ref != "HEAD":
        key = f"{owner}/{name}@{ref}/{path}"
        if key not in _cache:
            status, body = _raw_get(owner, name, ref, path)
            _cache[key] = body.decode("utf-8") if status == 200 else None
        raw = _cache[key]
        if raw is not None:
            try:
                return json.loads(raw), False
            except Exception:
                return None, False
    key = f"{owner}/{name}@HEAD/{path}"
    if key not in _cache:
        status, body = _raw_get(owner, name, "HEAD", path)
        _cache[key] = body.decode("utf-8") if status == 200 else None
    raw = _cache[key]
    if raw is None:
        return None, True
    try:
        return json.loads(raw), True
    except Exception:
        return None, True


def parse_github_repo(git_url: str) -> tuple[str, str] | None:
    """https://github.com/{owner}/{repo}.git -> (owner, repo)."""
    m = re.match(r"^https?://github\.com/([^/]+)/([^/]+?)(?:\.git)?/?$", git_url.strip())
    return (m.group(1), m.group(2)) if m else None


def blob_url(git_url: str, git_ref: str, git_path: str, file: str = ".mcp.json") -> str | None:
    repo = parse_github_repo(git_url)
    if not repo:
        return None
    owner, name = repo
    parts = [p for p in (git_path or ".").split("/") if p not in ("", ".")]
    path = "/".join(parts + [file]) if parts else file
    return f"https://github.com/{owner}/{name}/blob/{git_ref}/{path}"


def fetch_mcp_config(git_url: str, git_ref: str, git_path: str) -> tuple[str | None, dict | None, str | None, bool]:
    """
    Resolve a plugin's MCP server configuration.
    Returns (source_url, servers_config, error, pinned_ref_missing).

    Conventions supported, in order:
      1. `{gitPath}/.mcp.json` or `{gitPath}/mcp.json` containing {"mcpServers": {...}}
      2. `.cursor-plugin/plugin.json` manifest with inline "mcpServers": {...}
      3. `.cursor-plugin/plugin.json` with "mcpServers": "./path.json" (relative to gitPath)
    Falls back to the default branch when the pinned ref no longer exists.
    """
    repo = parse_github_repo(git_url)
    if not repo:
        return None, None, f"non-GitHub or invalid gitUrl: {git_url!r}", False
    owner, name = repo
    parts = [p for p in (git_path or ".").split("/") if p not in ("", ".")]
    prefix = "/".join(parts)

    def rel(f: str) -> str:
        return f"{prefix}/{f}" if prefix else f

    def blob(f: str, used_default: bool = False) -> str:
        ref = "HEAD" if used_default else (git_ref or "HEAD")
        return f"https://github.com/{owner}/{name}/blob/{ref}/{rel(f)}"

    ref_missing = False

    # 1. standalone mcp config files
    for f in (".mcp.json", "mcp.json"):
        doc, used_default = fetch_json_file(owner, name, git_ref, rel(f))
        ref_missing |= used_default
        if doc is None:
            continue
        servers = doc.get("mcpServers") if isinstance(doc, dict) else None
        if servers is None and isinstance(doc, dict):
            servers = {k: v for k, v in doc.items() if isinstance(v, dict) and ("url" in v or "command" in v)}
        if servers:
            return blob(f, used_default), servers, None, used_default
        return blob(f, used_default), None, "mcp config file has no mcpServers entries", used_default

    # 2/3. .cursor-plugin/plugin.json manifest (inline servers or path reference)
    manifest = None
    for mf in (".cursor-plugin/plugin.json", "plugin.json"):
        manifest, used_default = fetch_json_file(owner, name, git_ref, rel(mf))
        ref_missing |= used_default
        if manifest is not None:
            break
    if manifest is not None:
        servers = manifest.get("mcpServers")
        if isinstance(servers, dict) and servers:
            return blob(mf, used_default), servers, None, used_default
        if isinstance(servers, str) and servers:
            ref_path = servers[2:] if servers.startswith("./") else servers
            doc, used_default2 = fetch_json_file(
                owner, name, git_ref, f"{prefix}/{ref_path}" if prefix else ref_path)
            if doc is not None and isinstance(doc.get("mcpServers"), dict):
                return blob(ref_path, used_default2), doc["mcpServers"], None, used_default2
            return blob(ref_path), None, f"manifest-referenced mcp config not found: {servers}", used_default2

    return blob(".mcp.json"), None, "no mcp config found (likely a skills-only plugin)", ref_missing


def normalize_mcp_servers(servers: dict | None) -> list[dict]:
    """Normalize an mcpServers map into a flat server list."""
    if not isinstance(servers, dict):
        return []
    out = []
    for name, srv in servers.items():
        if not isinstance(srv, dict):
            continue
        entry: dict = {
            "name": name,
            "type": srv.get("type") or ("http" if srv.get("url") else "stdio"),
            "url": srv.get("url"),
            "command": srv.get("command"),
            "args": srv.get("args"),
            "envVarNames": sorted(srv["env"].keys()) if isinstance(srv.get("env"), dict) else None,
            "raw": srv,
        }
        out.append(entry)
    return out


def transport_summary(servers: list[dict]) -> dict:
    http = sum(1 for s in servers if s.get("url"))
    stdio = sum(1 for s in servers if s.get("command"))
    urls = sorted({s["url"] for s in servers if s.get("url")})
    return {"http": http, "stdio": stdio, "urls": urls}


# --------------------------------------------------------------------------- #
# Plugin shaping
# --------------------------------------------------------------------------- #
def iso(ms: str | int | None) -> str | None:
    if ms in (None, ""):
        return None
    try:
        return datetime.datetime.fromtimestamp(int(ms) / 1000, datetime.UTC).isoformat()
    except Exception:
        return None


def shape_plugin(p: dict) -> dict:
    publisher = p.get("publisher") or {}
    marketplace = p.get("marketplace") or {}
    ref = p.get("fullRef") or p.get("name") or ""
    detail_url = f"{MARKETPLACE_URL}/{ref}"
    pub_name = publisher.get("name")
    pub_url = f"{MARKETPLACE_URL}/{pub_name}" if pub_name else None
    return {
        "id": p.get("id"),
        "name": p.get("name"),
        "displayName": p.get("displayName"),
        "description": p.get("description"),
        "detailPageUrl": detail_url,
        "installUrl": f"{detail_url}",
        "logoUrl": p.get("logoUrl"),
        "primaryColor": p.get("primaryColor"),
        "tags": p.get("tags") or [],
        "curatedCategories": p.get("curatedCategoryKeys") or [],
        "status": p.get("status"),
        "lifecycleState": p.get("lifecycleState"),
        "isPublished": p.get("isPublished"),
        "isDeprecated": p.get("isDeprecated") or False,
        "deprecationMessage": p.get("deprecationMessage"),
        "replacedByPluginId": p.get("replacedByPluginId"),
        "minClientVersions": p.get("minClientVersions"),
        "repositoryUrl": p.get("repositoryUrl"),
        "gitUrl": p.get("gitUrl"),
        "gitRef": p.get("gitRef"),
        "gitPath": p.get("gitPath"),
        "fullRef": p.get("fullRef"),
        "release": {
            "repo": p.get("releaseRepo"),
            "asset": p.get("releaseAsset"),
            "tag": p.get("releaseTag"),
        } if p.get("releaseRepo") else None,
        "publisher": {
            "id": publisher.get("id"),
            "name": pub_name,
            "displayName": publisher.get("displayName"),
            "websiteUrl": publisher.get("websiteUrl"),
            "supportUrl": publisher.get("supportUrl"),
            "logoUrl": publisher.get("logoUrl"),
            "isVerified": publisher.get("isVerified") or False,
            "verifiedDomain": publisher.get("verifiedDomain"),
            "isUserOwned": publisher.get("isUserOwned") or False,
            "pageUrl": pub_url,
        },
        "marketplace": {
            "id": marketplace.get("id"),
            "name": marketplace.get("name"),
            "displayName": marketplace.get("displayName"),
        },
        "createdAt": iso(p.get("createdAt")),
        "updatedAt": iso(p.get("updatedAt")),
        "skills": [
            {"name": s.get("name"), "description": s.get("description")}
            for s in (p.get("skills") or [])
        ],
        "commands": [
            {"name": c.get("name"), "description": c.get("description"),
             "sourceUrl": c.get("sourceUrl")}
            for c in (p.get("commands") or [])
        ],
        "hooks": [
            {"name": h.get("name"), "description": h.get("description"),
             "sourceUrl": h.get("sourceUrl")}
            for h in (p.get("hooks") or [])
        ],
        "rules": p.get("rules") or [],
        "subagents": [
            {"name": s.get("name"), "description": s.get("description")}
            for s in (p.get("subagents") or [])
        ],
        "declaredMcpServers": [
            {"name": m.get("name"), "description": m.get("description"),
             "sourceUrl": m.get("sourceUrl")}
            for m in (p.get("mcpServers") or [])
        ],
        "variables": p.get("variables") or {},
    }


def enrich_mcp(plugin_shaped: dict, raw_plugin: dict) -> None:
    """Resolve the plugin's MCP configuration and attach transport details."""
    git_url = plugin_shaped["gitUrl"] or ""
    git_ref = plugin_shaped["gitRef"] or ""
    git_path = plugin_shaped["gitPath"] or "."
    src, servers_cfg, err, ref_missing = fetch_mcp_config(git_url, git_ref, git_path)
    mcp: dict = {
        "configSourceUrl": src,
        "configFetchError": err,
        "pinnedRefMissing": ref_missing,
        "servers": normalize_mcp_servers(servers_cfg),
        "endpoints": [],
    }
    mcp["endpoints"] = transport_summary(mcp["servers"])
    plugin_shaped["mcp"] = mcp


# --------------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------------- #
def main() -> int:
    ap = argparse.ArgumentParser(description="Fetch the Cursor Plugin Marketplace to JSON")
    ap.add_argument("--output", default="../../public/data/mcp-plugins.json")
    ap.add_argument("--no-mcp-config", action="store_true",
                    help="skip downloading each plugin's .mcp.json from GitHub")
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--marketplace-id", type=int, default=None)
    args = ap.parse_args()

    global GITHUB_TOKEN
    if not args.no_mcp_config:
        _cache_load()
        GITHUB_TOKEN = gh_token()
        print(f"GitHub auth: {'token from gh CLI' if GITHUB_TOKEN else 'unauthenticated (60 req/h limit!)'}",
              file=sys.stderr)

    print("Listing marketplace plugins...", file=sys.stderr)
    raw_plugins = list_all_plugins(marketplace_id=args.marketplace_id)
    print(f"Total plugins: {len(raw_plugins)}", file=sys.stderr)

    shaped = [shape_plugin(p) for p in raw_plugins]
    raw_by_id = {p.get("id"): p for p in raw_plugins}

    if not args.no_mcp_config:
        print("Fetching MCP configs from GitHub...", file=sys.stderr)
        targets = [(s, raw_by_id[s["id"]]) for s in shaped]
        with futures.ThreadPoolExecutor(max_workers=args.workers) as ex:
            futs = {ex.submit(enrich_mcp, s, r): s for s, r in targets}
            done = 0
            for fut in futures.as_completed(futs):
                done += 1
                if done % 50 == 0:
                    print(f"  enriched {done}/{len(targets)}", file=sys.stderr)
        errors = [s["name"] for s in shaped if s["mcp"] and s["mcp"]["configFetchError"]]
        print(f"MCP config fetch errors: {len(errors)}", file=sys.stderr)
        if errors:
            print(f"  affected: {errors[:20]}{'...' if len(errors) > 20 else ''}", file=sys.stderr)
        _cache_save()

    # ---- summary ----
    by_category: dict[str, int] = {}
    by_publisher: dict[str, int] = {}
    transports = {"http": 0, "stdio": 0}
    mcp_urls: set[str] = set()
    with_mcp = with_skills = with_commands = 0
    for s in shaped:
        for c in s["curatedCategories"]:
            by_category[c] = by_category.get(c, 0) + 1
        pn = s["publisher"]["name"] or "(unknown)"
        by_publisher[pn] = by_publisher.get(pn, 0) + 1
        mcp = s.get("mcp") or {}
        t = (mcp.get("endpoints") or {})
        transports["http"] += t.get("http", 0) or 0
        transports["stdio"] += t.get("stdio", 0) or 0
        mcp_urls.update(t.get("urls") or [])
        if mcp.get("servers"):
            with_mcp += 1
        if s["skills"]:
            with_skills += 1
        if s["commands"]:
            with_commands += 1

    result = {
        "source": MARKETPLACE_URL,
        "generatedAt": datetime.datetime.now(datetime.UTC).isoformat(),
        "apiEndpoints": {
            "listPlugins": "POST https://cursor.com/api/dashboard/list-marketplace-plugins",
            "getPlugin": "POST https://cursor.com/api/dashboard/get-plugin",
            "pluginDetailPage": "https://cursor.com/marketplace/{fullRef}",
        },
        "summary": {
            "totalPlugins": len(shaped),
            "pluginsWithMcpServer": with_mcp,
            "pluginsWithSkills": with_skills,
            "pluginsWithCommands": with_commands,
            "mcpServerTransports": transports,
            "distinctMcpServerUrls": len(mcp_urls),
            "mcpServerUrls": sorted(mcp_urls),
            "byCategory": dict(sorted(by_category.items(), key=lambda kv: -kv[1])),
            "byPublisher": dict(sorted(by_publisher.items(), key=lambda kv: -kv[1])),
        },
        "plugins": shaped,
    }

    out = os.path.abspath(args.output)
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    with open(out, "w") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"Wrote {out} ({os.path.getsize(out) / 1e6:.1f} MB)", file=sys.stderr)

    print(json.dumps({
        "output": out,
        "totalPlugins": len(shaped),
        "withMcpServer": with_mcp,
        "mcpServerUrls": len(mcp_urls),
    }, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())