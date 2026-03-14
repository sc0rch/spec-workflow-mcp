import { join, resolve } from 'path';
import { promises as fs } from 'fs';
import { generateProjectDisplayName, generateProjectId } from './project-registry.js';
import { getGlobalDir, getPermissionErrorHelp } from './global-dir.js';

export type RememberedProjectSource = 'manual' | 'mcp';

export interface RememberedProjectEntry {
  projectId: string;
  workspacePath: string;
  workflowRootPath: string;
  projectName: string;
  addedAt: string;
  lastSeenAt: string;
  source: RememberedProjectSource;
}

export interface UpsertRememberedProjectOptions {
  workflowRootPath?: string;
  projectName?: string;
  source: RememberedProjectSource;
  seenAt?: string;
}

interface RememberedProjectRecord {
  workspacePath: string;
  workflowRootPath: string;
  projectName: string;
  addedAt: string;
  lastSeenAt: string;
  source: RememberedProjectSource;
  hidden?: boolean;
}

export class RememberedProjectsStore {
  private readonly storeDir: string;
  private readonly storePath: string;

  constructor() {
    this.storeDir = getGlobalDir();
    this.storePath = join(this.storeDir, 'knownProjects.json');
  }

  private async ensureStoreDir(): Promise<void> {
    try {
      await fs.mkdir(this.storeDir, { recursive: true });
    } catch (error: any) {
      if (error.code === 'EEXIST') {
        return;
      }
      if (error.code === 'EACCES' || error.code === 'EPERM') {
        console.error(getPermissionErrorHelp('create directory', this.storeDir));
        throw error;
      }
      throw error;
    }
  }

  private async readStore(): Promise<Map<string, RememberedProjectRecord>> {
    await this.ensureStoreDir();

    try {
      const content = await fs.readFile(this.storePath, 'utf-8');
      const trimmedContent = content.trim();
      if (!trimmedContent) {
        return new Map();
      }

      const data = JSON.parse(trimmedContent) as Record<string, Partial<RememberedProjectRecord>>;
      const entries = new Map<string, RememberedProjectRecord>();

      for (const [projectId, record] of Object.entries(data)) {
        if (!record.workspacePath) {
          continue;
        }

        const workspacePath = resolve(record.workspacePath);
        const workflowRootPath = resolve(record.workflowRootPath || record.workspacePath);
        const addedAt = record.addedAt || new Date(0).toISOString();
        const lastSeenAt = record.lastSeenAt || addedAt;

        entries.set(projectId, {
          workspacePath,
          workflowRootPath,
          projectName: record.projectName || generateProjectDisplayName(workspacePath, workflowRootPath),
          addedAt,
          lastSeenAt,
          source: record.source === 'manual' ? 'manual' : 'mcp',
          hidden: !!record.hidden
        });
      }

      return entries;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return new Map();
      }
      if (error instanceof SyntaxError) {
        console.error(`[RememberedProjectsStore] Failed to parse ${this.storePath}: ${error.message}`);
        return new Map();
      }
      throw error;
    }
  }

  private async writeStore(store: Map<string, RememberedProjectRecord>): Promise<void> {
    await this.ensureStoreDir();

    const content = JSON.stringify(Object.fromEntries(store), null, 2);
    const tempPath = `${this.storePath}.tmp`;
    await fs.writeFile(tempPath, content, 'utf-8');
    await fs.rename(tempPath, this.storePath);
  }

  private toEntry(projectId: string, record: RememberedProjectRecord): RememberedProjectEntry {
    return {
      projectId,
      workspacePath: record.workspacePath,
      workflowRootPath: record.workflowRootPath,
      projectName: record.projectName,
      addedAt: record.addedAt,
      lastSeenAt: record.lastSeenAt,
      source: record.source
    };
  }

  async upsertProject(
    workspacePath: string,
    options: UpsertRememberedProjectOptions
  ): Promise<RememberedProjectEntry> {
    const store = await this.readStore();
    const normalizedWorkspacePath = resolve(workspacePath);
    const normalizedWorkflowRootPath = resolve(options.workflowRootPath || workspacePath);
    const projectId = generateProjectId(normalizedWorkspacePath);
    const timestamp = options.seenAt || new Date().toISOString();
    const existing = store.get(projectId);

    const nextRecord: RememberedProjectRecord = {
      workspacePath: normalizedWorkspacePath,
      workflowRootPath: normalizedWorkflowRootPath,
      projectName:
        options.projectName ||
        existing?.projectName ||
        generateProjectDisplayName(normalizedWorkspacePath, normalizedWorkflowRootPath),
      addedAt: existing?.addedAt || timestamp,
      lastSeenAt: timestamp,
      source: options.source,
      hidden: false
    };

    store.set(projectId, nextRecord);
    await this.writeStore(store);

    return this.toEntry(projectId, nextRecord);
  }

  async getAllProjects(): Promise<RememberedProjectEntry[]> {
    const store = await this.readStore();
    return Array.from(store.entries())
      .filter(([, record]) => !record.hidden)
      .map(([projectId, record]) => this.toEntry(projectId, record))
      .sort((a, b) => a.projectName.localeCompare(b.projectName));
  }

  async getProject(workspacePath: string): Promise<RememberedProjectEntry | null> {
    const normalizedWorkspacePath = resolve(workspacePath);
    const projectId = generateProjectId(normalizedWorkspacePath);
    return this.getProjectById(projectId);
  }

  async getProjectById(projectId: string): Promise<RememberedProjectEntry | null> {
    const store = await this.readStore();
    const record = store.get(projectId);
    if (!record) {
      return null;
    }
    return this.toEntry(projectId, record);
  }

  async removeProjectById(projectId: string): Promise<void> {
    const store = await this.readStore();
    const record = store.get(projectId);
    if (!record) {
      return;
    }
    record.hidden = true;
    store.set(projectId, record);
    await this.writeStore(store);
  }

  async getHiddenProjectIds(): Promise<Set<string>> {
    const store = await this.readStore();
    const hiddenProjectIds = new Set<string>();

    for (const [projectId, record] of store.entries()) {
      if (record.hidden) {
        hiddenProjectIds.add(projectId);
      }
    }

    return hiddenProjectIds;
  }

  getStorePath(): string {
    return this.storePath;
  }
}
