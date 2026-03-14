import './styles.css';
import { startTransition, useEffect, useEffectEvent, useState, type ReactNode } from 'react';
import type { DesktopRuntimeInfo, DesktopShellState } from '../shared/desktop-api.js';

type WorkMode = 'overview' | 'specs' | 'approvals' | 'activity';

const workModes: Array<{ id: WorkMode; label: string; shortcut: string }> = [
  { id: 'overview', label: 'Overview', shortcut: '1' },
  { id: 'specs', label: 'Specs', shortcut: '2' },
  { id: 'approvals', label: 'Approvals', shortcut: '3' },
  { id: 'activity', label: 'Activity', shortcut: '4' }
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
  const [activeMode, setActiveMode] = useState<WorkMode>('overview');
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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }

      if (event.key === 'j' || event.key === 'ArrowDown') {
        event.preventDefault();
        selectAdjacentProject(1);
        return;
      }

      if (event.key === 'k' || event.key === 'ArrowUp') {
        event.preventDefault();
        selectAdjacentProject(-1);
        return;
      }

      const matchedMode = workModes.find((mode) => mode.shortcut === event.key);
      if (matchedMode) {
        event.preventDefault();
        setActiveMode(matchedMode.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectAdjacentProject]);

  const canPickProject = Boolean(window.desktop);
  const activeProject = shellState.projects.find(
    (project) => project.workspacePath === activeProjectPath
  ) ?? null;

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

  return (
    <main className="shell">
      <section className="hero">
        <div className="hero-topline">
          <p className="eyebrow">Electron rewrite</p>
          <span className="status-pill">{isHydrated ? shellState.statusLabel : 'Status: Loading shell'}</span>
        </div>
        <h1>Spec Workflow Desktop</h1>
        <p className="lede">
          The desktop shell now orients work around active projects, recovery-safe state, and mode-based
          navigation instead of scattered dashboard tabs.
        </p>
      </section>

      <section className="shell-frame">
        <aside className="left-rail">
          <article className="panel panel-accent rail-access">
            <div className="section-header">
              <h2>Project access</h2>
              <span className="section-meta">{shellState.projects.length} tracked</span>
            </div>
            <p className="panel-copy">
              Bring in a repo once and the shell keeps it available after restart. The same bridge path now
              powers native picker flows, recovery, and future drag-and-drop entrypoints.
            </p>
            <button
              className="primary-action"
              disabled={!canPickProject || isPickingProject}
              onClick={() => {
                void handlePickProject();
              }}
              type="button"
            >
              {isPickingProject ? 'Opening folder picker...' : 'Choose project folder'}
            </button>
            <p className="helper-copy">
              {canPickProject
                ? 'Use J/K to switch projects and 1-4 to switch work modes.'
                : 'Browser preview mode does not expose native dialogs.'}
            </p>
          </article>

          <article className="panel rail-projects">
            <div className="section-header">
              <h2>Projects</h2>
              <span className="section-meta">{activeProject ? 'Ready' : 'Empty'}</span>
            </div>
            {shellState.projects.length === 0 ? (
              <p className="panel-copy">
                No remembered projects yet. Use the native folder picker once and the desktop shell
                will restore that workspace after restart.
              </p>
            ) : (
              <div aria-label="Remembered projects" className="project-list" role="list">
                {shellState.projects.map((project) => {
                  const isSelected = activeProject?.projectId === project.projectId;
                  const isForgetting = forgettingProjectId === project.projectId;

                  return (
                    <article
                      className={`project-card ${isSelected ? 'project-card-selected' : ''}`}
                      key={project.projectId}
                      role="listitem"
                    >
                      <button
                        aria-pressed={isSelected}
                        className="project-select"
                        onClick={() => {
                          setActiveProjectPath(project.workspacePath);
                        }}
                        type="button"
                      >
                        <div className="project-card-header">
                          <div>
                            <h3>{project.projectName}</h3>
                            <p className="project-meta">{project.workspacePath}</p>
                          </div>
                          <div className="project-badges">
                            <span className={`badge badge-${project.connectionState}`}>
                              {project.connectionState === 'live' ? 'Live' : 'Remembered'}
                            </span>
                            {project.pendingApprovalCount > 0 ? (
                              <span className="badge badge-warning">
                                {project.pendingApprovalCount} approvals
                              </span>
                            ) : null}
                            {project.instanceCount > 0 ? (
                              <span className="badge badge-neutral">{project.instanceCount} MCP</span>
                            ) : null}
                          </div>
                        </div>
                        <p className="project-note">
                          {project.latestImplementation
                            ? `${project.latestImplementation.summary} (${formatTimestamp(project.latestImplementation.timestamp)})`
                            : project.source === 'manual'
                              ? 'Added manually in desktop'
                              : project.source === 'mcp'
                                ? 'Observed from MCP activity'
                                : 'Catalog entry'}
                        </p>
                      </button>
                      <div className="project-actions">
                        <span className="helper-copy">
                          {project.latestSpec?.displayName ?? 'No specs yet'}
                        </span>
                        <button
                          className="secondary-action"
                          disabled={!window.desktop || isForgetting}
                          onClick={() => {
                            void handleForgetProject(project.projectId);
                          }}
                          type="button"
                        >
                          {isForgetting ? 'Forgetting...' : 'Forget project'}
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
          {activeProject ? (
            <>
              <article className="panel workspace-head">
                <div>
                  <p className="eyebrow">Workspace</p>
                  <h2>{activeProject.projectName}</h2>
                  <p className="panel-copy">
                    {getWorkspaceLead(activeProject, activeMode)}
                  </p>
                </div>
                <div className="workspace-summary">
                  <span className={`badge badge-${activeProject.connectionState}`}>
                    {activeProject.connectionState === 'live' ? 'Live MCP attached' : 'Recovered from memory'}
                  </span>
                  <span className="summary-meta">
                    {activeProject.gitBranch ?? 'No git branch'} · {activeProject.instanceCount} active MCP
                  </span>
                </div>
              </article>

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
                {renderWorkspaceContent(activeProject, activeMode)}
              </div>
            </>
          ) : (
            <article className="panel workspace-empty">
              <h2>Pick a project to begin</h2>
              <p className="panel-copy">
                The shell will keep recent workspaces visible here, surface approval pressure, and
                pivot into spec or activity views without bouncing through legacy dashboard tabs.
              </p>
            </article>
          )}
        </section>

        <aside className="details-panel">
          <article className="panel">
            <h2>Current shell state</h2>
            <dl className="stacked-list">
              <div>
                <dt>Selected project</dt>
                <dd>{shellState.selectedProjectPath ?? 'No project selected yet'}</dd>
              </div>
              <div>
                <dt>Last selection</dt>
                <dd>{formatTimestamp(shellState.lastSelectedAt)}</dd>
              </div>
              <div>
                <dt>Storage path</dt>
                <dd>{shellState.storagePath}</dd>
              </div>
              <div>
                <dt>Mode</dt>
                <dd>{shellState.runtime.isElectron ? 'Electron desktop' : 'Browser preview'}</dd>
              </div>
              <div>
                <dt>Bridge</dt>
                <dd>{canPickProject ? 'Connected' : 'Unavailable'}</dd>
              </div>
            </dl>
          </article>

          <article className="panel panel-outline">
            <h2>Startup diagnostics</h2>
            {bridgeError ? <p className="issue issue-error">{bridgeError}</p> : null}
            {shellState.issues.length === 0 ? (
              <p className="panel-copy">
                Startup checks passed: storage is writable, shell assets are available, and no blocking
                issues were detected.
              </p>
            ) : (
              <ul className="issue-list">
                {shellState.issues.map((issue) => (
                  <li className={`issue issue-${issue.severity}`} key={issue.code}>
                    <strong>{issue.severity === 'error' ? 'Error' : 'Warning'}:</strong> {issue.message}
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="panel">
            <h2>Runtime</h2>
            <dl className="stacked-list">
              <div>
                <dt>Platform</dt>
                <dd>{shellState.runtime.platform}</dd>
              </div>
              <div>
                <dt>Electron</dt>
                <dd>{shellState.runtime.versions.electron}</dd>
              </div>
              <div>
                <dt>Chrome</dt>
                <dd>{shellState.runtime.versions.chrome}</dd>
              </div>
              <div>
                <dt>Node</dt>
                <dd>{shellState.runtime.versions.node}</dd>
              </div>
            </dl>
          </article>

          <article className="panel panel-outline">
            <h2>Keyboard flow</h2>
            <ul className="shortcut-list">
              <li><kbd>1</kbd> Overview</li>
              <li><kbd>2</kbd> Specs</li>
              <li><kbd>3</kbd> Approvals</li>
              <li><kbd>4</kbd> Activity</li>
              <li><kbd>J</kbd> / <kbd>K</kbd> Project switch</li>
            </ul>
          </article>
        </aside>
      </section>
    </main>
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

function formatTimestamp(value: string | null): string {
  if (!value) {
    return 'No project has been selected yet';
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

function getWorkspaceLead(
  project: DesktopShellState['projects'][number],
  activeMode: WorkMode
): string {
  if (activeMode === 'specs') {
    return project.latestSpec
      ? `${project.latestSpec.displayName} is the current anchor spec for this workspace.`
      : 'No specs yet. Use this mode to scaffold and focus the next spec workflow.';
  }

  if (activeMode === 'approvals') {
    return project.pendingApprovalCount > 0
      ? `${project.pendingApprovalCount} approvals are waiting and should be treated as the fastest way to unblock work.`
      : 'Approval pressure is currently clear, so the next bottleneck is likely spec or implementation flow.';
  }

  if (activeMode === 'activity') {
    return project.latestImplementation
      ? `Latest implementation activity landed in ${project.latestImplementation.specDisplayName}.`
      : 'No implementation activity has been logged yet for this workspace.';
  }

  return 'Use the work modes below to move between project overview, spec focus, approvals, and implementation activity.';
}

function renderWorkspaceContent(
  project: DesktopShellState['projects'][number],
  activeMode: WorkMode
): ReactNode {
  if (activeMode === 'specs') {
    return (
      <>
        <article className="panel workspace-card">
          <h2>Spec focus</h2>
          <div className="metric-grid">
            <div className="metric-card">
              <span className="metric-label">Latest spec</span>
              <strong className="metric-value">{project.latestSpec?.displayName ?? 'No specs yet'}</strong>
              <span className="metric-note">
                {project.latestSpec ? formatTimestamp(project.latestSpec.createdAt) : 'Create or import a spec next.'}
              </span>
            </div>
            <div className="metric-card">
              <span className="metric-label">Workflow root</span>
              <strong className="metric-value metric-value-path">{project.workflowRootPath}</strong>
              <span className="metric-note">Shared or worktree-local spec root currently bound to this project.</span>
            </div>
          </div>
        </article>
        <article className="panel workspace-card panel-outline">
          <h2>Suggested next step</h2>
          <ul className="focus-list">
            <li>{project.latestSpec ? 'Open the active spec and tighten tasks before implementation drifts.' : 'Create the first spec for this workspace and establish the requirements/design/tasks flow.'}</li>
            <li>{project.connectionState === 'live' ? 'MCP is currently attached, so actions from Codex should immediately reinforce this project state.' : 'This project is recovered from local state; reconnect MCP when you want live agent visibility.'}</li>
          </ul>
        </article>
      </>
    );
  }

  if (activeMode === 'approvals') {
    return (
      <>
        <article className="panel workspace-card">
          <h2>Approval inbox</h2>
          <div className="metric-grid">
            <div className="metric-card metric-card-emphasis">
              <span className="metric-label">Pending approvals</span>
              <strong className="metric-value">{project.pendingApprovalCount}</strong>
              <span className="metric-note">
                {project.pendingApprovalCount > 0
                  ? `${project.pendingApprovalCount} items waiting for review`
                  : 'No pending approvals right now'}
              </span>
            </div>
            <div className="metric-card">
              <span className="metric-label">Latest implementation</span>
              <strong className="metric-value">
                {project.latestImplementation
                  ? `${project.latestImplementation.specDisplayName} · ${project.latestImplementation.taskId}`
                  : 'No implementation logs yet'}
              </strong>
              <span className="metric-note">
                {project.latestImplementation?.summary ?? 'Implementation history will show up here after the first log entry.'}
              </span>
            </div>
          </div>
        </article>
        <article className="panel workspace-card panel-outline">
          <h2>Review posture</h2>
          <ul className="focus-list">
            <li>No verbal approvals. Queue-driven review is the canonical path.</li>
            <li>When approval count spikes, this mode should become the default workspace landing view.</li>
          </ul>
        </article>
      </>
    );
  }

  if (activeMode === 'activity') {
    return (
      <>
        <article className="panel workspace-card">
          <h2>Implementation activity</h2>
          <div className="metric-grid">
            <div className="metric-card">
              <span className="metric-label">Latest implementation</span>
              <strong className="metric-value">
                {project.latestImplementation
                  ? `${project.latestImplementation.specDisplayName} · ${project.latestImplementation.taskId}`
                  : 'No implementation logs yet'}
              </strong>
              <span className="metric-note">
                {project.latestImplementation
                  ? `${project.latestImplementation.summary} · ${formatTimestamp(project.latestImplementation.timestamp)}`
                  : 'Log activity will surface here after the first implementation step is recorded.'}
              </span>
            </div>
            <div className="metric-card">
              <span className="metric-label">Connection state</span>
              <strong className="metric-value">
                {project.connectionState === 'live' ? 'Live MCP attached' : 'Recovered project'}
              </strong>
              <span className="metric-note">
                {project.instanceCount > 0
                  ? `${project.instanceCount} MCP processes currently reference this workspace.`
                  : 'No live MCP instance is attached at the moment.'}
              </span>
            </div>
          </div>
        </article>
        <article className="panel workspace-card panel-outline">
          <h2>Why this matters</h2>
          <ul className="focus-list">
            <li>Recent implementation context should be visible without digging through markdown logs or old dashboard pages.</li>
            <li>This mode becomes the handoff surface between spec planning, implementation, and approvals.</li>
          </ul>
        </article>
      </>
    );
  }

  return (
    <>
      <article className="panel workspace-card">
        <h2>Project overview</h2>
        <div className="metric-grid">
          <div className="metric-card">
            <span className="metric-label">Latest spec</span>
            <strong className="metric-value">{project.latestSpec?.displayName ?? 'No specs yet'}</strong>
            <span className="metric-note">
              {project.latestSpec ? `Created ${formatTimestamp(project.latestSpec.createdAt)}` : 'Specs will appear here once added.'}
            </span>
          </div>
          <div className="metric-card metric-card-emphasis">
            <span className="metric-label">Pending approvals</span>
            <strong className="metric-value">{project.pendingApprovalCount}</strong>
            <span className="metric-note">
              {project.pendingApprovalCount > 0
                ? `${project.pendingApprovalCount} items waiting for review`
                : 'No approval backlog'}
            </span>
          </div>
          <div className="metric-card">
            <span className="metric-label">Latest implementation</span>
            <strong className="metric-value">
              {project.latestImplementation
                ? `${project.latestImplementation.specDisplayName} · ${project.latestImplementation.taskId}`
                : 'No implementation logs yet'}
            </strong>
            <span className="metric-note">
              {project.latestImplementation?.summary ?? 'Implementation momentum shows up here after the first log entry.'}
            </span>
          </div>
          <div className="metric-card">
            <span className="metric-label">Git branch</span>
            <strong className="metric-value">{project.gitBranch ?? 'Unavailable'}</strong>
            <span className="metric-note">
              {project.connectionState === 'live'
                ? `${project.instanceCount} live MCP connection${project.instanceCount === 1 ? '' : 's'}`
                : 'Recovered from remembered state'}
            </span>
          </div>
        </div>
      </article>
      <article className="panel workspace-card panel-outline">
        <h2>What to do next</h2>
        <ul className="focus-list">
          <li>{project.pendingApprovalCount > 0 ? 'Clear pending approvals first to remove the shortest workflow bottleneck.' : 'Approval backlog is clear, so spec and implementation views can drive the next step.'}</li>
          <li>{project.latestSpec ? `Keep ${project.latestSpec.displayName} as the working anchor until a newer spec supersedes it.` : 'Start by creating the first spec so the rest of the workflow has a durable anchor.'}</li>
        </ul>
      </article>
    </>
  );
}
