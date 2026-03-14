import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopApi } from '../shared/desktop-api.js';
import { desktopChannels } from '../shared/desktop-api.js';

const api: DesktopApi = {
  getRuntimeInfo() {
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
  },
  async getShellState() {
    return ipcRenderer.invoke(desktopChannels.getShellState);
  },
  async pickProjectDirectory() {
    return ipcRenderer.invoke(desktopChannels.pickProjectDirectory);
  },
  async forgetProject(projectId) {
    await ipcRenderer.invoke(desktopChannels.forgetProject, projectId);
  },
  onShellStateChanged(listener) {
    const handleShellStateChanged = (_event: Electron.IpcRendererEvent, nextState: Awaited<ReturnType<DesktopApi['getShellState']>>) => {
      listener(nextState);
    };

    ipcRenderer.on(desktopChannels.shellStateChanged, handleShellStateChanged);
    return () => {
      ipcRenderer.off(desktopChannels.shellStateChanged, handleShellStateChanged);
    };
  }
};

contextBridge.exposeInMainWorld('desktop', api);
