# Workspaces and Enterprise

## 1. Model

- `workspaces` — team container
- `workspace_roles` / `workspace_members` / `workspace_invites`
- `workspace_settings`
- `workspace_domains` — verified domains
- `sso_connections` — SSO
- `scim_tokens` — SCIM provisioning

Services: `workspace.service.ts`, `workspaces.repository.ts`.

---

## 2. API

| Path | Purpose |
|---|---|
| `/api/v1/workspaces/current` | Current workspace |
| `/api/v1/workspaces/members` | Members |
| `/api/v1/workspaces/domains` | Domains |
| `/api/v1/workspaces/sso-connections` | SSO |
| `/api/v1/workspaces/scim-tokens` | SCIM |

---

## 3. Identity bootstrap

New users get personal workspace membership via identity/onboarding flows as configured in migrations + `identity.service.ts`.

---

## 4. Related

- [`authentication.md`](./authentication.md)
- [`../reference/database-schema.md`](../reference/database-schema.md)
