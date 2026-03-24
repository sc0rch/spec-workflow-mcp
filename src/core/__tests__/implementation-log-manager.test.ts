import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ImplementationLogManager } from '../implementation-log-manager.js';

describe('ImplementationLogManager', () => {
  let tempDir: string;
  let specPath: string;
  let logManager: ImplementationLogManager;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(tmpdir(), 'spec-workflow-implementation-log-manager-'));
    specPath = join(tempDir, 'desktop-rewrite');
    await fs.mkdir(specPath, { recursive: true });
    logManager = new ImplementationLogManager(specPath);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('round-trips markdown log entries and sorts newest-first', async () => {
    await logManager.addLogEntry({
      taskId: '1.1',
      timestamp: '2026-03-14T10:00:00.000Z',
      summary: 'Initial desktop shell work',
      filesModified: ['apps/desktop/src/main/index.ts'],
      filesCreated: [],
      statistics: {
        linesAdded: 15,
        linesRemoved: 1,
        filesChanged: 1
      },
      artifacts: {}
    });

    await logManager.addLogEntry({
      taskId: '2.3',
      timestamp: '2026-03-14T11:45:00.000Z',
      summary: 'Added project activity service',
      filesModified: ['src/core/project-activity.ts'],
      filesCreated: ['src/core/project-catalog.ts'],
      statistics: {
        linesAdded: 60,
        linesRemoved: 3,
        filesChanged: 2
      },
      artifacts: {
        functions: [
          {
            name: 'getProjectActivity',
            purpose: 'Summarize approvals and implementation activity for a project',
            location: 'src/core/project-activity.ts:20',
            signature: '(paths: ProjectActivityPaths) => Promise<ProjectActivitySummary>',
            isExported: true
          }
        ]
      }
    });

    const logs = await logManager.getAllLogs();

    expect(logs).toHaveLength(2);
    expect(logs.map((entry) => entry.taskId)).toEqual(['2.3', '1.1']);
    expect(logs[0]).toEqual(
      expect.objectContaining({
        taskId: '2.3',
        summary: 'Added project activity service',
        filesCreated: ['src/core/project-catalog.ts'],
        artifacts: {
          functions: [
            expect.objectContaining({
              name: 'getProjectActivity',
              isExported: true
            })
          ]
        }
      })
    );
  });

  it('searches logs across summary, files, and artifacts with keyword AND semantics', async () => {
    await logManager.addLogEntry({
      taskId: '3.4',
      timestamp: '2026-03-14T12:00:00.000Z',
      summary: 'Added approval inbox activity service',
      filesModified: ['src/core/project-activity.ts'],
      filesCreated: [],
      statistics: {
        linesAdded: 22,
        linesRemoved: 0,
        filesChanged: 1
      },
      artifacts: {
        components: [
          {
            name: 'ApprovalInbox',
            type: 'React',
            purpose: 'Render pending approvals for desktop review',
            location: 'apps/desktop/src/renderer/App.tsx',
            exports: ['ApprovalInbox']
          }
        ]
      }
    });

    const matchingLogs = await logManager.searchLogs('approval inbox');
    const stats = await logManager.getTaskStats('3.4');

    expect(matchingLogs).toHaveLength(1);
    expect(matchingLogs[0]?.taskId).toBe('3.4');
    expect(stats).toEqual(
      expect.objectContaining({
        totalImplementations: 1,
        totalFilesModified: 1,
        totalFilesCreated: 0,
        totalLinesAdded: 22,
        lastImplementation: expect.objectContaining({
          taskId: '3.4'
        })
      })
    );
  });
});
