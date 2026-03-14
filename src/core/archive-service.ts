import { promises as fs } from 'fs';
import { join } from 'path';
import { PathUtils } from './path-utils.js';

export class SpecArchiveService {
  private projectPath: string;
  private static readonly IGNORE_EMPTY_DIR_ENTRIES = new Set([
    '.DS_Store',
    '.gitkeep',
    'Thumbs.db',
    'desktop.ini',
  ]);
  private static readonly ARCHIVE_LOGS_DIR_NAME = 'Implementation Logs';

  constructor(projectPath: string) {
    // Path should already be translated by caller (ProjectManager)
    this.projectPath = projectPath;
  }

  private static isIgnorableName(name: string): boolean {
    if (this.IGNORE_EMPTY_DIR_ENTRIES.has(name)) return true;
    if (name.startsWith('._')) return true; // AppleDouble
    return false;
  }

  private async isEffectivelyEmptyDirectory(dirPath: string): Promise<boolean> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const name = entry.name;
        if (SpecArchiveService.isIgnorableName(name)) continue;

        if (entry.isDirectory()) {
          const isEmpty = await this.isEffectivelyEmptyDirectory(join(dirPath, name));
          if (isEmpty) continue;
          return false;
        }

        // files / symlinks / others are meaningful
        return false;
      }
      return true;
    } catch (error: any) {
      if (error?.code === 'ENOENT') return true;
      return false;
    }
  }

  private async canOverwriteArchiveDirectory(archiveSpecPath: string): Promise<boolean> {
    const entries = await fs.readdir(archiveSpecPath, { withFileTypes: true });

    for (const entry of entries) {
      const name = entry.name;
      if (SpecArchiveService.isIgnorableName(name)) continue;

      if (entry.isDirectory()) {
        // Allow leftover archive logs folder even if it has content.
        if (name === SpecArchiveService.ARCHIVE_LOGS_DIR_NAME) continue;

        const isEmpty = await this.isEffectivelyEmptyDirectory(join(archiveSpecPath, name));
        if (isEmpty) continue;
        return false;
      }

      return false;
    }

    return true;
  }

  private async preserveExistingArchiveLogs(archiveSpecPath: string, specName: string): Promise<string | null> {
    const logsPath = join(archiveSpecPath, SpecArchiveService.ARCHIVE_LOGS_DIR_NAME);
    try {
      const stats = await fs.stat(logsPath);
      if (!stats.isDirectory()) return null;
    } catch (error: any) {
      if (error?.code === 'ENOENT') return null;
      throw error;
    }

    const tempBase = PathUtils.getArchiveSpecsPath(this.projectPath);
    const tempPath = join(
      tempBase,
      `.tmp-${specName}-archive-logs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    );
    await fs.rename(logsPath, tempPath);
    return tempPath;
  }

  private async restorePreservedArchiveLogs(archiveSpecPath: string, preservedLogsPath: string): Promise<void> {
    const logsPath = join(archiveSpecPath, SpecArchiveService.ARCHIVE_LOGS_DIR_NAME);
    await fs.mkdir(logsPath, { recursive: true });

    // Put previous logs under a deterministic subfolder to avoid collisions.
    let dest = join(logsPath, 'previous');
    let counter = 2;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        await fs.stat(dest);
        dest = join(logsPath, `previous-${counter++}`);
      } catch (error: any) {
        if (error?.code === 'ENOENT') break;
        throw error;
      }
    }

    await fs.rename(preservedLogsPath, dest);
  }

  async archiveSpec(specName: string): Promise<void> {
    const activeSpecPath = PathUtils.getSpecPath(this.projectPath, specName);
    const archiveSpecPath = PathUtils.getArchiveSpecPath(this.projectPath, specName);
    let preservedLogsPath: string | null = null;

    // Verify the active spec exists
    try {
      await fs.access(activeSpecPath);
    } catch {
      throw new Error(`Spec '${specName}' not found in active specs`);
    }

    // Verify the archive destination doesn't already exist
    try {
      const stats = await fs.stat(archiveSpecPath);
      if (!stats.isDirectory()) {
        throw new Error(`Archive destination for '${specName}' exists and is not a directory`);
      }

      const canOverwrite = await this.canOverwriteArchiveDirectory(archiveSpecPath);
      if (!canOverwrite) {
        throw new Error(`Spec '${specName}' already exists in archive`);
      }

      preservedLogsPath = await this.preserveExistingArchiveLogs(archiveSpecPath, specName);

      // Allow overwriting an empty archive directory (e.g., left behind after git discard),
      // while preserving any leftover implementation logs.
      await fs.rm(archiveSpecPath, { recursive: true, force: true });
    } catch (error: any) {
      if (error?.code !== 'ENOENT') {
        throw error;
      }
    }

    try {
      // Ensure archive directory structure exists
      await fs.mkdir(PathUtils.getArchiveSpecsPath(this.projectPath), { recursive: true });
      
      // Move the entire spec directory to archive
      await fs.rename(activeSpecPath, archiveSpecPath);

      if (preservedLogsPath) {
        try {
          await this.restorePreservedArchiveLogs(archiveSpecPath, preservedLogsPath);
        } catch (error) {
          console.error('Failed to restore preserved archive logs:', error);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to archive spec '${specName}': ${errorMessage}`);
    }
  }

  async unarchiveSpec(specName: string): Promise<void> {
    const archiveSpecPath = PathUtils.getArchiveSpecPath(this.projectPath, specName);
    const activeSpecPath = PathUtils.getSpecPath(this.projectPath, specName);

    // Verify the archived spec exists
    try {
      await fs.access(archiveSpecPath);
    } catch {
      throw new Error(`Spec '${specName}' not found in archive`);
    }

    // Verify the active destination doesn't already exist
    try {
      await fs.access(activeSpecPath);
      throw new Error(`Spec '${specName}' already exists in active specs`);
    } catch (error) {
      if (error instanceof Error && (error as any).code !== 'ENOENT') {
        throw error;
      }
    }

    try {
      // Ensure active specs directory exists
      await fs.mkdir(PathUtils.getSpecPath(this.projectPath, ''), { recursive: true });
      
      // Move the entire spec directory back to active
      await fs.rename(archiveSpecPath, activeSpecPath);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to unarchive spec '${specName}': ${errorMessage}`);
    }
  }

  async isSpecActive(specName: string): Promise<boolean> {
    try {
      await fs.access(PathUtils.getSpecPath(this.projectPath, specName));
      return true;
    } catch {
      return false;
    }
  }

  async isSpecArchived(specName: string): Promise<boolean> {
    try {
      await fs.access(PathUtils.getArchiveSpecPath(this.projectPath, specName));
      return true;
    } catch {
      return false;
    }
  }

  async getSpecLocation(specName: string): Promise<'active' | 'archived' | 'not-found'> {
    const isActive = await this.isSpecActive(specName);
    if (isActive) return 'active';

    const isArchived = await this.isSpecArchived(specName);
    if (isArchived) return 'archived';

    return 'not-found';
  }
}