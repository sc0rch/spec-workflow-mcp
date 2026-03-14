import { _electron as electron, expect, test } from '@playwright/test';
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';
import { ApprovalStorage } from '../../../src/core/approval-storage.js';
import { SPEC_WORKFLOW_HOME_ENV } from '../../../src/core/global-dir.js';
import { ImplementationLogManager } from '../../../src/core/implementation-log-manager.js';
import { DESKTOP_STORAGE_ROOT_ENV } from '../src/main/storage-root.js';

const desktopEntryPath = join(process.cwd(), 'dist', 'apps', 'desktop', 'src', 'main', 'index.js');

test('adds a project through the desktop bridge and restores it after restart', async () => {
  const sandboxPath = await createSandboxPath();
  const globalStatePath = join(sandboxPath, 'global-state');
  const desktopStoragePath = join(sandboxPath, 'desktop-user-data');
  const workspacePath = join(sandboxPath, 'repo-recovery');
  await createWorkspaceFixture(workspacePath);

  const firstRun = await launchDesktop({
    globalStatePath,
    desktopStoragePath
  });

  try {
    const firstPage = await firstRun.firstWindow();
    await expect(firstPage.getByRole('heading', { name: 'Spec Workflow Desktop' })).toBeVisible();
    await firstPage.evaluate(async (projectPath) => {
      await window.desktop.rememberProjectPath(projectPath);
    }, workspacePath);
    await expect(firstPage.locator('.workspace-head h2')).toHaveText('repo-recovery');
    await expect(firstPage.locator('.project-list .badge-remembered')).toHaveText('Remembered');
    await expect(firstPage.getByText('1 approvals')).toBeVisible();
    await expect(firstPage.getByText('Desktop Rewrite · 3.4')).toBeVisible();
    await expect(firstPage.locator('.project-meta')).toHaveText(workspacePath);
  } finally {
    await firstRun.close();
  }

  const secondRun = await launchDesktop({
    globalStatePath,
    desktopStoragePath
  });

  try {
    const secondPage = await secondRun.firstWindow();
    await expect(secondPage.locator('.workspace-head h2')).toHaveText('repo-recovery');
    await expect(secondPage.getByText('1 approvals')).toBeVisible();
    await expect(secondPage.locator('.project-meta')).toHaveText(workspacePath);
  } finally {
    await secondRun.close();
    await rm(sandboxPath, { recursive: true, force: true });
  }
});

test('forgets a remembered project and keeps it hidden after restart', async () => {
  const sandboxPath = await createSandboxPath();
  const globalStatePath = join(sandboxPath, 'global-state');
  const desktopStoragePath = join(sandboxPath, 'desktop-user-data');
  const workspacePath = join(sandboxPath, 'repo-forget');
  await createWorkspaceFixture(workspacePath);

  const firstRun = await launchDesktop({
    globalStatePath,
    desktopStoragePath
  });

  try {
    const firstPage = await firstRun.firstWindow();
    await firstPage.evaluate(async (projectPath) => {
      await window.desktop.rememberProjectPath(projectPath);
    }, workspacePath);
    await expect(firstPage.locator('.workspace-head h2')).toHaveText('repo-forget');
    await firstPage.getByRole('button', { name: 'Forget project' }).click();
    await expect(firstPage.getByText(/no remembered projects yet/i)).toBeVisible();
  } finally {
    await firstRun.close();
  }

  const secondRun = await launchDesktop({
    globalStatePath,
    desktopStoragePath
  });

  try {
    const secondPage = await secondRun.firstWindow();
    await expect(secondPage.getByText(/no remembered projects yet/i)).toBeVisible();
  } finally {
    await secondRun.close();
    await rm(sandboxPath, { recursive: true, force: true });
  }
});

async function launchDesktop(options: {
  globalStatePath: string;
  desktopStoragePath: string;
}) {
  return electron.launch({
    args: [desktopEntryPath],
    env: {
      ...process.env,
      [SPEC_WORKFLOW_HOME_ENV]: options.globalStatePath,
      [DESKTOP_STORAGE_ROOT_ENV]: options.desktopStoragePath
    }
  });
}

async function createWorkspaceFixture(workspacePath: string): Promise<void> {
  const specPath = join(workspacePath, '.spec-workflow', 'specs', 'desktop-rewrite');
  await mkdir(specPath, { recursive: true });
  await mkdir(join(workspacePath, 'src'), { recursive: true });
  await writeFile(join(specPath, 'requirements.md'), '# Desktop Rewrite', 'utf-8');
  await writeFile(join(workspacePath, 'src', 'desktop.ts'), 'export const desktop = true;', 'utf-8');

  const approvalStorage = new ApprovalStorage(workspacePath, {
    fileResolutionPath: workspacePath
  });
  await approvalStorage.createApproval(
    'Review desktop shell',
    'src/desktop.ts',
    'spec',
    'desktop-rewrite'
  );

  const logManager = new ImplementationLogManager(specPath);
  await logManager.addLogEntry({
    taskId: '3.4',
    timestamp: '2026-03-14T12:30:00.000Z',
    summary: 'Added recovery-aware project home',
    filesModified: ['apps/desktop/src/renderer/App.tsx'],
    filesCreated: [],
    statistics: {
      linesAdded: 32,
      linesRemoved: 4,
      filesChanged: 1
    },
    artifacts: {}
  });
}

async function createSandboxPath(): Promise<string> {
  const basePath = join(homedir(), '.tmp-spec-workflow-desktop-e2e');
  await mkdir(basePath, { recursive: true });
  return mkdtemp(join(basePath, 'case-'));
}
