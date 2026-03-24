import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { SpecDocumentsService } from '../spec-documents.js';

describe('SpecDocumentsService', () => {
  let tempDir: string;
  let workflowRootPath: string;
  let service: SpecDocumentsService;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(tmpdir(), 'spec-workflow-spec-documents-'));
    workflowRootPath = join(tempDir, 'repo-main');
    await fs.mkdir(workflowRootPath, { recursive: true });
    service = new SpecDocumentsService();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('creates the spec directory and saves markdown content', async () => {
    const result = await service.saveDocument({
      workflowRootPath,
      specName: 'desktop-rewrite',
      document: 'requirements',
      content: '# Requirements\n\nDesktop shell rewrite'
    });

    expect(result.filePath).toContain(
      join('repo-main', '.spec-workflow', 'specs', 'desktop-rewrite', 'requirements.md')
    );
    expect(result.savedAt).toMatch(/^20/);
    expect(
      await fs.readFile(
        join(workflowRootPath, '.spec-workflow', 'specs', 'desktop-rewrite', 'requirements.md'),
        'utf-8'
      )
    ).toBe('# Requirements\n\nDesktop shell rewrite');
  });

  it('rejects unsupported document names', async () => {
    await expect(
      service.saveDocument({
        workflowRootPath,
        specName: 'desktop-rewrite',
        document: 'notes' as 'requirements',
        content: '# Invalid'
      })
    ).rejects.toThrow('Invalid spec document type');
  });
});
