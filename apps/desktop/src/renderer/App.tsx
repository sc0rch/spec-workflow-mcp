import './styles.css';
import {
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  type ReactNode
} from 'react';
import { CommandPalette, type CommandPaletteItem } from './CommandPalette.js';
import { ApprovalReviewPanel } from './approvals/ApprovalReviewPanel.js';
import { MarkdownDocumentView } from './specs/MarkdownDocumentView.js';
import { TaskKanbanBoard } from './specs/TaskKanbanBoard.js';
import { getApprovalDisplayTitle } from './approvals/approval-display.js';
import type {
  DesktopApprovalComment,
  DesktopApprovalDraftInput,
  DesktopApprovalReview,
  DesktopSpecDocumentName,
  DesktopProjectWorkspace,
  DesktopRuntimeInfo,
  DesktopShellState
} from '../shared/desktop-api.js';

type WorkMode = 'inbox' | 'workspace' | 'approvals';
type WorkspaceTabId = DesktopSpecDocumentName | 'tasks-kanban';

type ProjectSummary = DesktopShellState['projects'][number];
type WorkspaceSpec = DesktopProjectWorkspace['specs'][number];
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
type ShellStatus = {
  tone: 'ready' | 'warning' | 'error';
  label: string;
  title: string;
};
type CommandItemContext = {
  shellState: DesktopShellState;
  activeProject: ProjectSummary | null;
  projectWorkspace: DesktopProjectWorkspace | null;
  activeSpec: WorkspaceSpec | null;
  activeMode: WorkMode;
  activeTab: WorkspaceTabId;
  onPickProject: () => Promise<void>;
  onSelectProject: (workspacePath: string) => void;
  onSelectMode: (mode: WorkMode) => void;
  onSelectSpec: (specName: string) => void;
  onSelectTab: (document: WorkspaceTabId) => void;
  onSelectApproval: (approvalId: string) => void;
};

const workModes: Array<{ id: WorkMode; label: string; shortcut: string }> = [
  { id: 'inbox', label: 'Inbox', shortcut: '1' },
  { id: 'workspace', label: 'Specs', shortcut: '2' },
  { id: 'approvals', label: 'Approvals', shortcut: '3' }
];

const workspaceTabs: Array<{
  id: WorkspaceTabId;
  label: string;
  emptyLabel: string;
}> = [
  { id: 'requirements', label: 'Requirements', emptyLabel: 'No requirements.md yet.' },
  { id: 'design', label: 'Design', emptyLabel: 'No design.md yet.' },
  { id: 'tasks', label: 'Tasks (Markdown)', emptyLabel: 'No tasks.md yet.' },
  { id: 'tasks-kanban', label: 'Tasks (Kanban)', emptyLabel: 'No tasks yet.' }
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
  const [activeProjectPath, setActiveProjectPath] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<WorkMode>('inbox');
  const [projectWorkspace, setProjectWorkspace] = useState<DesktopProjectWorkspace | null>(null);
  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [activeSpecName, setActiveSpecName] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<WorkspaceTabId>('requirements');
  const [selectedApprovalId, setSelectedApprovalId] = useState<string | null>(null);
  const [approvalReview, setApprovalReview] = useState<DesktopApprovalReview | null>(null);
  const [isLoadingApprovalReview, setIsLoadingApprovalReview] = useState(false);
  const [approvalReviewError, setApprovalReviewError] = useState<string | null>(null);
  const [approvalActionState, setApprovalActionState] = useState<{
    status: 'idle' | 'saving' | 'saved' | 'error';
    message?: string | undefined;
  }>({ status: 'idle' });
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [paletteSelectionIndex, setPaletteSelectionIndex] = useState(0);
  const [isPickingProject, setIsPickingProject] = useState(false);
  const [forgettingProjectId, setForgettingProjectId] = useState<string | null>(null);
  const [shellError, setShellError] = useState<string | null>(null);
  const projectMenuRef = useRef<HTMLDivElement | null>(null);
  const projectMenuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const projectMenuDialogId = useId();
  const projectMenuTitleId = useId();

  const applyShellState = useEffectEvent((nextState: DesktopShellState) => {
    setShellState(nextState);
    setShellError(null);
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

    const currentIndex = workspaceTabs.findIndex((document) => document.id === activeTab);
    const fallbackIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = (fallbackIndex + offset + workspaceTabs.length) % workspaceTabs.length;
    const nextDocument = workspaceTabs[nextIndex];

    if (nextDocument) {
      setActiveTab(nextDocument.id);
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
          setShellError(error instanceof Error ? error.message : 'Desktop shell request failed.');
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
    activeProject?.latestSpec?.lastModified ?? activeProject?.latestSpec?.createdAt,
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
  const hasShellIssues = Boolean(shellError || workspaceError || shellState.issues.length > 0);
  const shellStatus = createShellStatus(shellState, shellError);

  const closeProjectMenu = useEffectEvent(() => {
    setIsProjectMenuOpen(false);
    projectMenuTriggerRef.current?.focus();
  });

  const handlePickProject = async () => {
    if (!window.desktop) {
      return;
    }

    setIsProjectMenuOpen(false);
    setIsPickingProject(true);
    try {
      await window.desktop.pickProjectDirectory();
    } catch (error) {
      setShellError(error instanceof Error ? error.message : 'Project picker failed.');
    } finally {
      setIsPickingProject(false);
    }
  };

  const handleForgetProject = async (projectId: string) => {
    if (!window.desktop) {
      return;
    }

    setIsProjectMenuOpen(false);
    setForgettingProjectId(projectId);
    try {
      await window.desktop.forgetProject(projectId);
    } catch (error) {
      setShellError(error instanceof Error ? error.message : 'Forget project request failed.');
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
      activeTab,
      onPickProject: handlePickProject,
      onSelectProject: (workspacePath) => {
        setActiveProjectPath(workspacePath);
      },
      onSelectMode: setActiveMode,
      onSelectSpec: (specName) => {
        setActiveSpecName(specName);
      },
      onSelectTab: setActiveTab,
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
    setIsProjectMenuOpen(false);
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
      setShellError(error instanceof Error ? error.message : 'Command palette action failed.');
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

  useEffect(() => {
    if (!isProjectMenuOpen) {
      return;
    }

    window.requestAnimationFrame(() => {
      const nextFocusTarget = projectMenuRef.current?.querySelector<HTMLElement>(
        '[data-project-option][data-selected="true"], [data-project-option]'
      );
      nextFocusTarget?.focus();
    });

    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) {
        return;
      }

      if (!projectMenuRef.current?.contains(event.target)) {
        setIsProjectMenuOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isProjectMenuOpen]);

  const handleApprovalAction = async (
    action: 'approve' | 'reject',
    comments: DesktopApprovalComment[]
  ) => {
    if (!window.desktop || !activeProject || !selectedApprovalId) {
      return;
    }

    if (action === 'approve' && comments.length > 0) {
      setApprovalActionState({
        status: 'error',
        message: 'Remove comments before approving.'
      });
      return;
    }

    setApprovalActionState({ status: 'saving' });

    try {
      const response = action === 'approve'
        ? 'Approved.'
        : (comments.length > 0 ? formatApprovalCommentsResponse(comments) : 'Rejected.');

      await window.desktop.respondToApproval(
        activeProject.projectId,
        selectedApprovalId,
        action,
        response,
        comments
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
        : (comments.length > 0 ? 'Revision request sent.' : 'Approval marked as rejected.');

      applyShellState(nextShellState);
      setProjectWorkspace(nextWorkspace);
      if (nextPending) {
        setSelectedApprovalId(nextPending.approvalId);
        if (nextPending.category === 'spec') {
          setActiveSpecName(nextPending.categoryName);
        }
      } else {
        setSelectedApprovalId(null);
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

    if (isProjectMenuOpen && event.key === 'Escape') {
      event.preventDefault();
      closeProjectMenu();
      return;
    }

      if (event.key === 'Escape' && isTextEditingTarget(event.target)) {
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
    activeTab,
    closeProjectMenu,
    activeMode,
    closePalette,
    handleApprovalAction,
    isProjectMenuOpen,
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
        <div aria-label="Main menu" className="shell-header-actions" role="toolbar">
          <div className="shell-header-group shell-header-group-start">
            <div className={`project-menu ${isProjectMenuOpen ? 'project-menu-open' : ''}`} ref={projectMenuRef}>
              <button
                aria-label={activeProject?.projectName ?? 'Projects'}
                aria-controls={isProjectMenuOpen ? projectMenuDialogId : undefined}
                aria-expanded={isProjectMenuOpen}
                aria-haspopup="dialog"
                className="secondary-action project-menu-trigger"
                onClick={() => {
                  setIsProjectMenuOpen((currentState) => !currentState);
                }}
                onKeyDown={(event) => {
                  if (
                    !isProjectMenuOpen &&
                    (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ')
                  ) {
                    event.preventDefault();
                    setIsProjectMenuOpen(true);
                  }
                }}
                ref={projectMenuTriggerRef}
                type="button"
              >
                {activeProject ? <span aria-hidden="true" className="project-dot" /> : null}
                <span className="project-menu-trigger-copy">
                  <span className="project-menu-trigger-label">
                    {activeProject?.projectName ?? 'Projects'}
                  </span>
                  {activeProject ? (
                    <span className="project-menu-trigger-meta">
                      {formatProjectContextLine(activeProject)}
                    </span>
                  ) : null}
                </span>
                <span aria-hidden="true" className="project-menu-chevron">▾</span>
              </button>
              {isProjectMenuOpen ? (
                <div
                  aria-labelledby={projectMenuTitleId}
                  aria-modal="false"
                  className="panel project-menu-popover"
                  id={projectMenuDialogId}
                  role="dialog"
                  tabIndex={-1}
                >
                  <h2 className="sr-only" id={projectMenuTitleId}>Project picker</h2>
                  {shellState.projects.length === 0 ? (
                    <p className="panel-copy project-menu-empty">
                      No saved projects yet. Add a folder once and it stays here after restart.
                    </p>
                  ) : (
                    <div aria-label="Projects" className="project-list" role="list">
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
                                data-project-option="true"
                                data-selected={isSelected ? 'true' : 'false'}
                                onClick={() => {
                                  setActiveProjectPath(project.workspacePath);
                                  setIsProjectMenuOpen(false);
                                  projectMenuTriggerRef.current?.focus();
                                }}
                                type="button"
                              >
                                <span aria-hidden="true" className="project-dot" />
                                <div className="project-select-copy">
                                  <strong>{project.projectName}</strong>
                                  <span className="project-select-meta project-select-meta-primary">
                                    {project.gitBranch ?? trimProjectPath(project.workspacePath)}
                                  </span>
                                  <span className="project-select-meta">
                                    {project.latestSpec
                                      ? `Latest spec: ${project.latestSpec.displayName}`
                                      : 'No specs yet'}
                                  </span>
                                </div>
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
                </div>
              ) : null}
            </div>
            <button
              aria-label="Add folder"
              className="secondary-action icon-action header-utility-action"
              disabled={!canPickProject || isPickingProject}
              onClick={() => {
                void handlePickProject();
              }}
              title={isPickingProject ? 'Opening folder picker...' : 'Add folder'}
              type="button"
            >
              <FolderOpenIcon />
            </button>
          </div>
          <div className="shell-header-spacer" />
          <div className="shell-header-group shell-header-group-end">
            <button
              aria-label="Search"
              className="secondary-action command-trigger header-utility-action"
              onClick={() => {
                openPalette();
              }}
              type="button"
            >
              <span className="header-action-label">Search</span>
            </button>
            <div
              aria-label={`Shell ${shellStatus.label}`}
              className={`shell-indicator shell-indicator-${shellStatus.tone} header-status-indicator`}
              role="status"
              title={shellStatus.title}
            >
              <span aria-hidden="true" className="shell-indicator-dot" />
              <span className="shell-indicator-label">{shellStatus.label}</span>
            </div>
          </div>
        </div>
      </header>

      <section className="workspace">
        {hasShellIssues ? (
          <article className="panel workspace-issues">
            {shellError ? <p className="issue issue-error">{shellError}</p> : null}
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
        {activeProject ? (
          <>
            <div className="workspace-head">
              <nav aria-label="Work modes" className="mode-tabs">
                {workModes.map((mode) => (
                  <button
                    aria-pressed={activeMode === mode.id}
                    className={`mode-tab ${activeMode === mode.id ? 'mode-tab-active' : ''}`}
                    data-mode={mode.id}
                    key={mode.id}
                    onClick={() => {
                      setActiveMode(mode.id);
                    }}
                    type="button"
                  >
                    <span>{mode.label}</span>
                  </button>
                ))}
              </nav>
            </div>

            <div className="workspace-grid">
              {renderWorkspaceContent({
                activeMode,
                project: activeProject,
                projectWorkspace,
                isLoadingWorkspace,
                workspaceError,
                activeSpecName,
                activeTab,
                selectedApprovalId,
                approvalReview,
                isLoadingApprovalReview,
                approvalReviewError,
                approvalActionState,
                onChangeMode: setActiveMode,
                onSelectSpec: setActiveSpecName,
                onSelectTab: setActiveTab,
                onSelectApproval: (approvalId) => {
                  setSelectedApprovalId(approvalId);

                  const approval = projectWorkspace?.pendingApprovals.find(
                    (entry) => entry.approvalId === approvalId
                  );
                  if (approval?.category === 'spec') {
                    setActiveSpecName(approval.categoryName);
                  }
                },
                onApprovalAction: handleApprovalAction,
                onSaveApprovalDraft: (draft) => {
                  if (!window.desktop || !activeProject || !selectedApprovalId) {
                    return;
                  }

                  void window.desktop.saveApprovalDraft(activeProject.projectId, selectedApprovalId, draft)
                    .catch((error) => {
                      setShellError(
                        error instanceof Error ? error.message : 'Approval draft could not be saved.'
                      );
                    });
                }
              })}
            </div>
          </>
        ) : (
          <article className="panel workspace-empty">
            <h2>No project selected</h2>
            <p className="panel-copy">Pick a project to open reviews, specs, and recent work.</p>
          </article>
        )}
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
  activeTab: WorkspaceTabId;
  selectedApprovalId: string | null;
  approvalReview: DesktopApprovalReview | null;
  isLoadingApprovalReview: boolean;
  approvalReviewError: string | null;
  approvalActionState: {
    status: 'idle' | 'saving' | 'saved' | 'error';
    message?: string | undefined;
  };
  onChangeMode: (mode: WorkMode) => void;
  onSelectSpec: (specName: string) => void;
  onSelectTab: (document: WorkspaceTabId) => void;
  onSelectApproval: (approvalId: string) => void;
  onApprovalAction: (
    action: 'approve' | 'reject',
    comments: DesktopApprovalComment[]
  ) => Promise<void>;
  onSaveApprovalDraft: (draft: DesktopApprovalDraftInput | null) => void;
}): ReactNode {
  const {
    activeMode,
    project,
    projectWorkspace,
    isLoadingWorkspace,
    workspaceError,
    activeSpecName,
    activeTab,
    selectedApprovalId,
    approvalReview,
    isLoadingApprovalReview,
    approvalReviewError,
    approvalActionState,
    onChangeMode,
    onSelectSpec,
    onSelectTab,
    onSelectApproval,
    onApprovalAction,
    onSaveApprovalDraft
  } = options;

  if (isLoadingWorkspace) {
    return (
      <article className="panel workspace-message-card workspace-span-2">
        <h2>Loading workspace</h2>
        <p className="panel-copy">
          Loading specs, reviews, and recent implementation work for {project.projectName}.
        </p>
      </article>
    );
  }

  if (workspaceError) {
    return (
      <article className="panel workspace-message-card workspace-span-2">
        <h2>Workspace unavailable</h2>
        <p className="issue issue-error">{workspaceError}</p>
      </article>
    );
  }

  if (!projectWorkspace) {
    return (
      <article className="panel workspace-message-card workspace-span-2">
        <h2>Workspace not ready yet</h2>
        <p className="panel-copy">
          Pick a project to load its specs, reviews, and recent work.
        </p>
      </article>
    );
  }

  if (activeMode === 'workspace') {
    return renderWorkspaceMode(
      projectWorkspace,
      activeSpecName,
      activeTab,
      onSelectSpec,
      onSelectTab
    );
  }

  if (activeMode === 'approvals') {
    return (
      <ApprovalReviewPanel
        approvalActionState={approvalActionState}
        approvalDraft={approvalReview?.draft ?? null}
        approvalReview={approvalReview}
        approvalReviewError={approvalReviewError}
        isLoadingApprovalReview={isLoadingApprovalReview}
        onSaveDraft={onSaveApprovalDraft}
        onSelectApproval={onSelectApproval}
        onSubmitDecision={onApprovalAction}
        projectWorkspace={projectWorkspace}
        selectedApprovalId={selectedApprovalId}
      />
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
      title: getApprovalDisplayTitle(approval),
      summary: `${formatDisplayName(approval.categoryName)} · ${approval.filePath}`,
      meta: formatTimestamp(approval.createdAt, 'Unknown time'),
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
          : 'Open this spec',
      meta: formatTimestamp(spec.lastModified, 'Unknown update'),
      actionLabel: 'Open',
      badgeClassName: `badge-phase-${spec.phaseState}`,
      onSelect: () => {
        onSelectSpec(spec.name);
        onChangeMode('workspace');
      }
    })),
    ...recentImplementations.slice(0, 3).map((entry) => ({
      id: entry.id,
      kind: 'implementation' as const,
      kindLabel: 'Implementation',
      title: `${entry.specDisplayName} · ${entry.taskId}`,
      summary: entry.summary,
      meta: formatTimestamp(entry.timestamp, 'Unknown timestamp'),
      actionLabel: 'Open',
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
    <article className="workspace-card workspace-span-2 workspace-mode workspace-mode-inbox">
      <div className="section-header">
        <h2>Inbox</h2>
      </div>
      {nextAction ? (
        <div
          className="inbox-callout"
          data-kind={nextAction.kind}
          data-tone={nextAction.badgeClassName}
        >
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
          No reviews or active specs need attention right now.
        </p>
      )}

      {visibleInboxItems.length > 0 ? (
        <div aria-label="Inbox queue" className="inbox-list" role="list">
          {visibleInboxItems.map((item) => (
            <button
              className="queue-item"
              data-kind={item.kind}
              data-tone={item.badgeClassName}
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
              </div>
              <div className="queue-item-footer">
                <span>{item.meta}</span>
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
  activeTab: WorkspaceTabId,
  onSelectSpec: (specName: string) => void,
  onSelectTab: (document: WorkspaceTabId) => void
): ReactNode {
  if (projectWorkspace.specs.length === 0) {
    return (
      <article className="panel workspace-message-card workspace-span-2">
        <h2>No specs yet</h2>
        <p className="panel-copy">
          This project is connected, but it does not have any spec files yet.
        </p>
      </article>
    );
  }

  const activeSpec = projectWorkspace.specs.find((spec) => spec.name === activeSpecName)
    ?? projectWorkspace.specs[0];
  const selectedTab = workspaceTabs.find((document) => document.id === activeTab)
    ?? workspaceTabs[0];
  const selectedDocument = selectedTab.id === 'tasks-kanban' ? null : selectedTab;
  const documentContent = selectedDocument
    ? activeSpec.phases[selectedDocument.id].content ?? ''
    : null;

  return (
    <article className="workspace-card workspace-span-2 workspace-detail-card workspace-mode workspace-mode-specs">
      <div className="section-header">
        <h2>Specs</h2>
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

      <div className="phase-stack">
        <section className="phase-card document-shell">
          <div aria-label="Spec documents" className="document-tabs" role="tablist">
            {workspaceTabs.map((document) => {
              const phase = document.id === 'tasks-kanban'
                ? activeSpec.phases.tasks
                : activeSpec.phases[document.id];
              return (
                <button
                  aria-pressed={selectedTab.id === document.id}
                  className={`spec-tab ${selectedTab.id === document.id ? 'spec-tab-active' : ''}`}
                  key={document.id}
                  onClick={() => {
                    onSelectTab(document.id);
                  }}
                  type="button"
                >
                  <span>{document.label}</span>
                  {!phase.exists ? (
                    <span className="document-tab-meta">Missing</span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {selectedTab.id === 'tasks-kanban' ? (
            <TaskKanbanBoard spec={activeSpec} />
          ) : selectedDocument && activeSpec.phases[selectedDocument.id].exists ? (
            <MarkdownDocumentView
              ariaLabel={`${activeSpec.displayName} ${selectedTab.label}`}
              content={documentContent ?? ''}
            />
          ) : (
            <div className="document-empty-state">
              <p className="panel-copy">{selectedTab.emptyLabel}</p>
            </div>
          )}
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

function formatTimestamp(value: string | null, fallback: string): string {
  if (!value) {
    return fallback;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function formatApprovalCommentsResponse(comments: DesktopApprovalComment[]): string {
  const normalizedComments = comments
    .map((comment) => comment.comment.trim())
    .filter((comment) => comment.length > 0);

  if (normalizedComments.length === 0) {
    return 'Changes requested.';
  }

  return normalizedComments.join('\n\n');
}

function formatProjectContextLine(project: ProjectSummary): string {
  const primary = project.gitBranch ?? trimProjectPath(project.workspacePath);
  if (project.latestSpec) {
    return `${primary} · ${project.latestSpec.displayName}`;
  }

  return primary;
}

function trimProjectPath(workspacePath: string): string {
  const normalized = workspacePath.replace(/\/+$/, '');
  const segments = normalized.split('/').filter((segment) => segment.length > 0);
  const tail = segments.slice(-2);

  return tail.length > 0 ? tail.join('/') : workspacePath;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return target.closest('input, textarea, select, button, [contenteditable="true"]') !== null;
}

function isTextEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return target.closest('input, textarea, [contenteditable="true"]') !== null;
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

function createShellStatus(
  shellState: DesktopShellState,
  shellError: string | null
): ShellStatus {
  if (shellError) {
    return {
      tone: 'error',
      label: 'Attention',
      title: shellError
    };
  }

  const errorIssue = shellState.issues.find((issue) => issue.severity === 'error');
  if (errorIssue) {
    return {
      tone: 'error',
      label: 'Attention',
      title: errorIssue.message
    };
  }

  const warningIssue = shellState.issues[0];
  if (warningIssue) {
    return {
      tone: 'warning',
      label: 'Warnings',
      title: warningIssue.message
    };
  }

  return {
    tone: 'ready',
    label: 'Ready',
    title: 'Local desktop shell is ready.'
  };
}

function createCommandPaletteItems(context: CommandItemContext): CommandPaletteItem[] {
  const items: CommandPaletteItem[] = [
    {
      id: 'action:add-project',
      category: 'Action',
      title: 'Add folder',
      meta: 'Pick a project folder and keep it in the app.',
      keywords: ['folder', 'picker', 'remember', 'repo'],
      onSelect: async () => {
        await context.onPickProject();
      }
    },
    ...workModes.map((mode) => ({
      id: `action:mode:${mode.id}`,
      category: 'Action',
      title: `Open ${mode.label}`,
      meta: context.activeProject
        ? `${context.activeProject.projectName} · ${mode.label.toLowerCase()}`
        : 'Pick a project first.',
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
      meta: `Saved folder${project.gitBranch ? ` · ${project.gitBranch}` : ''}`,
      keywords: [
        project.projectName,
        project.workspacePath,
        project.workflowRootPath
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
      ...workspaceTabs.map((document) => ({
        id: `document:${document.id}`,
        category: 'Document',
        title: document.id === 'tasks-kanban' ? 'Tasks board' : `${document.label} document`,
        meta: `${context.activeSpec.displayName}${context.activeTab === document.id ? ' · current' : ''}`,
        keywords: [
          document.id,
          document.label.toLowerCase(),
          context.activeSpec.name,
          context.activeSpec.displayName
        ],
        onSelect: () => {
          context.onSelectMode('workspace');
          context.onSelectTab(document.id);
        }
      }))
    );
  }

  items.push(
    ...context.projectWorkspace.pendingApprovals.map((approval) => ({
      id: `approval:${approval.approvalId}`,
      category: 'Approval',
      title: getApprovalDisplayTitle(approval),
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

function FolderOpenIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
      <path
        d="M3.75 6.75a1.5 1.5 0 0 1 1.5-1.5h4.04a2.25 2.25 0 0 1 1.59.66l1.2 1.2c.14.14.33.22.53.22h5.14a1.5 1.5 0 0 1 1.5 1.5v.78H3.75v-2.81Z"
        fill="currentColor"
        opacity="0.55"
      />
      <path
        d="M4.93 10.5h14.14c1.14 0 1.97 1.09 1.65 2.18l-1.87 6.38A1.5 1.5 0 0 1 17.4 20.25H5.66a1.5 1.5 0 0 1-1.45-1.1l-1.88-6.39A1.72 1.72 0 0 1 4 10.5h.93Zm7.7 1.82v1.56h1.56a.75.75 0 0 1 0 1.5h-1.56v1.56a.75.75 0 0 1-1.5 0v-1.56H9.57a.75.75 0 0 1 0-1.5h1.56v-1.56a.75.75 0 0 1 1.5 0Z"
        fill="currentColor"
      />
    </svg>
  );
}
