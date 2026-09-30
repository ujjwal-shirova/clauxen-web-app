# Cursor Marketplace Scraper

Fetches the complete [Cursor Plugin Marketplace](https://cursor.com/marketplace) —
every plugin's metadata and its actual MCP server configuration — into a single
JSON file. Pure Python 3 standard library, no dependencies.

## Usage

```bash
python3 fetch_marketplace.py                       # writes ../../public/data/mcp-plugins.json
python3 fetch_marketplace.py --no-mcp-config       # metadata only, no GitHub fetch
python3 fetch_marketplace.py --output other.json   # custom output path
python3 fetch_marketplace.py --workers 16          # parallel GitHub fetches
```

Reuses the local `gh` CLI token if present (not required — file contents come
from `raw.githubusercontent.com`, which works unauthenticated for public repos).
Results are cached in `.mcp_config_cache.json` (git-ignored) so re-runs are cheap.

## Data sources

| Source | What it provides |
|---|---|
| `POST /api/dashboard/list-marketplace-plugins` (public, cursor-paginated) | Full plugin index: description, publisher, categories, skills, commands, hooks, rules, subagents, declared MCP servers, git source (`gitUrl`/`gitRef`/`gitPath`) |
| `https://raw.githubusercontent.com/{repo}/{pinned-ref}/{gitPath}/.mcp.json` (or `mcp.json`) | The actual MCP transport config pinned to the marketplace snapshot |
| `.cursor-plugin/plugin.json` manifest fallback | Some plugins declare `mcpServers` inline or via a path reference instead of a standalone `.mcp.json` |

If the pinned ref no longer exists upstream (force-pushed repos), the default
branch is used and `mcp.pinnedRefMissing` is set.

## Output shape

```jsonc
{
  "source": "https://cursor.com/marketplace",
  "generatedAt": "2026-09-30T...",
  "summary": {
    "totalPlugins": 393,
    "pluginsWithMcpServer": 333,
    "mcpServerTransports": {"http": 325, "stdio": 59},
    "byCategory": {"PRODUCTIVITY": 60, "INFRASTRUCTURE": 44, "...": 0},
    "byPublisher": {"cursor": 85, "aws": 9, "...": 0},
    "mcpServerUrls": ["https://mcp.atlassian.com/v2/mcp", "..."]
  },
  "plugins": [
    {
      "id": "70801387",
      "name": "slides",
      "displayName": "Slides.com",
      "detailPageUrl": "https://cursor.com/marketplace/slides",
      "installUrl": "https://cursor.com/marketplace/slides",
      "logoUrl": "...",
      "curatedCategories": ["DESIGN"],
      "gitUrl": "https://github.com/slides/agent-plugin",
      "gitRef": "b2d3966a...",
      "gitPath": ".",
      "publisher": { "name": "slides.com", "isVerified": true, "pageUrl": "..." },
      "skills": [{"name": "slides-authoring", "description": "..."}],
      "commands": [{"name": "...", "description": "..."}],
      "hooks": [], "rules": [], "subagents": [],
      "declaredMcpServers": [{"name": "slides"}],
      "mcp": {
        "configSourceUrl": "https://github.com/.../blob/<ref>/.mcp.json",
        "servers": [
          {"name": "slides", "type": "http", "url": "https://...", "command": null,
           "args": null, "envVarNames": null, "raw": {"url": "https://..."}}
        ],
        "endpoints": {"http": 1, "stdio": 0, "urls": ["https://..."]}
      }
    }
  ]
}
```

Plugins that ship skills/rules/commands only (no MCP server) keep
`mcp.configFetchError: "no mcp config found (likely a skills-only plugin)"`.