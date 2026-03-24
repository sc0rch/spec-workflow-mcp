import { execFile } from 'child_process';
import { mkdir, mkdtemp, writeFile, rm } from 'fs/promises';
import { homedir } from 'os';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { afterEach, describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const entrypointPath = join(repoRoot, 'src', 'index.ts');
const tsxPath = join(repoRoot, 'node_modules', '.bin', 'tsx');
const tempRoot = join(homedir(), '.spec-workflow-cli-entrypoint');

describe('CLI entrypoint', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((directory) => rm(directory, { recursive: true, force: true })));
  });

  it('prints machine-readable guide output', async () => {
    const result = await runCli(['guide', '--json']);
    expect(result.exitCode).toBe(0);
    const payload = JSON.parse(result.stdout) as { success: boolean; data: { guide: string } };
    expect(payload.success).toBe(true);
    expect(payload.data.guide).toContain('Spec Development Workflow');
  });

  it('binds spec-status to the current working directory when --project-path is omitted', async () => {
    const projectDir = await createProjectFixture();
    const result = await runCli(['spec-status', '--spec-name', 'demo-spec', '--json'], projectDir);

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      success: true,
      projectContext: {
        projectPath: projectDir
      },
      data: {
        name: 'demo-spec'
      }
    });
  });

  it('returns a non-zero exit code for unknown commands', async () => {
    const result = await runCli(['unknown-command']);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Unknown command: unknown-command');
  });

  async function createProjectFixture(): Promise<string> {
    await mkdir(tempRoot, { recursive: true });
    const projectDir = await mkdtemp(join(tempRoot, 'spec-workflow-entrypoint-'));
    tempDirs.push(projectDir);
    const specDir = join(projectDir, '.spec-workflow', 'specs', 'demo-spec');
    await mkdir(specDir, { recursive: true });
    await writeFile(
      join(specDir, 'requirements.md'),
      '# Requirements\n\nKeep entrypoint behavior predictable.\n',
      'utf-8'
    );
    await writeFile(
      join(specDir, 'design.md'),
      '# Design\n\nUse a compact CLI envelope.\n',
      'utf-8'
    );
    await writeFile(
      join(specDir, 'tasks.md'),
      '- [ ] 1.1 Verify cwd binding\n',
      'utf-8'
    );
    return projectDir;
  }
});

async function runCli(args: string[], cwd = repoRoot): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
}> {
  return new Promise((resolvePromise) => {
    execFile(
      tsxPath,
      [entrypointPath, ...args],
      {
        cwd,
        env: process.env
      },
      (error, stdout, stderr) => {
        resolvePromise({
          exitCode: error && typeof error.code === 'number' ? error.code : 0,
          stdout: stdout.trim(),
          stderr: stderr.trim()
        });
      }
    );
  });
}
