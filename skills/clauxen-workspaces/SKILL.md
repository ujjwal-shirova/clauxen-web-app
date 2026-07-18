---
name: clauxen-workspaces
description: >-
  Clauxen workspaces and enterprise: members, domains, SSO, SCIM, workspace settings. Use when working on team accounts, /api/v1/workspaces/*, SSO connections, or SCIM tokens.
---

# Clauxen workspaces

## Read first

- `docs/systems/workspaces-enterprise.md`

## Tables

`workspaces`, `workspace_roles`, `workspace_members`, `workspace_invites`, `workspace_settings`, `workspace_domains`, `sso_connections`, `scim_tokens`

## API

`/api/v1/workspaces/current|members|domains|sso-connections|scim-tokens`

## Code

`src/backend/services/workspace.service.ts`, `workspaces.repository.ts`

## Note

Implement enterprise slices only when user asks — do not scaffold unused SSO UI early.
