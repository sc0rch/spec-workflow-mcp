# Electron Desktop Rewrite

Last updated: 2026-03-14
Status: Milestone 3 in progress
Current focus: Finish approvals/log service extraction behind typed desktop boundaries and harden the new project catalog/home flow with deeper recovery coverage.

## Purpose

Rewrite Spec Workflow MCP into an Electron-first desktop product that is easier to use, more stable, and materially better in day-to-day UX than the current web dashboard.

This document is the working source of truth for the rewrite. Update it after each meaningful implementation step so future sessions can resume without reconstructing context from chat history.

## Product Direction

- The desktop app is the canonical user experience.
- Electron is the default delivery model; the browser dashboard is no longer the design center.
- The rewrite is allowed to break current UX and internal APIs if the replacement is cleaner and more maintainable.
- Preserve only the domain behavior that is still correct:
  - on-disk spec format
  - project binding semantics
  - explicit failure on ambiguous binding
  - deterministic approval state transitions
- Delete obsolete layers instead of preserving them through wrappers.

## Locked Decisions

- `v1` keeps Codex App launching MCP directly through stdio.
- `v1` Electron owns desktop UX, native dialogs, project recovery UX, and dashboard lifecycle.
- `v2` may add a small `spec-workflow-codex-bridge` executable so Codex can still spawn stdio MCP while Electron owns the real lifecycle behind a local bridge.
- New desktop code must stay lean:
  - small files where practical
  - clear module boundaries
  - no renderer-side filesystem business logic
  - no compatibility shims unless explicitly justified
- New desktop code must be held to stricter standards than the legacy code:
  - TypeScript strict mode
  - ESLint for new desktop code
  - TDD for domain logic and service boundaries
  - end-to-end coverage for critical desktop flows

## Quality Bar

### Code rules

- Keep modules focused and composable.
- Prefer dependency-injected services over singleton state.
- Keep Electron `main`, `preload`, renderer, and domain code separated.
- Put filesystem and workflow mutations behind typed service boundaries.
- Avoid files that mix transport, orchestration, and business logic.

### Testing rules

- Unit and integration tests: Vitest
- Renderer component tests: React Testing Library
- Desktop/e2e flows: Playwright with Electron support
- Approval, project registration, and MCP orchestration flows need explicit end-to-end coverage before release

### UX rules

- Optimize for the core loops:
  - open/add project
  - resume current work
  - inspect/edit spec
  - request/review approval
  - recover from restart/errors
- Replace page-heavy navigation with task-oriented flows.
- Reduce clicks and context switching aggressively.

## Target Architecture

## Architecture Glossary

- desktop shell
  - Electron `main` + `preload` + renderer frame that owns native app capabilities, shell state, tray, window lifecycle, and desktop-only UX.
- renderer
  - React application running in the browser window. It consumes typed desktop APIs and never touches filesystem or Node APIs directly.
- desktop bridge
  - Narrow preload-exposed API between renderer and Electron `main`.
- workflow service
  - Testable domain/service module that performs filesystem or workflow mutations behind a typed interface.
- legacy dashboard
  - Existing browser dashboard/backend stack kept only as a temporary source of reusable domain logic during the rewrite.
- Codex-launched MCP
  - Current `v1` integration model where Codex App still spawns the MCP server over stdio.

### App shape

- `apps/desktop/`
  - Electron `main` process
  - `preload` bridge
  - React renderer
  - desktop-specific tests and build config
- Shared workflow/domain modules remain reusable and testable outside Electron.
- Existing legacy web dashboard remains in place only until feature parity is good enough to retire it.

### Process model

- Electron `main`
  - app lifecycle
  - window and tray
  - native folder picker
  - local process orchestration for dashboard/service pieces
  - safe IPC routing
- `preload`
  - narrow, typed desktop bridge
  - no direct Node exposure to renderer
- renderer
  - React UI
  - no direct filesystem access
  - state derived from typed service APIs
- workflow services
  - project registry / remembered projects
  - spec parsing and mutations
  - approvals
  - logs
  - MCP bridge/orchestration later

## MCP strategy

### Version 1

- Codex App still starts MCP via its config.
- Electron does not try to replace Codex's stdio parent/child lifecycle.
- Shared disk state is the contract between Codex-launched MCP and Electron desktop UI.

### Version 2

- Add `spec-workflow-codex-bridge`:
  - Codex spawns the bridge over stdio
  - bridge forwards MCP traffic to Electron-managed local service
  - Electron becomes the effective lifecycle owner

## Milestones

### Milestone 0: Rewrite Guardrails

Goal: Freeze scope, quality bar, and migration strategy before writing desktop code.

- [x] Decide the product direction is Electron-first.
- [x] Decide `v1` MCP ownership stays with Codex App.
- [x] Decide `v2` bridge is optional follow-up work, not a blocker.
- [x] Add root scripts and conventions for the new desktop subtree.
- [x] Define which legacy behaviors are intentionally preserved vs intentionally dropped.
- [x] Add a short architecture glossary so future work uses consistent terms.

Exit criteria:
- This document is current.
- The team can say what `v1` includes and excludes in one paragraph.

### Milestone 1: Desktop Workspace Scaffold

Goal: Create a clean Electron app workspace without entangling it with legacy dashboard code.

- [x] Create `apps/desktop/` workspace with Electron `main`, `preload`, renderer, and shared config.
- [x] Add TypeScript strict configuration scoped to new desktop code.
- [x] Add ESLint flat config for desktop code and CI script to run it.
- [x] Add base test setup for Vitest and React Testing Library.
- [x] Add Playwright Electron runner skeleton.
- [x] Add build scripts for local dev and production packaging.

Exit criteria:
- Desktop app boots to a blank shell window.
- `lint`, unit test, and desktop dev startup all work.

### Milestone 2: Desktop Shell and Native Capabilities

Goal: Replace terminal friction with a usable desktop shell.

- [x] Implement window lifecycle and single-instance behavior.
- [x] Add tray menu with:
  - open app
  - add project
  - show current app status
  - quit
- [x] Add native folder selection dialog via `main` + `preload`.
- [x] Add app settings storage for window state and basic preferences.
- [x] Add startup checks for writable storage paths and missing dependencies.

Implemented in this milestone:
- Typed desktop bridge for shell state, project picking, and shell-state change notifications.
- `DesktopShell` main-process controller for window restore, single-instance focus, tray wiring, and persisted project selection.
- Settings store with coverage for persisted window/project state.
- Startup diagnostics for storage writability, renderer bundle presence, tray asset availability, and Git availability.
- Renderer shell upgraded from static scaffold to live desktop state, diagnostics, and native folder-picker UX.
- Production `package:dir` smoke-test passes with ad-hoc signing fallback on macOS.

Exit criteria:
- User can launch the app without terminal usage.
- User can pick a project via native folder dialog.

### Milestone 3: Domain Service Extraction

Goal: Stop coupling new UI to legacy transport and page structure.

- [x] Identify reusable workflow modules from current codebase.
- [ ] Extract or wrap reusable logic for:
  - [x] remembered projects
  - [x] project binding/path logic for manual desktop project registration
  - [x] spec parsing
  - [ ] approvals storage
  - [ ] implementation logs
- [x] Create typed desktop service interfaces for renderer use.
- [ ] Add unit tests for each extracted service boundary.
- [ ] Remove accidental dependencies on HTTP route handlers from new code.

Implemented so far:
- Removed duplicate `SpecParser` implementations and kept one canonical parser in `src/core/parser.ts`.
- Added `ProjectCatalogService` in `src/core/project-catalog.ts` for remembered/live project merge, latest spec lookup, manual add/forget, and live/disconnected state.
- Refactored dashboard `ProjectManager` to consume the extracted catalog service instead of duplicating merge/add/remove behavior.
- Wired desktop `main -> preload -> renderer` through a typed project catalog contract so the Electron shell now reads remembered/live projects through domain services, not ad-hoc UI state.
- Hardened `src/core/task-parser.ts` to satisfy strict desktop compilation once shared core modules became part of the Electron runtime build.
- Added focused tests for the extracted project catalog service and parser unification behavior.

Exit criteria:
- New desktop code calls services, not legacy page/server code.

### Milestone 4: Project Home and Recovery UX

Goal: Make startup and restart recovery feel native and immediate.

- [x] Build desktop home screen with:
  - recent/remembered projects
  - project status
  - last active workspace
  - add project action
- [x] Show remembered projects immediately on launch.
- [x] Support forget/remove project behavior.
- [x] Show disconnected vs live MCP state clearly.
- [x] Add empty state that does not require manual path typing.
- [ ] Cover add/remove/restart recovery with e2e tests.

Implemented so far:
- Desktop renderer now shows a real project home with remembered/live projects, latest spec, git branch, workflow root, and a native add-project action.
- Forget/remove is routed through the typed desktop bridge and updates persisted remembered-project state.
- Desktop shell refreshes project catalog state on launch and focus, so restart recovery and MCP visibility now appear in the native UI instead of the legacy dashboard only.

Exit criteria:
- Restarting the app still shows the user's project list.
- Adding a project never requires raw path entry.

### Milestone 5: Core Navigation Rewrite

Goal: Replace the current tab-heavy dashboard with a task-oriented layout.

- [ ] Define new information architecture:
  - left rail for projects/navigation
  - center workspace for current work
  - right detail/action panel
- [ ] Implement a compact navigation model around work modes, not legacy tabs.
- [ ] Add keyboard-friendly project and spec switching.
- [ ] Reduce modal/page churn for common flows.
- [ ] Keep renderer state local and explicit; avoid global state sprawl.

Exit criteria:
- User can move between project, spec, tasks, approvals, and logs with substantially fewer clicks.

### Milestone 6: Spec Workflow Rewrite

Goal: Rebuild spec creation, browsing, and editing flows around the actual working loop.

- [ ] Implement project overview with current status and active specs.
- [ ] Implement spec detail workflow:
  - requirements
  - design
  - tasks
  - implementation logs
- [ ] Add draft/edit/save UX with strong save state feedback.
- [ ] Make recent and in-progress work visible from the main screen.
- [ ] Add regression tests around spec file mutations.

Exit criteria:
- A user can move from project selection to active spec work without tab-hunting.

### Milestone 7: Approval UX Rewrite

Goal: Replace the current approval UX with a queue-first review flow.

- [ ] Design approval inbox as a primary workflow, not a secondary page.
- [ ] Build diff-first approval review.
- [ ] Make approve/reject/revise actions fast and obvious.
- [ ] Add keyboard shortcuts and batch flows where safe.
- [ ] Preserve strict approval rules:
  - no verbal approval
  - deterministic state transitions
- [ ] Add end-to-end tests for full approval lifecycle.

Exit criteria:
- Approval handling becomes one of the shortest flows in the app.

### Milestone 8: MCP Visibility and Operations

Goal: Make MCP state understandable without making Electron the owner too early.

- [ ] Show whether MCP is connected and which workspaces are active.
- [ ] Show last error, restart hints, and health indicators.
- [ ] Add documentation and UI copy explaining the `v1` lifecycle model:
  - Codex launches MCP
  - Electron observes and complements it
- [ ] Add logs or diagnostics view for local debugging.

Exit criteria:
- Users can understand MCP status without visiting config files or terminal output.

### Milestone 9: Optional Codex Bridge

Goal: Make Electron the lifecycle owner later without blocking `v1`.

- [ ] Define local bridge transport between stdio bridge and Electron-managed service.
- [ ] Implement `spec-workflow-codex-bridge`.
- [ ] Add settings/docs for updating Codex config to use the bridge executable.
- [ ] Add resilience tests around bridge reconnect/restart behavior.

Exit criteria:
- Codex can talk to Electron-managed MCP through a spawned stdio bridge.

### Milestone 10: Legacy Retirement

Goal: Remove the old dashboard as the default path after the desktop app is clearly better.

- [ ] Audit which legacy dashboard routes/pages are no longer needed.
- [ ] Remove dead code after desktop replacement is proven.
- [ ] Keep only the backend pieces that still serve reusable workflow logic.
- [ ] Update docs, screenshots, and onboarding around the desktop-first product.

Exit criteria:
- The desktop app is the default documented interface.
- Legacy dashboard is either removed or explicitly marked secondary/legacy.

## Current Progress Checklist

- [x] Decide to pursue Electron-first rewrite.
- [x] Decide `v1` keeps Codex-launched MCP.
- [x] Add this roadmap file as canonical rewrite plan.
- [x] Add a pointer to this roadmap in repo instructions.
- [ ] Start Milestone 1.

## Update Protocol

When continuing this rewrite:

1. Read this file first.
2. Update `Last updated`, `Status`, and `Current focus`.
3. Mark active milestone items as `[-]`.
4. Mark completed items as `[x]`.
5. If architecture changes, update `Locked Decisions` before writing code.
6. If a milestone is split or dropped, rewrite the checklist instead of adding contradictory notes below it.

## Not in Scope for Version 1

- Owning Codex's stdio MCP lifecycle directly from Electron without a bridge
- Preserving the current dashboard navigation model
- Supporting every legacy browser workflow equally well
- Keeping legacy APIs solely for backward compatibility with internal code

## Open Risks to Track

- Extracting correct domain logic from legacy code without carrying over its UI architecture
- Preventing Electron rewrite work from getting entangled with old dashboard routes/pages
- Keeping `v1` simple enough while still making the product feel materially better
- Avoiding desktop-specific logic leaks into reusable workflow modules
