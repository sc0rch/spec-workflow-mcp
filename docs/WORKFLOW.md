# Workflow

Spec Workflow follows one sequence:

```text
Steering -> Requirements -> Design -> Tasks -> Implementation
```

Everything lives in `.spec-workflow/`.

## Phase Order

1. Create or update steering docs in `.spec-workflow/steering/` when the project needs stable product, technical, or structure guidance.
2. Create `requirements.md` for a spec and request approval.
3. Create `design.md` after requirements approval and request approval.
4. Create `tasks.md` after design approval and request approval.
5. Implement tasks one at a time.
6. Log implementation before marking a task complete.

## CLI Commands

Read the canonical workflow guide:

```bash
spec-workflow guide --json
```

Check a spec:

```bash
spec-workflow spec-status --spec-name "<spec-name>" --project-path "<project-path>" --json
```

Request approval:

```bash
spec-workflow approvals request \
  --title "Review requirements for <spec-name>" \
  --file-path ".spec-workflow/specs/<spec-name>/requirements.md" \
  --type document \
  --category spec \
  --category-name "<spec-name>" \
  --project-path "<project-path>" \
  --json
```

Inspect and respond:

```bash
spec-workflow approvals inspect --approval-id "<approval-id>" --project-path "<project-path>" --json
spec-workflow approvals respond --approval-id "<approval-id>" --action approve --response "Approved." --project-path "<project-path>" --json
```

Delete completed approval records:

```bash
spec-workflow approvals delete --approval-id "<approval-id>" --project-path "<project-path>" --json
```

Log implementation:

```bash
spec-workflow log-implementation --input ./implementation-log.json --project-path "<project-path>" --json
```
