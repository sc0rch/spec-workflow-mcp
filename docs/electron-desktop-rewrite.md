# Electron Desktop Rewrite

Last updated: 2026-03-14
Status: Milestone 14 in progress
Current focus: Re-evaluate the remaining browser-only automation/settings surface now that shell, notification, route-removal, and list-only task flows have explicit regression guardrails.

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
- `v2` bridge support now exists as an optional `spec-workflow-codex-bridge` executable so Codex can still spawn stdio MCP while Electron owns the real lifecycle behind a local bridge.
- Design benchmark for the desktop rewrite is closer to `Linear`, `Raycast`, and `Warp` than to a generic web admin dashboard.
- The main shell must be inbox-first and keyboard-heavy:
  - dense left rail for projects and navigation
  - central workspace for the current queue/editor/review flow
  - contextual detail panel only when it materially helps the active task
- Remove marketing-style chrome from the app surface:
  - no hero sections
  - no decorative gradients or glassmorphism
  - no permanent runtime/debug panels in the main workflow surface
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
- Favor dense, operational UI over explanatory dashboard copy.
- Prefer keyboard-first actions over secondary modal flows.
- Keep diagnostics, settings, and environment detail outside the main working surface unless the user is actively troubleshooting.

## External Design Review

### Latest Opus critique

- The legacy dashboard is organized like an admin panel by feature/page instead of by developer workflow.
- The current Electron rewrite is architecturally better but still too conservative visually and interactionally.
- The biggest issues called out in the current desktop shell:
  - hero/landing-page framing
  - too many card grids
  - a permanent right column full of runtime/debug information
  - low information density
  - plain `textarea` editing where a real editor flow should exist
- Target direction:
  - unified inbox for approvals, active specs, and recent work
  - spec workspace with proper editor affordances and tighter layout
  - full-width diff-first approval review with sticky actions
  - command palette and strong keyboard model
  - flat dark visual language with teal accent, subtle borders, and minimal motion

### Latest Opus checkpoint after shell reset

- The current shell is materially closer to the target direction:
  - flat dark tool-like visual language
  - denser typography and spacing
  - three-mode model is tighter than the previous four-mode split
  - inbox callout, spec tabs, compact stats, and approval chip queue are all improvements
- Remaining critique that now drives the next milestones:
  - the inbox body is still too dashboard-like because it uses three parallel columns instead of one prioritized queue
  - the spec workspace still shows three stacked textareas instead of one tabbed editor surface
  - the approval review still uses too many boxed sub-sections and needs to become diff-dominant with a sticky action footer
  - the right panel should show information not already duplicated in the center workspace
- Opus judged Milestone 5 complete enough to move on once the low-effort cleanup landed:
  - remove the session panel
  - remove explanatory header/workspace copy
  - flatten project rows

### Latest Opus checkpoint after approval rewrite

- Opus judged the approval flow complete enough to mark Milestone 8 done:
  - metadata flattened into one muted line
  - related spec context collapsed behind `<details>`
  - diff view no longer capped
  - sticky decision footer and visible keyboard shortcuts landed
  - auto-advance through the queue landed
- Remaining highest-impact critique after that review:
  - kill the permanent right panel
  - replace workspace stat boxes with one metadata line
  - quiet uppercase eyebrow/label patterns
  - replace `Edited` text with a dirty dot
  - collapse implementation logs by default
  - flatten the workspace head
  - remove the diff card wrapper
  - tighten border radii
- Those notes directly drove the shell density pass that is now implemented.

### Latest Opus checkpoint after command palette

- Opus judged Milestone 10 complete enough to move on:
  - `Cmd/Ctrl+K` palette exists and searches actions, projects, specs, documents, and approvals
  - palette keyboard navigation is in place
  - document switching with `Tab` / `Shift+Tab` landed
- Remaining critique after that review was no longer structural; it was consistency polish:
  - remove the palette title row and keep only the input plus `Esc`
  - remove the misleading `⌘K` shortcut from the `Add project` command item
  - kill blur-heavy/glassy palette styling and tighten density
  - remove inbox first-item duplication
  - shorten the workspace metadata line
  - normalize hardcoded border radii and delete dead renderer CSS
- Those notes directly drove the interaction-polish pass that is now implemented.

### Latest Opus checkpoint after MCP visibility

- Opus judged Milestone 12 complete enough to move on because the required MCP visibility surfaces now exist:
  - inline header-triggered diagnostics instead of a permanent debug column
  - visible live vs remembered workspaces
  - restart hints and runtime details without making Electron the lifecycle owner
- Remaining critique was density, not missing features:
  - remove architecture prose from the panel
  - flatten the live/remembered split into one list
  - drop extra bordered cards around hints and empty states
- Those notes directly drove the final MCP density pass that is now implemented.

### Latest Opus checkpoint after legacy-dashboard de-emphasis

- Opus agreed with the product direction:
  - the web dashboard should be clearly secondary
  - docs should be desktop-first
  - the browser surface should signal "legacy" without competing with the desktop product
- The critique was about density and shape, not direction:
  - a full-width migration-style banner in the browser UI is too loud
  - launch commands belong in docs, not in a persistent browser banner
  - the legacy signal should behave like a compact status marker, not a campaign panel
- Those notes directly drove the density pass that reduced the browser notice to a compact inline legacy marker and removed terminal instructions from the UI surface.

### Latest Opus checkpoint after browser-shell cleanup

- Opus judged the browser legacy direction as correct and specific enough to keep trimming instead of redesigning:
  - compact legacy notice, grouped workflow/utilities nav, and desktop-first empty-state copy are the right shape
  - the browser surface now reads as secondary without pretending to be feature-parity with Electron
- Remaining high-value cleanup called out by Opus:
  - remove mobile-only settings UX from the legacy shell
  - make the version badge static instead of a changelog modal trigger
  - remove sidebar collapse/persistence chrome
  - eventually strip notification-volume polish and Kanban-only UX if the browser surface still feels too productized
- Those notes directly drove the next cleanup pass now implemented in Milestone 14.
- A follow-up cleanup slice also removed notification-audio polish from the legacy browser shell instead of carrying it forward as a pseudo-product feature.

### Latest gpt-5.3-codex baseline review

- First whole-repository baseline code review is now part of the rewrite loop and has already been run in headless trust mode.
- The first pass surfaced concrete issues instead of style-only commentary:
  - runtime crash path in the legacy dashboard empty state because `AppInner` used `t(...)` without calling `useTranslation()`
  - shared initial-load ref in `NotificationProvider` that coupled approvals bootstrap with task bootstrap
  - stale frontend `getChangelog` API contract after the changelog modal was removed
  - user-facing wording drift between CLI help and dashboard runtime logging
- Immediate local fixes from that review are now implemented:
  - restored `useTranslation()` inside `AppInner`
  - split initial-load refs in `NotificationProvider`
  - removed dead `getChangelog` frontend API surface
  - aligned dashboard runtime log wording with the documented project-recovery behavior
- Follow-up cleanup after that review kept the browser surface moving in the same direction:
  - removed the `VolumeControl` UI from the legacy header
  - deleted the browser-only notification sound/volume path from `NotificationProvider`
  - deleted the unused `VolumeControl` component and CSS
  - moved theme/language controls into the sidebar footer so mobile still has access without reviving the old settings drawer
  - removed the stale `howler` dependency from the root package manifest/lock
- Remaining review gap to address later:
  - browser dashboard frontend still lacks focused component-level tests, and root `tsc` does not typecheck `src/dashboard_frontend/**`

### Review cadence

- Ask Opus for UI/UX/design critique at the end of each major renderer milestone:
  - after shell restructure
  - after unified inbox
  - after spec workspace rewrite
  - after approval workflow rewrite
- Run `gpt-5.3-codex` code review after each meaningful cleanup/refactor slice:
  - prioritize bugs, regressions, weak boundaries, dead code, and missing tests
  - prefer review prompts that ask for findings with file references and severity ordering
  - treat the review as a gate before moving to the next milestone slice when practical
- Periodically run a broader `gpt-5.3-codex` baseline review across the whole repository:
  - after major milestone checkpoints
  - when the rewrite changes both legacy and desktop surfaces in one pass
  - before declaring a milestone complete
- Preferred mechanism is to continue the same `cursor-agent` conversation with `--continue` or `--resume [chatId]`.
- For unattended reviews, use headless `cursor-agent --print --trust --force ...` so Opus does not stall on internal shell approvals.
- Use the same headless `cursor-agent --print --trust --force ...` flow for `gpt-5.3-codex` reviews so they can run unattended and be copied into the roadmap or chat summary.
- If the previous chat cannot be resumed, pass the prior Opus critique back into the next prompt so review stays cumulative instead of reset.
- Treat Opus design critique as a forcing function for direction, not as the source of truth for workflow behavior or domain rules.
- Treat `gpt-5.3-codex` review findings as engineering quality input:
  - fix confirmed issues immediately when the change is local and low-risk
  - otherwise record them in the roadmap/current focus before continuing

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
- [x] Extract or wrap reusable logic for:
  - [x] remembered projects
  - [x] project binding/path logic for manual desktop project registration
  - [x] spec parsing
  - [x] approvals storage
  - [x] implementation logs
- [x] Create typed desktop service interfaces for renderer use.
- [x] Add unit tests for each extracted service boundary.
- [x] Remove accidental dependencies on HTTP route handlers from new code.

Implemented so far:
- Removed duplicate `SpecParser` implementations and kept one canonical parser in `src/core/parser.ts`.
- Added `ProjectCatalogService` in `src/core/project-catalog.ts` for remembered/live project merge, latest spec lookup, manual add/forget, and live/disconnected state.
- Refactored dashboard `ProjectManager` to consume the extracted catalog service instead of duplicating merge/add/remove behavior.
- Wired desktop `main -> preload -> renderer` through a typed project catalog contract so the Electron shell now reads remembered/live projects through domain services, not ad-hoc UI state.
- Hardened `src/core/task-parser.ts` to satisfy strict desktop compilation once shared core modules became part of the Electron runtime build.
- Moved `ApprovalStorage` and `ImplementationLogManager` into `src/core/`, fixed them up for strict desktop builds, and updated dashboard/tool imports to use the new canonical module locations.
- Added `ProjectActivityService` in `src/core/project-activity.ts` so project-level approval and implementation summaries can be derived without touching legacy dashboard transport.
- Added focused tests for the extracted project catalog, project activity, implementation log manager, and approval path-resolution behavior.

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
- [x] Cover add/remove/restart recovery with e2e tests.

Implemented so far:
- Desktop renderer now shows a real project home with remembered/live projects, latest spec, git branch, workflow root, and a native add-project action.
- Forget/remove is routed through the typed desktop bridge and updates persisted remembered-project state.
- Desktop shell refreshes project catalog state on launch and focus, so restart recovery and MCP visibility now appear in the native UI instead of the legacy dashboard only.
- Desktop shell now exposes a typed `rememberProjectPath()` bridge path that backs native picker persistence and future drag/drop or deep-link entrypoints without reintroducing manual path UX.
- Electron e2e now verifies remembered project restoration after restart and forget persistence across relaunches with real workflow data on disk.

Exit criteria:
- Restarting the app still shows the user's project list.
- Adding a project never requires raw path entry.

### Milestone 5: Shell Restructure and Visual Reset

Goal: Remove the remaining dashboard/marketing feel and establish the dense desktop shell that all later workflows will inherit.

- [x] Remove hero/landing-page framing from the desktop app.
- [x] Flatten the shell into a denser app layout with less card sprawl.
- [x] Collapse permanent diagnostics/runtime/keyboard-reference panels out of the main working view.
- [x] Replace decorative gradients, dashed panels, and glassmorphism with a flatter desktop visual system.
- [x] Tighten typography, spacing, and badges for higher information density.
- [x] Keep renderer state local and explicit; avoid global state sprawl while restructuring the shell.

Implemented so far:
- Rebuilt the desktop renderer into a three-zone shell with a project rail, central workspace, and details column instead of the earlier flat card grid.
- Cut the hero/landing frame and replaced it with a compact one-line shell header.
- Removed permanent runtime/keyboard/diagnostics panels from the main workflow surface; diagnostics now appear only when issues exist.
- Replaced the old gradient/glassmorphism look with a flat dark visual system tuned for higher density.
- Flattened the project rail from multi-line cards into compact rows and moved project detail/forget actions out of the rail.
- Added keyboard shortcuts for mode switching (`1-3`) and project switching (`J/K`) as the first step toward keyboard-heavy desktop flows.
- Kept selection and view mode local to the renderer while continuing to derive all project/workflow data from the typed desktop bridge.
- Added canonical per-project workspace snapshots in `src/core/project-workspace.ts`, so the renderer now consumes specs, task state, approvals, phase content, and recent implementation logs from one service boundary.

Exit criteria:
- The desktop shell no longer looks like a dashboard or landing page.
- The main workflow surface prioritizes project selection and current work over diagnostics.

### Milestone 6: Unified Inbox

Goal: Make the default view a work queue instead of a summary dashboard.

- [x] Replace the current `Overview` mode with a true unified inbox.
- [x] Merge:
  - pending approvals
  - active specs / current tasks
  - recent implementation activity
- [x] Make the next recommended action obvious without reading explanatory copy.
- [x] Preserve keyboard-first mode and project movement while the inbox is active.
- [x] Keep empty and loading states compact and operational.

Implemented:
- Added a workspace snapshot service that resolves spec phase content, task progress, pending approvals, and recent implementation logs for the currently selected project.
- Desktop renderer now defaults to an inbox surface with a next-action callout plus one prioritized queue that mixes approvals, actionable specs, and recent implementation activity.
- Shell reset follow-up removed the remaining header/session noise so the inbox is now the first real working surface after project selection.
- Keyboard mode switching (`1-3`) and project switching (`J/K`) stay available while the inbox is focused.

Exit criteria:
- The first screen after project selection is an actionable queue, not a status report.

### Milestone 7: Spec Workspace Rewrite

Goal: Turn spec work into a focused editor workflow instead of a stack of cards and textareas.

- [x] Replace the current spec detail stack with a tighter editor-centered workspace.
- [x] Use real editor affordances for `requirements`, `design`, and `tasks`.
- [x] Support quick tab switching between spec documents.
- [x] Keep implementation logs visible below or beside the active document.
- [x] Surface compact task progress in the workspace without dashboard-style metric cards.
- [x] Add regression coverage around editor save and navigation behavior.

Implemented:
- Added `SpecDocumentsService` in `src/core/spec-documents.ts` as the canonical mutation path for requirements/design/tasks markdown saves.
- Desktop renderer now supports inline editing and save-state feedback for requirements, design, and tasks through the typed Electron bridge instead of direct filesystem access.
- Reworked the workspace shell into a single-document editor surface with spec tabs, document tabs, save shortcuts, and one compact metadata line instead of a stack of three editors and stat cards.
- Implementation logs now live below the editor behind a collapsed history section instead of always competing with the active document.
- Added focused mutation coverage for core spec-document saves plus renderer save-flow coverage through the desktop API mock.

Exit criteria:
- A user can move from project selection to spec editing without fighting layout noise.

### Milestone 8: Approval Review Rewrite

Goal: Make approval handling a full-width, fast review flow with minimal friction.

- [x] Keep approval inbox as a primary workflow, not a secondary page.
- [x] Make diff review the dominant surface.
- [x] Use a sticky action bar for approve / request revision / reject.
- [x] Add keyboard shortcuts and safe auto-advance behavior.
- [x] Preserve strict approval rules:
  - no verbal approval
  - deterministic state transitions
- [x] Add end-to-end tests for full approval lifecycle.

Implemented:
- Added `ApprovalReviewService` in `src/core/approval-review.ts` so desktop approval review, diff loading, and state transitions all go through one core service boundary.
- Desktop renderer now uses flattened review metadata, collapsed related-spec context, unbounded diff rendering, a sticky decision footer, visible approval shortcuts, and queue auto-advance.
- Added focused core coverage for approval review snapshots/actions and renderer coverage for approval decisions through the desktop API contract.
- Desktop end-to-end coverage now exercises remembered-project recovery and forget flows against the new shell while full desktop tests cover approval shortcuts and auto-advance behavior.

Exit criteria:
- Approval handling becomes one of the shortest flows in the app.

### Milestone 9: Shell Density Pass

Goal: Remove persistent UI dead weight and give the center workspace most of the screen.

- [x] Remove the permanent right panel and reclaim width for the center workspace.
- [x] Flatten the workspace head into a plain row instead of a bordered card.
- [x] Replace remaining workspace stat grids with single metadata lines.
- [x] Collapse implementation logs by default.
- [x] Remove loud uppercase eyebrow patterns and text-heavy dirty indicators.
- [x] Tighten corner radii and hover states for a denser tool-like feel.
- [x] Move diagnostics into the main workspace surface only when they matter.

Implemented:
- Removed the always-visible right panel, moved forget-project into the rail, and turned diagnostics into inline workspace banners.
- Flattened the workspace head, removed the last approval diff wrapper card, and collapsed implementation history by default.
- Replaced document dirty text with a dot, quieted queue labels, and tightened control/panel radii.

Exit criteria:
- The app reads as a two-column developer tool instead of a dashboard with a debug sidebar.

### Milestone 10: Command Palette and Interaction Layer

Goal: Add a global command surface and deeper keyboard routing on top of the denser shell.

- [x] Add `Cmd+K` command palette for projects, specs, approvals, and shell actions.
- [x] Add fast actions for open project, jump to spec, jump to approval, and add project.
- [x] Extend keyboard routing beyond mode switches:
  - project/surface jumps
  - queue movement
  - editor/document switching
- [x] Tighten loading, empty, success, and error states around the command layer.

Implemented:
- Added a typed renderer command palette component with search, arrow-key navigation, enter-to-run behavior, and explicit close handling.
- Wired the palette into the desktop shell for actions, projects, specs, documents, and approvals, plus a compact header trigger and `Cmd/Ctrl+K` global shortcut.
- Added `Tab` / `Shift+Tab` document switching and kept approval/save shortcuts coordinated with the new command layer.
- Added renderer tests for palette routing across workspace and approvals plus document tab cycling.

Exit criteria:
- A user can reach any active work item without hunting through visible UI.

### Milestone 11: Interaction Polish and Palette Refinement

Goal: Make the dense shell and command layer visually consistent and remove the last obvious dashboard leftovers.

- [x] Remove palette chrome that reads like a modal dialog instead of a quick command surface.
- [x] Tighten palette density, borders, and typography to match the main shell.
- [x] Remove inbox duplication between the next-action callout and the queue list.
- [x] Shorten workspace metadata so it collapses cleanly when there is no active/next task.
- [x] Normalize hardcoded radii to shared tokens and delete dead renderer CSS.

Implemented:
- Removed the command-palette title row, kept the palette accessible through `aria-label`, and moved `Esc` into the search row.
- Removed blur-heavy/glassy palette treatment, tightened gaps and borders, and aligned palette category typography with the quieter queue styling.
- Removed the misleading `⌘K` shortcut from `Add project`, de-duplicated the first inbox item, and shortened the workspace metadata line to only show real segments.
- Normalized renderer radii to shared tokens, removed dead command/shell selectors, and simplified the editor height rules.

Exit criteria:
- The command layer feels native to the shell instead of looking like a separate modal system.

### Milestone 12: MCP Visibility and Operations

Goal: Make MCP state understandable without making Electron the owner too early.

- [x] Show whether MCP is connected and which workspaces are active.
- [x] Show last error, restart hints, and health indicators.
- [x] Add documentation and UI copy explaining the `v1` lifecycle model:
  - Codex launches MCP
  - Electron observes and complements it
- [x] Add logs or diagnostics view for local debugging.

Implemented:
- Added a compact MCP status trigger in the desktop header plus a keyboard-dismissable diagnostics panel inside the main workspace column instead of reintroducing a permanent debug rail.
- The diagnostics panel now shows live vs remembered workspaces, restart hints, runtime details, and current health without claiming ownership of Codex's stdio lifecycle.
- Command palette actions can open the same MCP visibility surface, so status remains reachable without hunting through layout chrome.
- Updated README with the current desktop-shell `v1` lifecycle note so contributors and testers understand that Codex still launches MCP while Electron observes and complements it.

Exit criteria:
- Users can understand MCP status without visiting config files or terminal output.

### Milestone 13: Optional Codex Bridge

Goal: Make Electron the lifecycle owner later without blocking `v1`.

- [x] Define local bridge transport between stdio bridge and Electron-managed service.
- [x] Implement `spec-workflow-codex-bridge`.
- [x] Add settings/docs for updating Codex config to use the bridge executable.
- [x] Add resilience tests around bridge reconnect/restart behavior.

Implemented:
- Added a local socket bridge contract in `apps/desktop/src/shared/mcp-bridge.ts` plus `SocketMcpTransport` so Electron can host real MCP server instances behind a newline-delimited local transport instead of stdio.
- Added `McpBridgeService` in the Electron main process, backed by an endpoint file under the desktop storage root, handshake token validation, per-session MCP server instances, and per-session registry instance IDs so multiple bridge sessions inside one Electron pid do not unregister each other.
- Added `spec-workflow-codex-bridge` in `apps/desktop/src/bridge/`, including hidden desktop auto-launch, endpoint discovery/retry logic, and raw stdio-to-socket proxying for Codex.
- Added hidden-start support to the desktop app so the bridge can launch Electron without forcing a visible window before the user asks for one.
- Documented the bridge-based Codex config path in `README.md` and added focused coverage for storage-root resolution, socket transport I/O, bridge-service handshake behavior, and bridge reconnect/launch retry logic.

Exit criteria:
- Codex can talk to Electron-managed MCP through a spawned stdio bridge.

### Milestone 14: Legacy Retirement

Goal: Remove the old dashboard as the default path after the desktop app is clearly better.

- [x] Audit which legacy dashboard routes/pages are no longer needed.
- [-] Remove dead code after desktop replacement is proven.
- [ ] Keep only the backend pieces that still serve reusable workflow logic.
- [x] Update docs, screenshots, and onboarding around the desktop-first product.

Implemented:
- Added `docs/LEGACY-DASHBOARD-AUDIT.md` as the canonical route inventory and cleanup map for the browser dashboard, including which routes are now legacy-only and which backend/domain modules remain canonical.
- Updated `README.md` to make the Electron desktop shell the preferred documented interface, move the browser dashboard into a legacy/secondary position, and keep bridge-based Codex setup in the primary onboarding path.
- Added an explicit legacy notice inside the browser dashboard UI plus a secondary-label treatment in the sidebar so contributors and testers no longer confuse the browser surface for the primary product direction.
- Removed the old browser `DashboardStatistics` landing page, redirected `/` to `/specs`, and dropped the statistics nav item so the legacy browser surface no longer opens like an admin overview by default.
- Removed additional browser-only dead weight by deleting the unused `StatusFilterPills` component and leftover `temp_source_update.js` helper, and stripped noisy debug `console.log` traces out of the browser notification and kanban flows.
- Flattened the legacy browser shell further by removing the donation CTA from the header, dropping sticky blur-heavy treatment, and rewriting the no-project empty state around desktop-first guidance instead of raw terminal commands.
- Updated CLI help and the legacy-dashboard audit so browser-mode instructions no longer present the web dashboard as the default workflow or depend on per-project terminal launch examples.
- Ran another Opus review in headless trust mode and used it to remove the browser-only mobile settings drawer, convert the version badge into static diagnostic text, delete the unused `ChangelogModal`, remove sidebar collapse/localStorage state, and make the compact legacy notice dismissible.
- Split the legacy browser sidebar into explicit workflow vs utility sections while keeping the surface permanently expanded, so the information architecture now reflects compatibility/debugging use instead of a primary product shell.
- Removed browser-only notification audio/volume controls from the legacy shell, simplifying `NotificationProvider` back to toast state/actions instead of keeping sound preferences and `Howler` wiring for a secondary debugging surface.
- Removed the Kanban-only browser task board, deleted its `@dnd-kit/*` dependency chain, and kept `TasksPage` list-first so the legacy task flow no longer maintains a separate drag-and-drop interaction model.
- Added explicit browser-frontend hardening with `tsconfig.dashboard.json`, `vitest.dashboard.config.ts`, and focused jsdom coverage for `App`, `LegacyDashboardNotice`, `PageNavigationSidebar`, and `NotificationProvider`.
- Folded the new dashboard typecheck into the root `build` path and fixed the latent browser TS defects it surfaced in `api.tsx`, `useMDXEditorTheme.ts`, `JobFormModal.tsx`, `LogsPage.tsx`, and `TasksPage.tsx` instead of weakening the new guardrail.
- Removed the dead browser changelog tail completely:
  - deleted stale `changelog` / `volumeControl` locale blocks from every browser locale bundle
  - removed unused changelog endpoints from `src/dashboard/multi-server.ts`
  - removed the unused `captureApprovalSnapshot` browser API contract and the matching manual-snapshot HTTP endpoint
- Added `src/dashboard/__tests__/multi-server-removed-routes.test.ts` so removed changelog routes stay unavailable and `/approvals/:id/snapshot` is locked to the new `Invalid action` behavior instead of silently surviving behind the generic approval-action route.
- Added focused `TasksPage` regression coverage for the list-only browser task flow, including status filtering and description sort-order toggling after the Kanban removal.
- Ran scoped `gpt-5.3-codex` reviews after both the hardening pass and the follow-up delete-pass; neither found concrete regressions, and the earlier residual `TasksPage` testing gap is now closed by focused list-flow coverage.

Exit criteria:
- The desktop app is the default documented interface.
- Legacy dashboard is either removed or explicitly marked secondary/legacy.

## Current Progress Checklist

- [x] Decide to pursue Electron-first rewrite.
- [x] Decide `v1` keeps Codex-launched MCP.
- [x] Add this roadmap file as canonical rewrite plan.
- [x] Add a pointer to this roadmap in repo instructions.
- [x] Start Milestone 1.
- [x] Complete Milestone 2.
- [x] Complete Milestone 3.
- [x] Complete Milestone 4.
- [x] Complete Milestone 5.
- [x] Complete Milestone 6.
- [x] Complete Milestone 7.
- [x] Complete Milestone 8.
- [x] Complete Milestone 9.
- [x] Complete Milestone 10.
- [x] Complete Milestone 11.
- [x] Complete Milestone 12.
- [x] Complete Milestone 13.
- [-] Start Milestone 14.

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
