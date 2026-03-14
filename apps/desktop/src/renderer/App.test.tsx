import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DesktopApi, DesktopShellState } from '../shared/desktop-api.js';
import { App } from './App.js';

const shellState: DesktopShellState = {
  runtime: {
    channel: 'desktop',
    isElectron: true,
    platform: 'darwin',
    versions: {
      chrome: '140.0.0.0',
      electron: '41.0.2',
      node: '22.18.1'
    }
  },
  selectedProjectPath: '/tmp/repo-a',
  lastSelectedAt: '2026-03-14T12:34:56.000Z',
  storagePath: '/tmp/spec-workflow-desktop/desktop-settings.json',
  statusLabel: 'Status: Project ready',
  issues: [],
  projects: [
    {
      projectId: 'project-a',
      projectName: 'repo-a',
      workspacePath: '/tmp/repo-a',
      workflowRootPath: '/tmp/repo-a',
      connectionState: 'live',
      source: 'mcp',
      addedAt: '2026-03-14T10:00:00.000Z',
      lastSeenAt: '2026-03-14T12:34:56.000Z',
      gitBranch: 'feature/demo',
      latestSpec: {
        name: 'alpha-spec',
        displayName: 'Alpha Spec',
        createdAt: '2026-03-14T09:00:00.000Z'
      },
      pendingApprovalCount: 2,
      latestImplementation: {
        taskId: '1.2',
        summary: 'Added project home recovery state',
        timestamp: '2026-03-14T11:15:00.000Z',
        specName: 'desktop-rewrite',
        specDisplayName: 'Desktop Rewrite'
      },
      instanceCount: 1
    }
  ]
};

describe('App', () => {
  beforeEach(() => {
    window.desktop = createDesktopApiMock();
  });

  afterEach(() => {
    delete window.desktop;
    vi.restoreAllMocks();
  });

  it('hydrates shell state from the preload bridge', async () => {
    render(<App />);

    expect(
      screen.getByRole('heading', { name: 'Spec Workflow Desktop' })
    ).toBeInTheDocument();
    expect(
      await screen.findByText('Alpha Spec')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Status: Project ready')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /repo-a \/tmp\/repo-a/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText('2 approvals')
    ).toBeInTheDocument();
  });

  it('invokes the native folder picker through the desktop bridge', async () => {
    const user = userEvent.setup();
    const pickProjectDirectory = vi.fn<DesktopApi['pickProjectDirectory']>().mockResolvedValue({
      canceled: false,
      path: '/tmp/repo-b'
    });
    window.desktop = createDesktopApiMock({
      pickProjectDirectory
    });

    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'Choose project folder' }));

    expect(pickProjectDirectory).toHaveBeenCalledTimes(1);
  });

  it('forgets a remembered project through the desktop bridge', async () => {
    const user = userEvent.setup();
    const forgetProject = vi.fn<DesktopApi['forgetProject']>().mockResolvedValue(undefined);
    window.desktop = createDesktopApiMock({
      forgetProject
    });

    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'Forget project' }));

    expect(forgetProject).toHaveBeenCalledWith('project-a');
  });

  it('switches workspace modes without leaving the desktop shell', async () => {
    const user = userEvent.setup();

    render(<App />);

    await screen.findByText('Alpha Spec');
    await user.keyboard('3');

    expect(await screen.findByText('Approval inbox')).toBeInTheDocument();
    expect(await screen.findByText('2 items waiting for review')).toBeInTheDocument();
  });
});

function createDesktopApiMock(
  overrides: Partial<DesktopApi> = {}
): DesktopApi {
  return {
    getRuntimeInfo: () => shellState.runtime,
    getShellState: vi.fn().mockResolvedValue(shellState),
    pickProjectDirectory: vi.fn().mockResolvedValue({
      canceled: true,
      path: null
    }),
    rememberProjectPath: vi.fn().mockResolvedValue(undefined),
    forgetProject: vi.fn().mockResolvedValue(undefined),
    onShellStateChanged: vi.fn().mockReturnValue(() => undefined),
    ...overrides
  };
}
