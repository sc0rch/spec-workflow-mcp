# Spec Workflow MCP

Spec Workflow MCP is a local-first toolchain for spec-driven development.

This repository currently contains four main parts:

- `src/`: the MCP server
- `apps/desktop/`: the Electron desktop app
- `src/dashboard_frontend/` + `src/dashboard/`: the legacy browser dashboard
- `vscode-extension/`: the VS Code extension

The desktop app is the primary local UI.
The browser dashboard is still available, but it is now a secondary compatibility/debug surface.

## What To Run

If you only want to know how to launch the app from this repository:

```bash
npm install
npm run desktop:install
npm run desktop:dev
```

Run those commands from the repository root.

That starts the Electron desktop app in development mode.

## Prerequisites

- Node.js 22+
- npm
- macOS, Linux, or Windows with Electron support

## Quick Start

### 1. Install dependencies

Root dependencies:

```bash
npm install
```

Desktop app dependencies:

```bash
npm run desktop:install
```

### 2. Launch the desktop app

Development mode:

```bash
npm run desktop:dev
```

What this does:

- compiles the Electron `main` and `preload` processes in watch mode
- starts the renderer with Vite on `127.0.0.1:5174`
- launches the Electron window automatically

### 3. Build the desktop app

```bash
npm run desktop:build
```

### 4. Create a packaged desktop build

```bash
npm run desktop:package
```

The packaged output is written under [apps/desktop/release](/Users/sc0rch/Documents/Develop/spec-workflow-mcp/apps/desktop/release).

## Run Modes

### Desktop app

Preferred local UI for:

- remembered projects
- approvals
- spec editing
- MCP visibility
- optional Codex bridge

Commands:

```bash
npm run desktop:dev
npm run desktop:build
npm run desktop:package
```

### MCP server

Build first:

```bash
npm run build
```

Run in project-agnostic mode:

```bash
npm start
```

Run with a fixed startup project binding:

```bash
npm start -- ~/projects/my-app
```

You can also run the TypeScript entry directly during development:

```bash
npm run dev
```

### Legacy browser dashboard

The browser dashboard is no longer the main UI, but it still exists.

Run it directly from TypeScript:

```bash
npm run dev -- --dashboard
```

Or from the built output:

```bash
npm run build
npm start -- --dashboard
```

By default it listens on `http://localhost:5091`.

## How The Pieces Fit Together

Current default lifecycle:

- Codex launches the MCP server over stdio
- the desktop app observes and complements that state
- the browser dashboard is optional and legacy

So if you open the desktop app by itself, it works as a local shell, but you will only see live MCP sessions after your MCP client is configured and running.

## Codex Setup

There are two practical ways to use this repository with Codex.

### Option A: Codex launches the MCP server directly

This is the simplest setup.

1. Build the server:

```bash
npm run build
```

2. Point Codex at the built server:

```toml
[mcp_servers.spec-workflow]
command = "node"
args = ["/Users/sc0rch/Documents/Develop/spec-workflow-mcp/dist/index.js"]
```

If you want workspace-local `.spec-workflow` state inside git worktrees:

```toml
[mcp_servers.spec-workflow]
command = "node"
args = ["/Users/sc0rch/Documents/Develop/spec-workflow-mcp/dist/index.js", "--no-shared-worktree-specs"]
```

### Option B: Codex launches the desktop bridge

Use this if you want Electron to own the effective MCP lifecycle behind a stdio bridge.

1. Build the desktop app:

```bash
npm run desktop:build
```

2. Point Codex at the bridge executable:

```toml
[mcp_servers.spec-workflow]
command = "node"
args = ["/Users/sc0rch/Documents/Develop/spec-workflow-mcp/apps/desktop/dist/apps/desktop/src/bridge/index.js"]
```

The bridge will:

- start the desktop app hidden if needed
- connect to the Electron-managed local MCP socket
- proxy stdio traffic from Codex

## Most Useful Commands

From the repository root:

```bash
npm install
npm run build
npm run test
npm run test:dashboard-frontend
npm run desktop:install
npm run desktop:dev
npm run desktop:build
npm run desktop:test
npm run desktop:test:e2e
```

## Repository Map

- [src/index.ts](/Users/sc0rch/Documents/Develop/spec-workflow-mcp/src/index.ts): CLI entrypoint
- [src/server.ts](/Users/sc0rch/Documents/Develop/spec-workflow-mcp/src/server.ts): MCP server wiring
- [src/core/project-binding.ts](/Users/sc0rch/Documents/Develop/spec-workflow-mcp/src/core/project-binding.ts): canonical project binding
- [apps/desktop/src/main/index.ts](/Users/sc0rch/Documents/Develop/spec-workflow-mcp/apps/desktop/src/main/index.ts): Electron app entry
- [apps/desktop/src/bridge/index.ts](/Users/sc0rch/Documents/Develop/spec-workflow-mcp/apps/desktop/src/bridge/index.ts): Codex bridge entry
- [docs/electron-desktop-rewrite.md](/Users/sc0rch/Documents/Develop/spec-workflow-mcp/docs/electron-desktop-rewrite.md): rewrite roadmap
- [docs/LEGACY-DASHBOARD-AUDIT.md](/Users/sc0rch/Documents/Develop/spec-workflow-mcp/docs/LEGACY-DASHBOARD-AUDIT.md): browser-surface cleanup map

## Additional Docs

- [docs/CONFIGURATION.md](/Users/sc0rch/Documents/Develop/spec-workflow-mcp/docs/CONFIGURATION.md)
- [docs/USER-GUIDE.md](/Users/sc0rch/Documents/Develop/spec-workflow-mcp/docs/USER-GUIDE.md)
- [docs/WORKFLOW.md](/Users/sc0rch/Documents/Develop/spec-workflow-mcp/docs/WORKFLOW.md)
- [docs/PROMPTING-GUIDE.md](/Users/sc0rch/Documents/Develop/spec-workflow-mcp/docs/PROMPTING-GUIDE.md)
- [docs/TOOLS-REFERENCE.md](/Users/sc0rch/Documents/Develop/spec-workflow-mcp/docs/TOOLS-REFERENCE.md)
- [docs/TROUBLESHOOTING.md](/Users/sc0rch/Documents/Develop/spec-workflow-mcp/docs/TROUBLESHOOTING.md)
- [docs/DEVELOPMENT.md](/Users/sc0rch/Documents/Develop/spec-workflow-mcp/docs/DEVELOPMENT.md)

## Status

- Desktop app: primary interface
- MCP server: active and supported
- Codex bridge: available
- Browser dashboard: legacy
- VS Code extension: available
