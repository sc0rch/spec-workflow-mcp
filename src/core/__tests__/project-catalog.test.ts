import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { SPEC_WORKFLOW_HOME_ENV } from '../global-dir.js';
import { ProjectCatalogService } from '../project-catalog.js';
import { ProjectRegistry } from '../project-registry.js';
import { RememberedProjectsStore } from '../remembered-projects.js';
import {
  getCurrentGitBranch,
  resolveGitRoot,
  resolveGitWorkspaceRoot
} from '../git-utils.js';

vi.mock('../git-utils.js', async () => {
  const actual = await vi.importActual<typeof import('../git-utils.js')>('../git-utils.js');
  return {
    ...actual,
    getCurrentGitBranch: vi.fn(() => 'feature/demo'),
    resolveGitRoot: vi.fn((path: string) => path),
    resolveGitWorkspaceRoot: vi.fn((path: string) => path)
  };
});

const mockedGetCurrentGitBranch = vi.mocked(getCurrentGitBranch);
const mockedResolveGitRoot = vi.mocked(resolveGitRoot);
const mockedResolveGitWorkspaceRoot = vi.mocked(resolveGitWorkspaceRoot);

describe('ProjectCatalogService', () => {
  let tempDir: string;
  let stateDir: string;
  let registry: ProjectRegistry;
  let rememberedProjects: RememberedProjectsStore;
  let service: ProjectCatalogService;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    const baseDir = join(process.cwd(), '.tmp-project-catalog');
    await fs.mkdir(baseDir, { recursive: true });
    tempDir = join(baseDir, `case-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    stateDir = join(tempDir, '.state');
    await fs.mkdir(tempDir, { recursive: true });
    process.env[SPEC_WORKFLOW_HOME_ENV] = stateDir;

    mockedGetCurrentGitBranch.mockReturnValue('feature/demo');
    mockedResolveGitRoot.mockImplementation((path: string) => path);
    mockedResolveGitWorkspaceRoot.mockImplementation((path: string) => path);

    registry = new ProjectRegistry();
    rememberedProjects = new RememberedProjectsStore();
    service = new ProjectCatalogService({
      registry,
      rememberedProjects
    });
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('merges remembered and live projects into enriched catalog entries', async () => {
    const liveWorkspace = join(tempDir, 'repo-live');
    const rememberedWorkspace = join(tempDir, 'repo-remembered');
    await createSpecWorkspace(liveWorkspace, 'alpha-spec');
    await fs.mkdir(rememberedWorkspace, { recursive: true });

    await rememberedProjects.upsertProject(rememberedWorkspace, {
      workflowRootPath: rememberedWorkspace,
      projectName: 'repo-remembered',
      source: 'manual',
      seenAt: '2026-03-14T10:00:00.000Z'
    });
    await registry.registerProject(liveWorkspace, process.pid, {
      workflowRootPath: liveWorkspace,
      projectName: 'repo-live'
    });

    const projects = await service.getProjects();

    expect(projects).toHaveLength(2);
    expect(projects[0].projectName).toBe('repo-live');
    expect(projects[0].connectionState).toBe('live');
    expect(projects[0].instances).toHaveLength(1);
    expect(projects[0].latestSpec).toEqual(
      expect.objectContaining({
        name: 'alpha-spec',
        displayName: 'Alpha Spec'
      })
    );
    expect(projects[0].gitBranch).toBe('feature/demo');
    expect(projects[1].projectName).toBe('repo-remembered');
    expect(projects[1].connectionState).toBe('remembered');

    const storedProjects = await rememberedProjects.getAllProjects();
    expect(storedProjects).toHaveLength(2);
  });

  it('prefers workspace-local .spec-workflow roots when adding a project manually', async () => {
    const repoRootPath = join(tempDir, 'repo-root');
    const workspacePath = join(tempDir, 'worktrees', 'wt-a');
    await fs.mkdir(join(workspacePath, '.spec-workflow'), { recursive: true });
    await fs.mkdir(repoRootPath, { recursive: true });

    mockedResolveGitWorkspaceRoot.mockReturnValue(workspacePath);
    mockedResolveGitRoot.mockReturnValue(repoRootPath);

    const project = await service.addProjectByPath(workspacePath);

    expect(project.connectionState).toBe('remembered');
    expect(project.source).toBe('manual');
    expect(project.workflowRootPath).toBe(workspacePath);

    const storedProject = await rememberedProjects.getProjectById(project.projectId);
    expect(storedProject?.workflowRootPath).toBe(workspacePath);
  });

  it('keeps forgotten projects visible while a live MCP instance is still registered', async () => {
    const workspacePath = join(tempDir, 'repo-live');
    await createSpecWorkspace(workspacePath, 'beta-spec');

    const remembered = await rememberedProjects.upsertProject(workspacePath, {
      workflowRootPath: workspacePath,
      projectName: 'repo-live',
      source: 'manual'
    });
    await registry.registerProject(workspacePath, process.pid, {
      workflowRootPath: workspacePath,
      projectName: 'repo-live'
    });

    await service.forgetProjectById(remembered.projectId);

    const liveProjects = await service.getProjects();
    expect(liveProjects).toHaveLength(1);
    expect(liveProjects[0].connectionState).toBe('live');

    await registry.unregisterProject(workspacePath, process.pid);

    const afterDisconnect = await service.getProjects();
    expect(afterDisconnect).toEqual([]);
  });
});

async function createSpecWorkspace(workspacePath: string, specName: string): Promise<void> {
  const specDir = join(workspacePath, '.spec-workflow', 'specs', specName);
  await fs.mkdir(specDir, { recursive: true });
  await fs.writeFile(join(specDir, 'requirements.md'), '# Requirements', 'utf-8');
}
