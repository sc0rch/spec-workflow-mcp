// @vitest-environment node

import { runStartupChecks } from './startup-checks.js';

describe('runStartupChecks', () => {
  it('returns no issues when storage, assets, and git are available', async () => {
    const issues = await runStartupChecks(
      {
        storageRoot: '/tmp/spec-workflow-desktop',
        rendererEntryPath: '/tmp/spec-workflow-desktop/renderer/index.html',
        trayIconPath: '/tmp/spec-workflow-desktop/assets/tray-icon.svg'
      },
      {
        ensureWritableStorage: async () => undefined,
        isCommandAvailable: async () => true,
        pathExists: async () => true
      }
    );

    expect(issues).toEqual([]);
  });

  it('reports storage and dependency problems deterministically', async () => {
    const issues = await runStartupChecks(
      {
        storageRoot: '/tmp/spec-workflow-desktop',
        rendererEntryPath: '/tmp/spec-workflow-desktop/renderer/index.html',
        trayIconPath: '/tmp/spec-workflow-desktop/assets/tray-icon.svg'
      },
      {
        ensureWritableStorage: async () => {
          throw new Error('permission denied');
        },
        isCommandAvailable: async () => false,
        pathExists: async (path) => !path.includes('renderer')
      }
    );

    expect(issues).toEqual([
      expect.objectContaining({
        code: 'storage-unwritable',
        severity: 'error'
      }),
      expect.objectContaining({
        code: 'renderer-unavailable',
        severity: 'error'
      }),
      expect.objectContaining({
        code: 'git-unavailable',
        severity: 'warning'
      })
    ]);
  });

  it('skips renderer bundle checks when a dev server URL is configured', async () => {
    const pathExists = vi.fn(async () => false);

    const issues = await runStartupChecks(
      {
        storageRoot: '/tmp/spec-workflow-desktop',
        rendererEntryPath: '/tmp/spec-workflow-desktop/renderer/index.html',
        rendererUrl: 'http://127.0.0.1:5174',
        trayIconPath: '/tmp/spec-workflow-desktop/assets/tray-icon.svg'
      },
      {
        ensureWritableStorage: async () => undefined,
        isCommandAvailable: async () => true,
        pathExists
      }
    );

    expect(issues).toEqual([
      expect.objectContaining({
        code: 'tray-icon-missing',
        severity: 'warning'
      })
    ]);
    expect(pathExists).toHaveBeenCalledTimes(1);
    expect(pathExists).toHaveBeenCalledWith('/tmp/spec-workflow-desktop/assets/tray-icon.svg');
  });
});
