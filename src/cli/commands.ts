import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { ApprovalReviewService } from '../core/approval-review.js';
import { ApprovalStorage, type ApprovalComment } from '../core/approval-storage.js';
import { PathUtils } from '../core/path-utils.js';
import { readProjectRelativeFile } from '../core/project-path-resolution.js';
import { SpecParser } from '../core/parser.js';
import { validateTasksMarkdown, formatValidationErrors } from '../core/task-validator.js';
import { validateMarkdownForMdx, formatMdxValidationIssues } from '../core/mdx-validator.js';
import { parseTasksFromMarkdown } from '../core/task-parser.js';
import { ImplementationLogManager } from '../core/implementation-log-manager.js';
import { resolveBoundProject } from '../core/project-binding.js';
import type { BoundProject, CommandResult, ImplementationLogEntry } from '../types.js';
import { loadGuideFile } from './guide-loader.js';

export interface CommandGlobalOptions {
  projectPath?: string;
  noSharedWorktreeSpecs: boolean;
  packageVersion: string;
}

export interface ParsedFlags {
  readonly values: Map<string, string | true>;
  readonly positionals: string[];
}

export async function runGuideCommand(
  fileName: string,
  message: string
): Promise<CommandResult<{ guide: string }>> {
  return {
    success: true,
    message,
    data: {
      guide: await loadGuideFile(fileName)
    }
  };
}

export async function runSpecStatusCommand(
  flags: ParsedFlags,
  options: CommandGlobalOptions
): Promise<CommandResult> {
  const specName = requireFlag(flags, 'spec-name');
  const boundProject = await getBoundProject(flags, options);
  const parser = new SpecParser(boundProject.translatedWorkflowRootPath);
  const spec = await parser.getSpec(specName);

  if (!spec) {
    return {
      success: false,
      message: `Specification '${specName}' not found`,
      nextSteps: [
        `Check that ${specName} exists under .spec-workflow/specs/`,
        'Run spec-workflow guide for the expected workflow'
      ]
    };
  }

  let currentPhase = 'not-started';
  let overallStatus = 'not-started';

  if (!spec.phases.requirements.exists) {
    currentPhase = 'requirements';
    overallStatus = 'requirements-needed';
  } else if (!spec.phases.design.exists) {
    currentPhase = 'design';
    overallStatus = 'design-needed';
  } else if (!spec.phases.tasks.exists) {
    currentPhase = 'tasks';
    overallStatus = 'tasks-needed';
  } else if (spec.taskProgress && spec.taskProgress.pending > 0) {
    currentPhase = 'implementation';
    overallStatus = 'implementing';
  } else if (spec.taskProgress && spec.taskProgress.total > 0 && spec.taskProgress.completed === spec.taskProgress.total) {
    currentPhase = 'completed';
    overallStatus = 'completed';
  } else {
    currentPhase = 'implementation';
    overallStatus = 'ready-for-implementation';
  }

  return {
    success: true,
    message: `Specification '${specName}' status: ${overallStatus}`,
    data: {
      name: specName,
      description: spec.description,
      currentPhase,
      overallStatus,
      createdAt: spec.createdAt,
      lastModified: spec.lastModified,
      phases: [
        {
          name: 'Requirements',
          status: spec.phases.requirements.exists ? 'created' : 'missing',
          lastModified: spec.phases.requirements.lastModified
        },
        {
          name: 'Design',
          status: spec.phases.design.exists ? 'created' : 'missing',
          lastModified: spec.phases.design.lastModified
        },
        {
          name: 'Tasks',
          status: spec.phases.tasks.exists ? 'created' : 'missing',
          lastModified: spec.phases.tasks.lastModified
        },
        {
          name: 'Implementation',
          status: spec.phases.implementation.exists ? 'in-progress' : 'not-started',
          progress: spec.taskProgress
        }
      ],
      taskProgress: spec.taskProgress ?? {
        total: 0,
        completed: 0,
        pending: 0
      }
    },
    nextSteps: buildSpecStatusNextSteps(specName, currentPhase, spec.taskProgress?.pending ?? 0),
    projectContext: buildProjectContext(boundProject, { specName, currentPhase })
  };
}

export async function runApprovalsRequestCommand(
  flags: ParsedFlags,
  options: CommandGlobalOptions
): Promise<CommandResult> {
  const title = requireFlag(flags, 'title');
  const filePath = requireFlag(flags, 'file-path');
  const type = requireEnumFlag(flags, 'type', ['document', 'action']);
  const category = requireEnumFlag(flags, 'category', ['spec', 'steering']);
  const categoryName = requireFlag(flags, 'category-name');
  const boundProject = await getBoundProject(flags, options);

  if (isAbsoluteOrTraversal(filePath)) {
    return {
      success: false,
      message: 'Security error: filePath must be relative and must not contain ".."'
    };
  }

  const approvalStorage = new ApprovalStorage(boundProject.translatedWorkflowRootPath, {
    originalPath: boundProject.workflowRootPath,
    fileResolutionPath: boundProject.translatedWorkspacePath
  });
  await approvalStorage.start();

  try {
    const isMarkdownFile = filePath.toLowerCase().endsWith('.md');
    let markdownContent: string | undefined;

    if (isMarkdownFile) {
      markdownContent = (await readProjectRelativeFile(boundProject, filePath)).content;
      const mdxValidation = await validateMarkdownForMdx(markdownContent);
      if (!mdxValidation.valid) {
        return {
          success: false,
          message: 'Markdown file has MDX compatibility errors that must be fixed before approval',
          data: {
            errorCount: mdxValidation.issues.length
          },
          nextSteps: [
            'Fix MDX compatibility issues',
            ...formatMdxValidationIssues(mdxValidation.issues)
          ]
        };
      }
    }

    if (filePath.endsWith('tasks.md')) {
      const content = markdownContent ?? (await readProjectRelativeFile(boundProject, filePath)).content;
      const validationResult = validateTasksMarkdown(content);
      if (!validationResult.valid) {
        return {
          success: false,
          message: 'Tasks document has format errors that must be fixed before approval',
          data: {
            errorCount: validationResult.errors.length,
            warningCount: validationResult.warnings.length,
            summary: validationResult.summary
          },
          nextSteps: [
            'Fix the format errors listed below',
            ...formatValidationErrors(validationResult)
          ]
        };
      }
    }

    const approvalId = await approvalStorage.createApproval(
      title,
      filePath,
      category,
      categoryName,
      type
    );

    return {
      success: true,
      message: `Approval request created: ${approvalId}`,
      data: {
        approvalId,
        title,
        filePath,
        type,
        status: 'pending'
      },
      nextSteps: [
        `Inspect approval: spec-workflow approvals inspect --approval-id ${approvalId}${boundProject.requestedPath ? ` --project-path ${quotePath(boundProject.requestedPath)}` : ''}`,
        `Check status: spec-workflow approvals status --approval-id ${approvalId}${boundProject.requestedPath ? ` --project-path ${quotePath(boundProject.requestedPath)}` : ''}`
      ],
      projectContext: buildProjectContext(boundProject)
    };
  } finally {
    await approvalStorage.stop();
  }
}

export async function runApprovalsStatusCommand(
  flags: ParsedFlags,
  options: CommandGlobalOptions
): Promise<CommandResult> {
  const approvalId = requireFlag(flags, 'approval-id');
  const boundProject = await getBoundProject(flags, options);
  const approvalStorage = new ApprovalStorage(boundProject.translatedWorkflowRootPath, {
    originalPath: boundProject.workflowRootPath,
    fileResolutionPath: boundProject.translatedWorkspacePath
  });
  await approvalStorage.start();

  try {
    const approval = await approvalStorage.getApproval(approvalId);
    if (!approval) {
      return {
        success: false,
        message: `Approval request not found: ${approvalId}`
      };
    }

    const nextSteps: string[] = [];
    if (approval.status === 'pending') {
      nextSteps.push('Inspect the approval and respond before proceeding');
    } else if (approval.status === 'approved') {
      nextSteps.push('Run approvals delete before moving to the next phase');
    } else if (approval.status === 'needs-revision') {
      nextSteps.push('Update the document with the requested changes');
      nextSteps.push('Create a new approval request after revising the document');
    }

    return {
      success: true,
      message: approval.status === 'pending'
        ? `BLOCKED: Status is ${approval.status}.`
        : `Approval status: ${approval.status}`,
      data: {
        approvalId,
        title: approval.title,
        type: approval.type,
        status: approval.status,
        createdAt: approval.createdAt,
        respondedAt: approval.respondedAt,
        response: approval.response,
        annotations: approval.annotations,
        comments: approval.comments
      },
      nextSteps,
      projectContext: buildProjectContext(boundProject)
    };
  } finally {
    await approvalStorage.stop();
  }
}

export async function runApprovalsInspectCommand(
  flags: ParsedFlags,
  options: CommandGlobalOptions
): Promise<CommandResult> {
  const approvalId = requireFlag(flags, 'approval-id');
  const boundProject = await getBoundProject(flags, options);
  const approvalReview = new ApprovalReviewService();
  const review = await approvalReview.getApprovalReview(
    {
      translatedWorkflowRootPath: boundProject.translatedWorkflowRootPath,
      translatedWorkspacePath: boundProject.translatedWorkspacePath
    },
    approvalId
  );

  if (!review) {
    return {
      success: false,
      message: `Approval request not found: ${approvalId}`
    };
  }

  return {
    success: true,
    message: `Approval review loaded for ${approvalId}`,
    data: {
      approval: review.approval,
      currentContent: review.currentContent,
      diff: review.diff
    },
    projectContext: buildProjectContext(boundProject)
  };
}

export async function runApprovalsRespondCommand(
  flags: ParsedFlags,
  options: CommandGlobalOptions
): Promise<CommandResult> {
  const approvalId = requireFlag(flags, 'approval-id');
  const action = requireEnumFlag(flags, 'action', ['approve', 'reject', 'needs-revision']);
  const response = requireFlag(flags, 'response');
  const annotations = getOptionalFlag(flags, 'annotations');
  const commentsFile = getOptionalFlag(flags, 'comments-file');
  const comments = commentsFile ? await readJsonFile<ApprovalComment[]>(commentsFile) : undefined;
  const boundProject = await getBoundProject(flags, options);
  const approvalReview = new ApprovalReviewService();

  await approvalReview.respondToApproval(
    {
      translatedWorkflowRootPath: boundProject.translatedWorkflowRootPath,
      translatedWorkspacePath: boundProject.translatedWorkspacePath
    },
    approvalId,
    action,
    response,
    annotations,
    comments
  );

  return {
    success: true,
    message: `Approval ${approvalId} marked as ${action}`,
    data: {
      approvalId,
      action,
      response
    },
    nextSteps: ['Run approvals status to verify the new state'],
    projectContext: buildProjectContext(boundProject)
  };
}

export async function runApprovalsDeleteCommand(
  flags: ParsedFlags,
  options: CommandGlobalOptions
): Promise<CommandResult> {
  const approvalId = requireFlag(flags, 'approval-id');
  const boundProject = await getBoundProject(flags, options);
  const approvalStorage = new ApprovalStorage(boundProject.translatedWorkflowRootPath, {
    originalPath: boundProject.workflowRootPath,
    fileResolutionPath: boundProject.translatedWorkspacePath
  });
  await approvalStorage.start();

  try {
    const approval = await approvalStorage.getApproval(approvalId);
    if (!approval) {
      return {
        success: false,
        message: `Approval request "${approvalId}" not found`
      };
    }

    if (approval.status === 'pending') {
      return {
        success: false,
        message: `BLOCKED: Cannot delete approval "${approvalId}" while it is still pending.`,
        nextSteps: [
          'Inspect and respond to the approval first',
          'Delete only after the approval leaves the pending state'
        ],
        projectContext: buildProjectContext(boundProject)
      };
    }

    const deleted = await approvalStorage.deleteApproval(approvalId);
    return {
      success: deleted,
      message: deleted
        ? `Approval request "${approvalId}" deleted successfully`
        : `Failed to delete approval request "${approvalId}"`,
      nextSteps: deleted ? ['Cleanup complete'] : ['Check that the approval file is writable'],
      projectContext: buildProjectContext(boundProject)
    };
  } finally {
    await approvalStorage.stop();
  }
}

export async function runLogImplementationCommand(
  flags: ParsedFlags,
  options: CommandGlobalOptions
): Promise<CommandResult> {
  const inputPath = requireFlag(flags, 'input');
  const input = await readJsonFile<{
    specName: string;
    taskId: string;
    summary: string;
    filesModified?: string[];
    filesCreated?: string[];
    statistics: {
      linesAdded: number;
      linesRemoved: number;
    };
    artifacts: ImplementationLogEntry['artifacts'];
  }>(inputPath);

  if (!input.artifacts) {
    return {
      success: false,
      message: 'Artifacts field is REQUIRED.'
    };
  }

  const boundProject = await getBoundProject(flags, options);
  const specPath = PathUtils.getSpecPath(boundProject.translatedWorkflowRootPath, input.specName);
  const tasksPath = join(specPath, 'tasks.md');
  const tasksContent = await readFile(tasksPath, 'utf-8');
  const parsed = parseTasksFromMarkdown(tasksContent);
  const taskExists = parsed.tasks.some((task) => task.id === input.taskId);

  if (!taskExists) {
    return {
      success: false,
      message: `Task '${input.taskId}' not found in specification '${input.specName}'`,
      nextSteps: [
        `Check .spec-workflow/specs/${input.specName}/tasks.md`,
        'Verify that the task ID is correct'
      ]
    };
  }

  const logManager = new ImplementationLogManager(specPath);
  const createdEntry = await logManager.addLogEntry({
    taskId: input.taskId,
    timestamp: new Date().toISOString(),
    summary: input.summary,
    filesModified: input.filesModified ?? [],
    filesCreated: input.filesCreated ?? [],
    statistics: {
      linesAdded: input.statistics.linesAdded || 0,
      linesRemoved: input.statistics.linesRemoved || 0,
      filesChanged: (input.filesModified?.length ?? 0) + (input.filesCreated?.length ?? 0)
    },
    artifacts: input.artifacts
  });

  const taskStats = await logManager.getTaskStats(input.taskId);
  return {
    success: true,
    message: `Implementation logged for task '${input.taskId}'`,
    data: {
      entryId: createdEntry.id,
      entry: createdEntry,
      taskStats
    },
    nextSteps: ['Mark the task as completed in tasks.md'],
    projectContext: buildProjectContext(boundProject, { specName: input.specName })
  };
}

export function parseFlags(args: string[]): ParsedFlags {
  const values = new Map<string, string | true>();
  const positionals: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];
    if (!current) {
      continue;
    }

    if (current === '-h' || current === '--help') {
      values.set('help', true);
      continue;
    }

    if (!current.startsWith('--')) {
      positionals.push(current);
      continue;
    }

    const [, rawNameValue] = current.split('--');
    const [name, inlineValue] = rawNameValue.split('=', 2);
    if (!name) {
      continue;
    }

    if (inlineValue !== undefined) {
      values.set(name, inlineValue);
      continue;
    }

    const next = args[index + 1];
    if (!next || next.startsWith('--')) {
      values.set(name, true);
      continue;
    }

    values.set(name, next);
    index += 1;
  }

  return {
    values,
    positionals
  };
}

export function hasHelpFlag(flags: ParsedFlags): boolean {
  return flags.values.get('help') === true;
}

function buildProjectContext(
  boundProject: BoundProject,
  extra: { specName?: string; currentPhase?: string } = {}
) {
  return {
    projectPath: boundProject.workspacePath,
    workspacePath: boundProject.workspacePath,
    workflowRoot: PathUtils.getWorkflowRoot(boundProject.workflowRootPath),
    ...(extra.specName ? { specName: extra.specName } : {}),
    ...(extra.currentPhase ? { currentPhase: extra.currentPhase } : {})
  };
}

async function getBoundProject(flags: ParsedFlags, options: CommandGlobalOptions): Promise<BoundProject> {
  const projectPath = getOptionalFlag(flags, 'project-path') ?? options.projectPath;
  return resolveBoundProject({
    projectPath,
    noSharedWorktreeSpecs: options.noSharedWorktreeSpecs,
    packageVersion: options.packageVersion
  });
}

function buildSpecStatusNextSteps(specName: string, currentPhase: string, pendingTasks: number): string[] {
  switch (currentPhase) {
    case 'requirements':
      return [
        `Read .spec-workflow/templates/requirements-template.md`,
        `Create .spec-workflow/specs/${specName}/requirements.md`,
        'Request approval'
      ];
    case 'design':
      return [
        `Read .spec-workflow/templates/design-template.md`,
        `Create .spec-workflow/specs/${specName}/design.md`,
        'Request approval'
      ];
    case 'tasks':
      return [
        `Read .spec-workflow/templates/tasks-template.md`,
        `Create .spec-workflow/specs/${specName}/tasks.md`,
        'Request approval'
      ];
    case 'implementation':
      return pendingTasks > 0
        ? [
            `Read .spec-workflow/specs/${specName}/tasks.md`,
            'Mark one task as in-progress before implementing it',
            'Log implementation before marking the task complete'
          ]
        : [
            `Read .spec-workflow/specs/${specName}/tasks.md`,
            'Begin implementation by marking the first task in-progress'
          ];
    case 'completed':
      return ['All tasks are complete', 'Run project tests'];
    default:
      return [];
  }
}

function quotePath(pathValue: string): string {
  return pathValue.includes(' ') ? `"${pathValue}"` : pathValue;
}

function requireFlag(flags: ParsedFlags, name: string): string {
  const value = flags.values.get(name);
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }

  throw new Error(`Missing required flag: --${name}`);
}

function getOptionalFlag(flags: ParsedFlags, name: string): string | undefined {
  const value = flags.values.get(name);
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function requireEnumFlag<const T extends readonly string[]>(
  flags: ParsedFlags,
  name: string,
  allowed: T
): T[number] {
  const value = requireFlag(flags, name);
  if (allowed.includes(value as T[number])) {
    return value as T[number];
  }

  throw new Error(`Invalid value for --${name}: ${value}`);
}

function isAbsoluteOrTraversal(filePath: string): boolean {
  return filePath.startsWith('/') || filePath.includes('..') || /^[A-Za-z]:[\\/]/.test(filePath);
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, 'utf-8');
  return JSON.parse(raw) as T;
}
