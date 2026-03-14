import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { SpecArchiveService } from '../archive-service.js';
import { PathUtils } from '../path-utils.js';

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

describe('SpecArchiveService', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `specwf-archive-svc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('overwrites an empty archive destination directory', async () => {
    const specName = 'my-spec';
    const activeSpecPath = PathUtils.getSpecPath(tempDir, specName);
    const archiveSpecPath = PathUtils.getArchiveSpecPath(tempDir, specName);

    await fs.mkdir(activeSpecPath, { recursive: true });
    await fs.writeFile(join(activeSpecPath, 'requirements.md'), '# Requirements', 'utf-8');

    // Simulate an empty directory left in archive with the same spec name
    await fs.mkdir(archiveSpecPath, { recursive: true });

    const service = new SpecArchiveService(tempDir);
    await service.archiveSpec(specName);

    expect(await pathExists(activeSpecPath)).toBe(false);
    expect(await pathExists(archiveSpecPath)).toBe(true);
    expect(await pathExists(join(archiveSpecPath, 'requirements.md'))).toBe(true);
  });

  it('overwrites an archive destination containing only Implementation Logs', async () => {
    const specName = 'my-spec';
    const activeSpecPath = PathUtils.getSpecPath(tempDir, specName);
    const archiveSpecPath = PathUtils.getArchiveSpecPath(tempDir, specName);

    await fs.mkdir(activeSpecPath, { recursive: true });
    await fs.writeFile(join(activeSpecPath, 'requirements.md'), '# Requirements', 'utf-8');

    await fs.mkdir(join(archiveSpecPath, 'Implementation Logs'), { recursive: true });

    const service = new SpecArchiveService(tempDir);
    await service.archiveSpec(specName);

    expect(await pathExists(activeSpecPath)).toBe(false);
    expect(await pathExists(join(archiveSpecPath, 'requirements.md'))).toBe(true);
  });

  it('treats .DS_Store-only archive directories as empty', async () => {
    const specName = 'my-spec';
    const activeSpecPath = PathUtils.getSpecPath(tempDir, specName);
    const archiveSpecPath = PathUtils.getArchiveSpecPath(tempDir, specName);

    await fs.mkdir(activeSpecPath, { recursive: true });
    await fs.writeFile(join(activeSpecPath, 'requirements.md'), '# Requirements', 'utf-8');

    await fs.mkdir(archiveSpecPath, { recursive: true });
    await fs.writeFile(join(archiveSpecPath, '.DS_Store'), 'x', 'utf-8');

    const service = new SpecArchiveService(tempDir);
    await service.archiveSpec(specName);

    expect(await pathExists(activeSpecPath)).toBe(false);
    expect(await pathExists(join(archiveSpecPath, 'requirements.md'))).toBe(true);
  });

  it('does not overwrite a non-empty archive destination directory', async () => {
    const specName = 'my-spec';
    const activeSpecPath = PathUtils.getSpecPath(tempDir, specName);
    const archiveSpecPath = PathUtils.getArchiveSpecPath(tempDir, specName);

    await fs.mkdir(activeSpecPath, { recursive: true });
    await fs.writeFile(join(activeSpecPath, 'requirements.md'), '# Requirements', 'utf-8');

    await fs.mkdir(archiveSpecPath, { recursive: true });
    await fs.writeFile(join(archiveSpecPath, 'notes.txt'), 'do not overwrite', 'utf-8');

    const service = new SpecArchiveService(tempDir);
    await expect(service.archiveSpec(specName)).rejects.toThrow('already exists in archive');
  });
});

