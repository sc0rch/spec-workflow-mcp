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
        displayName: 'Alpha Spec',
        lastModified: expect.any(String)
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

  it('prefers the most recently modified spec when choosing latest spec metadata', async () => {
    const workspacePath = join(tempDir, 'repo-latest');
    await createSpecWorkspace(workspacePath, 'older-spec');
    await createSpecWorkspace(workspacePath, 'newer-spec');

    await setSpecTimestamp(workspacePath, 'older-spec', '2026-03-14T09:00:00.000Z');
    await setSpecTimestamp(workspacePath, 'newer-spec', '2026-03-14T12:00:00.000Z');

    await registry.registerProject(workspacePath, process.pid, {
      workflowRootPath: workspacePath,
      projectName: 'repo-latest'
    });

    const [project] = await service.getProjects();

    expect(project?.latestSpec).toEqual(
      expect.objectContaining({
        name: 'newer-spec',
        displayName: 'Newer Spec'
      })
    );
  });

  it('refreshes remembered live-project metadata when the saved entry is stale', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-14T12:30:00.000Z'));

    const workspacePath = join(tempDir, 'repo-refresh');
    await createSpecWorkspace(workspacePath, 'refresh-spec');

    const remembered = await rememberedProjects.upsertProject(workspacePath, {
      workflowRootPath: workspacePath,
      projectName: 'repo-old-name',
      source: 'manual',
      seenAt: '2026-03-14T10:00:00.000Z'
    });
    await registry.registerProject(workspacePath, process.pid, {
      workflowRootPath: workspacePath,
      projectName: 'repo-refresh'
    });

    await service.getProjects();

    const storedProject = await rememberedProjects.getProjectById(remembered.projectId);
    expect(storedProject?.projectName).toBe('repo-refresh');
    expect(storedProject?.source).toBe('mcp');
    expect(storedProject?.lastSeenAt).toBe('2026-03-14T12:30:00.000Z');

    vi.useRealTimers();
  });

  it('does not keep rewriting remembered live-project metadata while it is still fresh', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-14T12:30:00.000Z'));

    const workspacePath = join(tempDir, 'repo-stable');
    await createSpecWorkspace(workspacePath, 'stable-spec');

    const remembered = await rememberedProjects.upsertProject(workspacePath, {
      workflowRootPath: workspacePath,
      projectName: 'repo-stable',
      source: 'mcp',
      seenAt: '2026-03-14T12:30:00.000Z'
    });
    await registry.registerProject(workspacePath, process.pid, {
      workflowRootPath: workspacePath,
      projectName: 'repo-stable'
    });

    vi.setSystemTime(new Date('2026-03-14T12:30:10.000Z'));
    await service.getProjects();

    const storedProject = await rememberedProjects.getProjectById(remembered.projectId);
    expect(storedProject?.lastSeenAt).toBe('2026-03-14T12:30:00.000Z');

    vi.useRealTimers();
  });

  it('falls back to createdAt when lastModified is missing', async () => {
    const latestSpec = await (service as unknown as {
      computeLatestSpec: (parser: {
        getAllSpecs: () => Promise<Array<{
          name: string;
          displayName: string;
          createdAt: string;
          lastModified?: string | undefined;
        }>>;
      }) => Promise<{
        name: string;
        displayName: string;
        createdAt: string;
        lastModified?: string | undefined;
      } | undefined>;
    }).computeLatestSpec({
      getAllSpecs: async () => [
        {
          name: 'older-spec',
          displayName: 'Older Spec',
          createdAt: '2026-03-14T09:00:00.000Z'
        },
        {
          name: 'newer-spec',
          displayName: 'Newer Spec',
          createdAt: '2026-03-14T12:00:00.000Z',
          lastModified: ''
        }
      ]
    });

    expect(latestSpec).toEqual(
      expect.objectContaining({
        name: 'newer-spec',
        displayName: 'Newer Spec',
        createdAt: '2026-03-14T12:00:00.000Z'
      })
    );
  });
});

async function createSpecWorkspace(workspacePath: string, specName: string): Promise<void> {
  const specDir = join(workspacePath, '.spec-workflow', 'specs', specName);
  await fs.mkdir(specDir, { recursive: true });
  await fs.writeFile(join(specDir, 'requirements.md'), '# Requirements', 'utf-8');
}

async function setSpecTimestamp(workspacePath: string, specName: string, isoTimestamp: string): Promise<void> {
  const specDir = join(workspacePath, '.spec-workflow', 'specs', specName);
  const timestamp = new Date(isoTimestamp);
  await fs.utimes(specDir, timestamp, timestamp);
  await fs.utimes(join(specDir, 'requirements.md'), timestamp, timestamp);
}
