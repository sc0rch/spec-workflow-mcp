import { app } from 'electron';
import type { DesktopRuntimeInfo } from '../shared/desktop-api.js';
import { DesktopShell } from './services/desktop-shell.js';
import { configureDesktopStorageRoot } from './storage-root.js';

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  const storageRoot = configureDesktopStorageRoot(app);
  const shell = new DesktopShell({
    rendererUrl: process.env.SPEC_WORKFLOW_DESKTOP_RENDERER_URL,
    runtimeInfo: createRuntimeInfo(),
    storageRoot
  });

  app.on('second-instance', () => {
    shell.focusWindow();
  });

  app.whenReady()
    .then(async () => {
      await shell.initialize();

      app.on('activate', () => {
        shell.focusWindow();
      });
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      app.quit();
    });

  app.on('before-quit', () => {
    shell.dispose();
  });

  app.on('window-all-closed', () => {
    // Keep the process alive so the tray can reopen the desktop shell.
  });
}

function createRuntimeInfo(): DesktopRuntimeInfo {
  return {
    channel: 'desktop',
    isElectron: true,
    platform: process.platform,
    versions: {
      chrome: process.versions.chrome,
      electron: process.versions.electron,
      node: process.versions.node
    }
  };
}
