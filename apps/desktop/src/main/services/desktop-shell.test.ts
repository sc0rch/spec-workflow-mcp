// @vitest-environment node

import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => [])
  },
  app: {
    quit: vi.fn()
  },
  dialog: {
    showOpenDialog: vi.fn()
  },
  ipcMain: {
    handle: vi.fn(),
    removeHandler: vi.fn()
  }
}));

import { DesktopShell } from './desktop-shell.js';

describe('DesktopShell refresh handling', () => {
  let storageRoot: string;

  beforeEach(async () => {
    storageRoot = await mkdtemp(join(tmpdir(), 'spec-workflow-desktop-shell-'));
  });

  afterEach(async () => {
    vi.useRealTimers();
    await rm(storageRoot, { recursive: true, force: true });
  });

  it('swallows refresh snapshot failures and clears the reentrancy flag', async () => {
    const shell = new DesktopShell({
      storageRoot,
      runtimeInfo: createRuntimeInfo()
    });
    const shellAccess = shell as unknown as {
      projectCatalog: {
        cleanupStaleProjects: ReturnType<typeof vi.fn>;
      };
      refreshProjectCatalog: ReturnType<typeof vi.fn>;
      refreshProjectCatalogSnapshot: () => Promise<void>;
      isRefreshingProjects: boolean;
    };
    const refreshError = new Error('catalog exploded');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    shellAccess.projectCatalog = {
      cleanupStaleProjects: vi.fn().mockRejectedValue(refreshError)
    };
    shellAccess.refreshProjectCatalog = vi.fn();

    await expect(shellAccess.refreshProjectCatalogSnapshot()).resolves.toBeUndefined();

    expect(shellAccess.refreshProjectCatalog).not.toHaveBeenCalled();
    expect(shellAccess.isRefreshingProjects).toBe(false);
    expect(consoleError).toHaveBeenCalledWith(
      '[DesktopShell] Failed to refresh project catalog snapshot:',
      refreshError
    );

    consoleError.mockRestore();
  });

  it('starts and stops the periodic refresh loop cleanly', async () => {
    vi.useFakeTimers();

    const shell = new DesktopShell({
      storageRoot,
      runtimeInfo: createRuntimeInfo()
    });
    const shellAccess = shell as unknown as {
      refreshProjectCatalogSnapshot: ReturnType<typeof vi.fn>;
      mcpBridge: {
        stop: ReturnType<typeof vi.fn>;
      };
      startProjectRefreshLoop: () => void;
    };
    const refreshProjectCatalogSnapshot = vi.fn().mockResolvedValue(undefined);
    const stopBridge = vi.fn().mockResolvedValue(undefined);

    shellAccess.refreshProjectCatalogSnapshot = refreshProjectCatalogSnapshot;
    shellAccess.mcpBridge = {
      stop: stopBridge
    };

    shellAccess.startProjectRefreshLoop();
    await vi.advanceTimersByTimeAsync(4_000);

    expect(refreshProjectCatalogSnapshot).toHaveBeenCalledTimes(2);

    shell.dispose();
    await vi.advanceTimersByTimeAsync(4_000);

    expect(refreshProjectCatalogSnapshot).toHaveBeenCalledTimes(2);
    expect(stopBridge).toHaveBeenCalledTimes(1);
  });

  it('returns early when a refresh is already in progress', async () => {
    const shell = new DesktopShell({
      storageRoot,
      runtimeInfo: createRuntimeInfo()
    });
    const shellAccess = shell as unknown as {
      isRefreshingProjects: boolean;
      projectCatalog: {
        cleanupStaleProjects: ReturnType<typeof vi.fn>;
      };
      refreshProjectCatalog: ReturnType<typeof vi.fn>;
      refreshProjectCatalogSnapshot: () => Promise<void>;
    };

    shellAccess.isRefreshingProjects = true;
    shellAccess.projectCatalog = {
      cleanupStaleProjects: vi.fn()
    };
    shellAccess.refreshProjectCatalog = vi.fn();

    await expect(shellAccess.refreshProjectCatalogSnapshot()).resolves.toBeUndefined();

    expect(shellAccess.projectCatalog.cleanupStaleProjects).not.toHaveBeenCalled();
    expect(shellAccess.refreshProjectCatalog).not.toHaveBeenCalled();
  });
});

function createRuntimeInfo() {
  return {
    channel: 'desktop' as const,
    isElectron: true,
    platform: 'darwin' as const,
    versions: {
      chrome: '140.0.0.0',
      electron: '41.0.2',
      node: '22.18.1'
    }
  };
}
