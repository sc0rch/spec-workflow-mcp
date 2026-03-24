#!/usr/bin/env node

import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import {
  hasHelpFlag,
  parseFlags,
  runApprovalsDeleteCommand,
  runApprovalsInspectCommand,
  runApprovalsRequestCommand,
  runApprovalsRespondCommand,
  runApprovalsStatusCommand,
  runGuideCommand,
  runLogImplementationCommand,
  runSpecStatusCommand,
  type CommandGlobalOptions
} from './cli/commands.js';
import { renderCommandResult } from './cli/render.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJsonPath = join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as { version: string };

function showHelp(): void {
  console.error(`
Spec Workflow

USAGE:
  spec-workflow <command> [options]

COMMANDS:
  guide
  steering-guide
  spec-status --spec-name <name>
  approvals request ...
  approvals status --approval-id <id>
  approvals inspect --approval-id <id>
  approvals respond --approval-id <id> --action <approve|reject|needs-revision> --response <text>
  approvals delete --approval-id <id>
  log-implementation --input <json-file>

GLOBAL OPTIONS:
  --project-path <path>            Use an explicit project/worktree path
  --no-shared-worktree-specs       Store .spec-workflow in the current worktree instead of the shared git root
  --json                           Print a machine-readable JSON result
  --help, -h                       Show this help message
`);
}

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  const json = flags.values.get('json') === true;
  const noSharedWorktreeSpecs = flags.values.get('no-shared-worktree-specs') === true;
  const globalOptions: CommandGlobalOptions = {
    projectPath: typeof flags.values.get('project-path') === 'string'
      ? String(flags.values.get('project-path'))
      : undefined,
    noSharedWorktreeSpecs,
    packageVersion: packageJson.version
  };

  if (hasHelpFlag(flags) || flags.positionals.length === 0) {
    showHelp();
    process.exit(0);
  }

  try {
    const [command, subcommand] = flags.positionals;
    const result = await dispatchCommand(command, subcommand, flags, globalOptions);
    const output = renderCommandResult(result, json);
    if (result.success) {
      console.log(output);
      process.exit(0);
    }

    console.error(output);
    process.exit(1);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  }
}

async function dispatchCommand(
  command: string | undefined,
  subcommand: string | undefined,
  flags: ReturnType<typeof parseFlags>,
  globalOptions: CommandGlobalOptions
) {
  switch (command) {
    case 'guide':
      return runGuideCommand(
        'spec-workflow-guide.md',
        'Spec workflow guide loaded'
      );
    case 'steering-guide':
      return runGuideCommand(
        'steering-guide.md',
        'Steering workflow guide loaded'
      );
    case 'spec-status':
      return runSpecStatusCommand(flags, globalOptions);
    case 'approvals':
      switch (subcommand) {
        case 'request':
          return runApprovalsRequestCommand(flags, globalOptions);
        case 'status':
          return runApprovalsStatusCommand(flags, globalOptions);
        case 'inspect':
          return runApprovalsInspectCommand(flags, globalOptions);
        case 'respond':
          return runApprovalsRespondCommand(flags, globalOptions);
        case 'delete':
          return runApprovalsDeleteCommand(flags, globalOptions);
        default:
          throw new Error(`Unknown approvals command: ${subcommand ?? '(missing)'}`);
      }
    case 'log-implementation':
      return runLogImplementationCommand(flags, globalOptions);
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

export function resolveEntrypoint(pathValue: string | undefined): string | undefined {
  if (!pathValue) return undefined;

  try {
    return resolve(pathValue);
  } catch {
    return undefined;
  }
}

const entrypoint = resolveEntrypoint(process.argv[1]);
const currentFile = resolveEntrypoint(fileURLToPath(import.meta.url));

if (entrypoint && currentFile && currentFile === entrypoint) {
  void main();
}
