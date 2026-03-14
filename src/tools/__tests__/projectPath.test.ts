import { describe, it, expect, vi } from 'vitest';
import { specStatusHandler } from '../spec-status.js';
import { logImplementationHandler } from '../log-implementation.js';
import { approvalsHandler } from '../approvals.js';
import { BoundProject, ToolContext } from '../../types.js';
import { dirname, join } from 'path';
import { homedir } from 'os';
import { mkdtemp, mkdir, readdir, rm, writeFile } from 'fs/promises';

function createBoundProject(pathValue: string, overrides: Partial<BoundProject> = {}): BoundProject {
  return {
    requestedPath: pathValue,
    workspacePath: pathValue,
    workflowRootPath: pathValue,
    translatedWorkspacePath: pathValue,
    translatedWorkflowRootPath: pathValue,
    noSharedWorktreeSpecs: false,
    source: 'startup-binding',
    ...overrides
  };
}

function createContext(
  defaultPath?: string,
  overrides: Partial<ToolContext> = {},
  resolveOverride?: (projectPath?: string) => Promise<BoundProject>
): ToolContext {
  return {
    dashboardUrl: 'http://localhost:5000',
    resolveBoundProject: resolveOverride || (async (projectPath?: string) => {
      const selectedPath = projectPath || defaultPath;
      if (!selectedPath) {
        throw new Error('Project binding could not be resolved: no startup path is configured and the MCP client did not provide exactly one filesystem root. Pass projectPath explicitly.');
      }
      return createBoundProject(selectedPath, {
        source: projectPath ? 'explicit-arg' : 'startup-binding'
      });
    }),
    ...overrides
  };
}

describe('Tool project binding behavior', () => {
  describe('spec-status tool', () => {
    async function createWorkspacePair(prefix: string): Promise<{ mainRepo: string; worktree: string }> {
      const tempRoot = join(homedir(), '.tmp-test-worktrees');
      await mkdir(tempRoot, { recursive: true });
      const pairRoot = await mkdtemp(join(tempRoot, prefix));
      const mainRepo = join(pairRoot, 'repo-main');
      const worktree = join(pairRoot, 'repo-wt-a');
      await mkdir(mainRepo, { recursive: true });
      await mkdir(worktree, { recursive: true });
      return { mainRepo, worktree };
    }

    it('uses the resolved project binding when args.projectPath is not provided', async () => {
      const result = await specStatusHandler(
        { specName: 'test-spec' },
        createContext('/test/project/from/context')
      );

      expect(result.success).toBe(false);
      expect(result.message).not.toContain('Pass projectPath explicitly');
    });

    it('uses args.projectPath as an explicit override', async () => {
      const result = await specStatusHandler(
        { specName: 'test-spec', projectPath: '/override/path' },
        createContext('/test/project/from/context')
      );

      expect(result.success).toBe(false);
      expect(result.message).not.toContain('Pass projectPath explicitly');
    });

    it('fails with the canonical binding error when no project can be resolved', async () => {
      const result = await specStatusHandler(
        { specName: 'test-spec' },
        createContext(undefined)
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Pass projectPath explicitly');
    });

    it('uses the resolved worktree binding in no-shared mode', async () => {
      const { mainRepo, worktree } = await createWorkspacePair('specwf-status-');
      const requirementsPath = join(worktree, '.spec-workflow', 'specs', 'worktree-spec', 'requirements.md');

      try {
        await mkdir(dirname(requirementsPath), { recursive: true });
        await writeFile(requirementsPath, '# Requirements\n', 'utf-8');

        const result = await specStatusHandler(
          { specName: 'worktree-spec', projectPath: worktree },
          createContext(mainRepo, { noSharedWorktreeSpecs: true }, async (projectPath?: string) => {
            const selectedPath = projectPath || mainRepo;
            return createBoundProject(selectedPath, {
              workflowRootPath: selectedPath,
              translatedWorkflowRootPath: selectedPath,
              noSharedWorktreeSpecs: true,
              source: projectPath ? 'explicit-arg' : 'startup-binding'
            });
          })
        );

        expect(result.success).toBe(true);
        expect(result.projectContext?.projectPath).toBe(worktree);
        expect(result.projectContext?.workflowRoot).toBe(join(worktree, '.spec-workflow'));
      } finally {
        await rm(join(mainRepo, '..'), { recursive: true, force: true });
      }
    });
  });

  describe('log-implementation tool', () => {
    it('uses the resolved project binding when args.projectPath is not provided', async () => {
      const result = await logImplementationHandler(
        {
          specName: 'test-spec',
          taskId: '1.1',
          summary: 'Test implementation',
          filesModified: [],
          filesCreated: [],
          statistics: { linesAdded: 10, linesRemoved: 5 },
          artifacts: { functions: [] }
        },
        createContext('/test/project/from/context')
      );

      expect(result.success).toBe(false);
      expect(result.message).not.toContain('Pass projectPath explicitly');
    });

    it('fails with the canonical binding error when no project can be resolved', async () => {
      const result = await logImplementationHandler(
        {
          specName: 'test-spec',
          taskId: '1.1',
          summary: 'Test implementation',
          filesModified: [],
          filesCreated: [],
          statistics: { linesAdded: 10, linesRemoved: 5 },
          artifacts: { functions: [] }
        },
        createContext(undefined)
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Pass projectPath explicitly');
    });
  });

  describe('approvals tool', () => {
    async function createTempProject(prefix: string): Promise<string> {
      const tempRoot = join(homedir(), '.tmp-test-approvals');
      await mkdir(tempRoot, { recursive: true });
      return mkdtemp(join(tempRoot, prefix));
    }

    it('uses the resolved project binding for request action when args.projectPath is not provided', async () => {
      const result = await approvalsHandler(
        {
          action: 'request',
          title: 'Test approval',
          filePath: 'test.md',
          type: 'document',
          category: 'spec',
          categoryName: 'test-spec'
        },
        createContext('/test/project/from/context')
      );

      expect(result.success).toBe(false);
      expect(result.message).not.toContain('Pass projectPath explicitly');
    });

    it('uses the resolved project binding for status action when args.projectPath is not provided', async () => {
      const result = await approvalsHandler(
        {
          action: 'status',
          approvalId: 'test-id'
        },
        createContext('/test/project/from/context')
      );

      expect(result.success).toBe(false);
      expect(result.message).not.toContain('Pass projectPath explicitly');
    });

    it('fails with the canonical binding error when no project can be resolved', async () => {
      const result = await approvalsHandler(
        {
          action: 'request',
          title: 'Test approval',
          filePath: 'test.md',
          type: 'document',
          category: 'spec',
          categoryName: 'test-spec'
        },
        createContext(undefined)
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Pass projectPath explicitly');
    });

    it('does not report path translation errors for request action', async () => {
      const result = await approvalsHandler(
        {
          action: 'request',
          title: 'Test approval',
          filePath: 'test.md',
          type: 'document',
          category: 'spec',
          categoryName: 'test-spec'
        },
        createContext('/test/project/from/context')
      );

      expect(result.success).toBe(false);
      expect(result.message).not.toContain('PathUtils.translatePath is not a function');
      expect(result.message).not.toContain('PathUtils.translatePath is not available');
    });

    it('does not report path translation errors for status action', async () => {
      const result = await approvalsHandler(
        {
          action: 'status',
          approvalId: 'test-id'
        },
        createContext('/test/project/from/context')
      );

      expect(result.success).toBe(false);
      expect(result.message).not.toContain('PathUtils.translatePath is not a function');
      expect(result.message).not.toContain('PathUtils.translatePath is not available');
    });

    it('does not report path translation errors for delete action', async () => {
      const result = await approvalsHandler(
        {
          action: 'delete',
          approvalId: 'test-id'
        },
        createContext('/test/project/from/context')
      );

      expect(result.success).toBe(false);
      expect(result.message).not.toContain('PathUtils.translatePath is not a function');
      expect(result.message).not.toContain('PathUtils.translatePath is not available');
    });

    it('blocks approval request for markdown with MDX-incompatible content', async () => {
      const tempProject = await createTempProject('specwf-mdx-');
      const relativePath = '.spec-workflow/specs/test-spec/requirements.md';
      const absolutePath = join(tempProject, relativePath);

      try {
        await mkdir(dirname(absolutePath), { recursive: true });
        await writeFile(absolutePath, '# Test\\n\\n- Threshold: <5%\\n', 'utf-8');

        const result = await approvalsHandler(
          {
            action: 'request',
            title: 'Review requirements',
            filePath: relativePath,
            type: 'document',
            category: 'spec',
            categoryName: 'test-spec'
          },
          createContext(tempProject)
        );

        expect(result.success).toBe(false);
        expect(result.message).toContain('MDX compatibility errors');
        expect(result.nextSteps?.some(step => step.includes('mdx-compile-error'))).toBe(true);
      } finally {
        await rm(tempProject, { recursive: true, force: true });
      }
    });

    it('blocks approval request for tasks markdown with MDX-incompatible content', async () => {
      const tempProject = await createTempProject('specwf-mdx-tasks-');
      const relativePath = '.spec-workflow/specs/test-spec/tasks.md';
      const absolutePath = join(tempProject, relativePath);

      try {
        await mkdir(dirname(absolutePath), { recursive: true });
        await writeFile(absolutePath, '# Tasks\\n\\n- [ ] 1. Check threshold <5%\\n', 'utf-8');

        const result = await approvalsHandler(
          {
            action: 'request',
            title: 'Review tasks',
            filePath: relativePath,
            type: 'document',
            category: 'spec',
            categoryName: 'test-spec'
          },
          createContext(tempProject)
        );

        expect(result.success).toBe(false);
        expect(result.message).toContain('MDX compatibility errors');
        expect(result.nextSteps?.some(step => step.includes('mdx-compile-error'))).toBe(true);
      } finally {
        await rm(tempProject, { recursive: true, force: true });
      }
    });

    it('stores approvals in the selected worktree workflow root in no-shared mode', async () => {
      const tempRoot = join(homedir(), '.tmp-test-approvals');
      await mkdir(tempRoot, { recursive: true });
      const pairRoot = await mkdtemp(join(tempRoot, 'specwf-worktree-'));
      const mainRepo = join(pairRoot, 'repo-main');
      const worktree = join(pairRoot, 'repo-wt-a');
      const relativePath = '.spec-workflow/specs/test-spec/requirements.md';
      const absolutePath = join(worktree, relativePath);

      try {
        await mkdir(mainRepo, { recursive: true });
        await mkdir(dirname(absolutePath), { recursive: true });
        await writeFile(absolutePath, '# Requirements\n', 'utf-8');

        const result = await approvalsHandler(
          {
            action: 'request',
            projectPath: worktree,
            title: 'Review worktree requirements',
            filePath: relativePath,
            type: 'document',
            category: 'spec',
            categoryName: 'test-spec'
          },
          createContext(mainRepo, { noSharedWorktreeSpecs: true }, async (projectPath?: string) => {
            const selectedPath = projectPath || mainRepo;
            return createBoundProject(selectedPath, {
              workflowRootPath: selectedPath,
              translatedWorkflowRootPath: selectedPath,
              noSharedWorktreeSpecs: true,
              source: projectPath ? 'explicit-arg' : 'startup-binding'
            });
          })
        );

        expect(result.success).toBe(true);
        expect(result.projectContext?.projectPath).toBe(worktree);
        expect(result.projectContext?.workflowRoot).toBe(join(worktree, '.spec-workflow'));

        const approvalFiles = (await readdir(join(worktree, '.spec-workflow', 'approvals', 'test-spec')))
          .filter(fileName => fileName.endsWith('.json'));
        expect(approvalFiles).toHaveLength(1);
      } finally {
        await rm(pairRoot, { recursive: true, force: true });
      }
    });
  });
});
