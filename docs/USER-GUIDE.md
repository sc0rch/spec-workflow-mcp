# User Guide

Spec Workflow is used through the CLI and the Electron app.

## CLI

Use the CLI when you need structured JSON output for an agent, script, or terminal workflow.

Examples:

```bash
spec-workflow guide --json
spec-workflow spec-status --spec-name "<spec-name>" --project-path "<project-path>" --json
spec-workflow approvals inspect --approval-id "<approval-id>" --project-path "<project-path>" --json
```

Stateful commands bind to the current directory unless `--project-path` is supplied.

## Electron App

Use the Electron app when you want a local visual workflow for:

- remembered projects
- spec browsing
- approval review and response
- implementation log browsing

Run it from the repo root:

```bash
npm run desktop:dev
```

## On-Disk Layout

```text
.spec-workflow/
  steering/
  specs/
    <spec-name>/
      requirements.md
      design.md
      tasks.md
      Implementation Logs/
  approvals/
```

## Approval Flow

1. Request approval for a document with `spec-workflow approvals request`
2. Inspect the pending approval with `spec-workflow approvals inspect`
3. Respond with `spec-workflow approvals respond`
4. Delete completed approval records with `spec-workflow approvals delete`

## Implementation Logging

After implementing a task, write one JSON payload and submit it through:

```bash
spec-workflow log-implementation --input ./implementation-log.json --project-path "<project-path>" --json
```

Only after the log is recorded should the task be marked complete in `tasks.md`.
