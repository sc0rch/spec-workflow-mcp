# Spec Workflow Skill

Use this repository through the `spec-workflow` CLI.

## Rules

- Prefer `spec-workflow ... --json` for any machine-consumed result
- Pass `--project-path <path>` when the target project is not the current working directory
- Do not assume MCP, browser dashboard, or VS Code extension flows exist
- Treat the CLI as the public contract and `.spec-workflow/` as on-disk state

## Workflow

1. Read the guide:

```bash
spec-workflow guide --json
```

2. Check a spec:

```bash
spec-workflow spec-status --spec-name "<spec-name>" --project-path "<project-path>" --json
```

3. Request approval for a document:

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

4. Inspect approval content and diff:

```bash
spec-workflow approvals inspect --approval-id "<approval-id>" --project-path "<project-path>" --json
```

5. Respond to an approval:

```bash
spec-workflow approvals respond \
  --approval-id "<approval-id>" \
  --action approve \
  --response "Approved." \
  --project-path "<project-path>" \
  --json
```

For annotated feedback, provide `--comments-file <json-file>` with an array of approval comments.

6. Delete completed approval records:

```bash
spec-workflow approvals delete --approval-id "<approval-id>" --project-path "<project-path>" --json
```

7. Log implementation after a task is implemented:

```bash
spec-workflow log-implementation --input "<json-file>" --project-path "<project-path>" --json
```

## JSON Contracts

- `guide` and `steering-guide` return guide markdown under `data.guide`
- all commands return `success`, `message`, optional `data`, optional `nextSteps`, and optional `projectContext`
- prefer `projectContext.projectPath` and `projectContext.workflowRoot` instead of inferring paths yourself
