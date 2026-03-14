import { PathUtils } from './path-utils.js';
import { ApprovalStorage } from './approval-storage.js';
import { ImplementationLogManager } from './implementation-log-manager.js';
import { SpecParser } from './parser.js';

export interface ProjectLatestImplementation {
  taskId: string;
  summary: string;
  timestamp: string;
  specName: string;
  specDisplayName: string;
}

export interface ProjectActivitySummary {
  pendingApprovalCount: number;
  latestImplementation?: ProjectLatestImplementation | undefined;
}

export interface ProjectActivityPaths {
  translatedWorkflowRootPath: string;
  translatedWorkspacePath: string;
}

export class ProjectActivityService {
  async getProjectActivity(paths: ProjectActivityPaths): Promise<ProjectActivitySummary> {
    const [pendingApprovalCount, latestImplementation] = await Promise.all([
      this.getPendingApprovalCount(paths),
      this.getLatestImplementation(paths.translatedWorkflowRootPath)
    ]);

    return {
      pendingApprovalCount,
      latestImplementation
    };
  }

  private async getPendingApprovalCount(paths: ProjectActivityPaths): Promise<number> {
    const storage = new ApprovalStorage(paths.translatedWorkflowRootPath, {
      fileResolutionPath: paths.translatedWorkspacePath
    });
    const pendingApprovals = await storage.getAllPendingApprovals();
    return pendingApprovals.length;
  }

  private async getLatestImplementation(
    translatedWorkflowRootPath: string
  ): Promise<ProjectLatestImplementation | undefined> {
    const parser = new SpecParser(translatedWorkflowRootPath);
    const specs = await parser.getAllSpecs();

    let latestImplementation: ProjectLatestImplementation | undefined;
    let latestTimestamp = 0;

    for (const spec of specs) {
      const specPath = PathUtils.getSpecPath(translatedWorkflowRootPath, spec.name);
      const logManager = new ImplementationLogManager(specPath);
      const logs = await logManager.getAllLogs();
      const [latestLog] = logs;

      if (!latestLog) {
        continue;
      }

      const timestamp = Date.parse(latestLog.timestamp) || 0;
      if (timestamp > latestTimestamp) {
        latestTimestamp = timestamp;
        latestImplementation = {
          taskId: latestLog.taskId,
          summary: latestLog.summary,
          timestamp: latestLog.timestamp,
          specName: spec.name,
          specDisplayName: spec.displayName
        };
      }
    }

    return latestImplementation;
  }
}
