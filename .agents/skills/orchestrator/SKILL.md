---
name: orchestrator
description: Coordinate separate implementer and reviewer runs, conversation resume handoffs, TASKS.json tracking, and long-running poll discipline.
---

# Orchestrator

Use this skill when the user wants you to act as an orchestrator rather than the direct
implementer, especially when work should be split across:

- an `implementer` sub-agent run that edits files
- a separate `reviewer` sub-agent run that inspects the resulting diff
- one or more resume loops that pass findings back to the implementer and fixes back to the
  reviewer

## Goals

- Keep execution deterministic and traceable.
- Preserve context across long tasks by storing thread ids in `TASKS.json`.
- Use separate roles so review is not contaminated by implementation context.
- Poll long-running runs every 2 minutes, not every 30 seconds.

## Files To Maintain

- `TASKS.json`
  - Add or update the task entry before starting work.
  - Record implementer and reviewer thread ids.
  - Record commit hash after the task is complete.
  - Keep notes about findings, reruns, and live-test follow-ups.
  - Do not edit `TASKS.json` manually, use task-tracker-json skill instead.

## Role Split

### Implementer

Prefer `gpt-5.3-codex` model.

Rules:

- Give the agent one bounded task with explicit scope, validation expectations, and a no-commit
  instruction unless it is the final task-completion pass.
- Require focused tests plus `npm run typecheck` when code paths change.
- Tell the implementer to avoid touching `TASKS.json`, spec files, or unrelated workflow files unless
  the task explicitly requires it.

### Reviewer

Prefer `gpt-5.3-codex` model.

Reviewer prompt requirements:

- review only, no file edits
- findings first
- severity + file references
- prioritize bugs, regressions, safety risks, missing tests
- say `NO_MEANINGFUL_FINDINGS` when clean

## Resume Loop

1. Start or resume the implementer thread.
2. Wait for the implementer to finish validation.
3. Run a separate reviewer pass against the current working tree.
4. If findings exist:
   - resume the implementer thread with the reviewer findings
   - ask for targeted fixes and validation only
5. Re-run reviewer.
6. Repeat until the reviewer is clean or the remaining findings are explicitly not worth fixing.
7. Only then commit the task.

## Polling Discipline

- Let complex runs work for up to 30 minutes when needed.
- Do not close implementer or reviewer agents during the active review/fix loop for the same task. Reuse the same agents until the task is either review-clean or explicitly paused.
- Create fresh implementer/reviewer agents only when starting a new task, not for follow-up passes within the same task.
- Close agents only after the task loop is complete or when the thread id is no longer needed.

## Practical Guardrails

- Don't edit TASKS.json manually, prefer task-tracker-json skill.
- Don't stop working sub-agent unless it's absolutely necessary.

## Finalization

- Commit only after the review loop is complete.
- Use imperative English commit titles.
- Update task in `TASKS.json` with:
  - final status
  - review outcome
  - validation summary
  - commit hash

## Repository-Specific Notes

- This repo uses `TASKS.json` as permanent orchestration memory.
