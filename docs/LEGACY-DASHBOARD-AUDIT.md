# Legacy Dashboard Audit

Last updated: 2026-03-14
Status: Active during Milestone 14

## Position

The browser dashboard is now a legacy and secondary interface.

- Preferred interface: Electron desktop shell in `apps/desktop/`
- Secondary interface: VS Code extension
- Legacy interface: browser dashboard in `src/dashboard_frontend/` and `src/dashboard/`

The dashboard remains useful for:
- browser-only access
- compatibility with older workflows
- backend and websocket debugging

It should no longer be the design center for new UX work.

## Current Route Inventory

Frontend routes are still defined in [src/dashboard_frontend/src/modules/app/App.tsx](/Users/sc0rch/Documents/Develop/spec-workflow-mcp/src/dashboard_frontend/src/modules/app/App.tsx):

- `/`
  - redirects to `/specs`
  - no longer owns a dedicated landing page
- `/steering`
  - `SteeringPage`
- `/specs`
  - `SpecsPage`
- `/specs/view`
  - `SpecViewerPage`
- `/tasks`
  - `TasksPage`
  - list-based task flow only; the old Kanban view is retired
- `/logs`
  - `LogsPage`
- `/approvals`
  - `ApprovalsPage`
- `/settings`
  - `SettingsPage`

Navigation still lives in [src/dashboard_frontend/src/modules/components/PageNavigationSidebar.tsx](/Users/sc0rch/Documents/Develop/spec-workflow-mcp/src/dashboard_frontend/src/modules/components/PageNavigationSidebar.tsx).
The shell no longer has a dedicated landing page, mobile settings drawer, changelog modal, collapsible desktop sidebar, notification-volume controls, a Kanban task board, or browser changelog endpoints.
Theme and language controls now live in the sidebar footer instead of the header/drawer so they remain reachable on mobile without reintroducing extra shell chrome.
This legacy shell now also has its own explicit browser-only typecheck/test guardrails instead of relying on the root Node-only TypeScript build.

## Keep vs Retire

Keep for now:
- dashboard backend API in `src/dashboard/multi-server.ts`
- project recovery and registry sync
- approvals/log/spec APIs still used by browser workflows and backend tests
- websocket update path
- browser project add/remove flow

Do not invest heavily in:
- landing/statistics polish
- browser-specific workflow redesign
- new dashboard-only navigation concepts
- visual redesign work that duplicates Electron effort

Retire or simplify later:
- page-heavy sidebar-first IA as the primary documented workflow
- browser-only explanatory chrome that duplicates desktop affordances
- incidental product-marketing/admin chrome inside the browser shell header or empty states
- mobile-only interaction patterns that are disproportionate for a compatibility/debugging surface
- browser-only interaction polish such as sound controls when the browser surface is no longer the primary daily UI

## Canonical Reusable Logic

These areas remain canonical and should stay reusable even if more dashboard UI is removed later:

- [src/core/project-binding.ts](/Users/sc0rch/Documents/Develop/spec-workflow-mcp/src/core/project-binding.ts)
- [src/core/project-catalog.ts](/Users/sc0rch/Documents/Develop/spec-workflow-mcp/src/core/project-catalog.ts)
- [src/core/project-workspace.ts](/Users/sc0rch/Documents/Develop/spec-workflow-mcp/src/core/project-workspace.ts)
- [src/core/spec-documents.ts](/Users/sc0rch/Documents/Develop/spec-workflow-mcp/src/core/spec-documents.ts)
- [src/core/approval-review.ts](/Users/sc0rch/Documents/Develop/spec-workflow-mcp/src/core/approval-review.ts)
- [src/core/approval-storage.ts](/Users/sc0rch/Documents/Develop/spec-workflow-mcp/src/core/approval-storage.ts)
- [src/core/implementation-log-manager.ts](/Users/sc0rch/Documents/Develop/spec-workflow-mcp/src/core/implementation-log-manager.ts)

## Next Removal Candidates

When Milestone 14 moves from audit to deletion, start here:

1. Keep trimming unused dashboard-only UI modules that no longer provide unique value over Electron.
2. Continue removing browser-only debug noise and incidental admin-panel behavior from still-kept pages.
3. Re-evaluate older browser-only automation/settings flows that still assume the dashboard is a primary product shell.
4. Add or expand focused tests for high-churn legacy pages like `TasksPage` when cleanup changes their behavior materially.
5. Keep backend and shared domain services, but stop treating browser dashboard screenshots and flows as the primary onboarding path.
