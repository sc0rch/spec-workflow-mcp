# Spec Development Workflow

Use this workflow when creating or advancing a spec-driven feature.

## Core rules

- Work directly in `.spec-workflow/`
- Follow the sequence: Requirements -> Design -> Tasks -> Implementation
- Use kebab-case spec names
- Request approval after each spec document phase
- Do not move to the next phase until approval is no longer pending and cleanup is done
- Log implementation before marking a task complete

## Requirements

1. Read optional steering docs in `.spec-workflow/steering/`
2. Read `.spec-workflow/templates/requirements-template.md`
3. Create `.spec-workflow/specs/<spec-name>/requirements.md`
4. Run:

```bash
spec-workflow approvals request \
  --title "Review requirements for <spec-name>" \
  --file-path ".spec-workflow/specs/<spec-name>/requirements.md" \
  --type document \
  --category spec \
  --category-name "<spec-name>" \
  --json
```

5. Inspect and respond to the approval, then delete it after approval is complete

## Design

1. Read `.spec-workflow/templates/design-template.md`
2. Create `.spec-workflow/specs/<spec-name>/design.md`
3. Request approval with the same pattern as requirements

## Tasks

1. Read `.spec-workflow/templates/tasks-template.md`
2. Create `.spec-workflow/specs/<spec-name>/tasks.md`
3. Keep tasks atomic and generate `_Prompt` sections for implementers
4. Request approval with the same pattern as requirements

## Implementation

1. Check status:

```bash
spec-workflow spec-status --spec-name "<spec-name>" --json
```

2. Read `.spec-workflow/specs/<spec-name>/tasks.md`
3. Mark one task as in-progress
4. Search `.spec-workflow/specs/<spec-name>/Implementation Logs/` before writing code
5. Implement the task
6. Log implementation:

```bash
spec-workflow log-implementation --input ./implementation-log.json --json
```

7. Only after the log succeeds, mark the task complete

## Approval review flow

Inspect:

```bash
spec-workflow approvals inspect --approval-id "<approval-id>" --json
```

Respond:

```bash
spec-workflow approvals respond \
  --approval-id "<approval-id>" \
  --action approve \
  --response "Approved" \
  --json
```

Delete:

```bash
spec-workflow approvals delete --approval-id "<approval-id>" --json
```
