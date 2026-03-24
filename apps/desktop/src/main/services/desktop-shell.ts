import { BrowserWindow, app, dialog, ipcMain } from 'electron';
import type { OpenDialogOptions } from 'electron';
import type {
  DesktopApprovalComment,
  DesktopApprovalDraftInput,
  DesktopProjectSummary,
  DesktopRuntimeInfo,
  DesktopSpecDocumentName,
  DesktopShellState,
  ProjectSelectionResult,
  StartupIssue,
  StartupIssueCode
} from '../../shared/desktop-api.js';
import { desktopChannels } from '../../shared/desktop-api.js';
import { ApprovalReviewService } from '../../../../../src/core/approval-review.js';
import { PathUtils } from '../../../../../src/core/path-utils.js';
import { ProjectWorkspaceService } from '../../../../../src/core/project-workspace.js';
import { SpecDocumentsService } from '../../../../../src/core/spec-documents.js';
import { getRendererEntryPath, getTrayIconPath } from '../runtime-paths.js';
import { createMainWindow } from '../window.js';
import { SettingsStore, type WindowState } from './settings-store.js';
import { DesktopProjectService } from './project-service.js';
import { runStartupChecks } from './startup-checks.js';
import { createTrayController, type TrayController } from './tray.js';

export interface DesktopShellOptions {
  readonly rendererUrl?: string | undefined;
  readonly runtimeInfo: DesktopRuntimeInfo;
  readonly storageRoot: string;
  readonly startHidden?: boolean;
}

export class DesktopShell {
  private static readonly PROJECT_REFRESH_INTERVAL_MS = 2_000;
  private readonly settingsStore: SettingsStore;
  private readonly projectService: DesktopProjectService;
  private readonly approvalReview: ApprovalReviewService;
  private readonly projectWorkspace: ProjectWorkspaceService;
  private readonly specDocuments: SpecDocumentsService;
  private mainWindow: BrowserWindow | null = null;
  private trayController: TrayController | null = null;
  private isIpcRegistered = false;
  private shellState: DesktopShellState;
  private refreshTimer: NodeJS.Timeout | null = null;
  private isRefreshingProjects = false;

  constructor(private readonly options: DesktopShellOptions) {
    this.settingsStore = new SettingsStore(options.storageRoot);
    this.projectService = new DesktopProjectService(options.storageRoot);
    this.approvalReview = new ApprovalReviewService();
    this.projectWorkspace = new ProjectWorkspaceService();
    this.specDocuments = new SpecDocumentsService();
    this.shellState = {
      runtime: options.runtimeInfo,
      selectedProjectPath: null,
      lastSelectedAt: null,
      storagePath: options.storageRoot,
      statusLabel: 'Status: Starting',
      issues: [],
      projects: []
    };
  }

  async initialize(): Promise<void> {
    const settings = await this.settingsStore.load();
    const issues = await runStartupChecks({
      storageRoot: this.options.storageRoot,
      rendererEntryPath: getRendererEntryPath(),
      rendererUrl: this.options.rendererUrl,
      trayIconPath: getTrayIconPath()
    });

    this.shellState = this.createShellState({
      selectedProjectPath: settings.lastSelectedProjectPath,
      lastSelectedAt: settings.lastSelectedAt,
      issues
    });

    this.registerIpcHandlers();
    this.trayController = this.createTrayIfAvailable();
    await this.refreshProjectCatalogSnapshot({
      selectedProjectPath: settings.lastSelectedProjectPath,
      lastSelectedAt: settings.lastSelectedAt
    });
    this.startProjectRefreshLoop();
    if (!this.options.startHidden) {
      this.mainWindow = this.createOrRestoreWindow(settings.window, false);
    }
    this.broadcastShellState();
  }

  focusWindow(): void {
    const window = this.mainWindow?.isDestroyed() ? null : this.mainWindow;
    if (!window) {
      this.mainWindow = this.createOrRestoreWindow(this.settingsStore.getSettings().window, false);
      return;
    }

    if (window.isMinimized()) {
      window.restore();
    }

    void this.refreshProjectCatalogSnapshot();
    window.show();
    window.focus();
  }

  dispose(): void {
    this.trayController?.destroy();
    this.trayController = null;
    this.stopProjectRefreshLoop();

    if (this.isIpcRegistered) {
      ipcMain.removeHandler(desktopChannels.getShellState);
      ipcMain.removeHandler(desktopChannels.getProjectWorkspace);
      ipcMain.removeHandler(desktopChannels.getApprovalReview);
      ipcMain.removeHandler(desktopChannels.saveApprovalDraft);
      ipcMain.removeHandler(desktopChannels.saveSpecDocument);
      ipcMain.removeHandler(desktopChannels.respondToApproval);
      ipcMain.removeHandler(desktopChannels.pickProjectDirectory);
      ipcMain.removeHandler(desktopChannels.rememberProjectPath);
      ipcMain.removeHandler(desktopChannels.forgetProject);
      this.isIpcRegistered = false;
    }
  }

  private registerIpcHandlers(): void {
    if (this.isIpcRegistered) {
      return;
    }

    ipcMain.handle(desktopChannels.getShellState, async () => {
      await this.refreshProjectCatalogSnapshot();
      return this.shellState;
    });
    ipcMain.handle(desktopChannels.getProjectWorkspace, async (_event, projectId: string) => {
      return this.getProjectWorkspace(projectId);
    });
    ipcMain.handle(desktopChannels.getApprovalReview, async (_event, projectId: string, approvalId: string) => {
      return this.getApprovalReview(projectId, approvalId);
    });
    ipcMain.handle(
      desktopChannels.saveApprovalDraft,
      async (_event, projectId: string, approvalId: string, draft: DesktopApprovalDraftInput | null) => {
        await this.saveApprovalDraft(projectId, approvalId, draft);
      }
    );
    ipcMain.handle(
      desktopChannels.saveSpecDocument,
      async (_event, projectId: string, specName: string, document: DesktopSpecDocumentName, content: string) => {
        return this.saveSpecDocument(projectId, specName, document, content);
      }
    );
    ipcMain.handle(
      desktopChannels.respondToApproval,
      async (
        _event,
        projectId: string,
        approvalId: string,
        action: 'approve' | 'reject' | 'needs-revision',
        response: string,
        comments?: DesktopApprovalComment[]
      ) => {
        await this.respondToApproval(projectId, approvalId, action, response, comments);
      }
    );
    ipcMain.handle(desktopChannels.pickProjectDirectory, async () => this.pickProjectDirectory());
    ipcMain.handle(desktopChannels.rememberProjectPath, async (_event, projectPath: string) => {
      await this.rememberProjectPath(projectPath);
    });
    ipcMain.handle(desktopChannels.forgetProject, async (_event, projectId: string) => {
      await this.forgetProject(projectId);
    });
    this.isIpcRegistered = true;
  }

  private createTrayIfAvailable(): TrayController | null {
    if (this.hasIssue('tray-icon-missing')) {
      return null;
    }

    try {
      const trayController = createTrayController({
        iconPath: getTrayIconPath(),
        onShowWindow: () => this.focusWindow(),
        onPickProject: async () => {
          await this.pickProjectDirectory();
        },
        onQuit: () => {
          app.quit();
        }
      });

      trayController.setStatusLabel(this.shellState.statusLabel);
      return trayController;
    } catch (error) {
      this.upsertIssue({
        code: 'tray-icon-missing',
        severity: 'warning',
        message: createTrayIssueMessage(error)
      });
      return null;
    }
  }

  private createOrRestoreWindow(initialState: WindowState, startHidden = this.options.startHidden ?? false): BrowserWindow {
    const window = createMainWindow({
      initialState,
      startHidden,
      rendererUrl: this.options.rendererUrl,
      onWindowStateChanged: async (windowState) => {
        await this.persistWindowState(windowState);
      }
    });

    window.on('closed', () => {
      if (this.mainWindow === window) {
        this.mainWindow = null;
      }
    });

    return window;
  }

  private async persistWindowState(windowState: WindowState): Promise<void> {
    try {
      await this.settingsStore.setWindowState(windowState);
      this.clearIssue('storage-unwritable');
    } catch (error) {
      this.upsertIssue({
        code: 'storage-unwritable',
        severity: 'error',
        message: createStorageIssueMessage(error)
      });
    }
  }

  private async pickProjectDirectory(): Promise<ProjectSelectionResult> {
    const dialogOptions: OpenDialogOptions = {
      title: 'Select project folder',
      buttonLabel: 'Use project',
      properties: ['openDirectory', 'createDirectory']
    };
    const selection = this.mainWindow
      ? await dialog.showOpenDialog(this.mainWindow, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);

    if (selection.canceled || selection.filePaths.length === 0) {
      return {
        canceled: true,
        path: null
      };
    }

    const selectedPath = selection.filePaths[0] ?? null;
    if (!selectedPath) {
      return {
        canceled: true,
        path: null
      };
    }

    await this.rememberProjectPath(selectedPath);
    this.focusWindow();

    return {
      canceled: false,
      path: selectedPath
    };
  }

  private async rememberProjectPath(projectPath: string): Promise<void> {
    const rememberedProject = await this.projectService.rememberProjectPath(projectPath);
    const selectedProjectPath = rememberedProject.workspacePath;
    this.updateShellState({
      selectedProjectPath,
      lastSelectedAt: new Date().toISOString()
    });

    try {
      await this.settingsStore.setLastSelectedProjectPath(selectedProjectPath);
      const settings = this.settingsStore.getSettings();
      await this.refreshProjectCatalog({
        selectedProjectPath: settings.lastSelectedProjectPath,
        lastSelectedAt: settings.lastSelectedAt
      });
      this.clearIssue('storage-unwritable');
    } catch (error) {
      this.upsertIssue({
        code: 'storage-unwritable',
        severity: 'error',
        message: createStorageIssueMessage(error)
      });
    }
  }

  private async forgetProject(projectId: string): Promise<void> {
    await this.projectService.forgetProject(projectId);

    const selectedProjectPath = this.shellState.selectedProjectPath;
    if (!selectedProjectPath) {
      await this.refreshProjectCatalog();
      return;
    }

    const remainingProjects = await this.projectService.getProjects();
    const selectedStillVisible = remainingProjects.some(
      (project) => project.workspacePath === selectedProjectPath
    );

    if (!selectedStillVisible) {
      await this.settingsStore.setLastSelectedProjectPath(null);
      await this.refreshProjectCatalog({
        selectedProjectPath: null,
        lastSelectedAt: null
      });
      return;
    }

    this.updateShellState({
      projects: remainingProjects.map(mapProjectSummary)
    });
  }

  private createShellState(
    overrides: Partial<Omit<DesktopShellState, 'runtime' | 'storagePath' | 'statusLabel'>>
  ): DesktopShellState {
    const nextState: DesktopShellState = {
      ...this.shellState,
      ...overrides,
      runtime: this.options.runtimeInfo,
      storagePath: this.options.storageRoot,
      statusLabel: ''
    };

    return {
      ...nextState,
      statusLabel: computeStatusLabel(nextState)
    };
  }

  private updateShellState(
    overrides: Partial<Omit<DesktopShellState, 'runtime' | 'storagePath' | 'statusLabel'>>
  ): void {
    const nextState = this.createShellState(overrides);
    if (JSON.stringify(nextState) === JSON.stringify(this.shellState)) {
      return;
    }

    this.shellState = nextState;
    this.trayController?.setStatusLabel(this.shellState.statusLabel);
    this.broadcastShellState();
  }

  private startProjectRefreshLoop(): void {
    if (this.refreshTimer) {
      return;
    }

    this.refreshTimer = setInterval(() => {
      void this.refreshProjectCatalogSnapshot();
    }, DesktopShell.PROJECT_REFRESH_INTERVAL_MS);
  }

  private stopProjectRefreshLoop(): void {
    if (!this.refreshTimer) {
      return;
    }

    clearInterval(this.refreshTimer);
    this.refreshTimer = null;
  }

  private async refreshProjectCatalogSnapshot(
    overrides: Partial<Pick<DesktopShellState, 'selectedProjectPath' | 'lastSelectedAt'>> = {}
  ): Promise<void> {
    if (this.isRefreshingProjects) {
      return;
    }

    this.isRefreshingProjects = true;
    try {
      await this.refreshProjectCatalog(overrides);
    } catch (error) {
      console.error('[DesktopShell] Failed to refresh project catalog snapshot:', error);
    } finally {
      this.isRefreshingProjects = false;
    }
  }

  private async refreshProjectCatalog(
    overrides: Partial<Pick<DesktopShellState, 'selectedProjectPath' | 'lastSelectedAt'>> = {}
  ): Promise<void> {
    const projects = await this.projectService.getProjects();
    const selectedProjectPath = overrides.selectedProjectPath ?? this.shellState.selectedProjectPath;
    const selectedStillVisible = selectedProjectPath
      ? projects.some((project) => project.workspacePath === selectedProjectPath)
      : false;

    this.updateShellState({
      selectedProjectPath: selectedStillVisible ? selectedProjectPath : null,
      lastSelectedAt: selectedStillVisible
        ? (overrides.lastSelectedAt ?? this.shellState.lastSelectedAt)
        : null,
      projects: projects.map(mapProjectSummary)
    });
  }

  private async getProjectWorkspace(projectId: string) {
    const project = await this.projectService.getProjectById(projectId);
    if (!project) {
      return null;
    }

    return this.projectWorkspace.getWorkspaceSnapshot({
      translatedWorkflowRootPath: PathUtils.translatePath(project.workflowRootPath),
      translatedWorkspacePath: PathUtils.translatePath(project.workspacePath)
    });
  }

  private async saveSpecDocument(
    projectId: string,
    specName: string,
    document: DesktopSpecDocumentName,
    content: string
  ) {
    const project = await this.projectService.getProjectById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const result = await this.specDocuments.saveDocument({
      workflowRootPath: PathUtils.translatePath(project.workflowRootPath),
      specName,
      document,
      content
    });

    await this.refreshProjectCatalog();
    return result;
  }

  private async getApprovalReview(projectId: string, approvalId: string) {
    const project = await this.projectService.getProjectById(projectId);
    if (!project) {
      return null;
    }

    return this.approvalReview.getApprovalReview(
      {
        translatedWorkflowRootPath: PathUtils.translatePath(project.workflowRootPath),
        translatedWorkspacePath: PathUtils.translatePath(project.workspacePath)
      },
      approvalId
    );
  }

  private async respondToApproval(
    projectId: string,
    approvalId: string,
    action: 'approve' | 'reject' | 'needs-revision',
    response: string,
    comments?: DesktopApprovalComment[]
  ) {
    const project = await this.projectService.getProjectById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    await this.approvalReview.respondToApproval(
      {
        translatedWorkflowRootPath: PathUtils.translatePath(project.workflowRootPath),
        translatedWorkspacePath: PathUtils.translatePath(project.workspacePath)
      },
      approvalId,
      action,
      response,
      undefined,
      comments
    );

    await this.refreshProjectCatalog();
  }

  private async saveApprovalDraft(
    projectId: string,
    approvalId: string,
    draft: DesktopApprovalDraftInput | null
  ) {
    const project = await this.projectService.getProjectById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    await this.approvalReview.saveApprovalDraft(
      {
        translatedWorkflowRootPath: PathUtils.translatePath(project.workflowRootPath),
        translatedWorkspacePath: PathUtils.translatePath(project.workspacePath)
      },
      approvalId,
      draft
    );
  }

  private broadcastShellState(): void {
    const windows = BrowserWindow.getAllWindows();
    for (const window of windows) {
      if (!window.isDestroyed()) {
        window.webContents.send(desktopChannels.shellStateChanged, this.shellState);
      }
    }
  }

  private hasIssue(code: StartupIssueCode): boolean {
    return this.shellState.issues.some((issue) => issue.code === code);
  }

  private clearIssue(code: StartupIssueCode): void {
    if (!this.hasIssue(code)) {
      return;
    }

    this.updateShellState({
      issues: this.shellState.issues.filter((issue) => issue.code !== code)
    });
  }

  private upsertIssue(issue: StartupIssue): void {
    const nextIssues = this.shellState.issues.filter((entry) => entry.code !== issue.code);
    nextIssues.push(issue);
    this.updateShellState({ issues: nextIssues });
  }
}

function computeStatusLabel(shellState: DesktopShellState): string {
  if (shellState.issues.some((issue) => issue.severity === 'error')) {
    return 'Status: Attention needed';
  }

  if (shellState.selectedProjectPath) {
    return 'Status: Project ready';
  }

  if (shellState.issues.length > 0) {
    return 'Status: Ready with warnings';
  }

  return 'Status: Ready';
}

function createStorageIssueMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return `Selected project could not be persisted. ${error.message}`;
  }

  return 'Selected project could not be persisted.';
}

function createTrayIssueMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return `Tray menu is unavailable. ${error.message}`;
  }

  return 'Tray menu is unavailable.';
}

function mapProjectSummary(
  project: Awaited<ReturnType<DesktopProjectService['getProjects']>>[number]
): DesktopProjectSummary {
  return {
    projectId: project.projectId,
    projectName: project.projectName,
    workspacePath: project.workspacePath,
    workflowRootPath: project.workflowRootPath,
    addedAt: project.addedAt,
    gitBranch: project.gitBranch,
    latestSpec: project.latestSpec,
    pendingApprovalCount: project.pendingApprovalCount,
    latestImplementation: project.latestImplementation
  };
}
