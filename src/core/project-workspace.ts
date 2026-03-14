import { ApprovalStorage, type ApprovalRequest } from './approval-storage.js';
import { ImplementationLogManager } from './implementation-log-manager.js';
import { SpecParser, type ParsedSpec } from './parser.js';
import { PathUtils } from './path-utils.js';
import {
  findNextPendingTask,
  getTaskById,
  parseTasksFromMarkdown,
  type ParsedTask
} from './task-parser.js';

export interface ProjectWorkspacePaths {
  translatedWorkflowRootPath: string;
  translatedWorkspacePath: string;
}

export interface ProjectWorkspaceTaskPreview {
  id: string;
  description: string;
  status: ParsedTask['status'];
  requirements?: string[] | undefined;
}

export interface ProjectWorkspacePhaseDetail {
  exists: boolean;
  lastModified?: string | undefined;
  content?: string | undefined;
}

export interface ProjectWorkspaceImplementationEntry {
  id: string;
  taskId: string;
  summary: string;
  timestamp: string;
  filesModified: string[];
  filesCreated: string[];
}

export interface ProjectWorkspaceSpecSummary {
  name: string;
  displayName: string;
  lastModified: string;
  phaseState: 'requirements' | 'design' | 'ready' | 'active' | 'implemented';
  phases: {
    requirements: ProjectWorkspacePhaseDetail;
    design: ProjectWorkspacePhaseDetail;
    tasks: ProjectWorkspacePhaseDetail;
  };
  taskSummary: {
    total: number;
    completed: number;
    pending: number;
    inProgress: number;
  };
  pendingApprovalCount: number;
  activeTask?: ProjectWorkspaceTaskPreview | undefined;
  nextTask?: ProjectWorkspaceTaskPreview | undefined;
  latestImplementation?: {
    taskId: string;
    summary: string;
    timestamp: string;
  } | undefined;
  implementationEntries: ProjectWorkspaceImplementationEntry[];
}

export interface ProjectWorkspaceApprovalQueueItem {
  approvalId: string;
  title: string;
  filePath: string;
  type: ApprovalRequest['type'];
  category: ApprovalRequest['category'];
  categoryName: string;
  createdAt: string;
}

export interface ProjectWorkspaceSnapshot {
  specs: ProjectWorkspaceSpecSummary[];
  pendingApprovals: ProjectWorkspaceApprovalQueueItem[];
}

export class ProjectWorkspaceService {
  async getWorkspaceSnapshot(paths: ProjectWorkspacePaths): Promise<ProjectWorkspaceSnapshot> {
    const parser = new SpecParser(paths.translatedWorkflowRootPath);
    const approvalStorage = new ApprovalStorage(paths.translatedWorkflowRootPath, {
      fileResolutionPath: paths.translatedWorkspacePath
    });

    const [specs, pendingApprovals] = await Promise.all([
      parser.getAllSpecs(),
      approvalStorage.getAllPendingApprovals()
    ]);

    const approvalsBySpec = groupApprovalsBySpec(pendingApprovals);
    const specSummaries = await Promise.all(
      specs.map(async (spec) => this.toSpecSummary(spec, approvalsBySpec.get(spec.name) ?? [], paths))
    );

    return {
      specs: sortSpecSummaries(specSummaries),
      pendingApprovals: pendingApprovals
        .map(mapApprovalQueueItem)
        .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt))
    };
  }

  private async toSpecSummary(
    spec: ParsedSpec,
    pendingApprovals: ApprovalRequest[],
    paths: ProjectWorkspacePaths
  ): Promise<ProjectWorkspaceSpecSummary> {
    const taskResult = spec.phases.tasks.content
      ? parseTasksFromMarkdown(spec.phases.tasks.content)
      : {
          tasks: [],
          inProgressTask: null,
          summary: {
            total: 0,
            completed: 0,
            inProgress: 0,
            pending: 0,
            headers: 0
          }
        };
    const activeTask = taskResult.inProgressTask
      ? getTaskById(taskResult.tasks, taskResult.inProgressTask)
      : undefined;
    const nextTask = findNextPendingTask(taskResult.tasks);
    const implementationEntries = await this.getImplementationEntriesForSpec(
      paths.translatedWorkflowRootPath,
      spec.name
    );
    const latestImplementation = implementationEntries[0]
      ? {
          taskId: implementationEntries[0].taskId,
          summary: implementationEntries[0].summary,
          timestamp: implementationEntries[0].timestamp
        }
      : undefined;

    return {
      name: spec.name,
      displayName: spec.displayName,
      lastModified: spec.lastModified,
      phaseState: deriveSpecPhaseState(spec, taskResult.summary),
      phases: {
        requirements: mapPhaseDetail(spec.phases.requirements),
        design: mapPhaseDetail(spec.phases.design),
        tasks: mapPhaseDetail(spec.phases.tasks)
      },
      taskSummary: {
        total: taskResult.summary.total,
        completed: taskResult.summary.completed,
        pending: taskResult.summary.pending,
        inProgress: taskResult.summary.inProgress
      },
      pendingApprovalCount: pendingApprovals.length,
      activeTask: activeTask ? mapTaskPreview(activeTask) : undefined,
      nextTask: nextTask ? mapTaskPreview(nextTask) : undefined,
      latestImplementation,
      implementationEntries
    };
  }

  private async getImplementationEntriesForSpec(
    translatedWorkflowRootPath: string,
    specName: string
  ): Promise<ProjectWorkspaceImplementationEntry[]> {
    const specPath = PathUtils.getSpecPath(translatedWorkflowRootPath, specName);
    const logManager = new ImplementationLogManager(specPath);
    const logs = await logManager.getAllLogs();

    return logs.slice(0, 6).map((entry) => ({
      id: entry.id,
      taskId: entry.taskId,
      summary: entry.summary,
      timestamp: entry.timestamp,
      filesModified: entry.filesModified,
      filesCreated: entry.filesCreated
    }));
  }
}

function groupApprovalsBySpec(approvals: ApprovalRequest[]): Map<string, ApprovalRequest[]> {
  const grouped = new Map<string, ApprovalRequest[]>();

  for (const approval of approvals) {
    if (approval.category !== 'spec') {
      continue;
    }

    const existingApprovals = grouped.get(approval.categoryName) ?? [];
    existingApprovals.push(approval);
    grouped.set(approval.categoryName, existingApprovals);
  }

  return grouped;
}

function mapTaskPreview(task: ParsedTask): ProjectWorkspaceTaskPreview {
  return {
    id: task.id,
    description: task.description,
    status: task.status,
    requirements: task.requirements
  };
}

function mapPhaseDetail(phase: ParsedSpec['phases']['requirements']): ProjectWorkspacePhaseDetail {
  return {
    exists: phase.exists,
    lastModified: phase.lastModified,
    content: phase.content
  };
}

function mapApprovalQueueItem(approval: ApprovalRequest): ProjectWorkspaceApprovalQueueItem {
  return {
    approvalId: approval.id,
    title: approval.title,
    filePath: approval.filePath,
    type: approval.type,
    category: approval.category,
    categoryName: approval.categoryName,
    createdAt: approval.createdAt
  };
}

function deriveSpecPhaseState(
  spec: ParsedSpec,
  summary: {
    total: number;
    completed: number;
    inProgress: number;
    pending: number;
  }
): ProjectWorkspaceSpecSummary['phaseState'] {
  if (summary.total > 0 && summary.completed === summary.total) {
    return 'implemented';
  }

  if (summary.inProgress > 0 || summary.completed > 0) {
    return 'active';
  }

  if (spec.phases.tasks.exists) {
    return 'ready';
  }

  if (spec.phases.design.exists) {
    return 'design';
  }

  return 'requirements';
}

function sortSpecSummaries(specs: ProjectWorkspaceSpecSummary[]): ProjectWorkspaceSpecSummary[] {
  return specs.sort((left, right) => {
    const leftScore = scoreSpec(left);
    const rightScore = scoreSpec(right);

    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }

    const timestampDiff = Date.parse(right.lastModified) - Date.parse(left.lastModified);
    if (timestampDiff !== 0) {
      return timestampDiff;
    }

    return left.displayName.localeCompare(right.displayName);
  });
}

function scoreSpec(spec: ProjectWorkspaceSpecSummary): number {
  let score = 0;

  if (spec.pendingApprovalCount > 0) {
    score += 8;
  }
  if (spec.taskSummary.inProgress > 0) {
    score += 6;
  }
  if (spec.taskSummary.pending > 0) {
    score += 4;
  }
  if (spec.phaseState === 'implemented') {
    score += 1;
  }

  return score;
}
