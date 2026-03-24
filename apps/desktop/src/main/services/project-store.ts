import { mkdir, readFile, rename, writeFile } from 'fs/promises';
import { dirname, join, resolve } from 'path';
import { resolveGitWorkspaceRoot } from '../../../../../src/core/git-utils.js';
import { validateProjectPath } from '../../../../../src/core/path-utils.js';
import { generateProjectId } from '../../../../../src/core/project-metadata.js';

export interface DesktopStoredProject {
  readonly projectId: string;
  readonly workspacePath: string;
  readonly addedAt: string;
}

interface DesktopStoredProjectRecord {
  readonly workspacePath: string;
  readonly addedAt: string;
}

export class DesktopProjectStore {
  private readonly storePath: string;

  constructor(storageRoot: string) {
    this.storePath = join(storageRoot, 'desktop-projects.json');
  }

  async getProjects(): Promise<DesktopStoredProject[]> {
    const records = await this.readStore();
    return Array.from(records.entries())
      .map(([projectId, record]) => ({
        projectId,
        workspacePath: record.workspacePath,
        addedAt: record.addedAt
      }))
      .sort((left, right) => left.workspacePath.localeCompare(right.workspacePath));
  }

  async getProjectById(projectId: string): Promise<DesktopStoredProject | null> {
    const records = await this.readStore();
    const record = records.get(projectId);
    if (!record) {
      return null;
    }

    return {
      projectId,
      workspacePath: record.workspacePath,
      addedAt: record.addedAt
    };
  }

  async addProject(projectPath: string): Promise<DesktopStoredProject> {
    const requestedPath = await validateProjectPath(projectPath);
    const workspacePath = resolveGitWorkspaceRoot(requestedPath);
    const projectId = generateProjectId(workspacePath);
    const records = await this.readStore();
    const existing = records.get(projectId);
    const nextRecord: DesktopStoredProjectRecord = {
      workspacePath,
      addedAt: existing?.addedAt ?? new Date().toISOString()
    };

    records.set(projectId, nextRecord);
    await this.writeStore(records);

    return {
      projectId,
      workspacePath,
      addedAt: nextRecord.addedAt
    };
  }

  async removeProject(projectId: string): Promise<void> {
    const records = await this.readStore();
    if (!records.delete(projectId)) {
      return;
    }

    await this.writeStore(records);
  }

  getStorePath(): string {
    return this.storePath;
  }

  private async readStore(): Promise<Map<string, DesktopStoredProjectRecord>> {
    try {
      const raw = await readFile(this.storePath, 'utf-8');
      const parsed = JSON.parse(raw) as Record<string, Partial<DesktopStoredProjectRecord>>;
      const records = new Map<string, DesktopStoredProjectRecord>();

      for (const [projectId, record] of Object.entries(parsed)) {
        if (!record.workspacePath) {
          continue;
        }

        records.set(projectId, {
          workspacePath: resolve(record.workspacePath),
          addedAt: record.addedAt ?? new Date(0).toISOString()
        });
      }

      return records;
    } catch {
      return new Map();
    }
  }

  private async writeStore(records: Map<string, DesktopStoredProjectRecord>): Promise<void> {
    await mkdir(dirname(this.storePath), { recursive: true });
    const tempPath = `${this.storePath}.tmp`;
    await writeFile(tempPath, JSON.stringify(Object.fromEntries(records), null, 2), 'utf-8');
    await rename(tempPath, this.storePath);
  }
}
