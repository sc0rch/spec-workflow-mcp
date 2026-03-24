# Prompting Guide

Use prompts that map cleanly to the CLI-first workflow.

## Good Requests

```text
Show the status of demo-spec in ~/code/my-project
Inspect approval approval-123 for ~/code/my-project
Log implementation for task 2.1 in demo-spec
```

Those requests map directly to:

```bash
spec-workflow spec-status --spec-name demo-spec --project-path ~/code/my-project --json
spec-workflow approvals inspect --approval-id approval-123 --project-path ~/code/my-project --json
spec-workflow log-implementation --input ./implementation-log.json --project-path ~/code/my-project --json
```

## Prompting Rules

- name the spec explicitly
- give the project path when the current directory is ambiguous
- ask for one concrete phase at a time
- keep approval feedback specific and actionable

## Approval Feedback

Good:

```text
Request revisions:
- clarify rollback behavior
- add failure handling for the background worker
- document the migration order
```

Weak:

```text
This feels wrong. Please improve it.
```

## Implementation Logging Payloads

The CLI expects one JSON payload file with:

- `specName`
- `taskId`
- `summary`
- `filesModified`
- `filesCreated`
- `statistics`
- `artifacts`

Keep the summary factual and keep artifacts structured so later agents can search them.
