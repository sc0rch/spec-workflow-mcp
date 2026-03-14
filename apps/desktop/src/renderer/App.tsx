import './styles.css';
import { startTransition, useEffect, useEffectEvent, useState } from 'react';
import type { DesktopRuntimeInfo, DesktopShellState } from '../shared/desktop-api.js';

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
  const [isPickingProject, setIsPickingProject] = useState(false);
  const [bridgeError, setBridgeError] = useState<string | null>(null);

  const applyShellState = useEffectEvent((nextState: DesktopShellState) => {
    startTransition(() => {
      setShellState(nextState);
      setIsHydrated(true);
      setBridgeError(null);
    });
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

  const canPickProject = Boolean(window.desktop);

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

  return (
    <main className="shell">
      <section className="hero">
        <div className="hero-topline">
          <p className="eyebrow">Electron rewrite</p>
          <span className="status-pill">{isHydrated ? shellState.statusLabel : 'Status: Loading shell'}</span>
        </div>
        <h1>Spec Workflow Desktop</h1>
        <p className="lede">
          Native shell capabilities are now wired through Electron. The app can restore window state,
          stay single-instance, expose a tray menu, and choose project folders without raw path entry.
        </p>
      </section>

      <section className="grid">
        <article className="panel panel-accent">
          <h2>Project access</h2>
          <p className="panel-copy">
            Choose a repository with the native folder dialog. The selected path is persisted so restart
            recovery and project home work can build on top of it in the next milestone.
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
              ? 'Available through the typed preload bridge.'
              : 'Browser preview mode does not expose native dialogs.'}
          </p>
        </article>

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
            <p className="panel-copy">Startup checks passed: storage is writable, shell assets are available, and no blocking issues were detected.</p>
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
          <h2>Next milestones</h2>
          <ul className="milestone-list">
            <li>Project recovery home screen with remembered workspaces</li>
            <li>Domain service extraction out of legacy dashboard routes</li>
            <li>Task-oriented approvals and spec flows</li>
          </ul>
        </article>
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
    issues: []
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
