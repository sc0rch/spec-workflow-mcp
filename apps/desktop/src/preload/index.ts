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
  async getProjectWorkspace(projectId) {
    return ipcRenderer.invoke(desktopChannels.getProjectWorkspace, projectId);
  },
  async getApprovalReview(projectId, approvalId) {
    return ipcRenderer.invoke(desktopChannels.getApprovalReview, projectId, approvalId);
  },
  async saveSpecDocument(projectId, specName, document, content) {
    return ipcRenderer.invoke(desktopChannels.saveSpecDocument, projectId, specName, document, content);
  },
  async respondToApproval(projectId, approvalId, action, response) {
    return ipcRenderer.invoke(desktopChannels.respondToApproval, projectId, approvalId, action, response);
  },
  async pickProjectDirectory() {
    return ipcRenderer.invoke(desktopChannels.pickProjectDirectory);
  },
  async rememberProjectPath(projectPath) {
    await ipcRenderer.invoke(desktopChannels.rememberProjectPath, projectPath);
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
