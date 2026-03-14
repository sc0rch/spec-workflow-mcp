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

## Rewrite roadmap

- For the Electron rewrite, use `docs/electron-desktop-rewrite.md` as the canonical roadmap and progress checklist.
- When work meaningfully advances or direction changes, update that file in the same turn so future sessions can resume from it directly.

## Design Context

### Users
Primary users are solo developers and team leads working in spec-driven development workflows.
They use the product to organize projects/specifications, review and approve work, and move tasks forward with low overhead.
Core job to be done: turn requirements into implemented work with fast navigation, clear status visibility, and minimal friction.

### Brand Personality
Headache-free, spec-driven workflow.
Voice and tone should feel calm, technical, practical, and trustworthy.
Emotional target: calm confidence while making progress through complex technical work.

### Aesthetic Direction
Use a clean, readable, technical interface with practical UX choices.
Reference direction:
- Mail apps mental model: projects as folders, specs as letters, easy text selection/commenting/reply actions.
- Codex app qualities: readable layout, clean hierarchy, technical clarity, pragmatic controls, theme-aware behavior.
Anti-direction:
- Avoid over-designed navigation.
- Avoid workflows that require too many clicks for simple actions.
Theme direction:
- Prioritize dark mode first.
- Keep theme support extensible for light/dark parity over time.

### Design Principles
1. Keep navigation shallow and direct: common actions should be reachable in one to two interactions.
2. Optimize for readability first: clear hierarchy, strong contrast in dark mode, and disciplined information density.
3. Make review and response workflows effortless: selecting text, commenting, and sending responses should feel immediate.
4. Prefer practical UI over decorative UI: every component must earn its place by reducing effort or ambiguity.
5. Preserve user control and comfort: support keyboard-driven font size adjustment in the Electron app.
