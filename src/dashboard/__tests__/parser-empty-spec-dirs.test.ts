import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { SpecParser } from '../../core/parser.js';

describe('SpecParser ignores empty spec directories', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `specwf-parser-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('does not include empty active spec directories', async () => {
    await fs.mkdir(join(tempDir, '.spec-workflow', 'specs', 'empty-spec'), { recursive: true });
    await fs.mkdir(join(tempDir, '.spec-workflow', 'specs', 'real-spec'), { recursive: true });
    await fs.writeFile(join(tempDir, '.spec-workflow', 'specs', 'real-spec', 'requirements.md'), '# Requirements', 'utf-8');

    const parser = new SpecParser(tempDir);
    const specs = await parser.getAllSpecs();

    expect(specs.map(s => s.name).sort()).toEqual(['real-spec']);
  });

  it('does not include empty archived spec directories', async () => {
    await fs.mkdir(join(tempDir, '.spec-workflow', 'archive', 'specs', 'empty-archived'), { recursive: true });
    await fs.mkdir(join(tempDir, '.spec-workflow', 'archive', 'specs', 'real-archived'), { recursive: true });
    await fs.writeFile(join(tempDir, '.spec-workflow', 'archive', 'specs', 'real-archived', 'requirements.md'), '# Archived Requirements', 'utf-8');

    const parser = new SpecParser(tempDir);
    const archivedSpecs = await parser.getAllArchivedSpecs();

    expect(archivedSpecs.map(s => s.name).sort()).toEqual(['real-archived']);
  });

  it('does not treat a requirements.md directory as a spec document', async () => {
    await fs.mkdir(join(tempDir, '.spec-workflow', 'archive', 'specs', 'fake-doc-spec', 'requirements.md'), { recursive: true });
    await fs.mkdir(join(tempDir, '.spec-workflow', 'archive', 'specs', 'real-archived'), { recursive: true });
    await fs.writeFile(join(tempDir, '.spec-workflow', 'archive', 'specs', 'real-archived', 'requirements.md'), '# Archived Requirements', 'utf-8');

    const parser = new SpecParser(tempDir);
    const archivedSpecs = await parser.getAllArchivedSpecs();

    expect(archivedSpecs.map(s => s.name).sort()).toEqual(['real-archived']);
  });
});
