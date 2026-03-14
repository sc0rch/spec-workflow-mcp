import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { ApprovalStorage } from '../approval-storage.js';
import { ImplementationLogManager } from '../implementation-log-manager.js';
import { ProjectWorkspaceService } from '../project-workspace.js';

describe('ProjectWorkspaceService', () => {
  let tempDir: string;
  let workflowRootPath: string;
  let workspacePath: string;
  let service: ProjectWorkspaceService;

  beforeEach(async () => {
    const baseDir = join(process.cwd(), '.tmp-project-workspace');
    await fs.mkdir(baseDir, { recursive: true });
    tempDir = join(baseDir, `case-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    workflowRootPath = join(tempDir, 'repo-main');
    workspacePath = workflowRootPath;
    await fs.mkdir(workflowRootPath, { recursive: true });
    service = new ProjectWorkspaceService();
  });

  afterEach(async () => {
    vi.useRealTimers();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('builds spec summaries with task progress and approval queue', async () => {
    await createSpec(workflowRootPath, 'desktop-rewrite', [
      '- [-] 1.1 Build desktop shell',
      '  - Purpose: Introduce Electron shell',
      '- [ ] 1.2 Add workspace view',
      '  - Purpose: Show specs and approvals'
    ].join('\n'));
    await createSpec(workflowRootPath, 'approval-inbox', [
      '- [x] 2.1 Extract approval queue',
      '  - Purpose: Reuse approval storage',
      '- [ ] 2.2 Render approval detail'
    ].join('\n'));

    await fs.mkdir(join(workspacePath, 'src'), { recursive: true });
    await fs.writeFile(join(workspacePath, 'src', 'desktop.ts'), 'export const desktop = true;', 'utf-8');

    const approvalStorage = new ApprovalStorage(workflowRootPath, {
      fileResolutionPath: workspacePath
    });
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-14T12:00:00.000Z'));
    await approvalStorage.createApproval('Review desktop shell', 'src/desktop.ts', 'spec', 'desktop-rewrite');
    vi.setSystemTime(new Date('2026-03-14T12:05:00.000Z'));
    await approvalStorage.createApproval('Review steering docs', 'src/desktop.ts', 'steering', 'tech');

    const logManager = new ImplementationLogManager(
      join(workflowRootPath, '.spec-workflow', 'specs', 'desktop-rewrite')
    );
    await logManager.addLogEntry({
      taskId: '1.1',
      timestamp: '2026-03-14T13:00:00.000Z',
      summary: 'Built desktop shell view',
      filesModified: ['apps/desktop/src/renderer/App.tsx'],
      filesCreated: [],
      statistics: {
        linesAdded: 50,
        linesRemoved: 0,
        filesChanged: 1
      },
      artifacts: {}
    });

    const snapshot = await service.getWorkspaceSnapshot({
      translatedWorkflowRootPath: workflowRootPath,
      translatedWorkspacePath: workspacePath
    });

    expect(snapshot.pendingApprovals).toHaveLength(2);
    expect(snapshot.pendingApprovals[0]).toEqual(
      expect.objectContaining({
        category: 'steering',
        categoryName: 'tech',
        title: 'Review steering docs'
      })
    );
    expect(snapshot.pendingApprovals[1]).toEqual(
      expect.objectContaining({
        category: 'spec',
        categoryName: 'desktop-rewrite',
        title: 'Review desktop shell'
      })
    );
    expect(snapshot.specs[0]).toEqual(
      expect.objectContaining({
        name: 'desktop-rewrite',
        phaseState: 'active',
        pendingApprovalCount: 1,
        tasks: [
          expect.objectContaining({
            id: '1.1',
            description: 'Build desktop shell',
            status: 'in-progress',
            purposes: ['Introduce Electron shell']
          }),
          expect.objectContaining({
            id: '1.2',
            description: 'Add workspace view',
            status: 'pending',
            purposes: ['Show specs and approvals']
          })
        ],
        phases: expect.objectContaining({
          requirements: expect.objectContaining({
            exists: true,
            content: '# Requirements'
          }),
          tasks: expect.objectContaining({
            exists: true,
            content: expect.stringContaining('1.1 Build desktop shell')
          })
        }),
        activeTask: expect.objectContaining({
          id: '1.1'
        }),
        nextTask: expect.objectContaining({
          id: '1.2'
        }),
        latestImplementation: expect.objectContaining({
          taskId: '1.1'
        }),
        implementationEntries: [
          expect.objectContaining({
            taskId: '1.1',
            summary: 'Built desktop shell view'
          })
        ]
      })
    );
    expect(snapshot.specs[1]).toEqual(
      expect.objectContaining({
        name: 'approval-inbox',
        phaseState: 'active',
        pendingApprovalCount: 0
      })
    );
  });
});

async function createSpec(
  workflowRootPath: string,
  specName: string,
  tasksContent: string
): Promise<void> {
  const specPath = join(workflowRootPath, '.spec-workflow', 'specs', specName);
  await fs.mkdir(specPath, { recursive: true });
  await fs.writeFile(join(specPath, 'requirements.md'), '# Requirements', 'utf-8');
  await fs.writeFile(join(specPath, 'design.md'), '# Design', 'utf-8');
  await fs.writeFile(join(specPath, 'tasks.md'), tasksContent, 'utf-8');
}
