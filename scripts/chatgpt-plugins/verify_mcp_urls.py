#!/usr/bin/env python3
"""Recover extractable MCP URLs, drop nulls, and keep only endpoints that respond as MCP."""

from __future__ import annotations

import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import urljoin, urlparse

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

import extract_mcp_urls as ext
CATALOG = ROOT / "chatgpt-catalog.json"
PLUGIN_LIST = ROOT / "chatgpt-plugin-list.json"
MCP_LIST = ROOT / "mcp-url-list.json"
VERIFY = ROOT / "mcp-url-verify.json"

SKIP_PROBE_HOSTS = ext.GENERIC_REPO_HOSTS | ext.SKIP_HOSTS | {
    "widget.olutely.com",
    "www.widget.olutely.com",
    "olutely.com",
    "openai.com",
    "www.openai.com",
}

PATHS = ("/mcp", "/api/mcp", "/sse")


def is_http_url(value: str | None) -> bool:
    return isinstance(value, str) and value.startswith(("http://", "https://"))


def is_transport(status: int, headers: dict[str, str], body: bytes) -> str | None:
    if status == 0:
        return None
    ctype = headers.get("content-type", "").lower()
    www = headers.get("www-authenticate", "").lower()
    text = body[:4000].decode("utf-8", "replace")
    lowered = text.lower()
    if "text/html" in ctype and "jsonrpc" not in lowered and "text/event-stream" not in ctype:
        if status not in {401, 403, 405}:
            return None
    if "text/event-stream" in ctype:
        return "event-stream"
    if "mcp-session-id" in headers:
        return "mcp-session"
    if "resource_metadata" in www or "oauth-protected-resource" in www:
        return "oauth-protected"
    if '"jsonrpc"' in lowered and (
        "initialize" in lowered
        or "protocolversion" in lowered
        or '"result"' in lowered
        or '"error"' in lowered
    ):
        return "jsonrpc"
    if status in {401, 403, 405} and (
        "jsonrpc" in lowered or "mcp" in lowered or "bearer" in www
    ):
        return f"http-{status}"
    if "authorization_servers" in lowered and '"resource"' in lowered:
        return "oauth-metadata"
    return None


def probe_working(url: str) -> dict:
    if not is_http_url(url):
        return {"ok": False, "url": url, "reason": "invalid"}
    tried = []
    for candidate in candidate_urls(url):
        tried.append(candidate)
        result = probe_once(candidate)
        if result["ok"]:
            if candidate != url:
                result["triedFrom"] = url
            return result
    return {"ok": False, "url": url, "reason": f"tried:{','.join(tried[-3:])}"}


def candidate_urls(url: str) -> list[str]:
    urls = [url]
    parsed = urlparse(url)
    path = (parsed.path or "").rstrip("/")
    if "oauth-protected-resource" in url:
        return urls
    if not path.endswith("/mcp"):
        urls.append(url.rstrip("/") + "/mcp")
    if path in {"", "/"}:
        urls.append(url.rstrip("/") + "/api/mcp")
        urls.append(url.rstrip("/") + "/sse")
    return list(dict.fromkeys(urls))


def probe_once(url: str) -> dict:
    well_known = "oauth-protected-resource" in url
    if well_known:
        status, headers, body = ext.http("GET", url, timeout=6)
        reason = is_transport(status, headers, body)
        resource = ext.well_known_resource(body)
        if resource and resource != url:
            nested = probe_once(resource)
            if nested["ok"]:
                nested["via"] = url
                return nested
        if reason:
            return {
                "ok": True,
                "url": resource or url,
                "reason": reason,
                "status": status,
            }
        return {"ok": False, "url": url, "reason": f"well-known-{status}"}

    status, headers, body = ext.http("POST", url, ext.INIT_BODY, timeout=6)
    reason = is_transport(status, headers, body)
    if reason:
        return {"ok": True, "url": url, "reason": reason, "status": status}
    status, headers, body = ext.http("GET", url, timeout=6)
    reason = is_transport(status, headers, body)
    if reason:
        return {"ok": True, "url": url, "reason": reason, "status": status}
    return {"ok": False, "url": url, "reason": f"http-{status}", "status": status}


def candidates_for(plugin: dict) -> list[str]:
    urls: list[str] = []
    if is_http_url(plugin.get("mcpUrl")):
        urls.append(plugin["mcpUrl"])
    for server in plugin.get("mcpServers") or []:
        if is_http_url(server.get("url")):
            urls.append(server["url"])
    app = plugin.get("appsContent") or {}
    if is_http_url(app.get("resource")):
        urls.append(app["resource"])
    if is_http_url(app.get("website")) and "mcp" in (app.get("website") or "").lower():
        urls.append(app["website"])

    blob = {
        "websiteUrl": plugin.get("websiteUrl") or "",
        "privacyPolicyUrl": plugin.get("privacyPolicyUrl") or "",
        "termsOfServiceUrl": plugin.get("termsOfServiceUrl") or "",
        "description": plugin.get("description") or plugin.get("longDescription") or "",
        "longDescription": plugin.get("longDescription") or "",
    }
    urls.extend(ext.catalog_candidates(blob))

    website = plugin.get("websiteUrl") or ""
    host = ext.norm_host(website) if website else ""
    if host and host not in SKIP_PROBE_HOSTS:
        base = ext.origin(website)
        if base:
            for path in PATHS:
                urls.append(urljoin(base.rstrip("/") + "/", path.lstrip("/")))
            if not host.startswith("mcp."):
                urls.append(f"https://mcp.{host}/mcp")
        if "/mcp" in website or website.rstrip("/").endswith("/sse"):
            urls.append(website)

    return list(dict.fromkeys(url for url in urls if is_http_url(url)))


def compact_row(plugin: dict) -> dict:
    return {
        "id": plugin["id"],
        "displayName": plugin.get("displayName") or plugin.get("name") or plugin["id"],
        "shortDescription": plugin.get("shortDescription") or "",
        "logoUrl": plugin.get("logoUrl") or "",
        "websiteUrl": plugin.get("websiteUrl") or "",
        "developer": plugin.get("developer") or "",
        "categories": plugin.get("categories") or [],
        "sourceUrl": plugin.get("sourceUrl") or "",
        "mcpUrl": plugin.get("mcpUrl"),
        "mcpServers": plugin.get("mcpServers") or [],
        "mcpStatus": plugin.get("mcpStatus"),
        "mcpProbe": plugin.get("mcpProbe"),
    }


def main() -> int:
    started = time.time()
    catalog = json.loads(CATALOG.read_text())
    plugins = catalog["plugins"]
    print(f"catalog {len(plugins)} plugins", flush=True)

    nulls = [p for p in plugins if not p.get("mcpUrl")]
    print(f"null mcpUrl {len(nulls)}; probing extractable endpoints…", flush=True)

    recovered = 0
    workers = 64

    def recover(plugin: dict) -> tuple[str, str | None, dict]:
        for url in candidates_for(plugin):
            result = probe_working(url)
            if result["ok"]:
                return plugin["id"], result["url"], result
        return plugin["id"], None, {"ok": False, "reason": "not_extractable"}

    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(recover, plugin): plugin["id"] for plugin in nulls}
        done = 0
        by_id = {plugin["id"]: plugin for plugin in plugins}
        for future in as_completed(futures):
            pid, url, result = future.result()
            done += 1
            if url:
                plugin = by_id[pid]
                plugin["mcpUrl"] = url
                servers = list(plugin.get("mcpServers") or [])
                if not any(server.get("url") == url for server in servers):
                    servers.append(
                        {
                            "key": "website_probe",
                            "type": "http",
                            "url": url,
                            "oauthResource": None,
                        }
                    )
                plugin["mcpServers"] = servers
                plugin["mcpProbe"] = result
                recovered += 1
            if done % 100 == 0 or done == len(futures):
                print(
                    f"recover {done}/{len(futures)} extracted={recovered} "
                    f"elapsed={round(time.time() - started, 1)}s",
                    flush=True,
                )

    with_url = [p for p in plugins if p.get("mcpUrl")]
    print(f"with mcpUrl after recovery {len(with_url)}; verifying…", flush=True)

    verified: list[dict] = []
    failed: list[dict] = []
    unique_urls = list(dict.fromkeys(p["mcpUrl"] for p in with_url))
    url_result: dict[str, dict] = {}

    def check(url: str) -> tuple[str, dict]:
        return url, probe_working(url)

    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(check, url): url for url in unique_urls}
        done = 0
        ok = 0
        for future in as_completed(futures):
            url, result = future.result()
            url_result[url] = result
            done += 1
            if result["ok"]:
                ok += 1
            if done % 100 == 0 or done == len(futures):
                print(
                    f"verify {done}/{len(futures)} working={ok} "
                    f"elapsed={round(time.time() - started, 1)}s",
                    flush=True,
                )

    for plugin in with_url:
        result = url_result.get(plugin["mcpUrl"]) or {"ok": False, "reason": "missing"}
        working_url = result.get("url") if result.get("ok") else None
        if result.get("ok") and working_url:
            plugin["mcpUrl"] = working_url
            plugin["mcpStatus"] = "working"
            plugin["mcpProbe"] = result
            verified.append(plugin)
        else:
            plugin["mcpStatus"] = "dead"
            plugin["mcpProbe"] = result
            failed.append(plugin)

    verified.sort(key=lambda p: (p.get("displayName") or p["id"]).lower())
    catalog["capturedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    catalog["total"] = len(verified)
    catalog["listedCount"] = len(plugins)
    catalog["mcpUrlCount"] = len(verified)
    catalog["removedNullOrDead"] = {
        "nullAfterRecovery": len(plugins) - len(with_url),
        "deadEndpoints": len(failed),
        "keptWorking": len(verified),
    }
    catalog["plugins"] = verified
    CATALOG.write_text(json.dumps(catalog, indent=2))

    compact = [compact_row(plugin) for plugin in verified]
    PLUGIN_LIST.write_text(json.dumps(compact, indent=2))
    MCP_LIST.write_text(
        json.dumps(
            [
                {
                    "id": plugin["id"],
                    "displayName": plugin.get("displayName"),
                    "mcpUrl": plugin["mcpUrl"],
                    "mcpServers": plugin.get("mcpServers") or [],
                    "mcpStatus": "working",
                    "mcpProbe": plugin.get("mcpProbe"),
                }
                for plugin in verified
            ],
            indent=2,
        )
    )
    (ROOT / "mcp-url-dropped.json").write_text(
        json.dumps(
            [
                {
                    "id": plugin["id"],
                    "displayName": plugin.get("displayName"),
                    "mcpUrl": plugin.get("mcpUrl"),
                    "reason": (plugin.get("mcpProbe") or {}).get("reason"),
                }
                for plugin in failed
            ],
            indent=2,
        )
    )
    VERIFY.write_text(
        json.dumps(
            {
                "generatedAt": catalog["capturedAt"],
                "elapsedSeconds": round(time.time() - started, 1),
                "input": len(plugins),
                "recoveredFromNull": recovered,
                "hadUrlBeforeVerify": len(with_url),
                "working": len(verified),
                "dead": len(failed),
                "droppedNull": len(plugins) - len(with_url),
            },
            indent=2,
        )
    )
    print(
        f"done recovered={recovered} working={len(verified)} "
        f"dead={len(failed)} dropped_null={len(plugins) - len(with_url)} -> {MCP_LIST}",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
