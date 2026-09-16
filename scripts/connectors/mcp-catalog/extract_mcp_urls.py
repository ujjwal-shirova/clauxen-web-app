#!/usr/bin/env python3
"""Discover remote MCP URLs for every ChatGPT plugin catalog entry (stdlib only)."""

from __future__ import annotations

import json
import re
import ssl
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
CATALOG = ROOT / "plugins.json"
OUT = ROOT / "mcp-urls.json"
PROGRESS = ROOT / "mcp-urls.progress.json"

USER_AGENT = (
    "ClauxenMCPExtractor/1.0 (+https://clauxen.com; catalog MCP URL discovery)"
)
REGISTRY = "https://registry.modelcontextprotocol.io/v0/servers"
SKIP_HOSTS = {
    "chatgpt.com",
    "chat.openai.com",
    "openai.com",
    "files.openai.com",
    "platform.openai.com",
    "localhost",
    "127.0.0.1",
}
GENERIC_REPO_HOSTS = {
    "github.com",
    "gitlab.com",
    "bitbucket.org",
    "gist.github.com",
    "raw.githubusercontent.com",
    "githubusercontent.com",
    "npmjs.com",
    "www.npmjs.com",
    "pypi.org",
    "huggingface.co",
    "gitlab.io",
}
MCP_PATHS = (
    "/mcp",
    "/sse",
    "/api/mcp",
    "/.well-known/oauth-protected-resource",
)
URL_RE = re.compile(r"https?://[^\s\"'<>)\\]]+", re.I)
MCPISH_RE = re.compile(
    r"https?://[^\s\"'<>)\\]]*(?:/mcp(?:/|$|\?)|/sse(?:/|$|\?)|mcp\.)",
    re.I,
)
INIT_BODY = json.dumps(
    {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": "2025-03-26",
            "capabilities": {},
            "clientInfo": {"name": "clauxen-extractor", "version": "1.0.0"},
        },
    }
).encode()
CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE


def norm_host(value: str) -> str:
    host = urlparse(value).netloc.lower().split("@")[-1].split(":")[0]
    if host.startswith("www."):
        host = host[4:]
    return host


def origin(value: str) -> str | None:
    try:
        parsed = urlparse(value)
    except Exception:
        return None
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return None
    host = parsed.netloc.lower()
    if host.startswith("www."):
        host = host[4:]
    if host in SKIP_HOSTS or host.endswith(".openai.com"):
        return None
    return f"{parsed.scheme}://{host}"


def slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", (value or "").lower())


def http(
    method: str,
    url: str,
    data: bytes | None = None,
    timeout: float = 4.0,
    max_bytes: int = 20000,
) -> tuple[int, dict[str, str], bytes]:
    headers = {"user-agent": USER_AGENT, "accept": "*/*"}
    if data is not None:
        headers["content-type"] = "application/json"
        headers["accept"] = "application/json, text/event-stream"
    req = Request(url, data=data, headers=headers, method=method)
    try:
        with urlopen(req, timeout=timeout, context=CTX) as resp:
            return (
                resp.status,
                {k.lower(): v for k, v in resp.headers.items()},
                resp.read(max_bytes),
            )
    except HTTPError as err:
        try:
            body = err.read(max_bytes)
        except Exception:
            body = b""
        return err.code, {k.lower(): v for k, v in err.headers.items()}, body
    except (URLError, TimeoutError, ssl.SSLError, OSError, ValueError, Exception):
        return 0, {}, b""


def get_json(url: str, timeout: int = 30) -> dict[str, Any]:
    status, _, body = http("GET", url, timeout=timeout, max_bytes=2_000_000)
    if status != 200:
        raise RuntimeError(f"{url} -> HTTP {status}")
    return json.loads(body.decode("utf-8", "replace"))


def load_registry() -> list[dict[str, Any]]:
    servers: list[dict[str, Any]] = []
    cursor = ""
    pages = 0
    while True:
        url = f"{REGISTRY}?limit=100"
        if cursor:
            url += f"&cursor={cursor}"
        payload = get_json(url)
        batch = payload.get("servers") or []
        pages += 1
        for item in batch:
            meta = (item.get("_meta") or {}).get(
                "io.modelcontextprotocol.registry/official"
            ) or {}
            remotes = ((item.get("server") or {}).get("remotes") or [])
            if remotes and meta.get("isLatest", True):
                servers.append(item)
        cursor = (payload.get("metadata") or {}).get("nextCursor") or ""
        print(
            f"registry page={pages} remotes={len(servers)}",
            flush=True,
        )
        if not cursor or not batch or pages >= 80:
            break
    return servers


def registry_indexes(servers: list[dict[str, Any]]) -> dict[str, dict[str, list[str]]]:
    by_host: dict[str, list[str]] = defaultdict(list)
    by_slug: dict[str, list[str]] = defaultdict(list)
    for item in servers:
        server = item.get("server") or {}
        remotes = [
            r.get("url")
            for r in (server.get("remotes") or [])
            if isinstance(r, dict) and r.get("url")
        ]
        if not remotes:
            continue
        names = [
            server.get("title") or "",
            server.get("name") or "",
            (server.get("name") or "").split("/")[-1],
        ]
        for remote in remotes:
            host = norm_host(remote)
            if host and host not in GENERIC_REPO_HOSTS:
                by_host[host].extend(remotes)
        for name in names:
            key = slug(name)
            if len(key) >= 4:
                by_slug[key].extend(remotes)
        repo = (server.get("repository") or {}).get("url") or ""
        host = norm_host(repo)
        if host and host not in GENERIC_REPO_HOSTS and host not in SKIP_HOSTS:
            by_host[host].extend(remotes)
    return {
        "host": {k: list(dict.fromkeys(v)) for k, v in by_host.items()},
        "slug": {k: list(dict.fromkeys(v)) for k, v in by_slug.items()},
    }


def catalog_candidates(plugin: dict[str, Any]) -> list[str]:
    found: list[str] = []
    for key in (
        "websiteUrl",
        "privacyPolicyUrl",
        "termsOfServiceUrl",
        "description",
        "longDescription",
        "directoryDescription",
    ):
        text = plugin.get(key) or ""
        if not isinstance(text, str):
            continue
        for match in URL_RE.findall(text):
            match = match.rstrip(").,;]")
            if MCPISH_RE.search(match) and origin(match):
                found.append(match)
    return list(dict.fromkeys(found))


def plugin_origins(plugin: dict[str, Any]) -> list[str]:
    origins = []
    item = origin(plugin.get("websiteUrl") or "")
    if item:
        origins.append(item)
    return origins


def looks_like_mcp(status: int, headers: dict[str, str], body: bytes) -> bool:
    ctype = headers.get("content-type", "").lower()
    www = headers.get("www-authenticate", "")
    text = body[:4000].decode("utf-8", "replace")
    lowered = text.lower()
    if "resource_metadata" in www or "oauth-protected-resource" in www:
        return True
    if "text/event-stream" in ctype:
        return True
    if "mcp-session-id" in headers:
        return True
    if '"jsonrpc"' in lowered and (
        "initialize" in lowered
        or "protocolversion" in lowered
        or '"result"' in lowered
        or '"error"' in lowered
    ):
        return True
    if "authorization_servers" in lowered and '"resource"' in lowered:
        return True
    if status in {401, 405} and ("mcp" in lowered or "jsonrpc" in lowered or www):
        return True
    return False


CACHE: dict[str, bool] = {}


def well_known_resource(body: bytes) -> str | None:
    try:
        data = json.loads(body.decode("utf-8", "replace"))
    except Exception:
        return None
    if not isinstance(data, dict):
        return None
    resource = data.get("resource")
    if isinstance(resource, str) and resource.startswith(("http://", "https://")):
        return resource.rstrip("/")
    return None


def probe_url(url: str) -> bool:
    if url in CACHE:
        return CACHE[url]
    ok = False
    well_known = "oauth-protected-resource" in url
    if well_known:
        status, headers, body = http("GET", url)
        ok = looks_like_mcp(status, headers, body)
        resource = well_known_resource(body)
        if resource and resource != url:
            CACHE[url] = ok
            probe_url(resource)
            return ok
    else:
        status, headers, body = http("POST", url, INIT_BODY)
        ok = looks_like_mcp(status, headers, body)
        if not ok:
            status, headers, body = http("GET", url)
            ok = looks_like_mcp(status, headers, body)
    CACHE[url] = ok
    return ok


def url_rank(url: str) -> int:
    path = urlparse(url).path.lower()
    host = urlparse(url).netloc.lower()
    if "oauth-protected-resource" in path:
        return 90
    if path.endswith("/mcp") or "/mcp/" in path or path.endswith("/api/mcp"):
        return 0
    if path.endswith("/sse") or "/sse/" in path:
        return 1
    if host.startswith("mcp.") or ".mcp." in host:
        return 2
    return 10


def hosts_related(a: str, b: str) -> bool:
    if not a or not b:
        return False
    if a == b:
        return True
    return a.endswith("." + b) or b.endswith("." + a)


def row_needs_reprobe(row: dict[str, Any], plugin: dict[str, Any]) -> bool:
    website_host = norm_host(plugin.get("websiteUrl") or "")
    methods = set(row.get("methods") or [])
    mcp = row.get("mcpUrl") or ""
    mcp_host = norm_host(mcp) if mcp else ""
    if website_host in GENERIC_REPO_HOSTS and "registry_host" in methods:
        return True
    if mcp_host and website_host and not hosts_related(website_host, mcp_host):
        if methods & {"catalog_text", "homepage_scrape", "well_known_resource"}:
            return False
        return True
    return False


def scrape_home(base: str) -> list[str]:
    status, _, body = http("GET", base, timeout=8)
    if status == 0 or not body:
        return []
    text = body.decode("utf-8", "replace")
    found = []
    for match in MCPISH_RE.findall(text):
        match = match.rstrip(").,;]'\"")
        if origin(match):
            found.append(match)
    return list(dict.fromkeys(found))[:12]


def discover_plugin(
    plugin: dict[str, Any], indexes: dict[str, dict[str, list[str]]]
) -> dict[str, Any]:
    pid = plugin.get("id") or ""
    name = plugin.get("displayName") or plugin.get("name") or ""
    website = plugin.get("websiteUrl") or ""
    try:
        return _discover_plugin(plugin, indexes)
    except Exception as exc:
        return {
            "id": pid,
            "displayName": name,
            "websiteUrl": website,
            "mcpUrl": None,
            "mcpUrls": [],
            "methods": [],
            "status": "not_found",
            "error": type(exc).__name__,
        }


def _discover_plugin(
    plugin: dict[str, Any], indexes: dict[str, dict[str, list[str]]]
) -> dict[str, Any]:
    pid = plugin.get("id") or ""
    name = plugin.get("displayName") or plugin.get("name") or ""
    website = plugin.get("websiteUrl") or ""
    methods: list[str] = []
    urls: list[str] = []

    urls.extend(catalog_candidates(plugin))
    if urls:
        methods.append("catalog_text")

    host = norm_host(website) if website else ""
    if host and host not in GENERIC_REPO_HOSTS and host in indexes["host"]:
        urls.extend(indexes["host"][host])
        methods.append("registry_host")
    key = slug(name)
    if len(key) >= 4 and key in indexes["slug"]:
        if host:
            related = [
                remote
                for remote in indexes["slug"][key]
                if hosts_related(host, norm_host(remote))
            ]
            urls.extend(related)
            if related:
                methods.append("registry_name")
        else:
            urls.extend(indexes["slug"][key])
            methods.append("registry_name")

    origins = plugin_origins(plugin)
    for base in origins[:3]:
        for path in MCP_PATHS:
            urls.append(urljoin(base.rstrip("/") + "/", path.lstrip("/")))

    urls = list(dict.fromkeys(urls))
    confirmed: list[str] = []
    extra_from_well_known: list[str] = []
    for url in urls:
        if probe_url(url):
            confirmed.append(url)
            if "oauth-protected-resource" in url:
                status, _, body = http("GET", url)
                resource = well_known_resource(body)
                if resource:
                    extra_from_well_known.append(resource)
                    methods.append("well_known_resource")
            else:
                methods.append("origin_probe")
            if len(confirmed) >= 5:
                break

    for resource in extra_from_well_known:
        if resource not in urls and probe_url(resource):
            confirmed.append(resource)

    if not confirmed:
        for base in origins[:2]:
            for url in scrape_home(base):
                methods.append("homepage_scrape")
                if probe_url(url):
                    confirmed.append(url)
                    break
            if confirmed:
                break

    confirmed = list(dict.fromkeys(confirmed))
    confirmed.sort(key=url_rank)
    transport = [
        url
        for url in confirmed
        if "oauth-protected-resource" not in url
    ]
    mcp_url = (transport or confirmed or [None])[0]
    return {
        "id": pid,
        "displayName": name,
        "websiteUrl": website,
        "mcpUrl": mcp_url,
        "mcpUrls": confirmed,
        "methods": list(dict.fromkeys(methods)),
        "status": "found" if mcp_url else "not_found",
    }


def save(results: list[dict[str, Any]], registry_count: int, started: float) -> None:
    found = [r for r in results if r.get("mcpUrl")]
    payload = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "elapsedSeconds": round(time.time() - started, 1),
        "total": len(results),
        "found": len(found),
        "notFound": len(results) - len(found),
        "registryServers": registry_count,
        "mcpUrls": [
            {"id": r["id"], "displayName": r["displayName"], "mcpUrl": r["mcpUrl"]}
            for r in found
        ],
        "plugins": results,
    }
    OUT.write_text(json.dumps(payload, indent=2))
    list_path = ROOT / "mcp-url-list.json"
    list_path.write_text(
        json.dumps(
            [
                {"id": r["id"], "displayName": r["displayName"], "mcpUrl": r["mcpUrl"]}
                for r in found
            ],
            indent=2,
        )
    )
    PROGRESS.write_text(
        json.dumps(
            {
                "processed": len(results),
                "found": len(found),
                "elapsedSeconds": round(time.time() - started, 1),
            },
            indent=2,
        )
    )


def main() -> int:
    started = time.time()
    catalog = json.loads(CATALOG.read_text())
    plugins = catalog["plugins"]
    print(f"catalog {len(plugins)} plugins", flush=True)

    existing: dict[str, dict[str, Any]] = {}
    if OUT.exists():
        try:
            prev = json.loads(OUT.read_text())
            plugin_by_id = {p.get("id"): p for p in plugins if p.get("id")}
            dropped = 0
            for row in prev.get("plugins") or []:
                pid = row.get("id")
                if not pid:
                    continue
                plugin = plugin_by_id.get(pid)
                if plugin and row_needs_reprobe(row, plugin):
                    dropped += 1
                    continue
                existing[pid] = row
            print(
                f"resuming with {len(existing)} existing rows "
                f"(reprobe {dropped} stale matches)",
                flush=True,
            )
        except Exception:
            existing = {}

    remaining = [p for p in plugins if p.get("id") not in existing]
    print("downloading official MCP registry…", flush=True)
    servers = load_registry()
    indexes = registry_indexes(servers)
    print(
        f"registry index hosts={len(indexes['host'])} names={len(indexes['slug'])}",
        flush=True,
    )

    results_by_id: dict[str, dict[str, Any]] = dict(existing)
    workers = 64
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {
            pool.submit(discover_plugin, plugin, indexes): plugin.get("id")
            for plugin in remaining
        }
        done = 0
        total = len(futures)
        if total == 0:
            print("nothing left to probe", flush=True)
        for future in as_completed(futures):
            row = future.result()
            results_by_id[row["id"]] = row
            done += 1
            if done % 50 == 0 or done == total:
                ordered_partial = [
                    results_by_id[p["id"]]
                    for p in plugins
                    if p.get("id") in results_by_id
                ]
                found = sum(1 for r in ordered_partial if r.get("mcpUrl"))
                print(
                    f"probed {len(results_by_id)}/{len(plugins)} "
                    f"(batch {done}/{total}) found={found} "
                    f"elapsed={round(time.time() - started, 1)}s",
                    flush=True,
                )
                save(ordered_partial, len(servers), started)

    ordered = [results_by_id[p["id"]] for p in plugins if p.get("id") in results_by_id]
    save(ordered, len(servers), started)
    found = sum(1 for r in ordered if r.get("mcpUrl"))
    print(f"done total={len(ordered)} found={found} -> {OUT}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
