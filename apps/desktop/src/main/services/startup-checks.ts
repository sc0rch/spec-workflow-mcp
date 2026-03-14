import { execFile } from 'child_process';
import { access } from 'fs/promises';
import { promisify } from 'util';
import type { StartupIssue } from '../../shared/desktop-api.js';
import { ensureWritableStorage } from './storage-check.js';

const execFileAsync = promisify(execFile);

export interface StartupCheckOptions {
  readonly rendererEntryPath: string;
  readonly rendererUrl?: string | undefined;
  readonly storageRoot: string;
  readonly trayIconPath: string;
}

export interface StartupCheckDependencies {
  readonly ensureWritableStorage: (storageRoot: string) => Promise<void>;
  readonly isCommandAvailable: (command: string, args: string[]) => Promise<boolean>;
  readonly pathExists: (path: string) => Promise<boolean>;
}

const defaultDependencies: StartupCheckDependencies = {
  ensureWritableStorage,
  async isCommandAvailable(command, args) {
    try {
      await execFileAsync(command, args);
      return true;
    } catch {
      return false;
    }
  },
  async pathExists(path) {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  }
};

export async function runStartupChecks(
  options: StartupCheckOptions,
  dependencies: StartupCheckDependencies = defaultDependencies
): Promise<StartupIssue[]> {
  const issues: StartupIssue[] = [];

  try {
    await dependencies.ensureWritableStorage(options.storageRoot);
  } catch (error) {
    issues.push({
      code: 'storage-unwritable',
      severity: 'error',
      message: createIssueMessage('App storage is not writable.', error)
    });
  }

  if (!options.rendererUrl) {
    const rendererExists = await dependencies.pathExists(options.rendererEntryPath);
    if (!rendererExists) {
      issues.push({
        code: 'renderer-unavailable',
        severity: 'error',
        message: `Renderer bundle is missing at ${options.rendererEntryPath}. Run a desktop build before launching the packaged app.`
      });
    }
  }

  const trayIconExists = await dependencies.pathExists(options.trayIconPath);
  if (!trayIconExists) {
    issues.push({
      code: 'tray-icon-missing',
      severity: 'warning',
      message: `Tray icon is missing at ${options.trayIconPath}. The app can still run, but the tray menu will not be available.`
    });
  }

  const gitAvailable = await dependencies.isCommandAvailable('git', ['--version']);
  if (!gitAvailable) {
    issues.push({
      code: 'git-unavailable',
      severity: 'warning',
      message: 'Git is not available in PATH. Project and worktree features will remain limited until Git is installed.'
    });
  }

  return issues;
}

function createIssueMessage(prefix: string, error: unknown): string {
  if (error instanceof Error && error.message) {
    return `${prefix} ${error.message}`;
  }

  return prefix;
}
