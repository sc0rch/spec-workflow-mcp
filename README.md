# Spec Workflow

Spec Workflow is a local-first spec-driven workflow toolkit with two canonical surfaces:

- `spec-workflow`: a CLI for agents, automation, and terminal usage
- `apps/desktop/`: an Electron app for browsing projects, reviewing approvals, reading specs, and inspecting implementation logs

There is no MCP server, browser dashboard, or VS Code extension in the active product surface anymore.

## Requirements

- Node.js 22+
- npm
- macOS, Linux, or Windows for the Electron app

## Install

From the repository root:

```bash
npm install
npm run desktop:install
```

## Build

CLI:

```bash
npm run build
```

Electron app:

```bash
npm run desktop:build
```

## Run

CLI examples:

```bash
npm run dev -- guide
npm run dev -- spec-status --spec-name my-spec --project-path ~/code/my-project --json
npm run dev -- approvals inspect --approval-id approval-123 --project-path ~/code/my-project --json
```

Electron app in development:

```bash
npm run desktop:dev
```

Packaged desktop build:

```bash
npm run desktop:package
```

## CLI Surface

The public CLI contract is:

```bash
spec-workflow guide [--json]
spec-workflow steering-guide [--json]
spec-workflow spec-status --spec-name <name> [--project-path <path>] [--json]
spec-workflow approvals request ...
spec-workflow approvals status --approval-id <id> ...
spec-workflow approvals inspect --approval-id <id> ...
spec-workflow approvals respond --approval-id <id> --action <approve|reject|needs-revision> --response <text> ...
spec-workflow approvals delete --approval-id <id> ...
spec-workflow log-implementation --input <json-file> [--project-path <path>] [--json]
```

Stateful commands bind to:

1. `--project-path`, if provided
2. the current working directory otherwise

Shared worktree specs remain enabled by default. Use `--no-shared-worktree-specs` to keep `.spec-workflow` inside the current worktree instead of the shared git root.

## Electron App

The Electron app is the primary human-facing interface. It keeps a local remembered-project list and reads project data directly from the repository and `.spec-workflow/`.

Current desktop workflows:

- add and remove remembered projects
- inspect project/spec overview
- read requirements, design, and tasks
- review approvals and respond
- browse implementation logs

## Skills

The repo ships with a canonical agent instruction file at [SKILL.md](/Users/sc0rch/Documents/Develop/spec-workflow-mcp/SKILL.md).

That file is intentionally CLI-first:

- agents should call `spec-workflow ... --json`
- business logic stays in the CLI and shared core
- the skill only describes how to use the CLI correctly

## Verification

From the repository root:

```bash
npm run build
npm test
npm run desktop:test
npm run desktop:build
```

## Repository Map

- [src/index.ts](/Users/sc0rch/Documents/Develop/spec-workflow-mcp/src/index.ts): CLI entrypoint
- [src/cli/commands.ts](/Users/sc0rch/Documents/Develop/spec-workflow-mcp/src/cli/commands.ts): CLI command handlers
- [src/core/project-binding.ts](/Users/sc0rch/Documents/Develop/spec-workflow-mcp/src/core/project-binding.ts): canonical CLI project binding
- [apps/desktop/src/main/index.ts](/Users/sc0rch/Documents/Develop/spec-workflow-mcp/apps/desktop/src/main/index.ts): Electron app entrypoint
- [apps/desktop/src/main/services/desktop-shell.ts](/Users/sc0rch/Documents/Develop/spec-workflow-mcp/apps/desktop/src/main/services/desktop-shell.ts): desktop IPC and shell state
- [apps/desktop/src/main/services/project-service.ts](/Users/sc0rch/Documents/Develop/spec-workflow-mcp/apps/desktop/src/main/services/project-service.ts): desktop-local project summaries
