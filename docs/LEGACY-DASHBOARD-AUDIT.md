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
  - `DashboardStatistics`
  - legacy summary landing page
- `/steering`
  - `SteeringPage`
- `/specs`
  - `SpecsPage`
- `/specs/view`
  - `SpecViewerPage`
- `/tasks`
  - `TasksPage`
- `/logs`
  - `LogsPage`
- `/approvals`
  - `ApprovalsPage`
- `/settings`
  - `SettingsPage`

Navigation still lives in [src/dashboard_frontend/src/modules/components/PageNavigationSidebar.tsx](/Users/sc0rch/Documents/Develop/spec-workflow-mcp/src/dashboard_frontend/src/modules/components/PageNavigationSidebar.tsx).

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

1. Trim unused dashboard-only UI modules that no longer provide unique value over Electron.
2. Keep backend and shared domain services, but stop treating browser dashboard screenshots and flows as the primary onboarding path.
3. Continue shrinking browser-only navigation so it reflects compatibility/debugging use, not a primary product IA.
