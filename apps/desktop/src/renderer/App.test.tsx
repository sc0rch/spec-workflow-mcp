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
  issues: []
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
      await screen.findByText('/tmp/repo-a')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Status: Project ready')
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
    onShellStateChanged: vi.fn().mockReturnValue(() => undefined),
    ...overrides
  };
}
