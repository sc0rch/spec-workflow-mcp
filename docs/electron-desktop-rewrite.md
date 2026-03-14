# Electron Desktop Rewrite

Last updated: 2026-03-14
Status: Milestone 14 complete; post-roadmap approval review rewrite, desktop refresh hardening, accessibility hardening, inbox recency fixes, and spec-viewer kanban rework implemented
Current focus: Core rewrite milestones are complete. Post-roadmap Electron refinements are now focused on approval-flow polish, accessibility cleanup, bundle-weight reduction, and targeted desktop UX cleanup while browser cleanup stays opportunistic only. Keep inbox prioritization aligned with the most recent MCP activity and keep Specs optimized for review rather than editing.

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

### Latest Opus checkpoint after settings/history simplification

- Opus judged the browser automation utility as directionally correct but still too admin-heavy before the latest pass:
  - the header card and empty-state illustration were still productized for a legacy utility page
  - job cards, badge pills, and full-width action bars still read like a mini admin dashboard
  - `JobExecutionHistory` was the weakest surface:
    - hardcoded gray/dark classes instead of shell tokens
    - a six-card stats grid for a secondary accordion panel
    - duplicated analytics that did not earn their maintenance cost
- The concrete cleanup it asked for:
  - flatten settings jobs into compact rows
  - replace the delete modal with inline confirmation
  - replace radio-card form chrome with simple selects
  - gut history stats and keep only a compact recent-runs surface
  - remove the `/api/jobs/:jobId/stats` dependency entirely
- Those notes directly drove the latest Milestone 14 cleanup pass now implemented.

### Latest Opus checkpoint after browser-settings removal

- Opus judged the remaining browser information architecture to still overstate the product:
  - `Logs` and `Steering` were still presented like daily destinations in the sidebar even though the browser shell is now only compatibility/debugging
  - `LogsPage` may stay useful as a read-only inspection surface, but not as first-class navigation
  - `SteeringPage` as a rich authoring surface actively undermined the desktop-first product stance
- The recommended direction was:
  - collapse browser sidebar to `Specs`, `Approvals`, `Tasks`
  - keep `Logs` only as a deep-link/debug route
  - remove browser steering authoring entirely instead of carrying it as a parallel editing surface
- Those notes directly drove the latest Milestone 14 navigation and route cleanup now implemented.

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

### Latest gpt-5.3-codex review after settings/history cleanup

- The first code-review pass on this slice found two concrete regressions plus one local UX bug:
  - manual `Run Now` executions did not persist into job history or `lastRun`
  - the browser UI treated `200 OK` manual runs as success even when payload returned `success: false`
  - settings form submit errors were swallowed by the page-level handler, making modal inline error UI unreachable
- All three issues are now fixed:
  - `JobScheduler.runJobManually()` now persists execution history and `lastRun` through the same helper used by catch-up and scheduled runs
  - browser settings now surfaces `result.error` on `success: false` while still updating `lastRun`
  - settings form submit now rethrows after setting page-level error so the modal stays open and shows inline submit errors
- New focused coverage now locks these fixes:
  - backend unit test for manual run persistence
  - browser test for `Run Now` with `success: false`
  - browser integration-style test for failed job creation keeping the modal open
- A short follow-up re-review then found two additional concrete issues:
  - browser settings still trusted `/api/jobs` JSON without checking `response.ok`
  - the compact form still exposed Quartz-style weekly/bi-weekly cron presets that `node-cron` cannot schedule
- Both follow-up issues are now fixed:
  - `/api/jobs` load now validates HTTP status and payload shape before mapping
  - the invalid presets were removed/replaced with `node-cron` compatible values and browser coverage now locks that reduced preset set

### Latest gpt-5.3-codex review after full settings removal

- A final deletion-focused review was run after removing the browser settings/automation surface entirely.
- No concrete bugs or regressions were found in the reviewed areas:
  - `src/dashboard/multi-server.ts`
  - `src/dashboard/__tests__/multi-server-removed-routes.test.ts`
  - `src/dashboard_frontend/src/modules/app/App.tsx`
  - `src/dashboard_frontend/src/modules/components/PageNavigationSidebar.tsx`
  - `src/types.ts`
  - `src/dashboard_frontend/src/types.ts`
  - `docs/LEGACY-DASHBOARD-AUDIT.md`
- Residual risk called out by the review:
  - removed-route coverage is explicit but still narrow, so future accidental route reintroduction would rely on broader suites unless the removed-routes test keeps expanding with deletions

### Latest gpt-5.3-codex review after workflow-only browser shell

- A final follow-up review was run after collapsing the browser shell to workflow-only navigation and deleting browser steering authoring.
- No concrete bugs or regressions were found in the reviewed areas:
  - `src/dashboard_frontend/src/modules/app/App.tsx`
  - `src/dashboard_frontend/src/modules/app/App.test.tsx`
  - `src/dashboard_frontend/src/modules/components/PageNavigationSidebar.tsx`
  - `src/dashboard_frontend/src/modules/components/PageNavigationSidebar.test.tsx`
  - `src/dashboard_frontend/src/modules/api/api.tsx`
  - `src/dashboard/multi-server.ts`
  - `src/dashboard/__tests__/multi-server-removed-routes.test.ts`
  - `docs/LEGACY-DASHBOARD-AUDIT.md`
- Residual risks called out by the review:
  - `/logs` remains a deep-link/debug route without browser-level e2e coverage for direct URL entry plus back/forward navigation
  - removed-route coverage is still representative rather than exhaustive, so future deletions should continue extending the dedicated regression test

### Latest post-roadmap quieter pass for Electron shell

- A quieter-pass was applied to the Electron renderer after the design critique identified too much same-weight shell chrome competing with active work.
- The refinement intentionally targeted shell intensity, not workflow structure:
  - header utilities were regrouped into a quieter status / MCP / palette strip
  - status copy was shortened from verbose runtime labels to calmer utility labels
  - project rail chrome was softened and the section meta was reduced to saved-project count
  - work-mode tabs were flattened into a lighter navigation strip instead of three equally heavy boxed controls
  - panel borders, fills, command-palette backdrop, and accent saturation were all reduced so the editor/review surfaces stay visually primary
  - top-level connection-state copy was shortened from `Live MCP attached` / `Recovered from memory` to `Live` / `Remembered`
- Verification for this pass:
  - `npm --prefix apps/desktop run test`
  - `npm --prefix apps/desktop run lint`
  - `npm --prefix apps/desktop run build`
- Current environment note:
  - `npm --prefix apps/desktop run test:e2e` is currently blocked by an already-running Electron desktop instance, so Playwright launches exit immediately on the single-instance lock instead of exercising the shell

### Latest post-roadmap bolder pass for Electron shell

- A follow-up bolder-pass was applied after the quieter pass reduced noise but still left the shell feeling too safe and too close to generic teal-on-dark developer tooling.
- The direction for this pass was deliberately narrow:
  - keep shell chrome relatively restrained
  - make active project context, next-action callout, and review/editor surfaces feel more confident and memorable
  - shift the shell away from the earlier cool-teal palette into a warmer industrial/editorial tone
- Implemented changes:
  - moved the desktop palette from cool teal neutrals to warmer rust/copper-tinted neutrals and accents
  - added a subtle background grid/field treatment so the shell no longer floats on a flat anonymous dark canvas
  - enlarged the active project title and gave the workspace head a stronger editorial anchor
  - turned the inbox callout into a true focal moment with stronger contrast, larger title, and an accent rail
  - made selected project and approval states feel more intentional through stronger edge treatment instead of generic fill-only highlighting
  - deepened editor/review surfaces so they read more like working panes than standard dark textareas
- Verification for this pass:
  - `npm --prefix apps/desktop run test`
  - `npm --prefix apps/desktop run lint`
  - `npm --prefix apps/desktop run build`

### Latest post-roadmap polish pass for Electron shell

- A final polish-focused pass followed the quieter and bolder work so the renderer would feel less like a direction study and more like a shippable desktop surface.
- This pass avoided changing information architecture. It focused on detail quality:
  - filled in missing interactive states for primary/secondary actions and major shell surfaces
  - improved hover/active/focus behavior for queue rows, mode tabs, project rows, and palette items
  - added stronger focus treatment for editor, approval note, and command search inputs
  - tightened placeholder/readability treatment and allowed header/summary rows to wrap more gracefully instead of clipping
  - added coarse-pointer sizing so touch targets move up to a safer `44px` minimum on touch devices
  - added `prefers-reduced-motion` handling so the desktop shell respects reduced-motion environments
  - removed a small responsive inconsistency where the mobile mode-tab layout still carried an irrelevant grid declaration
- Verification for this pass:
  - `npm --prefix apps/desktop run test`
  - `npm --prefix apps/desktop run lint`
  - `npm --prefix apps/desktop run build`

### Latest post-roadmap clarify pass for Electron shell

- A follow-up clarify-pass tightened user-facing copy after the visual polish work, with the goal of removing the last bits of internal implementation jargon from the desktop shell.
- This pass stayed intentionally narrow:
  - no layout changes
  - no interaction-model changes
  - only labels, empty states, helper text, palette metadata, and review copy
- Implemented changes:
  - renamed the main picker action from `Add project` to `Add folder` so the button matches the native folder-picker behavior
  - changed the `Workspace` mode label and `Spec workspace` heading to `Specs` and `Spec editor`
  - replaced internal copy such as `desktop bridge`, `spec workflow state`, and `workflow root` with user-facing language about specs, approvals, logs, and reconnecting Codex
  - shortened and clarified empty states for inbox, specs, approvals, and the MCP diagnostics panel
  - replaced `Remembered`-style user copy with clearer `Saved` terminology in the shell while leaving the internal `remembered` state model intact
  - clarified approval-review context from vague phrasing like `anchored on` to direct labels like `Current task` and `Next task`
  - simplified palette/project metadata from `Live MCP attached` / `Recovered from memory` to `Live in Codex` / `Saved locally`
  - removed the duplicate inbox-empty copy path so an empty queue now says one clear thing instead of two similar things
- Verification for this pass:
  - `npm --prefix apps/desktop run test`
  - `npm --prefix apps/desktop run lint`
  - `npm --prefix apps/desktop run build`

### Latest post-roadmap distill pass for Electron shell

- A distill-pass followed the copy clarification work to remove repeated chrome and flatten the shell into a more direct work surface.
- This pass focused on subtraction rather than new features:
  - no new workflow concepts
  - no new panels
  - less repeated state, less decorative surface treatment, and fewer secondary signals competing with active work
- Implemented changes:
  - removed the standalone header status pill and folded runtime status into a quiet helper line under the app title
  - merged the active project heading and mode navigation into a single workspace bar instead of two stacked shell rows
  - removed repeated live/saved badges from the active workspace head and left connection state to the project list plus MCP status panel
  - simplified inbox rows by removing duplicated status badges and trailing action labels from every item
  - simplified approval queue chips by replacing default `document` badges with plain metadata and only keeping a visual badge for `action` approvals
  - flattened several renderer surfaces visually by replacing gradient-heavy fills with quieter solid/tinted backgrounds
  - removed the decorative shell background field so the desktop app reads more like a focused editor than a styled dashboard
- Verification for this pass:
  - `npm --prefix apps/desktop run test`
  - `npm --prefix apps/desktop run lint`
  - `npm --prefix apps/desktop run build`

### Latest top-bar navigation pass for Electron shell

- A follow-up shell-layout pass moved project navigation out of the left rail and into the sticky top menu, matching the desktop-app mental model more closely.
- Implemented changes:
  - removed the visible app-title/status block from the renderer header because Electron window chrome already identifies the app
  - replaced the left-rail project list with a top-left projects dropdown in the same command row as `MCP`, `Search`, and `Add folder`
  - kept project switching and forgetting available inside that dropdown, so the old rail behavior still exists without occupying permanent screen width
  - made the top menu sticky so navigation stays visible while scrolling
  - removed the two-column shell layout and let the main workspace content expand across the full available width
- Verification for this pass:
  - `npm --prefix apps/desktop run test`
  - `npm --prefix apps/desktop run lint`
  - `npm --prefix apps/desktop run build`

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
- [x] Remove dead code after desktop replacement is proven.
- [x] Keep only the backend pieces that still serve reusable workflow logic.
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
- Simplified the legacy browser automation/settings surface:
  - removed the single-section accordion from `SettingsPage`
  - switched job toggles/run/delete updates to functional state updates instead of stale closure mutations
  - removed `JobTemplates.ts` and the browser-only template chooser from `JobFormModal`
  - replaced the bulky cron helper panel with one compact preset select plus an inline cron hint
- Flattened the browser automation utility further based on the latest Opus review:
  - removed the extra header card and illustrated empty state from `SettingsPage`
  - replaced heavy job cards plus full-width action bars with compact rows and inline actions
  - replaced the delete confirmation modal with inline confirmation
  - shrank `JobFormModal`, replaced radio-card job type selection with a simple select, and kept custom cron input behind a `Custom` preset
  - gutted `JobExecutionHistory` into a compact history-only table using shell tokens instead of a stats dashboard
  - removed the now-unused `/api/jobs/:jobId/stats` backend route and service path
- Added focused browser tests for `SettingsPage`, `JobFormModal`, `JobExecutionHistory`, and settings form-error handling so the simplified settings contract is now regression-covered instead of relying on manual inspection.
- Fixed the concrete regressions found by the subsequent `gpt-5.3-codex` review:
  - manual `Run Now` now persists execution history and `lastRun`
  - browser settings now handles `success: false` manual-run payloads without falsely clearing errors
  - failed job creation/update now keeps the modal open and exposes inline submit errors
- Fixed the two additional issues found by the follow-up re-review:
  - browser settings now validates `/api/jobs` failures before mapping the payload
  - invalid Quartz-style weekly/bi-weekly presets are gone from the browser form
- Added backend unit coverage for manual job persistence and extended the removed-routes regression test so `/api/jobs/:jobId/stats` stays gone.
- Removed the legacy browser automation/settings surface completely after deciding it had no real workflow value:
  - deleted `/settings` from the browser route tree and sidebar navigation
  - deleted `SettingsPage`, `JobFormModal`, `JobExecutionHistory`, and their browser-only tests
  - removed `/api/jobs*` endpoints from the dashboard backend
  - deleted `job-scheduler.ts`, `settings-manager.ts`, and `execution-history-manager.ts`
  - removed the now-dead automation/history types from shared/browser type files
  - expanded the removed-routes test so the full `/api/jobs*` surface stays gone
- Collapsed the remaining browser shell to workflow-only navigation:
  - flattened the sidebar to `Specs`, `Approvals`, and `Tasks` only
  - removed `Logs` from first-class navigation while keeping `/logs` as a deep-link/debug route
  - removed `SteeringPage` from the browser route tree entirely
  - removed browser steering fetch/save actions and the matching `/api/projects/:projectId/steering/:name` endpoints
  - extended removed-routes coverage so deleted steering routes stay unavailable
- Ran scoped `gpt-5.3-codex` reviews after both the hardening pass and the follow-up delete-pass; neither found concrete regressions, and the earlier residual `TasksPage` testing gap is now closed by focused list-flow coverage.
- Ran one last `gpt-5.3-codex` follow-up review after the workflow-only browser-shell cleanup; it found no concrete regressions, so Milestone 14 closes with browser navigation reduced to `Specs`, `Approvals`, and `Tasks`, while `Logs` remains deep-link/debug only.

Exit criteria:
- The desktop app is the default documented interface.
- Legacy dashboard is either removed or explicitly marked secondary/legacy.

## Post-roadmap Refinements

### Approval Review Rewrite

Goal: Rework desktop approvals around rendered markdown review, visible comment authoring, and a simpler decision model.

- [x] Replace the old approval response textarea with a dedicated review surface and comment sidebar.
- [x] Support selection-based comments directly on rendered markdown with a visible floating `Add comment` affordance.
- [x] Keep a visible list of saved comments and allow general comments without a text selection.
- [x] Simplify approval actions to `Approve` plus a comment-gated `Reject` flow.
- [x] Add markdown code-block highlighting and focused desktop tests for rendered review and reject gating.

Implemented:
- Added a dedicated desktop approval review surface in `apps/desktop/src/renderer/approvals/ApprovalReviewPanel.tsx` with:
  - rendered markdown review for `.md` / `.mdx`
  - general comments
  - selection comments
  - visible saved-comment list
  - simplified `Approve` / `Reject` footer
- Added `MarkdownReviewSurface.tsx` with `markdown-it` and `highlight.js`, plus inline highlight anchors so comment targets stay visible inside rendered markdown and code-friendly content.
- Wired comment persistence through the desktop shell and shared approval types so comment payloads round-trip through preload/main/core approval review services instead of living only in renderer state.
- Removed the old desktop approval response textarea flow and its global approval shortcuts from `App.tsx`; approval shortcuts are now scoped to the approval panel itself.
- Kept the negative approval path aligned with the new UI contract by wiring the visible `Reject` action to a real `reject` status while still requiring at least one saved comment before it can fire.
- Normalized pre-existing approval comments without ids inside the desktop panel so older selection comments still render as inline highlights in markdown review mode.
- Hardened keyboard behavior so `Esc` no longer throws the reviewer back to Inbox while they are typing an unsaved approval comment draft.
- Added focused renderer coverage for:
  - markdown rendering and code-block highlighting
  - floating selection-comment affordance
  - reject gating until at least one comment exists
  - approval submission payloads including saved comments and auto-advance behavior
  - preserving comment drafts on `Esc`
  - rendering legacy selection comments that did not already carry ids
- Ran a scoped `gpt-5.3-codex` review on the approval rewrite and closed all concrete findings in the same pass instead of carrying them forward:
  - restored a true `reject` desktop action
  - fixed draft-loss on `Esc`
  - fixed highlight/interactivity for older comments without ids
- Restored worktree context in the desktop shell after the dropdown simplification regressed it:
  - active project header once again shows the current git branch and latest created spec
  - project dropdown rows now expose branch plus latest spec so multiple worktrees of the same repo remain distinguishable without reopening the legacy sidebar model

### Desktop Shell Hardening

Goal: Tighten real-time desktop shell behavior after the latest UI cleanup pass.

Implemented:
- Replaced the bulky MCP button/panel with a compact status indicator in the desktop header and moved search to the right-side utility group while keeping project selection and add-folder on the left.
- Shifted the desktop palette toward a Darcula-style color system and tightened project-trigger alignment so the top menu reads more like an editor/workbench than a dashboard.
- Fixed stale latest-spec ordering by preferring spec `lastModified` recency in `src/core/project-catalog.ts` and added catalog coverage for modified-spec precedence plus `createdAt` fallback behavior.
- Added a guarded desktop refresh loop in `apps/desktop/src/main/services/desktop-shell.ts` so periodic catalog refreshes no longer bubble transient failures into IPC consumers or unhandled timer rejections.
- Tightened remembered-project syncing so live MCP projects refresh their remembered metadata when stale without rewriting the remembered store on every polling cycle.
- Removed the renderer-side forced workspace reload nonce and now reload workspace state only when the active project's actual summary changes, avoiding churn from unrelated project updates.
- Added focused coverage for:
  - desktop shell refresh loop lifecycle and error swallowing
  - renderer behavior when another project's shell summary changes
  - remembered-project metadata refresh for stale live entries
- Closed the last two residual review gaps immediately after the follow-up review:
  - added a direct desktop-shell test for the `isRefreshingProjects` early-return path
  - added a catalog test that locks in reduced remembered-store writes while live metadata is still fresh
- Ran another scoped `gpt-5.3-codex` review on the hardening diff and closed all concrete findings:
  - refresh snapshot failures are swallowed and logged instead of rejecting IPC/timer paths
  - active workspace reloads no longer fire for unrelated shell-state pushes
  - remembered live-project metadata updates again without regressing into constant store rewrites

### Accessibility Hardening

Goal: Fix the highest-value renderer resilience gaps from the Electron audit without changing product direction.

Implemented:
- Hardened command palette semantics in `apps/desktop/src/renderer/CommandPalette.tsx`:
  - real dialog labeling
  - combobox-to-listbox wiring via `aria-controls` / `aria-activedescendant`
  - focus restoration on close
  - tab-loop containment inside the modal surface
- Hardened the top-left project picker in `apps/desktop/src/renderer/App.tsx`:
  - real popup dialog semantics with explicit labeling
  - trigger-to-popup control relationship
  - initial focus on the selected project action
  - keyboard opening with `ArrowDown` / `Enter` / `Space`
  - focus return to the trigger on keyboard close
- Hardened approval markdown review in `apps/desktop/src/renderer/approvals/MarkdownReviewSurface.tsx`:
  - focusable review surface with `role="document"`
  - selection detection now reacts to `selectionchange`, not only mouse-up
  - persistent `Comment selection` toolbar action so text-anchored comments are not mouse-only
- Hardened shell CSS in `apps/desktop/src/renderer/styles.css`:
  - raised muted/secondary text contrast to pass normal text AA in the main dark surfaces
  - added reusable `.sr-only`
  - added missing focus-visible treatment for `summary`, approval comment anchors, and the rendered review surface
  - increased utility control hit areas
  - added overflow wrapping for long metadata/error/comment content
  - removed one dead legacy responsive selector and reduced some theme drift by moving more surfaces back onto theme tokens
- Added focused regression coverage for:
  - command palette accessibility wiring through the app shell
  - project picker dialog semantics
  - focusable markdown review with toolbar-based selection comments
- Ran a scoped `gpt-5.3-codex` review on the hardening diff; it found no concrete bugs or regressions, only three missing focused tests, and those gaps were closed immediately:
  - command palette focus trap / focus restore
  - project picker keyboard open-close focus contract
  - markdown review keyboard-selection affordance

### Darcula Semantic Color Pass

Goal: Keep the Darcula-style neutral shell, but restore clearer semantic differentiation between specs, approvals, and implementation without adding more chrome.

Implemented:
- Added semantic renderer tokens in `apps/desktop/src/renderer/styles.css` for:
  - spec/info blue
  - design/document violet
  - approval/action amber
  - implementation/success green
- Applied those tokens to the existing shell instead of inventing new UI structure:
  - work-mode tabs now keep a cooler blue for `Specs` and a warmer amber for `Inbox` / `Approvals`
  - inbox callout and queue rows now tint by item meaning rather than sharing one generic accent
  - spec/document badges, selected spec tabs, approval queue pills, and approval comment highlights now use phase-aware tones
  - command palette rows now inherit category-aware accents through data attributes instead of one flat active state
- Reduced theme drift by moving a few remaining review/editor surfaces back onto renderer tokens:
  - project trigger open state
  - editor focus state
  - markdown inline-code and code-block surfaces
  - blockquote accent borders
- Followed up with a contrast correction pass after the first Darcula attempt still looked too muddy against the desired IDE-like reference:
  - shifted the base theme from brownish Darcula toward a cooler graphite/slate dark palette
  - raised primary, secondary, and muted text significantly
  - made panels, controls, editor surfaces, and palette layers more solid and less translucent
  - strengthened borders so cards, controls, and inputs separate cleanly from the app background

### Workbench Simplification Pass

Goal: Apply a coordinated `colorize -> distill -> quieter -> bolder -> clarify` pass to the Electron shell instead of making isolated cosmetic tweaks.

Implemented:
- Quieted the desktop chrome in `apps/desktop/src/renderer/App.tsx` and `apps/desktop/src/renderer/styles.css`:
  - search and add-folder controls now read as utility actions instead of primary boxed buttons
  - MCP status remains visible but no longer competes with the workspace
- Distilled the main work surfaces:
  - top-level inbox, specs, and approvals articles now render as flatter workspace sections instead of another layer of panels
  - inbox queue items were flattened from card rows into lighter list rows so the `Next` callout becomes the single primary focal point
  - document shell and implementation history were flattened so the editor surface does more of the visual work
  - approval comments rail is now a lighter sticky aside instead of another large boxed panel
- Added bolder hierarchy where it actually matters:
  - stronger project title in the workspace head
  - larger `Next` callout title
  - larger selected approval title inside the review surface
  - work-mode headings became quieter labels so active content dominates instead of section chrome
- Clarified user-facing copy:
  - shorter loading / empty-state messages
  - clearer approval helper text and comment labels
  - shorter editor help text
  - clearer command-palette action metadata

### Inbox Recency Fix

Goal: Make the desktop inbox `Next` action track the latest approval request instead of getting stuck on the oldest pending item.

Implemented:
- flipped `ProjectWorkspaceService` approval queue ordering to newest-first in `src/core/project-workspace.ts`
- added explicit timestamp-controlled coverage in `src/core/__tests__/project-workspace.test.ts`
- locked the desktop behavior to the latest MCP approval request because the inbox callout is derived from `pendingApprovals[0]`

### Specs Viewer and Kanban Pass

Goal: Rework the desktop `Specs` mode for review-oriented reading instead of inline editing.

Implemented:
- removed inline document editing from the desktop specs surface and replaced it with a read-only markdown viewer with code-block highlighting
- renamed the old tasks document tab to `Tasks (Markdown)`
- added a separate `Tasks (Kanban)` tab driven by canonical task data from `ProjectWorkspaceService`
- enriched workspace snapshots with parsed task metadata so kanban cards can expose prompt, purpose, requirements, files, and implementation details without reparsing markdown in the renderer
- made kanban columns independently scrollable and preserved column scroll positions across live board updates
- removed duplicate per-tab headings and helper copy from the specs body so the active tab itself is the only title source
- strengthened the active document tab indicator and flattened the kanban layout from boxed lanes to columns separated by vertical rules

### Noise Reduction Distill Pass

Goal: Remove any desktop copy and metadata that does not directly help spec review, task reading, or approval actions.

Implemented:
- removed duplicate project context from the workspace body because the active project dropdown already carries branch and latest-spec context
- removed inbox header counters and reduced inbox row footer metadata to timestamps only
- removed redundant spec-view meta such as the right-side phase badge and task/approval summary line
- removed kanban lane count badges and kept the board focused on tasks themselves instead of counts about tasks
- shortened approval titles derived from `Approve <phase> for <spec>` into compact `Phase · Spec` labels
- removed duplicate spec-name metadata from document approval tabs so the queue only shows the compact title once
- removed the fixed `Comment selection` action from approval review and kept only the floating selection affordance
- moved the `Select text, then add a comment.` helper under `Review decision`, where it supports the actual action instead of competing with the review surface
- removed diff summary noise such as `+99 / -0` from the approvals header

### Approval Sidebar Compaction Pass

Goal: Move approval actions into the comments column and remove the redundant bottom decision strip.

Implemented:
- removed the bottom `Review decision` bar from the main approval surface
- moved approval actions into the right comments sidebar and kept them visible beneath the scrolling comments list
- changed the empty-comments state to show `No review comments yet.` plus the selection hint inline in the sidebar
- changed approval actions to this UX contract:
  - no comments: `Approve` and `Reject`
  - one or more comments: only `Request revisions`, which submits a reject with the saved comments
- aligned keyboard behavior so approve is no longer available once comments exist

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
- [x] Complete Milestone 14.

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
