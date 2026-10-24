#!/usr/bin/env python3
"""
Build the enriched plugin details dataset from ChatGPT / Best GPT Apps directory
and local MCP definitions for all plugins present in Clauxen Web App.
"""

import json
import os
import re
import sys
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

CATALOG_PATH = "src/client/components/plugins/marketplace-catalog.json"
MCP_PLUGINS_PATH = "public/data/mcp-plugins.json"
OUTPUT_PATH = "src/client/components/plugins/plugin-details-dataset.json"

SLUG_ALIASES = {
    "outlook": "outlook-email",
    "jira": "atlassian",
    "confluence": "atlassian",
    "mail": "outlook-email",
    "google-docs": "google-drive",
    "google-sheets": "google-drive",
    "google-slides": "google-drive",
    "gmail": "gmail",
}

DEFAULT_PROMPTS_BY_CATEGORY = {
    "Infrastructure": [
        "Inspect the current deployment configuration and identify potential bottlenecks or misconfigurations.",
        "Generate a production-ready schema migration script with rollbacks and security safeguards.",
        "Audit service logs and error traces from the last 24 hours to uncover latency spikes.",
    ],
    "Productivity": [
        "Search through my recent workspace documents and draft a comprehensive executive recap.",
        "Extract open action items, assigned owners, and pending deadlines from the latest project notes.",
        "Synthesize team updates into a clean stakeholder status report with next milestones.",
    ],
    "Communication": [
        "Summarize the latest incoming thread and extract all questions that require a direct answer.",
        "Draft a clear, professional response confirming timelines and next deliverables.",
        "Filter and highlight high-priority messages requiring immediate attention today.",
    ],
    "Finance": [
        "Summarize recent billing invoices and categorize expenses by vendor and department.",
        "Identify recurring subscription costs and highlight any unexpected billing changes.",
        "Generate a structured financial report comparing budget projections against actual spend.",
    ],
    "Developer Tools": [
        "Review this code diff like a senior staff engineer: highlight edge cases, security flaws, and test gaps.",
        "Explain the authentication and data flow through this repository using code references.",
        "Draft a release changelog summarizing merged pull requests and notable breaking changes.",
    ],
}

def clean_html(raw_html: str) -> str:
    clean = re.sub(r"<[^>]+>", "", raw_html)
    clean = re.sub(r"&amp;", "&", clean)
    clean = re.sub(r"&quot;", '"', clean)
    clean = re.sub(r"&#39;", "'", clean)
    clean = re.sub(r"&lt;", "<", clean)
    clean = re.sub(r"&gt;", ">", clean)
    return clean.strip()

def scrape_bestgptapps(slug: str) -> dict | None:
    url = f"https://bestgptapps.com/apps/{slug}/"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"})
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            html = resp.read().decode("utf-8")
    except Exception:
        return None

    # Parse JSON-LD
    schemas = []
    for m in re.finditer(r'<script type="application/ld\+json">(.*?)</script>', html, re.DOTALL):
        try:
            val = json.loads(m.group(1))
            if isinstance(val, list):
                schemas.extend(val)
            elif isinstance(val, dict):
                schemas.append(val)
        except Exception:
            pass

    soft = next((s for s in schemas if s.get("@type") == "SoftwareApplication"), {})
    faq = next((s for s in schemas if s.get("@type") == "FAQPage"), {})

    # Extract Prompts
    prompts = []
    for item in faq.get("mainEntity", []):
        if "What can I ask" in item.get("name", ""):
            text = item.get("acceptedAnswer", {}).get("text", "")
            found = re.findall(r'[“\"]([^”\"]+)[”\"]', text)
            if found:
                # filter out single char or malformed punctuation
                prompts = [p.strip() for p in found if len(p.strip()) > 8 and not p.startswith(":{")]

    # Extract Capabilities
    capabilities = "Read, Write"
    cap_match = re.search(r'Capabilities</dt>\s*<dd[^>]*>(.*?)</dd>', html, re.DOTALL)
    if cap_match:
        capabilities = clean_html(cap_match.group(1))

    # Extract Developer
    developer = soft.get("author", {}).get("name")
    if not developer:
        dev_match = re.search(r'Developer</dt>\s*<dd[^>]*>(.*?)</dd>', html, re.DOTALL)
        if dev_match:
            developer = clean_html(dev_match.group(1))

    # Extract Category
    category = None
    cat_match = re.search(r'Category</dt>\s*<dd[^>]*>(.*?)</dd>', html, re.DOTALL)
    if cat_match:
        category = clean_html(cat_match.group(1))

    # Extract Version
    version = soft.get("softwareVersion") or "1.0.0"

    # Extract Website, Privacy, Terms
    website = soft.get("author", {}).get("url")
    web_match = re.search(r'Website</dt>\s*<dd[^>]*><a\s+href="([^"]+)"', html)
    if web_match:
        website = web_match.group(1)

    privacy = None
    priv_match = re.search(r'Privacy</dt>\s*<dd[^>]*><a\s+href="([^"]+)"', html)
    if priv_match:
        privacy = priv_match.group(1)

    terms = None
    terms_match = re.search(r'Terms</dt>\s*<dd[^>]*><a\s+href="([^"]+)"', html)
    if terms_match:
        terms = terms_match.group(1)

    # Extract Overview Description from FAQ or body
    overview = None
    for item in faq.get("mainEntity", []):
        if "What does" in item.get("name", ""):
            overview = item.get("acceptedAnswer", {}).get("text")
            break

    return {
        "prompts": prompts[:3],
        "capabilities": capabilities or "Read, Write",
        "developer": developer,
        "category": category,
        "version": version,
        "websiteUrl": website,
        "privacyUrl": privacy or (f"{website.rstrip('/')}/privacy" if website else None),
        "termsUrl": terms or (f"{website.rstrip('/')}/terms" if website else None),
        "overview": overview,
    }

def main():
    print("Reading local catalog & MCP dataset...")
    with open(CATALOG_PATH, "r", encoding="utf-8") as f:
        catalog = json.load(f)

    local_mcp_map = {}
    if os.path.exists(MCP_PLUGINS_PATH):
        with open(MCP_PLUGINS_PATH, "r", encoding="utf-8") as f:
            mcp_data = json.load(f)
            for p in mcp_data.get("plugins", []):
                key = p.get("name", "").lower()
                local_mcp_map[key] = p
                display_key = p.get("displayName", "").lower()
                if display_key:
                    local_mcp_map[display_key] = p

    plugins_dict = catalog.get("plugins", {})
    print(f"Total plugins in catalog: {len(plugins_dict)}")

    # Specific prompts override for popular tools shown in reference UI
    FEATURED_OVERRIDES = {
        "supabase": {
            "prompts": [
                "Use Supabase to set up Auth and protected routes for my app.",
                "Review my Supabase schema and RLS policies for security issues.",
                "Optimize my Postgres queries and indexes using Supabase best practices.",
            ],
            "overview": "Official Supabase plugin for Codex. Includes agent skills for Supabase development and Postgres best practices, plus MCP server integration for managing your Supabase projects directly from Codex.",
            "capabilities": "Read, Write",
            "developer": "Supabase",
            "category": "Developer Tools",
            "version": "1.0.0",
            "websiteUrl": "https://supabase.com/",
            "privacyUrl": "https://supabase.com/privacy",
            "termsUrl": "https://supabase.com/terms",
            "skills": [
                {
                    "name": "supabase",
                    "description": "Use when doing ANY task involving Supabase. Triggers: Supabase products (Database, Auth, Edge Functions, Realtime, Storage, Vectors, Cron, Queues); client libraries and SSR integrations.",
                },
                {
                    "name": "supabase-postgres-best-practices",
                    "description": "Postgres performance optimization and best practices from Supabase. Use this skill when writing, reviewing, or optimizing Postgres queries, schema designs, or database configurations.",
                },
            ],
            "apps": [
                {
                    "name": "Supabase",
                    "description": "Manage Supabase projects directly through ChatGPT. Execute SQL queries on PostgreSQL databases, design and modify table schemas, and deploy serverless functions.",
                }
            ],
        },
        "github": {
            "prompts": [
                "Explain this repo's authentication using code and docs: components, request flow, and how credentials and tokens are handled.",
                "Summarize this pull request like a senior reviewer: what changed, what could break, and what tests are missing or weak.",
                "Turn the last 7 days of commits and merged PRs into a stakeholder update: shipped work, risks, and next steps.",
            ],
            "overview": "Official GitHub integration for ChatGPT and Codex. Triage issues, review pull requests, automate CI/CD actions, and inspect repository architectures directly within your workspace conversation.",
            "capabilities": "Read, Write",
            "developer": "OpenAI & GitHub",
            "category": "Developer Tools",
            "version": "1.0.0",
            "websiteUrl": "https://github.com/",
            "privacyUrl": "https://docs.github.com/privacy",
            "termsUrl": "https://docs.github.com/terms",
            "skills": [
                {
                    "name": "github-workflow",
                    "description": "Automate pull requests, review workflows, code scanning, issue triage, and GitHub Actions dispatching.",
                },
                {
                    "name": "github-repo-insights",
                    "description": "Analyze repository commit history, commit velocity, branch dependencies, and dependency graph health.",
                },
            ],
            "apps": [
                {
                    "name": "GitHub",
                    "description": "Triage pull requests, issues, CI workflows, and publish flows directly from natural language prompts.",
                }
            ],
        },
        "google-drive": {
            "prompts": [
                "Search my Drive for the latest Q4 board deck and write a 10-bullet executive recap with the 3 biggest risks and 3 next actions.",
                "Rewrite this product one-pager using our brand guidelines doc: match the voice and format while keeping facts intact.",
                "From [folder], pull key deliverables, timeline, and open questions, then draft a client-ready status update.",
            ],
            "overview": "Official Google Drive plugin. Access, search, read, and cross-reference files, Docs, Sheets, and Slides in your Google Drive to ground responses in authoritative team documentation.",
            "capabilities": "Read, Write",
            "developer": "Google & OpenAI",
            "category": "Productivity",
            "version": "1.0.0",
            "websiteUrl": "https://workspace.google.com/products/drive/",
            "privacyUrl": "https://policies.google.com/privacy",
            "termsUrl": "https://policies.google.com/terms",
            "skills": [
                {
                    "name": "google-drive-search",
                    "description": "Full-text search across Docs, Sheets, and presentations with recency sorting and permission checking.",
                },
                {
                    "name": "document-synthesis",
                    "description": "Extract structured data, summaries, tables, and action items directly from Google Workspace files.",
                },
            ],
            "apps": [
                {
                    "name": "Google Drive",
                    "description": "Drive, Docs, Sheets, or Slides. Search and access team knowledge files directly through natural conversation.",
                }
            ],
        },
        "gmail": {
            "prompts": [
                "Search my inbox for the latest flight booking and add the confirmation details to my schedule.",
                "Draft a polite and concise follow-up email to the candidate regarding their interview status.",
                "Summarize unread emails from the past 24 hours and highlight anything requiring immediate action.",
            ],
            "overview": "Official Gmail plugin. Search, read, draft, and organize your emails directly from your conversation with full privacy controls and explicit draft approvals.",
            "capabilities": "Read, Write",
            "developer": "Google & OpenAI",
            "category": "Communication",
            "version": "1.0.0",
            "websiteUrl": "https://mail.google.com/",
            "privacyUrl": "https://policies.google.com/privacy",
            "termsUrl": "https://policies.google.com/terms",
            "skills": [
                {
                    "name": "gmail-inbox-triage",
                    "description": "Categorize unread emails, prioritize by urgency and sender seniority, and draft contextual replies.",
                }
            ],
            "apps": [
                {
                    "name": "Gmail",
                    "description": "Read and manage Gmail. Search inboxes, summarize active threads, and prepare client-ready drafts.",
                }
            ],
        },
        "health": {
            "prompts": [
                "Summarize my health history and recent wellness milestones.",
                "Help me understand my most recent lab results and doctor recommendations.",
                "What sleep patterns and activity metrics stand out over the past 30 days?",
            ],
            "overview": "Health integration. Securely explore, summarize, and understand your health data, fitness metrics, and lab reports with clinical references and personalized wellness insights.",
            "capabilities": "Read",
            "developer": "Health Connect",
            "category": "Health & Fitness",
            "version": "1.0.0",
            "websiteUrl": "https://clauxen.com",
            "privacyUrl": "https://clauxen.com/legal/privacy",
            "termsUrl": "https://clauxen.com/legal/terms",
            "skills": [
                {
                    "name": "biometric-trends",
                    "description": "Analyze resting heart rate, sleep stages, daily step counts, and activity trends over custom date windows.",
                }
            ],
            "apps": [
                {
                    "name": "Health",
                    "description": "Explore your health data in Clauxen. Secure personal health summaries and biometric understanding.",
                }
            ],
        },
        "outlook": {
            "prompts": [
                "Summarize the most recent thread with procurement and pull the exact questions they asked so I can answer cleanly.",
                "Draft a reply to the latest customer message: acknowledge the concern, set expectations, and offer two ways forward.",
                "Find the top 5 emails I should respond to today based on urgency, seniority, and deadlines; include one-line suggested replies.",
            ],
            "overview": "Official Microsoft Outlook integration. Search inboxes, read message threads, compose drafts, and manage emails securely within your workspace.",
            "capabilities": "Read, Write",
            "developer": "Microsoft & OpenAI",
            "category": "Communication",
            "version": "1.0.0",
            "websiteUrl": "https://outlook.live.com/",
            "privacyUrl": "https://privacy.microsoft.com/",
            "termsUrl": "https://www.microsoft.com/servicesagreement",
            "skills": [
                {
                    "name": "outlook-email-manager",
                    "description": "Scan Outlook folders, parse attachment metadata, flag urgent emails, and generate draft replies.",
                }
            ],
            "apps": [
                {
                    "name": "Outlook Email",
                    "description": "Triage Outlook inboxes. Search messages, summarize active conversations, and review suggested replies.",
                }
            ],
        },
    }

    # Gather list of plugin IDs to scrape/enrich
    slugs_to_scrape = {}
    for p_id, p_info in plugins_dict.items():
        if p_id in FEATURED_OVERRIDES:
            continue
        # determine slug to try
        slug = SLUG_ALIASES.get(p_id, p_id)
        slugs_to_scrape[p_id] = slug

    print(f"Scraping up to {len(slugs_to_scrape)} plugins from ChatGPT directory...")
    scraped_results = {}

    def fetch_worker(item):
        pid, slug = item
        data = scrape_bestgptapps(slug)
        return pid, data

    # Use ThreadPoolExecutor for fast parallel retrieval of matching directory pages
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(fetch_worker, item): item for item in slugs_to_scrape.items()}
        completed = 0
        for f in as_completed(futures):
            completed += 1
            pid, res = f.result()
            if res:
                scraped_results[pid] = res
            if completed % 50 == 0:
                print(f"  Processed {completed}/{len(slugs_to_scrape)} plugins (found {len(scraped_results)} online)")

    print(f"Scraped {len(scraped_results)} plugins directly from directory.")

    # Combine into enriched dataset
    enriched_dataset = {}

    for p_id, p_info in plugins_dict.items():
        name = p_info.get("name", p_id)
        desc = p_info.get("description", "")
        author = p_info.get("author", "")
        category = p_info.get("category", "General")
        icon_url = p_info.get("iconUrl", "")

        # Check featured overrides first
        if p_id in FEATURED_OVERRIDES:
            data = FEATURED_OVERRIDES[p_id]
            enriched_dataset[p_id] = {
                "id": p_id,
                "name": data.get("name", name),
                "author": data.get("developer", author or "Verified Provider"),
                "shortDescription": desc,
                "overview": data.get("overview", desc),
                "iconUrl": icon_url,
                "capabilities": data.get("capabilities", "Read, Write"),
                "developer": data.get("developer", author or "Verified Provider"),
                "category": data.get("category", category),
                "version": data.get("version", "1.0.0"),
                "websiteUrl": data.get("websiteUrl", "https://clauxen.com"),
                "privacyUrl": data.get("privacyUrl", "https://clauxen.com/legal/privacy"),
                "termsUrl": data.get("termsUrl", "https://clauxen.com/legal/terms"),
                "prompts": data.get("prompts", []),
                "apps": data.get("apps", [{"name": name, "description": desc}]),
                "skills": data.get("skills", []),
            }
            continue

        # Check scraped results
        scraped = scraped_results.get(p_id)
        local_mcp = local_mcp_map.get(p_id.lower()) or local_mcp_map.get(name.lower())

        skills_list = []
        if local_mcp and local_mcp.get("skills"):
            for s in local_mcp["skills"]:
                skills_list.append({
                    "name": s.get("name", "skill"),
                    "description": s.get("description", "Agent capability for this integration."),
                })

        apps_list = [{
            "name": name,
            "description": desc or f"Interact with {name} directly through natural language in Clauxen.",
        }]

        # Determine prompts
        prompts = []
        if scraped and scraped.get("prompts") and len(scraped["prompts"]) >= 2:
            prompts = scraped["prompts"][:3]
        else:
            # Generate 3 tailored prompts based on plugin description and category
            cat_key = category if category in DEFAULT_PROMPTS_BY_CATEGORY else "Productivity"
            cat_prompts = DEFAULT_PROMPTS_BY_CATEGORY[cat_key]
            prompts = [
                f"Use {name} to {desc.rstrip('.').lower()} and show the results.",
                f"Connect to {name} and check for any recent updates or changes.",
                cat_prompts[2] if len(cat_prompts) > 2 else f"Optimize my workflow using {name} best practices.",
            ]

        website = (scraped.get("websiteUrl") if scraped else None) or (local_mcp.get("publisher", {}).get("websiteUrl") if local_mcp else None) or "https://clauxen.com"
        developer = (scraped.get("developer") if scraped else None) or (local_mcp.get("publisher", {}).get("displayName") if local_mcp else None) or author or name

        enriched_dataset[p_id] = {
            "id": p_id,
            "name": name,
            "author": developer,
            "shortDescription": desc,
            "overview": (scraped.get("overview") if scraped else None) or desc or f"Official {name} integration for Clauxen. Connect your workspace with {name} to automate tasks, query data, and streamline workflows.",
            "iconUrl": icon_url or (local_mcp.get("logoUrl") if local_mcp else ""),
            "capabilities": (scraped.get("capabilities") if scraped else None) or "Read, Write",
            "developer": developer,
            "category": (scraped.get("category") if scraped else None) or category,
            "version": (scraped.get("version") if scraped else None) or "1.0.0",
            "websiteUrl": website,
            "privacyUrl": (scraped.get("privacyUrl") if scraped else None) or f"{website.rstrip('/')}/privacy",
            "termsUrl": (scraped.get("termsUrl") if scraped else None) or f"{website.rstrip('/')}/terms",
            "prompts": prompts[:3],
            "apps": apps_list,
            "skills": skills_list if skills_list else [
                {
                    "name": f"{p_id}-integration",
                    "description": f"Use when performing tasks involving {name}. Triggers API tools, data queries, and actions.",
                }
            ],
        }

    # Save to OUTPUT_PATH
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(enriched_dataset, f, indent=2, ensure_ascii=False)

    print(f"Successfully generated {OUTPUT_PATH} with {len(enriched_dataset)} plugin details!")

if __name__ == "__main__":
    main()
