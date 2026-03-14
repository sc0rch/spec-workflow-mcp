import './styles.css';
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useState,
  type ReactNode
} from 'react';
import { CommandPalette, type CommandPaletteItem } from './CommandPalette.js';
import type {
  DesktopApprovalReview,
  DesktopSpecDocumentName,
  DesktopProjectWorkspace,
  DesktopRuntimeInfo,
  DesktopShellState,
  StartupIssue
} from '../shared/desktop-api.js';

type WorkMode = 'inbox' | 'workspace' | 'approvals';

type ProjectSummary = DesktopShellState['projects'][number];
type WorkspaceSpec = DesktopProjectWorkspace['specs'][number];
type DraftState = Record<string, Record<DesktopSpecDocumentName, string>>;
type SaveIndicator = {
  status: 'idle' | 'dirty' | 'saving' | 'saved' | 'error';
  message?: string | undefined;
  savedAt?: string | undefined;
};
type SaveStateMap = Record<string, Partial<Record<DesktopSpecDocumentName, SaveIndicator>>>;
type InboxItem = {
  id: string;
  kind: 'approval' | 'spec' | 'implementation';
  kindLabel: string;
  title: string;
  summary: string;
  meta: string;
  actionLabel: string;
  badgeClassName: string;
  onSelect: () => void;
};
type McpVisibility = {
  liveProjects: ProjectSummary[];
  rememberedProjects: ProjectSummary[];
  statusLabel: string;
  summaryLabel: string;
  badgeClassName: string;
};
type CommandItemContext = {
  shellState: DesktopShellState;
  activeProject: ProjectSummary | null;
  projectWorkspace: DesktopProjectWorkspace | null;
  activeSpec: WorkspaceSpec | null;
  activeMode: WorkMode;
  activeDocument: DesktopSpecDocumentName;
  isDiagnosticsOpen: boolean;
  onPickProject: () => Promise<void>;
  onToggleDiagnostics: () => void;
  onSelectProject: (workspacePath: string) => void;
  onSelectMode: (mode: WorkMode) => void;
  onSelectSpec: (specName: string) => void;
  onSelectDocument: (document: DesktopSpecDocumentName) => void;
  onSelectApproval: (approvalId: string) => void;
};

const workModes: Array<{ id: WorkMode; label: string; shortcut: string }> = [
  { id: 'inbox', label: 'Inbox', shortcut: '1' },
  { id: 'workspace', label: 'Workspace', shortcut: '2' },
  { id: 'approvals', label: 'Approvals', shortcut: '3' }
];

const documentTabs: Array<{
  id: DesktopSpecDocumentName;
  label: string;
  emptyLabel: string;
}> = [
  { id: 'requirements', label: 'Requirements', emptyLabel: 'No requirements.md yet.' },
  { id: 'design', label: 'Design', emptyLabel: 'No design.md yet.' },
  { id: 'tasks', label: 'Tasks', emptyLabel: 'No tasks.md yet.' }
];

function getRuntimeInfo(): DesktopRuntimeInfo {
  return window.desktop?.getRuntimeInfo() ?? {
    channel: 'desktop',
    isElectron: false,
    platform: 'browser',
    versions: {
      chrome: 'n/a',
      electron: 'n/a',
      node: 'n/a'
    }
  };
}

export function App() {
  const [shellState, setShellState] = useState<DesktopShellState>(() => createFallbackShellState());
  const [isHydrated, setIsHydrated] = useState<boolean>(() => !window.desktop);
  const [activeProjectPath, setActiveProjectPath] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<WorkMode>('inbox');
  const [projectWorkspace, setProjectWorkspace] = useState<DesktopProjectWorkspace | null>(null);
  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [activeSpecName, setActiveSpecName] = useState<string | null>(null);
  const [activeDocument, setActiveDocument] = useState<DesktopSpecDocumentName>('requirements');
  const [selectedApprovalId, setSelectedApprovalId] = useState<string | null>(null);
  const [specDrafts, setSpecDrafts] = useState<DraftState>({});
  const [documentSaveState, setDocumentSaveState] = useState<SaveStateMap>({});
  const [approvalReview, setApprovalReview] = useState<DesktopApprovalReview | null>(null);
  const [isLoadingApprovalReview, setIsLoadingApprovalReview] = useState(false);
  const [approvalReviewError, setApprovalReviewError] = useState<string | null>(null);
  const [approvalResponseDraft, setApprovalResponseDraft] = useState('');
  const [approvalActionState, setApprovalActionState] = useState<{
    status: 'idle' | 'saving' | 'saved' | 'error';
    message?: string | undefined;
  }>({ status: 'idle' });
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [paletteSelectionIndex, setPaletteSelectionIndex] = useState(0);
  const [isPickingProject, setIsPickingProject] = useState(false);
  const [forgettingProjectId, setForgettingProjectId] = useState<string | null>(null);
  const [bridgeError, setBridgeError] = useState<string | null>(null);

  const applyShellState = useEffectEvent((nextState: DesktopShellState) => {
    startTransition(() => {
      setShellState(nextState);
      setIsHydrated(true);
      setBridgeError(null);
    });
  });

  const selectAdjacentProject = useEffectEvent((offset: number) => {
    if (shellState.projects.length < 2) {
      return;
    }

    const currentIndex = shellState.projects.findIndex(
      (project) => project.workspacePath === activeProjectPath
    );
    const fallbackIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = (fallbackIndex + offset + shellState.projects.length) % shellState.projects.length;
    const nextProject = shellState.projects[nextIndex];

    if (nextProject) {
      setActiveProjectPath(nextProject.workspacePath);
    }
  });

  const selectAdjacentSpec = useEffectEvent((offset: number) => {
    if (activeMode !== 'workspace' || !projectWorkspace || projectWorkspace.specs.length < 2) {
      return;
    }

    const currentIndex = projectWorkspace.specs.findIndex((spec) => spec.name === activeSpecName);
    const fallbackIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = (fallbackIndex + offset + projectWorkspace.specs.length) % projectWorkspace.specs.length;
    const nextSpec = projectWorkspace.specs[nextIndex];

    if (nextSpec) {
      setActiveSpecName(nextSpec.name);
    }
  });

  const selectAdjacentApproval = useEffectEvent((offset: number) => {
    if (activeMode !== 'approvals' || !projectWorkspace || projectWorkspace.pendingApprovals.length < 2) {
      return;
    }

    const currentIndex = projectWorkspace.pendingApprovals.findIndex(
      (approval) => approval.approvalId === selectedApprovalId
    );
    const fallbackIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex =
      (fallbackIndex + offset + projectWorkspace.pendingApprovals.length) %
      projectWorkspace.pendingApprovals.length;
    const nextApproval = projectWorkspace.pendingApprovals[nextIndex];

    if (nextApproval) {
      setSelectedApprovalId(nextApproval.approvalId);
      if (nextApproval.category === 'spec') {
        setActiveSpecName(nextApproval.categoryName);
      }
    }
  });

  const selectAdjacentDocument = useEffectEvent((offset: number) => {
    if (activeMode !== 'workspace') {
      return;
    }

    const currentIndex = documentTabs.findIndex((document) => document.id === activeDocument);
    const fallbackIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = (fallbackIndex + offset + documentTabs.length) % documentTabs.length;
    const nextDocument = documentTabs[nextIndex];

    if (nextDocument) {
      setActiveDocument(nextDocument.id);
    }
  });

  useEffect(() => {
    if (!window.desktop) {
      return undefined;
    }

    let isDisposed = false;
    const unsubscribe = window.desktop.onShellStateChanged((nextState) => {
      if (!isDisposed) {
        applyShellState(nextState);
      }
    });

    void window.desktop.getShellState()
      .then((nextState) => {
        if (!isDisposed) {
          applyShellState(nextState);
        }
      })
      .catch((error) => {
        if (!isDisposed) {
          setIsHydrated(true);
          setBridgeError(error instanceof Error ? error.message : 'Desktop bridge request failed.');
        }
      });

    return () => {
      isDisposed = true;
      unsubscribe();
    };
  }, [applyShellState]);

  useEffect(() => {
    setActiveProjectPath((currentPath) => {
      if (currentPath && shellState.projects.some((project) => project.workspacePath === currentPath)) {
        return currentPath;
      }

      return shellState.selectedProjectPath ?? shellState.projects[0]?.workspacePath ?? null;
    });
  }, [shellState.projects, shellState.selectedProjectPath]);

  const activeProject = shellState.projects.find(
    (project) => project.workspacePath === activeProjectPath
  ) ?? null;

  useEffect(() => {
    if (!window.desktop || !activeProject) {
      setProjectWorkspace(null);
      setIsLoadingWorkspace(false);
      setWorkspaceError(null);
      return;
    }

    let isDisposed = false;
    setIsLoadingWorkspace(true);
    setWorkspaceError(null);

    void window.desktop.getProjectWorkspace(activeProject.projectId)
      .then((snapshot) => {
        if (!isDisposed) {
          setProjectWorkspace(snapshot);
          setIsLoadingWorkspace(false);
        }
      })
      .catch((error) => {
        if (!isDisposed) {
          setProjectWorkspace(null);
          setIsLoadingWorkspace(false);
          setWorkspaceError(
            error instanceof Error ? error.message : 'Project workspace could not be loaded.'
          );
        }
      });

    return () => {
      isDisposed = true;
    };
  }, [
    activeProject?.projectId,
    activeProject?.latestImplementation?.timestamp,
    activeProject?.latestSpec?.createdAt,
    activeProject?.pendingApprovalCount
  ]);

  useEffect(() => {
    setActiveSpecName((currentName) => {
      if (currentName && projectWorkspace?.specs.some((spec) => spec.name === currentName)) {
        return currentName;
      }

      return projectWorkspace?.specs[0]?.name ?? null;
    });
  }, [projectWorkspace]);

  useEffect(() => {
    setSelectedApprovalId((currentId) => {
      if (
        currentId &&
        projectWorkspace?.pendingApprovals.some((approval) => approval.approvalId === currentId)
      ) {
        return currentId;
      }

      return projectWorkspace?.pendingApprovals[0]?.approvalId ?? null;
    });
  }, [projectWorkspace]);

  useEffect(() => {
    if (!projectWorkspace) {
      setSpecDrafts({});
      setDocumentSaveState({});
      return;
    }

    setSpecDrafts(createDraftState(projectWorkspace));
  }, [projectWorkspace]);

  useEffect(() => {
    if (!window.desktop || !activeProject || !selectedApprovalId || activeMode !== 'approvals') {
      setApprovalReview(null);
      setApprovalReviewError(null);
      setIsLoadingApprovalReview(false);
      return;
    }

    let isDisposed = false;
    setIsLoadingApprovalReview(true);
    setApprovalReviewError(null);

    void window.desktop.getApprovalReview(activeProject.projectId, selectedApprovalId)
      .then((review) => {
        if (!isDisposed) {
          setApprovalReview(review);
          setApprovalResponseDraft(review?.approval.response ?? '');
          setApprovalActionState({ status: 'idle' });
          setIsLoadingApprovalReview(false);
        }
      })
      .catch((error) => {
        if (!isDisposed) {
          setApprovalReview(null);
          setApprovalReviewError(
            error instanceof Error ? error.message : 'Approval review could not be loaded.'
          );
          setIsLoadingApprovalReview(false);
        }
      });

    return () => {
      isDisposed = true;
    };
  }, [activeMode, activeProject?.projectId, selectedApprovalId]);

  const canPickProject = Boolean(window.desktop);
  const deferredPaletteQuery = useDeferredValue(paletteQuery);
  const activeSpec = activeSpecName && projectWorkspace
    ? projectWorkspace.specs.find((spec) => spec.name === activeSpecName) ?? null
    : null;
  const hasShellIssues = Boolean(bridgeError || workspaceError || shellState.issues.length > 0);
  const mcpVisibility = createMcpVisibility(shellState);
  const shellStatusLabel = (isHydrated ? shellState.statusLabel : 'Status: Loading shell')
    .replace(/^Status:\s*/, '');

  const toggleDiagnostics = useEffectEvent(() => {
    setIsDiagnosticsOpen((currentState) => !currentState);
  });

  const closeDiagnostics = useEffectEvent(() => {
    setIsDiagnosticsOpen(false);
  });

  const handlePickProject = async () => {
    if (!window.desktop) {
      return;
    }

    setIsPickingProject(true);
    try {
      await window.desktop.pickProjectDirectory();
    } catch (error) {
      setBridgeError(error instanceof Error ? error.message : 'Project picker failed.');
    } finally {
      setIsPickingProject(false);
    }
  };

  const handleForgetProject = async (projectId: string) => {
    if (!window.desktop) {
      return;
    }

    setForgettingProjectId(projectId);
    try {
      await window.desktop.forgetProject(projectId);
    } catch (error) {
      setBridgeError(error instanceof Error ? error.message : 'Forget project request failed.');
    } finally {
      setForgettingProjectId(null);
    }
  };

  const commandPaletteItems = filterCommandPaletteItems(
    createCommandPaletteItems({
      shellState,
      activeProject,
      projectWorkspace,
      activeSpec,
      activeMode,
      activeDocument,
      isDiagnosticsOpen,
      onPickProject: handlePickProject,
      onToggleDiagnostics: toggleDiagnostics,
      onSelectProject: (workspacePath) => {
        setActiveProjectPath(workspacePath);
      },
      onSelectMode: setActiveMode,
      onSelectSpec: (specName) => {
        setActiveSpecName(specName);
      },
      onSelectDocument: setActiveDocument,
      onSelectApproval: (approvalId) => {
        setSelectedApprovalId(approvalId);

        const approval = projectWorkspace?.pendingApprovals.find(
          (entry) => entry.approvalId === approvalId
        );
        if (approval?.category === 'spec') {
          setActiveSpecName(approval.categoryName);
        }
      }
    }),
    deferredPaletteQuery
  );

  const openPalette = useEffectEvent(() => {
    setIsPaletteOpen(true);
    setPaletteQuery('');
    setPaletteSelectionIndex(0);
  });

  const closePalette = useEffectEvent(() => {
    setIsPaletteOpen(false);
    setPaletteQuery('');
    setPaletteSelectionIndex(0);
  });

  const movePaletteSelection = useEffectEvent((offset: number) => {
    if (commandPaletteItems.length === 0) {
      setPaletteSelectionIndex(0);
      return;
    }

    setPaletteSelectionIndex((currentIndex) => {
      const nextIndex =
        (currentIndex + offset + commandPaletteItems.length) % commandPaletteItems.length;
      return nextIndex;
    });
  });

  const handleSelectPaletteItem = useEffectEvent(async (item: CommandPaletteItem) => {
    closePalette();

    try {
      await item.onSelect();
    } catch (error) {
      setBridgeError(error instanceof Error ? error.message : 'Command palette action failed.');
    }
  });

  useEffect(() => {
    if (!isPaletteOpen) {
      return;
    }

    setPaletteSelectionIndex(0);
  }, [isPaletteOpen, paletteQuery]);

  useEffect(() => {
    if (!isPaletteOpen) {
      return;
    }

    setPaletteSelectionIndex((currentIndex) => {
      if (commandPaletteItems.length === 0) {
        return 0;
      }

      return Math.min(currentIndex, commandPaletteItems.length - 1);
    });
  }, [commandPaletteItems.length, isPaletteOpen]);

  const handleDocumentChange = (
    specName: string,
    document: DesktopSpecDocumentName,
    content: string
  ) => {
    setSpecDrafts((currentDrafts) => ({
      ...currentDrafts,
      [specName]: {
        ...currentDrafts[specName],
        [document]: content
      }
    }));
    setDocumentSaveState((currentState) => ({
      ...currentState,
      [specName]: {
        ...currentState[specName],
        [document]: {
          status: 'dirty'
        }
      }
    }));
  };

  const handleSaveDocument = async (
    specName: string,
    document: DesktopSpecDocumentName
  ) => {
    if (!window.desktop || !activeProject) {
      return;
    }

    const content = specDrafts[specName]?.[document] ?? '';
    setDocumentSaveState((currentState) => ({
      ...currentState,
      [specName]: {
        ...currentState[specName],
        [document]: {
          status: 'saving'
        }
      }
    }));

    try {
      const result = await window.desktop.saveSpecDocument(
        activeProject.projectId,
        specName,
        document,
        content
      );
      const nextWorkspace = await window.desktop.getProjectWorkspace(activeProject.projectId);

      setDocumentSaveState((currentState) => ({
        ...currentState,
        [specName]: {
          ...currentState[specName],
          [document]: {
            status: 'saved',
            savedAt: result.savedAt,
            message: 'Saved'
          }
        }
      }));
      setWorkspaceError(null);
      setProjectWorkspace(nextWorkspace);
    } catch (error) {
      setDocumentSaveState((currentState) => ({
        ...currentState,
        [specName]: {
          ...currentState[specName],
          [document]: {
            status: 'error',
            message: error instanceof Error ? error.message : 'Save failed.'
          }
        }
      }));
    }
  };

  const handleApprovalAction = async (action: 'approve' | 'reject' | 'needs-revision') => {
    if (!window.desktop || !activeProject || !selectedApprovalId) {
      return;
    }

    setApprovalActionState({ status: 'saving' });

    try {
      await window.desktop.respondToApproval(
        activeProject.projectId,
        selectedApprovalId,
        action,
        approvalResponseDraft
      );
      const [nextShellState, nextWorkspace] = await Promise.all([
        window.desktop.getShellState(),
        window.desktop.getProjectWorkspace(activeProject.projectId)
      ]);
      if (!nextWorkspace) {
        throw new Error('Project workspace could not be reloaded after approval action.');
      }
      const nextPending = nextWorkspace.pendingApprovals[0] ?? null;
      const successMessage = action === 'approve'
        ? 'Approval marked as approved.'
        : action === 'reject'
          ? 'Approval marked as rejected.'
          : 'Revision requested.';

      applyShellState(nextShellState);
      setProjectWorkspace(nextWorkspace);
      if (nextPending) {
        setSelectedApprovalId(nextPending.approvalId);
        setApprovalResponseDraft('');
        if (nextPending.category === 'spec') {
          setActiveSpecName(nextPending.categoryName);
        }
      } else {
        setSelectedApprovalId(null);
        setApprovalResponseDraft('');
        setApprovalReview(null);
        setActiveMode('inbox');
      }
      setApprovalActionState({ status: 'saved', message: successMessage });
    } catch (error) {
      setApprovalActionState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Approval action failed.'
      });
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }

      const key = event.key.toLowerCase();
      const isModifierKey = event.metaKey || event.ctrlKey;

      if (isModifierKey && key === 'k') {
        event.preventDefault();
        if (isPaletteOpen) {
          closePalette();
        } else {
          openPalette();
        }
        return;
      }

    if (isPaletteOpen) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closePalette();
      }
      return;
    }

    if (isDiagnosticsOpen && event.key === 'Escape') {
      event.preventDefault();
      closeDiagnostics();
      return;
    }

    if (activeMode === 'approvals' && isModifierKey) {
      if (event.key === 'Enter') {
          event.preventDefault();
          void handleApprovalAction('approve');
          return;
        }

        if (event.shiftKey && key === 'r') {
          event.preventDefault();
          void handleApprovalAction('needs-revision');
          return;
        }

        if (event.shiftKey && key === 'x') {
          event.preventDefault();
          void handleApprovalAction('reject');
          return;
        }
      }

      if (isModifierKey && key === 's') {
        if (activeMode === 'workspace' && activeSpec) {
          event.preventDefault();
          void handleSaveDocument(activeSpec.name, activeDocument);
        }
        return;
      }

      if (event.key === 'Escape' && activeMode !== 'inbox') {
        event.preventDefault();
        setActiveMode('inbox');
        return;
      }

      if (isEditableTarget(event.target)) {
        return;
      }

      if (activeMode === 'workspace' && event.key === 'Tab') {
        event.preventDefault();
        selectAdjacentDocument(event.shiftKey ? -1 : 1);
        return;
      }

      if (key === 'j' || event.key === 'ArrowDown') {
        event.preventDefault();
        selectAdjacentProject(1);
        return;
      }

      if (key === 'k' || event.key === 'ArrowUp') {
        event.preventDefault();
        selectAdjacentProject(-1);
        return;
      }

      if (key === 'l' || event.key === 'ArrowRight') {
        event.preventDefault();
        if (activeMode === 'workspace') {
          selectAdjacentSpec(1);
        } else if (activeMode === 'approvals') {
          selectAdjacentApproval(1);
        }
        return;
      }

      if (key === 'h' || event.key === 'ArrowLeft') {
        event.preventDefault();
        if (activeMode === 'workspace') {
          selectAdjacentSpec(-1);
        } else if (activeMode === 'approvals') {
          selectAdjacentApproval(-1);
        }
        return;
      }

      const matchedMode = workModes.find((mode) => mode.shortcut === key);
      if (matchedMode) {
        event.preventDefault();
        setActiveMode(matchedMode.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    activeDocument,
    closeDiagnostics,
    activeMode,
    activeSpec,
    closePalette,
    handleApprovalAction,
    handleSaveDocument,
    isDiagnosticsOpen,
    isPaletteOpen,
    openPalette,
    selectAdjacentApproval,
    selectAdjacentDocument,
    selectAdjacentProject,
    selectAdjacentSpec
  ]);

  return (
    <main className="shell">
      <header className="shell-header">
        <div className="shell-brand">
          <h1>Spec Workflow Desktop</h1>
        </div>
        <div className="shell-header-actions">
          <div className="shell-utility-strip">
            <span className="status-pill">
              <span className="utility-label">Status</span>
              <strong className="utility-value">{shellStatusLabel}</strong>
            </span>
            <button
              aria-label={isDiagnosticsOpen ? 'Hide MCP status' : 'Open MCP status'}
              aria-pressed={isDiagnosticsOpen}
              className={`secondary-action shell-status-button ${isDiagnosticsOpen ? 'shell-status-button-active' : ''}`}
              onClick={() => {
                toggleDiagnostics();
              }}
              type="button"
            >
              <span className="utility-label">MCP</span>
              <span className="utility-value">{mcpVisibility.summaryLabel}</span>
            </button>
            <button
              className="secondary-action command-trigger"
              onClick={() => {
                openPalette();
              }}
              type="button"
            >
              <span className="utility-label">Palette</span>
              <kbd>⌘K</kbd>
            </button>
          </div>
          <button
            className="primary-action"
            disabled={!canPickProject || isPickingProject}
            onClick={() => {
              void handlePickProject();
            }}
            type="button"
          >
            {isPickingProject ? 'Opening folder picker...' : 'Add project'}
          </button>
        </div>
      </header>

      <section className="shell-frame">
        <aside className="left-rail">
          <article className="panel rail-projects">
            <div className="section-header">
              <h2>Projects</h2>
              <span className="section-meta">
                {shellState.projects.length > 0 ? `${shellState.projects.length} saved` : 'None'}
              </span>
            </div>
            {shellState.projects.length === 0 ? (
              <p className="panel-copy">
                No saved projects yet. Add a repo once and it stays recoverable after restart.
              </p>
            ) : (
              <div aria-label="Remembered projects" className="project-list" role="list">
                {shellState.projects.map((project) => {
                  const isSelected = activeProject?.projectId === project.projectId;

                  return (
                    <article
                      className={`project-card ${isSelected ? 'project-card-selected' : ''}`}
                      key={project.projectId}
                      role="listitem"
                    >
                      <div className="project-row">
                        <button
                          aria-pressed={isSelected}
                          className="project-select project-select-row"
                          onClick={() => {
                            setActiveProjectPath(project.workspacePath);
                          }}
                          type="button"
                        >
                          <span
                            aria-hidden="true"
                            className={`project-dot project-dot-${project.connectionState}`}
                          />
                          <h3>{project.projectName}</h3>
                          <div className="project-badges">
                            {project.pendingApprovalCount > 0 ? (
                              <span className="badge badge-warning">{project.pendingApprovalCount}</span>
                            ) : null}
                          </div>
                        </button>
                        <button
                          aria-label={`Forget ${project.projectName}`}
                          className="project-forget"
                          disabled={!window.desktop || forgettingProjectId === project.projectId}
                          onClick={() => {
                            void handleForgetProject(project.projectId);
                          }}
                          type="button"
                        >
                          {forgettingProjectId === project.projectId ? '…' : '×'}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </article>
        </aside>

        <section className="workspace">
          {hasShellIssues ? (
            <article className="panel workspace-issues">
              {bridgeError ? <p className="issue issue-error">{bridgeError}</p> : null}
              {workspaceError ? <p className="issue issue-error">{workspaceError}</p> : null}
              {shellState.issues.length > 0 ? (
                <ul className="issue-list">
                  {shellState.issues.map((issue) => (
                    <li className={`issue issue-${issue.severity}`} key={issue.code}>
                      <strong>{issue.severity === 'error' ? 'Error' : 'Warning'}:</strong> {issue.message}
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          ) : null}
          {isDiagnosticsOpen ? renderMcpDiagnosticsPanel(shellState, mcpVisibility, closeDiagnostics) : null}
          {activeProject ? (
            <>
              <div className="workspace-head">
                <h2>{activeProject.projectName}</h2>
                <div className="workspace-summary">
                  {activeProject.gitBranch ? (
                    <span className="badge badge-neutral">{activeProject.gitBranch}</span>
                  ) : null}
                  <span className={`badge badge-${activeProject.connectionState}`}>
                    {activeProject.connectionState === 'live' ? 'Live' : 'Remembered'}
                  </span>
                </div>
              </div>

              <nav aria-label="Work modes" className="mode-tabs">
                {workModes.map((mode) => (
                  <button
                    aria-pressed={activeMode === mode.id}
                    className={`mode-tab ${activeMode === mode.id ? 'mode-tab-active' : ''}`}
                    key={mode.id}
                    onClick={() => {
                      setActiveMode(mode.id);
                    }}
                    type="button"
                  >
                    <span>{mode.label}</span>
                    <kbd>{mode.shortcut}</kbd>
                  </button>
                ))}
              </nav>

              <div className="workspace-grid">
                {renderWorkspaceContent({
                  activeMode,
                  project: activeProject,
                  projectWorkspace,
                  isLoadingWorkspace,
                  workspaceError,
                  activeSpecName,
                  activeDocument,
                  selectedApprovalId,
                  specDrafts,
                  documentSaveState,
                  approvalReview,
                  isLoadingApprovalReview,
                  approvalReviewError,
                  approvalResponseDraft,
                  approvalActionState,
                  onChangeMode: setActiveMode,
                  onSelectSpec: setActiveSpecName,
                  onSelectDocument: setActiveDocument,
                  onSelectApproval: (approvalId) => {
                    setSelectedApprovalId(approvalId);

                    const approval = projectWorkspace?.pendingApprovals.find(
                      (entry) => entry.approvalId === approvalId
                    );
                    if (approval?.category === 'spec') {
                      setActiveSpecName(approval.categoryName);
                    }
                  },
                  onDocumentChange: handleDocumentChange,
                  onSaveDocument: handleSaveDocument,
                  onApprovalResponseChange: setApprovalResponseDraft,
                  onApprovalAction: handleApprovalAction
                })}
              </div>
            </>
          ) : (
            <article className="panel workspace-empty">
              <h2>No project selected</h2>
              <p className="panel-copy">Add a project to open its inbox, workspace, and approval queue.</p>
            </article>
          )}
        </section>
      </section>

      <CommandPalette
        isOpen={isPaletteOpen}
        items={commandPaletteItems}
        onClose={closePalette}
        onMoveSelection={movePaletteSelection}
        onQueryChange={setPaletteQuery}
        onSelectItem={(item) => {
          void handleSelectPaletteItem(item);
        }}
        query={paletteQuery}
        selectedIndex={paletteSelectionIndex}
      />
    </main>
  );
}

function renderWorkspaceContent(options: {
  activeMode: WorkMode;
  project: ProjectSummary;
  projectWorkspace: DesktopProjectWorkspace | null;
  isLoadingWorkspace: boolean;
  workspaceError: string | null;
  activeSpecName: string | null;
  activeDocument: DesktopSpecDocumentName;
  selectedApprovalId: string | null;
  specDrafts: DraftState;
  documentSaveState: SaveStateMap;
  approvalReview: DesktopApprovalReview | null;
  isLoadingApprovalReview: boolean;
  approvalReviewError: string | null;
  approvalResponseDraft: string;
  approvalActionState: {
    status: 'idle' | 'saving' | 'saved' | 'error';
    message?: string | undefined;
  };
  onChangeMode: (mode: WorkMode) => void;
  onSelectSpec: (specName: string) => void;
  onSelectDocument: (document: DesktopSpecDocumentName) => void;
  onSelectApproval: (approvalId: string) => void;
  onDocumentChange: (
    specName: string,
    document: DesktopSpecDocumentName,
    content: string
  ) => void;
  onSaveDocument: (specName: string, document: DesktopSpecDocumentName) => Promise<void>;
  onApprovalResponseChange: (value: string) => void;
  onApprovalAction: (action: 'approve' | 'reject' | 'needs-revision') => Promise<void>;
}): ReactNode {
  const {
    activeMode,
    project,
    projectWorkspace,
    isLoadingWorkspace,
    workspaceError,
    activeSpecName,
    activeDocument,
    selectedApprovalId,
    specDrafts,
    documentSaveState,
    approvalReview,
    isLoadingApprovalReview,
    approvalReviewError,
    approvalResponseDraft,
    approvalActionState,
    onChangeMode,
    onSelectSpec,
    onSelectDocument,
    onSelectApproval,
    onDocumentChange,
    onSaveDocument,
    onApprovalResponseChange,
    onApprovalAction
  } = options;

  if (isLoadingWorkspace) {
    return (
      <article className="panel workspace-card workspace-span-2">
        <h2>Loading workspace</h2>
        <p className="panel-copy">
          Reading spec files, approval queue, and implementation logs for {project.projectName}.
        </p>
      </article>
    );
  }

  if (workspaceError) {
    return (
      <article className="panel workspace-card workspace-span-2">
        <h2>Workspace unavailable</h2>
        <p className="issue issue-error">{workspaceError}</p>
      </article>
    );
  }

  if (!projectWorkspace) {
    return (
      <article className="panel workspace-card workspace-span-2">
        <h2>Workspace not loaded yet</h2>
        <p className="panel-copy">
          Select a project or reconnect the desktop bridge to load its spec workflow state.
        </p>
      </article>
    );
  }

  if (activeMode === 'workspace') {
    return renderWorkspaceMode(
      projectWorkspace,
      activeSpecName,
      activeDocument,
      specDrafts,
      documentSaveState,
      onSelectSpec,
      onSelectDocument,
      onDocumentChange,
      onSaveDocument
    );
  }

  if (activeMode === 'approvals') {
    return renderApprovalsMode(
      projectWorkspace,
      selectedApprovalId,
      approvalReview,
      isLoadingApprovalReview,
      approvalReviewError,
      approvalResponseDraft,
      approvalActionState,
      onSelectApproval,
      onApprovalResponseChange,
      onApprovalAction
    );
  }

  return renderInboxMode(
    projectWorkspace,
    onChangeMode,
    onSelectSpec,
    onSelectApproval
  );
}

function renderInboxMode(
  projectWorkspace: DesktopProjectWorkspace,
  onChangeMode: (mode: WorkMode) => void,
  onSelectSpec: (specName: string) => void,
  onSelectApproval: (approvalId: string) => void
): ReactNode {
  const activeSpecs = projectWorkspace.specs.filter((spec) => spec.phaseState === 'active');
  const recentImplementations = getRecentImplementationEntries(projectWorkspace);
  const actionableSpecs = [...projectWorkspace.specs]
    .filter((spec) => spec.phaseState !== 'implemented' || spec.pendingApprovalCount > 0)
    .sort((left, right) => {
      const leftWeight = left.phaseState === 'active' ? 2 : left.nextTask ? 1 : 0;
      const rightWeight = right.phaseState === 'active' ? 2 : right.nextTask ? 1 : 0;

      if (leftWeight !== rightWeight) {
        return rightWeight - leftWeight;
      }

      return Date.parse(right.lastModified) - Date.parse(left.lastModified);
    });

  const inboxItems: InboxItem[] = [
    ...projectWorkspace.pendingApprovals.slice(0, 5).map((approval) => ({
      id: approval.approvalId,
      kind: 'approval' as const,
      kindLabel: 'Approval',
      title: approval.title,
      summary: `${formatDisplayName(approval.categoryName)} · ${approval.filePath}`,
      meta: `${formatTimestamp(approval.createdAt, 'Unknown time')} · ${approval.type}`,
      actionLabel: 'Review',
      badgeClassName: approval.type === 'action' ? 'badge-warning' : 'badge-neutral',
      onSelect: () => {
        onSelectApproval(approval.approvalId);
        onChangeMode('approvals');
      }
    })),
    ...actionableSpecs.slice(0, 4).map((spec) => ({
      id: spec.name,
      kind: 'spec' as const,
      kindLabel: spec.phaseState === 'active' ? 'In progress' : 'Spec',
      title: spec.displayName,
      summary: spec.activeTask
        ? `${spec.activeTask.id} ${spec.activeTask.description}`
        : spec.nextTask
          ? `Next ${spec.nextTask.id} ${spec.nextTask.description}`
          : 'Open workspace',
      meta: `${formatPhaseState(spec.phaseState)} · ${spec.taskSummary.completed}/${spec.taskSummary.total || 0} complete · ${spec.pendingApprovalCount} approvals`,
      actionLabel: 'Edit',
      badgeClassName: `badge-phase-${spec.phaseState}`,
      onSelect: () => {
        onSelectSpec(spec.name);
        onChangeMode('workspace');
      }
    })),
    ...recentImplementations.slice(0, 3).map((entry) => ({
      id: entry.id,
      kind: 'implementation' as const,
      kindLabel: 'Recent log',
      title: `${entry.specDisplayName} · ${entry.taskId}`,
      summary: entry.summary,
      meta: `${formatTimestamp(entry.timestamp, 'Unknown timestamp')} · ${formatFileDelta(entry.filesModified, entry.filesCreated)}`,
      actionLabel: 'Inspect',
      badgeClassName: 'badge-neutral',
      onSelect: () => {
        onSelectSpec(entry.specName);
        onChangeMode('workspace');
      }
    }))
  ];
  const nextAction = inboxItems[0] ?? null;
  const visibleInboxItems = nextAction ? inboxItems.slice(1) : inboxItems;

  return (
    <article className="panel workspace-card workspace-span-2">
      <div className="section-header">
        <h2>Inbox</h2>
        <span className="section-meta">
          {projectWorkspace.pendingApprovals.length} approvals · {activeSpecs.length} active specs
        </span>
      </div>
      {nextAction ? (
        <div className="inbox-callout">
          <div>
            <p className="callout-prefix">Next</p>
            <strong className="callout-title">{nextAction.title}</strong>
            <p className="panel-copy">{nextAction.summary}</p>
          </div>
          <button
            className="primary-action"
            onClick={nextAction.onSelect}
            type="button"
          >
            {nextAction.actionLabel}
          </button>
        </div>
      ) : (
        <p className="panel-copy">
          No immediate queue items. This project is connected, but nothing is blocked or active yet.
        </p>
      )}

      {inboxItems.length === 0 ? (
        <p className="panel-copy">Inbox is clear.</p>
      ) : visibleInboxItems.length > 0 ? (
        <div aria-label="Inbox queue" className="inbox-list" role="list">
          {visibleInboxItems.map((item) => (
            <button
              className="queue-item"
              key={item.id}
              onClick={item.onSelect}
              type="button"
            >
              <div className="queue-item-header">
                <div className="queue-item-copy">
                  <div className="queue-item-title-row">
                    <span className="queue-item-kind">{item.kindLabel}</span>
                    <strong>{item.title}</strong>
                  </div>
                  <p className="stack-card-copy">{item.summary}</p>
                </div>
                <span className={`badge ${item.badgeClassName}`}>
                  {item.kind === 'approval' ? 'Pending' : item.kind === 'spec' ? 'Open' : 'Recent'}
                </span>
              </div>
              <div className="queue-item-footer">
                <span>{item.meta}</span>
                <span>{item.actionLabel}</span>
              </div>
            </button>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function renderWorkspaceMode(
  projectWorkspace: DesktopProjectWorkspace,
  activeSpecName: string | null,
  activeDocument: DesktopSpecDocumentName,
  specDrafts: DraftState,
  documentSaveState: SaveStateMap,
  onSelectSpec: (specName: string) => void,
  onSelectDocument: (document: DesktopSpecDocumentName) => void,
  onDocumentChange: (
    specName: string,
    document: DesktopSpecDocumentName,
    content: string
  ) => void,
  onSaveDocument: (specName: string, document: DesktopSpecDocumentName) => Promise<void>
): ReactNode {
  if (projectWorkspace.specs.length === 0) {
    return (
      <article className="panel workspace-card workspace-span-2">
        <h2>No specs yet</h2>
        <p className="panel-copy">
          This workspace is connected, but there are no spec documents in the current workflow root yet.
        </p>
      </article>
    );
  }

  const activeSpec = projectWorkspace.specs.find((spec) => spec.name === activeSpecName)
    ?? projectWorkspace.specs[0];
  const selectedDocument = documentTabs.find((document) => document.id === activeDocument)
    ?? documentTabs[0];
  const draft = specDrafts[activeSpec.name]?.[selectedDocument.id] ?? '';
  const saveState = documentSaveState[activeSpec.name]?.[selectedDocument.id] ?? { status: 'idle' as const };
  const hasContent = draft.trim().length > 0;

  return (
    <article className="panel workspace-card workspace-span-2 workspace-detail-card">
      <div className="section-header">
        <div>
          <h2>Spec workspace</h2>
        </div>
        <span className={`badge badge-phase-${activeSpec.phaseState}`}>{formatPhaseState(activeSpec.phaseState)}</span>
      </div>

      <div aria-label="Specs" className="spec-tabs" role="tablist">
        {projectWorkspace.specs.map((spec) => (
          <button
            aria-pressed={activeSpec?.name === spec.name}
            className={`spec-tab ${activeSpec?.name === spec.name ? 'spec-tab-active' : ''}`}
            key={spec.name}
            onClick={() => {
              onSelectSpec(spec.name);
            }}
            type="button"
          >
            <span>{spec.displayName}</span>
            <span className={`badge badge-phase-${spec.phaseState}`}>{formatPhaseState(spec.phaseState)}</span>
          </button>
        ))}
      </div>

      <p className="spec-meta">{formatSpecMeta(activeSpec)}</p>

      <div className="phase-stack">
        <section className="phase-card document-shell">
          <div aria-label="Spec documents" className="document-tabs" role="tablist">
            {documentTabs.map((document) => {
              const documentSave = documentSaveState[activeSpec.name]?.[document.id] ?? { status: 'idle' as const };
              const phase = activeSpec.phases[document.id];

              return (
                <button
                  aria-pressed={selectedDocument.id === document.id}
                  className={`spec-tab ${selectedDocument.id === document.id ? 'spec-tab-active' : ''}`}
                  key={document.id}
                  onClick={() => {
                    onSelectDocument(document.id);
                  }}
                  type="button"
                >
                  <span>{document.label}</span>
                  {documentSave.status === 'dirty' ? (
                    <span aria-hidden="true" className="dirty-dot" />
                  ) : !phase.exists ? (
                    <span className="document-tab-meta">Missing</span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="phase-header">
            <div>
              <h3>{selectedDocument.label}</h3>
              <p className="panel-copy">
                {getDocumentMeta(activeSpec, selectedDocument.id)}
              </p>
            </div>
            <span className={`editor-status editor-status-${saveState.status}`}>
              {getSaveStateLabel(saveState)}
            </span>
          </div>
          <textarea
            aria-label={`${activeSpec.displayName} ${selectedDocument.label}`}
            className="phase-editor"
            onChange={(event) => {
              onDocumentChange(activeSpec.name, selectedDocument.id, event.target.value);
            }}
            placeholder={selectedDocument.emptyLabel}
            spellCheck={false}
            value={draft}
          />
          <div className="editor-footer">
            <span className="helper-copy">Cmd/Ctrl+S saves the current document. Esc returns to inbox.</span>
            <button
              className="secondary-action"
              disabled={saveState.status === 'saving' || (saveState.status !== 'dirty' && !hasContent)}
              onClick={() => {
                void onSaveDocument(activeSpec.name, selectedDocument.id);
              }}
              type="button"
            >
              {saveState.status === 'saving' ? 'Saving...' : `Save ${selectedDocument.label}`}
            </button>
          </div>
        </section>

        <details className="phase-card history-details">
          <summary>Implementation logs · {activeSpec.implementationEntries.length} entries</summary>
          {activeSpec.implementationEntries.length === 0 ? (
            <p className="panel-copy">No implementation logs have been recorded for this spec yet.</p>
          ) : (
            <ul className="timeline-list">
              {activeSpec.implementationEntries.map((entry) => (
                <li className="timeline-item" key={entry.id}>
                  <div className="timeline-item-header">
                    <strong>{entry.taskId}</strong>
                    <span className="section-meta">
                      {formatTimestamp(entry.timestamp, 'Unknown timestamp')}
                    </span>
                  </div>
                  <p className="stack-card-copy">{entry.summary}</p>
                  <p className="helper-copy">
                    {formatFileDelta(entry.filesModified, entry.filesCreated)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </details>
      </div>
    </article>
  );
}

function renderApprovalsMode(
  projectWorkspace: DesktopProjectWorkspace,
  selectedApprovalId: string | null,
  approvalReview: DesktopApprovalReview | null,
  isLoadingApprovalReview: boolean,
  approvalReviewError: string | null,
  approvalResponseDraft: string,
  approvalActionState: {
    status: 'idle' | 'saving' | 'saved' | 'error';
    message?: string | undefined;
  },
  onSelectApproval: (approvalId: string) => void,
  onApprovalResponseChange: (value: string) => void,
  onApprovalAction: (action: 'approve' | 'reject' | 'needs-revision') => Promise<void>
): ReactNode {
  if (projectWorkspace.pendingApprovals.length === 0) {
    return (
      <article className="panel workspace-card workspace-span-2">
        <h2>Approval inbox</h2>
        <p className="panel-copy">
          Nothing is waiting for review right now. This project can stay in spec or implementation flow.
        </p>
      </article>
    );
  }

  const selectedApproval = projectWorkspace.pendingApprovals.find(
    (approval) => approval.approvalId === selectedApprovalId
  ) ?? projectWorkspace.pendingApprovals[0];
  const relatedSpec = selectedApproval.category === 'spec'
    ? projectWorkspace.specs.find((spec) => spec.name === selectedApproval.categoryName)
    : null;

  return (
    <article className="panel workspace-card workspace-span-2 workspace-detail-card">
      <div className="section-header">
        <h2>Approval inbox</h2>
        <span className="section-meta">{projectWorkspace.pendingApprovals.length} pending</span>
      </div>

      <div aria-label="Approval inbox" className="approval-queue" role="list">
        {projectWorkspace.pendingApprovals.map((approval) => (
          <button
            aria-pressed={selectedApproval.approvalId === approval.approvalId}
            className={`approval-queue-item ${selectedApproval.approvalId === approval.approvalId ? 'approval-queue-item-active' : ''}`}
            key={approval.approvalId}
            onClick={() => {
              onSelectApproval(approval.approvalId);
            }}
            type="button"
          >
            <strong>{approval.title}</strong>
            <span className="approval-queue-meta">{formatDisplayName(approval.categoryName)}</span>
            <span className={`badge ${approval.type === 'action' ? 'badge-warning' : 'badge-neutral'}`}>
              {approval.type}
            </span>
          </button>
        ))}
      </div>

      <article className="approval-review-shell">
        <div className="section-header">
          <div>
            <h2>{selectedApproval.title}</h2>
            <p className="approval-meta">
              {selectedApproval.filePath} · {formatDisplayName(selectedApproval.categoryName)} · {formatTimestamp(selectedApproval.createdAt, 'Unknown time')} · {projectWorkspace.pendingApprovals.length} pending{approvalReview?.diff ? ` · +${approvalReview.diff.additions} / -${approvalReview.diff.deletions}` : ''}
            </p>
          </div>
          <span className={`badge ${selectedApproval.type === 'action' ? 'badge-warning' : 'badge-neutral'}`}>
            {selectedApproval.type}
          </span>
        </div>

        <details className="review-context">
          <summary>
            {relatedSpec
              ? `${relatedSpec.displayName} · ${formatPhaseState(relatedSpec.phaseState)}`
              : 'No related spec'}
          </summary>
          {relatedSpec ? (
            <ul className="focus-list">
              <li>
                {relatedSpec.activeTask
                  ? `Implementation is currently anchored on ${relatedSpec.activeTask.id} ${relatedSpec.activeTask.description}.`
                  : 'No task is marked in progress for this spec yet.'}
              </li>
              <li>
                {relatedSpec.nextTask
                  ? `Next queued task is ${relatedSpec.nextTask.id} ${relatedSpec.nextTask.description}.`
                  : 'There is no queued task after the current work.'}
              </li>
              <li>
                {relatedSpec.latestImplementation
                  ? `Latest implementation log: ${relatedSpec.latestImplementation.summary}.`
                  : 'No implementation logs recorded for this spec yet.'}
              </li>
            </ul>
          ) : (
            <p className="panel-copy">
              This approval is not attached to a spec summary yet, so only the file target is available.
            </p>
          )}
        </details>

        {isLoadingApprovalReview ? (
          <p className="panel-copy">Loading approval content...</p>
        ) : approvalReviewError ? (
          <p className="issue issue-error">{approvalReviewError}</p>
        ) : approvalReview?.diff ? (
          <pre className="diff-view" data-testid="approval-diff">
            {formatDiffPreview(approvalReview.diff)}
          </pre>
        ) : (
          <pre className="phase-content">{approvalReview?.currentContent ?? 'No review content available.'}</pre>
        )}
      </article>

      <section className="approval-decision">
        <div className="phase-header">
          <h3>Decision</h3>
          <span className="section-meta">{approvalActionState.message ?? 'Optional review note.'}</span>
        </div>
        <textarea
          aria-label={`${selectedApproval.title} response`}
          className="approval-note"
          onChange={(event) => {
            onApprovalResponseChange(event.target.value);
          }}
          placeholder="Add review notes, rationale, or revision guidance."
          rows={3}
          spellCheck={false}
          value={approvalResponseDraft}
        />
        <div className="action-row approval-action-row">
          <button
            className="primary-action"
            disabled={approvalActionState.status === 'saving'}
            onClick={() => {
              void onApprovalAction('approve');
            }}
            type="button"
          >
            {approvalActionState.status === 'saving' ? 'Processing...' : (
              <>
                <span>Approve</span>
                <kbd>⌘↵</kbd>
              </>
            )}
          </button>
          <button
            className="secondary-action"
            disabled={approvalActionState.status === 'saving'}
            onClick={() => {
              void onApprovalAction('needs-revision');
            }}
            type="button"
          >
            <span>Request revision</span>
            <kbd>⌘⇧R</kbd>
          </button>
          <button
            className="secondary-action"
            disabled={approvalActionState.status === 'saving'}
            onClick={() => {
              void onApprovalAction('reject');
            }}
            type="button"
          >
            <span>Reject</span>
            <kbd>⌘⇧X</kbd>
          </button>
        </div>
      </section>
    </article>
  );
}

function renderMcpDiagnosticsPanel(
  shellState: DesktopShellState,
  visibility: McpVisibility,
  onClose: () => void
): ReactNode {
  const hints = getMcpHints(shellState, visibility);
  const trackedProjects = [...visibility.liveProjects, ...visibility.rememberedProjects];

  return (
    <article className="panel mcp-panel">
      <div className="section-header">
        <h2>MCP visibility</h2>
        <div className="workspace-summary">
          <span className={`badge ${visibility.badgeClassName}`}>{visibility.summaryLabel}</span>
          <button
            className="secondary-action"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>
      </div>

      {trackedProjects.length === 0 ? (
        <p className="panel-copy">No projects remembered yet.</p>
      ) : (
        <ul className="mcp-list">
          {trackedProjects.map((project) => (
            <li className="mcp-row" key={project.projectId}>
              <div className="mcp-row-copy">
                <strong>{project.projectName}</strong>
                <p className="helper-copy">{project.workspacePath}</p>
              </div>
              <div className="project-badges">
                <span className={`badge ${project.connectionState === 'live' ? 'badge-live' : 'badge-neutral'}`}>
                  {project.connectionState === 'live' ? `${project.instanceCount} live` : 'Remembered'}
                </span>
                {project.gitBranch ? <span className="badge badge-neutral">{project.gitBranch}</span> : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {hints.length > 0 ? (
        <ul className="focus-list mcp-hints">
          {hints.map((hint) => (
            <li key={hint}>{hint}</li>
          ))}
        </ul>
      ) : null}

      <details className="phase-card history-details mcp-details">
        <summary>Runtime details</summary>
        <ul className="mcp-facts">
          <li><strong>Status:</strong> {visibility.statusLabel}</li>
          <li><strong>Platform:</strong> {shellState.runtime.platform}</li>
          <li><strong>Electron:</strong> {shellState.runtime.versions.electron}</li>
          <li><strong>Chrome:</strong> {shellState.runtime.versions.chrome}</li>
          <li><strong>Node:</strong> {shellState.runtime.versions.node}</li>
          <li><strong>Storage:</strong> {shellState.storagePath}</li>
          <li><strong>Selected project:</strong> {shellState.selectedProjectPath ?? 'None'}</li>
        </ul>
      </details>
    </article>
  );
}

function createFallbackShellState(): DesktopShellState {
  const runtime = getRuntimeInfo();

  return {
    runtime,
    selectedProjectPath: null,
    lastSelectedAt: null,
    storagePath: runtime.isElectron ? 'Loading shell state...' : 'Browser preview has no desktop storage path.',
    statusLabel: runtime.isElectron ? 'Status: Starting' : 'Status: Browser preview',
    issues: [],
    projects: []
  };
}

function createDraftState(projectWorkspace: DesktopProjectWorkspace): DraftState {
  return Object.fromEntries(
    projectWorkspace.specs.map((spec) => [
      spec.name,
      {
        requirements: spec.phases.requirements.content ?? '',
        design: spec.phases.design.content ?? '',
        tasks: spec.phases.tasks.content ?? ''
      }
    ])
  );
}

function formatTimestamp(value: string | null, fallback: string): string {
  if (!value) {
    return fallback;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return target.closest('input, textarea, select, button, [contenteditable="true"]') !== null;
}

function getRecentImplementationEntries(projectWorkspace: DesktopProjectWorkspace): Array<{
  id: string;
  specName: string;
  specDisplayName: string;
  taskId: string;
  summary: string;
  timestamp: string;
  filesModified: string[];
  filesCreated: string[];
}> {
  return projectWorkspace.specs
    .flatMap((spec) =>
      spec.implementationEntries.map((entry) => ({
        ...entry,
        specName: spec.name,
        specDisplayName: spec.displayName
      }))
    )
    .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp))
    .slice(0, 8);
}

function formatPhaseState(value: WorkspaceSpec['phaseState']): string {
  return formatDisplayName(value);
}

function formatDisplayName(value: string): string {
  return value
    .split('-')
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ');
}

function formatFileDelta(filesModified: string[], filesCreated: string[]): string {
  const modifiedLabel = filesModified.length > 0
    ? `${filesModified.length} modified`
    : '0 modified';
  const createdLabel = filesCreated.length > 0
    ? `${filesCreated.length} created`
    : '0 created';

  return `${modifiedLabel} · ${createdLabel}`;
}

function formatDiffPreview(diff: NonNullable<DesktopApprovalReview['diff']>): string {
  return diff.chunks
    .flatMap((chunk) => chunk.lines)
    .map((line) => {
      const prefix = line.type === 'add'
        ? '+'
        : line.type === 'delete'
          ? '-'
          : ' ';
      return `${prefix} ${line.content}`;
    })
    .join('\n');
}

function createMcpVisibility(shellState: DesktopShellState): McpVisibility {
  const liveProjects = shellState.projects.filter((project) => project.connectionState === 'live');
  const rememberedProjects = shellState.projects.filter(
    (project) => project.connectionState === 'remembered'
  );
  const hasErrors = shellState.issues.some((issue) => issue.severity === 'error');

  if (hasErrors) {
    return {
      liveProjects,
      rememberedProjects,
      statusLabel: 'Attention needed',
      summaryLabel: 'Issues',
      badgeClassName: 'badge-warning'
    };
  }

  if (liveProjects.length > 0) {
    return {
      liveProjects,
      rememberedProjects,
      statusLabel: `${liveProjects.length} live workspace${liveProjects.length === 1 ? '' : 's'}`,
      summaryLabel: `${liveProjects.length} live`,
      badgeClassName: 'badge-live'
    };
  }

  if (shellState.projects.length > 0) {
    return {
      liveProjects,
      rememberedProjects,
      statusLabel: 'Waiting for Codex-launched MCP',
      summaryLabel: 'Waiting',
      badgeClassName: 'badge-neutral'
    };
  }

  return {
    liveProjects,
    rememberedProjects,
    statusLabel: 'No projects remembered',
    summaryLabel: 'Idle',
    badgeClassName: 'badge-neutral'
  };
}

function getSaveStateLabel(saveState: SaveIndicator): string {
  if (saveState.status === 'saved') {
    return saveState.savedAt
      ? `Saved ${formatTimestamp(saveState.savedAt, 'Saved')}`
      : 'Saved';
  }

  if (saveState.status === 'saving') {
    return 'Saving changes...';
  }

  if (saveState.status === 'error') {
    return saveState.message ?? 'Save failed.';
  }

  if (saveState.status === 'dirty') {
    return 'Unsaved changes';
  }

  return 'No local changes';
}

function formatSpecMeta(spec: WorkspaceSpec): string {
  const segments = [
    spec.activeTask ? `Current: ${spec.activeTask.id} ${spec.activeTask.description}` : null,
    spec.nextTask ? `Next: ${spec.nextTask.id} ${spec.nextTask.description}` : null,
    `${spec.taskSummary.completed}/${spec.taskSummary.total || 0} tasks`,
    `${spec.pendingApprovalCount} approvals`
  ].filter((segment): segment is string => segment !== null);

  return segments.join(' · ');
}

function getMcpHints(shellState: DesktopShellState, visibility: McpVisibility): string[] {
  const hints = shellState.issues.map((issue) => getIssueHint(issue));

  if (visibility.liveProjects.length === 0 && shellState.projects.length > 0) {
    hints.push('Open a remembered project in Codex and run a tool or prompt to attach a live MCP session.');
  }

  if (shellState.projects.length === 0) {
    hints.push('Add a project from the desktop app or let Codex bind one first so Electron has something to recover.');
  }

  return [...new Set(hints)];
}

function getDocumentMeta(
  spec: WorkspaceSpec,
  document: DesktopSpecDocumentName
): string {
  if (document === 'tasks') {
    return `${spec.taskSummary.completed}/${spec.taskSummary.total || 0} tasks complete`;
  }

  return formatTimestamp(spec.phases[document].lastModified ?? null, 'No file yet');
}

function getIssueHint(issue: StartupIssue): string {
  switch (issue.code) {
    case 'bridge-unavailable':
      return 'Restart the desktop app if Codex cannot attach through the local MCP bridge.';
    case 'git-unavailable':
      return 'Install Git or expose it on PATH so branch and workspace metadata can be resolved cleanly.';
    case 'renderer-unavailable':
      return 'Rebuild the desktop app if the renderer bundle is missing or out of date.';
    case 'storage-unwritable':
      return 'Check write access for the desktop storage path so remembered projects and shell state can persist across restarts.';
    case 'tray-icon-missing':
      return 'Tray integration is optional. The app window still works even if the tray asset is unavailable.';
    default:
      return issue.message;
  }
}

function createCommandPaletteItems(context: CommandItemContext): CommandPaletteItem[] {
  const items: CommandPaletteItem[] = [
    {
      id: 'action:add-project',
      category: 'Action',
      title: 'Add project',
      meta: 'Open the native folder picker and remember a repository.',
      keywords: ['folder', 'picker', 'remember', 'repo'],
      onSelect: async () => {
        await context.onPickProject();
      }
    },
    {
      id: 'action:toggle-diagnostics',
      category: 'Action',
      title: context.isDiagnosticsOpen ? 'Hide MCP status' : 'Show MCP status',
      meta: 'Inspect live workspaces, issues, and runtime details for the current desktop session.',
      keywords: ['mcp', 'diagnostics', 'status', 'runtime', 'codex'],
      onSelect: () => {
        context.onToggleDiagnostics();
      }
    },
    ...workModes.map((mode) => ({
      id: `action:mode:${mode.id}`,
      category: 'Action',
      title: `Open ${mode.label}`,
      meta: context.activeProject
        ? `${context.activeProject.projectName} · ${mode.label.toLowerCase()}`
        : 'Select a project first.',
      shortcut: mode.shortcut,
      keywords: ['mode', mode.id, mode.label.toLowerCase()],
      onSelect: () => {
        context.onSelectMode(mode.id);
      }
    }))
  ];

  items.push(
    ...context.shellState.projects.map((project) => ({
      id: `project:${project.projectId}`,
      category: 'Project',
      title: project.projectName,
      meta: `${project.connectionState === 'live' ? 'Live MCP attached' : 'Recovered from memory'}${project.gitBranch ? ` · ${project.gitBranch}` : ''}`,
      keywords: [
        project.projectName,
        project.workspacePath,
        project.workflowRootPath,
        project.connectionState
      ],
      onSelect: () => {
        context.onSelectProject(project.workspacePath);
      }
    }))
  );

  if (!context.projectWorkspace) {
    return items;
  }

  items.push(
    ...context.projectWorkspace.specs.map((spec) => ({
      id: `spec:${spec.name}`,
      category: 'Spec',
      title: spec.displayName,
      meta: `${formatPhaseState(spec.phaseState)} · ${spec.pendingApprovalCount} approvals${spec.activeTask ? ` · ${spec.activeTask.id}` : ''}`,
      keywords: [
        spec.name,
        spec.displayName,
        spec.phaseState,
        spec.activeTask?.description ?? '',
        spec.nextTask?.description ?? ''
      ],
      onSelect: () => {
        context.onSelectSpec(spec.name);
        context.onSelectMode('workspace');
      }
    }))
  );

  if (context.activeSpec) {
    items.push(
      ...documentTabs.map((document) => ({
        id: `document:${document.id}`,
        category: 'Document',
        title: `${document.label} document`,
        meta: `${context.activeSpec.displayName}${context.activeDocument === document.id ? ' · current' : ''}`,
        keywords: [
          document.id,
          document.label.toLowerCase(),
          context.activeSpec.name,
          context.activeSpec.displayName
        ],
        onSelect: () => {
          context.onSelectMode('workspace');
          context.onSelectDocument(document.id);
        }
      }))
    );
  }

  items.push(
    ...context.projectWorkspace.pendingApprovals.map((approval) => ({
      id: `approval:${approval.approvalId}`,
      category: 'Approval',
      title: approval.title,
      meta: `${formatDisplayName(approval.categoryName)} · ${approval.filePath}`,
      keywords: [
        approval.title,
        approval.filePath,
        approval.categoryName,
        approval.type
      ],
      onSelect: () => {
        context.onSelectApproval(approval.approvalId);
        context.onSelectMode('approvals');
      }
    }))
  );

  return items;
}

function filterCommandPaletteItems(
  items: CommandPaletteItem[],
  query: string
): CommandPaletteItem[] {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return items;
  }

  return items.filter((item) => {
    const searchText = normalizeSearchText(
      [item.category, item.title, item.meta ?? '', ...(item.keywords ?? [])].join(' ')
    );
    return searchText.includes(normalizedQuery);
  });
}

function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase();
}
