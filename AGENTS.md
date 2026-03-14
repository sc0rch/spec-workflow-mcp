# Spec Workflow MCP

## What this project is

- MCP server for spec-driven development workflows.
- Core responsibilities: spec/status tooling, approvals, implementation logs, multi-project dashboard, VS Code extension.
- This repository is the implementation source of truth. Prefer changing the canonical runtime path over adding wrappers.

## Structure map

- `src/index.ts`
  CLI entrypoint and mode selection.
- `src/server.ts`
  MCP server wiring, request handlers, dashboard session integration.
- `src/core/project-binding.ts`
  Canonical project binding logic. This is the only place that decides how a request binds to a workspace/worktree/repo.
- `src/core/project-path-resolution.ts`
  File resolution helpers that operate on an already-bound project.
- `src/tools/`
  MCP tool schemas and handlers. Tool input schemas here are the canonical public contract.
- `src/prompts/`
  Prompt definitions and binding-aware prompt generation.
- `src/dashboard/`
  Dashboard backend, registry integration, approvals/log storage, project manager.
- `src/dashboard_frontend/`
  Dashboard UI.
- `vscode-extension/`
  VS Code extension and webview.
- `docs/`
  User-facing documentation. Keep English docs aligned with current runtime behavior.

## Engineering rules

- Keep one source of truth for project binding and path resolution.
  Use `src/core/project-binding.ts` for binding decisions.
  Use `src/core/project-path-resolution.ts` only after binding is already resolved.
- Do not add compatibility layers, fallback shims, or parallel implementations to preserve removed behavior.
- Do not duplicate schemas, path-selection rules, or binding precedence in tools, prompts, dashboard code, or docs.
- If behavior changes, update the canonical implementation first, then delete obsolete paths instead of routing around them.
- Prefer explicit failure over silent fallback when binding is ambiguous.
- Treat tool schemas and runtime behavior as more important than stale documentation; update docs to match code, not the other way around.

## Testing expectations

- Add or update focused tests for any change to binding, CLI argument parsing, tool contracts, or dashboard registration behavior.
- Prefer unit tests around canonical modules before adding broader integration coverage.
- Run targeted tests for changed areas and at least one build before finishing substantial changes.
