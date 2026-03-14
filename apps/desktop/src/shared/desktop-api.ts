export interface DesktopRuntimeInfo {
  readonly channel: 'desktop';
  readonly isElectron: boolean;
  readonly platform: NodeJS.Platform | 'browser';
  readonly versions: {
    readonly chrome: string;
    readonly electron: string;
    readonly node: string;
  };
}

export type StartupIssueCode =
  | 'git-unavailable'
  | 'renderer-unavailable'
  | 'storage-unwritable'
  | 'tray-icon-missing';

export type StartupIssueSeverity = 'error' | 'warning';

export interface StartupIssue {
  readonly code: StartupIssueCode;
  readonly severity: StartupIssueSeverity;
  readonly message: string;
}

export interface ProjectSelectionResult {
  readonly canceled: boolean;
  readonly path: string | null;
}

export interface DesktopShellState {
  readonly runtime: DesktopRuntimeInfo;
  readonly selectedProjectPath: string | null;
  readonly lastSelectedAt: string | null;
  readonly storagePath: string;
  readonly statusLabel: string;
  readonly issues: StartupIssue[];
}

export interface DesktopApi {
  getRuntimeInfo(): DesktopRuntimeInfo;
  getShellState(): Promise<DesktopShellState>;
  pickProjectDirectory(): Promise<ProjectSelectionResult>;
  onShellStateChanged(listener: (nextState: DesktopShellState) => void): () => void;
}

export const desktopChannels = {
  getShellState: 'desktop:get-shell-state',
  pickProjectDirectory: 'desktop:pick-project-directory',
  shellStateChanged: 'desktop:shell-state-changed'
} as const;
