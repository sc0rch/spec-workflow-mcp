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
  | 'bridge-unavailable'
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

export interface DesktopProjectSummary {
  readonly projectId: string;
  readonly projectName: string;
  readonly workspacePath: string;
  readonly workflowRootPath: string;
  readonly connectionState: 'live' | 'remembered';
  readonly source: 'manual' | 'mcp' | null;
  readonly addedAt: string | null;
  readonly lastSeenAt: string | null;
  readonly gitBranch?: string | undefined;
  readonly latestSpec?: {
    readonly name: string;
    readonly displayName: string;
    readonly createdAt: string;
  } | undefined;
  readonly pendingApprovalCount: number;
  readonly latestImplementation?: {
    readonly taskId: string;
    readonly summary: string;
    readonly timestamp: string;
    readonly specName: string;
    readonly specDisplayName: string;
  } | undefined;
  readonly instanceCount: number;
}

export interface DesktopProjectWorkspace {
  readonly specs: Array<{
    readonly name: string;
    readonly displayName: string;
    readonly lastModified: string;
    readonly phaseState: 'requirements' | 'design' | 'ready' | 'active' | 'implemented';
    readonly phases: {
      readonly requirements: {
        readonly exists: boolean;
        readonly lastModified?: string | undefined;
        readonly content?: string | undefined;
      };
      readonly design: {
        readonly exists: boolean;
        readonly lastModified?: string | undefined;
        readonly content?: string | undefined;
      };
      readonly tasks: {
        readonly exists: boolean;
        readonly lastModified?: string | undefined;
        readonly content?: string | undefined;
      };
    };
    readonly taskSummary: {
      readonly total: number;
      readonly completed: number;
      readonly pending: number;
      readonly inProgress: number;
    };
    readonly pendingApprovalCount: number;
    readonly activeTask?: {
      readonly id: string;
      readonly description: string;
      readonly status: 'pending' | 'in-progress' | 'completed';
      readonly requirements?: string[] | undefined;
    } | undefined;
    readonly nextTask?: {
      readonly id: string;
      readonly description: string;
      readonly status: 'pending' | 'in-progress' | 'completed';
      readonly requirements?: string[] | undefined;
    } | undefined;
    readonly latestImplementation?: {
      readonly taskId: string;
      readonly summary: string;
      readonly timestamp: string;
    } | undefined;
    readonly implementationEntries: Array<{
      readonly id: string;
      readonly taskId: string;
      readonly summary: string;
      readonly timestamp: string;
      readonly filesModified: string[];
      readonly filesCreated: string[];
    }>;
  }>;
  readonly pendingApprovals: Array<{
    readonly approvalId: string;
    readonly title: string;
    readonly filePath: string;
    readonly type: 'document' | 'action';
    readonly category: 'spec' | 'steering';
    readonly categoryName: string;
    readonly createdAt: string;
  }>;
}

export interface ProjectSelectionResult {
  readonly canceled: boolean;
  readonly path: string | null;
}

export type DesktopSpecDocumentName = 'requirements' | 'design' | 'tasks';

export interface SaveSpecDocumentResult {
  readonly filePath: string;
  readonly savedAt: string;
}

export interface DesktopApprovalComment {
  readonly id?: string | undefined;
  readonly type: 'selection' | 'general';
  readonly comment: string;
  readonly timestamp: string;
  readonly selectedText?: string | undefined;
  readonly startOffset?: number | undefined;
  readonly endOffset?: number | undefined;
}

export interface DesktopApprovalReview {
  readonly approval: {
    readonly id: string;
    readonly title: string;
    readonly filePath: string;
    readonly type: 'document' | 'action';
    readonly status: 'pending' | 'approved' | 'rejected' | 'needs-revision';
    readonly createdAt: string;
    readonly respondedAt?: string | undefined;
    readonly response?: string | undefined;
    readonly comments?: DesktopApprovalComment[] | undefined;
    readonly category: 'spec' | 'steering';
    readonly categoryName: string;
  };
  readonly currentContent: string | null;
  readonly diff: {
    readonly additions: number;
    readonly deletions: number;
    readonly changes: number;
    readonly chunks: Array<{
      readonly oldStart: number;
      readonly oldLines: number;
      readonly newStart: number;
      readonly newLines: number;
      readonly lines: Array<{
        readonly type: 'add' | 'delete' | 'normal';
        readonly oldLineNumber?: number | undefined;
        readonly newLineNumber?: number | undefined;
        readonly content: string;
      }>;
    }>;
  } | null;
}

export interface DesktopShellState {
  readonly runtime: DesktopRuntimeInfo;
  readonly selectedProjectPath: string | null;
  readonly lastSelectedAt: string | null;
  readonly storagePath: string;
  readonly statusLabel: string;
  readonly issues: StartupIssue[];
  readonly projects: DesktopProjectSummary[];
}

export interface DesktopApi {
  getRuntimeInfo(): DesktopRuntimeInfo;
  getShellState(): Promise<DesktopShellState>;
  getProjectWorkspace(projectId: string): Promise<DesktopProjectWorkspace | null>;
  getApprovalReview(projectId: string, approvalId: string): Promise<DesktopApprovalReview | null>;
  saveSpecDocument(
    projectId: string,
    specName: string,
    document: DesktopSpecDocumentName,
    content: string
  ): Promise<SaveSpecDocumentResult>;
  respondToApproval(
    projectId: string,
    approvalId: string,
    action: 'approve' | 'reject' | 'needs-revision',
    response: string,
    comments?: DesktopApprovalComment[]
  ): Promise<void>;
  pickProjectDirectory(): Promise<ProjectSelectionResult>;
  rememberProjectPath(projectPath: string): Promise<void>;
  forgetProject(projectId: string): Promise<void>;
  onShellStateChanged(listener: (nextState: DesktopShellState) => void): () => void;
}

export const desktopChannels = {
  getShellState: 'desktop:get-shell-state',
  getProjectWorkspace: 'desktop:get-project-workspace',
  getApprovalReview: 'desktop:get-approval-review',
  saveSpecDocument: 'desktop:save-spec-document',
  respondToApproval: 'desktop:respond-to-approval',
  pickProjectDirectory: 'desktop:pick-project-directory',
  rememberProjectPath: 'desktop:remember-project-path',
  forgetProject: 'desktop:forget-project',
  shellStateChanged: 'desktop:shell-state-changed'
} as const;
