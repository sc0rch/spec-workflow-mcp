import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {
  DesktopApi,
  DesktopApprovalReview,
  DesktopProjectWorkspace,
  DesktopShellState
} from '../shared/desktop-api.js';
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
      addedAt: '2026-03-14T10:00:00.000Z',
      gitBranch: 'feature/demo',
      latestSpec: {
        name: 'desktop-rewrite',
        displayName: 'Desktop Rewrite',
        createdAt: '2026-03-14T09:00:00.000Z',
        lastModified: '2026-03-14T12:10:00.000Z'
      },
      pendingApprovalCount: 2,
      latestImplementation: {
        taskId: '1.2',
        summary: 'Added project home recovery state',
        timestamp: '2026-03-14T11:15:00.000Z',
        specName: 'desktop-rewrite',
        specDisplayName: 'Desktop Rewrite'
      }
    }
  ]
};

const multiProjectShellState: DesktopShellState = {
  ...shellState,
  projects: [
    ...shellState.projects,
    {
      projectId: 'project-b',
      projectName: 'repo-b',
      workspacePath: '/tmp/repo-b',
      workflowRootPath: '/tmp/repo-b',
      addedAt: '2026-03-14T10:30:00.000Z',
      gitBranch: 'feature/other',
      latestSpec: {
        name: 'review-refresh',
        displayName: 'Review Refresh',
        createdAt: '2026-03-14T10:45:00.000Z',
        lastModified: '2026-03-14T12:00:00.000Z'
      },
      pendingApprovalCount: 0,
      latestImplementation: {
        taskId: '2.1',
        summary: 'Prepared another workspace',
        timestamp: '2026-03-14T12:05:00.000Z',
        specName: 'review-refresh',
        specDisplayName: 'Review Refresh'
      }
    }
  ]
};

const projectWorkspace: DesktopProjectWorkspace = {
  specs: [
    {
      name: 'desktop-rewrite',
      displayName: 'Desktop Rewrite',
      lastModified: '2026-03-14T12:10:00.000Z',
      phaseState: 'active',
      phases: {
        requirements: {
          exists: true,
          lastModified: '2026-03-14T09:10:00.000Z',
          content: '# Requirements\nKeep restart recovery obvious.'
        },
        design: {
          exists: true,
          lastModified: '2026-03-14T10:10:00.000Z',
          content: '# Design\nUse a left rail and detail panel.'
        },
        tasks: {
          exists: true,
          lastModified: '2026-03-14T11:10:00.000Z',
          content: '- [-] 1.1 Build desktop shell\n- [ ] 1.2 Add approval inbox'
        }
      },
      taskSummary: {
        total: 2,
        completed: 0,
        pending: 1,
        inProgress: 1
      },
      pendingApprovalCount: 1,
      tasks: [
        {
          id: '1.1',
          description: 'Build desktop shell',
          status: 'in-progress',
          lineNumber: 0,
          indentLevel: 0,
          isHeader: false,
          purposes: ['Introduce Electron shell'],
          implementationDetails: ['Keep project recovery obvious.'],
          prompt: 'Role: Desktop engineer | Task: Build shell'
        },
        {
          id: '1.2',
          description: 'Add approval inbox',
          status: 'pending',
          lineNumber: 1,
          indentLevel: 0,
          isHeader: false,
          requirements: ['REQ-1'],
          files: ['apps/desktop/src/renderer/App.tsx'],
          purposes: ['Show approval queue state'],
          prompt: 'Role: UI engineer | Task: Add queue-first review'
        }
      ],
      activeTask: {
        id: '1.1',
        description: 'Build desktop shell',
        status: 'in-progress'
      },
      nextTask: {
        id: '1.2',
        description: 'Add approval inbox',
        status: 'pending'
      },
      latestImplementation: {
        taskId: '1.2',
        summary: 'Added project home recovery state',
        timestamp: '2026-03-14T11:15:00.000Z'
      },
      implementationEntries: [
        {
          id: 'log-1',
          taskId: '1.2',
          summary: 'Added project home recovery state',
          timestamp: '2026-03-14T11:15:00.000Z',
          filesModified: ['apps/desktop/src/renderer/App.tsx'],
          filesCreated: []
        }
      ]
    },
    {
      name: 'approval-inbox',
      displayName: 'Approval Inbox',
      lastModified: '2026-03-14T12:20:00.000Z',
      phaseState: 'ready',
      phases: {
        requirements: {
          exists: true,
          lastModified: '2026-03-14T09:20:00.000Z',
          content: '# Requirements\nMake review fast.'
        },
        design: {
          exists: true,
          lastModified: '2026-03-14T10:20:00.000Z',
          content: '# Design\nReviewer flow ready for keyboard review.'
        },
        tasks: {
          exists: true,
          lastModified: '2026-03-14T11:20:00.000Z',
          content: '- [ ] 2.1 Add queue-first review'
        }
      },
      taskSummary: {
        total: 1,
        completed: 0,
        pending: 1,
        inProgress: 0
      },
      pendingApprovalCount: 1,
      tasks: [
        {
          id: '2.1',
          description: 'Add queue-first review',
          status: 'pending',
          lineNumber: 0,
          indentLevel: 0,
          isHeader: true
        }
      ],
      nextTask: {
        id: '2.1',
        description: 'Add queue-first review',
        status: 'pending'
      },
      implementationEntries: []
    }
  ],
  pendingApprovals: [
    {
      approvalId: 'approval-1',
      title: 'Review desktop shell',
      filePath: '.spec-workflow/specs/desktop-rewrite/requirements.md',
      type: 'document',
      category: 'spec',
      categoryName: 'desktop-rewrite',
      createdAt: '2026-03-14T11:00:00.000Z'
    },
    {
      approvalId: 'approval-2',
      title: 'Review approval inbox',
      filePath: 'src/core/approval-storage.ts',
      type: 'document',
      category: 'spec',
      categoryName: 'approval-inbox',
      createdAt: '2026-03-14T11:30:00.000Z'
    }
  ]
};

const approvalReview: DesktopApprovalReview = {
  approval: {
    id: 'approval-1',
    title: 'Review desktop shell',
    filePath: '.spec-workflow/specs/desktop-rewrite/requirements.md',
    type: 'document',
    status: 'pending',
    createdAt: '2026-03-14T11:00:00.000Z',
    category: 'spec',
    categoryName: 'desktop-rewrite'
  },
  currentContent: '# Requirements\n\nKeep restart recovery obvious.\n\n```ts\nconst ready = true;\n```\n',
  draft: null,
  diff: {
    additions: 6,
    deletions: 0,
    changes: 0,
    chunks: [
      {
        oldStart: 1,
        oldLines: 0,
        newStart: 1,
        newLines: 6,
        lines: [
          {
            type: 'add',
            newLineNumber: 1,
            content: '# Requirements'
          },
          {
            type: 'add',
            newLineNumber: 2,
            content: ''
          },
          {
            type: 'add',
            newLineNumber: 3,
            content: 'Keep restart recovery obvious.'
          },
          {
            type: 'add',
            newLineNumber: 4,
            content: ''
          },
          {
            type: 'add',
            newLineNumber: 5,
            content: '```ts'
          },
          {
            type: 'add',
            newLineNumber: 6,
            content: 'const ready = true;'
          }
        ]
      }
    ]
  }
};

const approvalInboxReview: DesktopApprovalReview = {
  approval: {
    id: 'approval-2',
    title: 'Review approval inbox',
    filePath: 'src/core/approval-storage.ts',
    type: 'document',
    status: 'pending',
    createdAt: '2026-03-14T11:30:00.000Z',
    category: 'spec',
    categoryName: 'approval-inbox'
  },
  currentContent: 'export const approvalStorage = true;\n',
  draft: null,
  diff: {
    additions: 1,
    deletions: 0,
    changes: 0,
    chunks: [
      {
        oldStart: 1,
        oldLines: 0,
        newStart: 1,
        newLines: 1,
        lines: [
          {
            type: 'add',
            newLineNumber: 1,
            content: 'export const approvalStorage = true;'
          }
        ]
      }
    ]
  }
};

describe('App', () => {
  beforeEach(() => {
    window.desktop = createDesktopApiMock();
  });

  afterEach(() => {
    delete window.desktop;
    vi.restoreAllMocks();
  });

  it('hydrates shell state and project workspace from the preload API', async () => {
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Inbox' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'repo-a' })
    ).toBeInTheDocument();
    expect(screen.getByText(/feature\/demo · Desktop Rewrite/i)).toBeInTheDocument();
    expect(
      screen.getAllByText('Review desktop shell')
    ).toHaveLength(1);
    expect(
      screen.getByText('Desktop Rewrite · .spec-workflow/specs/desktop-rewrite/requirements.md')
    ).toBeInTheDocument();
    expect(screen.getByText('Desktop Rewrite · 1.2')).toBeInTheDocument();
  });

  it('invokes the native folder picker through the desktop API', async () => {
    const user = userEvent.setup();
    const pickProjectDirectory = vi.fn<DesktopApi['pickProjectDirectory']>().mockResolvedValue({
      canceled: false,
      path: '/tmp/repo-b'
    });
    window.desktop = createDesktopApiMock({
      pickProjectDirectory
    });

    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'Add folder' }));

    expect(pickProjectDirectory).toHaveBeenCalledTimes(1);
  });

  it('renders a compact shell status indicator instead of a diagnostics button', async () => {
    render(<App />);

    await screen.findByRole('heading', { name: 'Inbox' });

    expect(screen.getByRole('status', { name: 'Shell Ready' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Shell Ready' })).not.toBeInTheDocument();
  });

  it('shows a warning shell indicator when startup checks report warnings', async () => {
    window.desktop = createDesktopApiMock({
      getShellState: vi.fn().mockResolvedValue({
        ...shellState,
        issues: [
          {
            code: 'tray-icon-missing',
            severity: 'warning',
            message: 'Tray menu is unavailable. Icon asset is missing.'
          }
        ]
      })
    });

    render(<App />);

    await screen.findByRole('heading', { name: 'Inbox' });
    const indicator = screen.getByRole('status', { name: 'Shell Warnings' });
    expect(indicator).toHaveAttribute(
      'title',
      'Tray menu is unavailable. Icon asset is missing.'
    );
  });

  it('shows an error shell indicator with tooltip text when the desktop shell reports an error', async () => {
    window.desktop = createDesktopApiMock({
      getShellState: vi.fn().mockResolvedValue({
        ...shellState,
        issues: [
          {
            code: 'storage-unwritable',
            severity: 'error',
            message: 'Selected project could not be persisted. Disk is read-only.'
          }
        ]
      })
    });

    render(<App />);

    const indicator = await screen.findByRole('status', { name: 'Shell Attention' });
    expect(indicator).toHaveAttribute(
      'title',
      'Selected project could not be persisted. Disk is read-only.'
    );
  });

  it('forgets a remembered project through the desktop API', async () => {
    const user = userEvent.setup();
    const forgetProject = vi.fn<DesktopApi['forgetProject']>().mockResolvedValue(undefined);
    window.desktop = createDesktopApiMock({
      forgetProject
    });

    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'repo-a' }));

    expect((await screen.findAllByText('Latest spec: Desktop Rewrite')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('feature/demo').length).toBeGreaterThan(0);

    await user.click(await screen.findByRole('button', { name: 'Forget repo-a' }));

    expect(forgetProject).toHaveBeenCalledWith('project-a');
  });

  it('opens the project picker as a dialog with a labeled control relationship', async () => {
    const user = userEvent.setup();

    render(<App />);

    const trigger = await screen.findByRole('button', { name: 'repo-a' });
    await user.click(trigger);

    const dialog = await screen.findByRole('dialog', { name: 'Project picker' });
    expect(trigger).toHaveAttribute('aria-controls', dialog.id);
    expect(dialog).toBeInTheDocument();
  });

  it('supports keyboard open and close focus management for the project picker', async () => {
    render(<App />);

    const trigger = await screen.findByRole('button', { name: 'repo-a' });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });

    const dialog = await screen.findByRole('dialog', { name: 'Project picker' });
    const selectedProjectButton = within(dialog).getByRole('button', { name: /^repo-a/i });

    await waitFor(() => {
      expect(selectedProjectButton).toHaveFocus();
    });

    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });

  it('supports keyboard-friendly spec and approval navigation', async () => {
    render(<App />);

    await screen.findByRole('heading', { name: 'Inbox' });
    fireEvent.keyDown(window, { key: '2' });

    expect(await screen.findByRole('heading', { name: 'Specs' })).toBeInTheDocument();
    expect(await screen.findByRole('document', { name: 'Desktop Rewrite Requirements' })).toBeInTheDocument();
    expect(await screen.findByText('Keep restart recovery obvious.')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'l' });

    expect(await screen.findByRole('document', { name: 'Approval Inbox Requirements' })).toBeInTheDocument();
    expect(await screen.findByText('Make review fast.')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(await screen.findByRole('heading', { name: 'Inbox' })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: '3' });

    expect(await screen.findByRole('heading', { name: 'Approvals' })).toBeInTheDocument();
    expect(await screen.findByText('Select text, then add a comment.')).toBeInTheDocument();
    expect(await screen.findByText(/Keep restart recovery obvious/)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'l' });

    expect(await screen.findByRole('button', { name: /^Reject$/i })).toBeEnabled();
    expect(
      await screen.findByText('+ export const approvalStorage = true;')
    ).toBeInTheDocument();
  });

  it('routes across workspace and approvals through the command palette', async () => {
    const user = userEvent.setup();

    render(<App />);

    await screen.findByRole('heading', { name: 'Inbox' });
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

    expect(
      await screen.findByRole('dialog', { name: 'Command palette' })
    ).toBeInTheDocument();
    const commandSearch = screen.getByRole('combobox', { name: 'Command search' });
    expect(commandSearch).toHaveAttribute('aria-controls');
    expect(commandSearch).toHaveAttribute('aria-expanded', 'true');

    await user.type(commandSearch, 'design document');
    await user.keyboard('{Enter}');

    expect(await screen.findByRole('document', { name: 'Desktop Rewrite Design' })).toBeInTheDocument();
    expect(await screen.findByText('Use a left rail and detail panel.')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    await user.type(screen.getByRole('combobox', { name: 'Command search' }), 'review approval inbox');
    await user.keyboard('{Enter}');

    expect(await screen.findByRole('heading', { name: 'Approvals' })).toBeInTheDocument();
    expect(await screen.findByText(/src\/core\/approval-storage\.ts/)).toBeInTheDocument();
  });

  it('traps focus inside the command palette and restores focus on close', async () => {
    const user = userEvent.setup();

    render(<App />);

    const searchTrigger = await screen.findByRole('button', { name: 'Search' });
    searchTrigger.focus();
    await user.click(searchTrigger);

    const commandSearch = await screen.findByRole('combobox', { name: 'Command search' });
    expect(commandSearch).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('button', { name: 'Close command palette' })).toHaveFocus();

    await user.tab();
    expect(commandSearch).toHaveFocus();

    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(searchTrigger).toHaveFocus();
    });
  });

  it('reloads inbox data when the desktop API pushes a new shell state', async () => {
    const listeners: Array<(nextState: DesktopShellState) => void> = [];
    const nextShellState: DesktopShellState = {
      ...shellState,
      projects: [
        {
          ...shellState.projects[0],
          pendingApprovalCount: 1,
          latestSpec: {
            name: 'approval-inbox',
            displayName: 'Approval Inbox',
            createdAt: '2026-03-14T09:30:00.000Z',
            lastModified: '2026-03-14T13:00:00.000Z'
          }
        }
      ]
    };
    const nextWorkspace: DesktopProjectWorkspace = {
      ...projectWorkspace,
      specs: projectWorkspace.specs.map((spec) => ({
        ...spec,
        pendingApprovalCount: spec.name === 'approval-inbox' ? 1 : 0
      })),
      pendingApprovals: [
        {
          approvalId: 'approval-3',
          title: 'Review approval hot reload',
          filePath: '.spec-workflow/specs/approval-inbox/tasks.md',
          type: 'document',
          category: 'spec',
          categoryName: 'approval-inbox',
          createdAt: '2026-03-14T13:00:00.000Z'
        }
      ]
    };
    let workspaceRequestCount = 0;
    const getProjectWorkspace = vi.fn<DesktopApi['getProjectWorkspace']>().mockImplementation(async () => {
      workspaceRequestCount += 1;
      return workspaceRequestCount > 1 ? nextWorkspace : projectWorkspace;
    });

    window.desktop = createDesktopApiMock({
      getProjectWorkspace,
      onShellStateChanged: vi.fn((listener) => {
        listeners.push(listener);
        return () => undefined;
      })
    });

    render(<App />);

    await screen.findByRole('heading', { name: 'Inbox' });
    await waitFor(() => {
      expect(listeners.length).toBeGreaterThan(0);
    });
    await act(async () => {
      listeners.at(-1)?.(nextShellState);
    });

    await waitFor(() => {
      expect(screen.getByText('Review approval hot reload')).toBeInTheDocument();
    });
  });

  it('does not reload the active workspace when a shell-state push only changes another project', async () => {
    const listeners: Array<(nextState: DesktopShellState) => void> = [];
    const getProjectWorkspace = vi.fn<DesktopApi['getProjectWorkspace']>().mockResolvedValue(projectWorkspace);

    window.desktop = createDesktopApiMock({
      getShellState: vi.fn().mockResolvedValue(multiProjectShellState),
      getProjectWorkspace,
      onShellStateChanged: vi.fn((listener) => {
        listeners.push(listener);
        return () => undefined;
      })
    });

    render(<App />);

    await screen.findByRole('heading', { name: 'Inbox' });
    expect(getProjectWorkspace).toHaveBeenCalledTimes(1);

    await act(async () => {
      listeners.at(-1)?.({
        ...multiProjectShellState,
        projects: multiProjectShellState.projects.map((project) =>
          project.projectId === 'project-b'
            ? {
                ...project,
                pendingApprovalCount: 3,
                latestSpec: {
                  ...project.latestSpec!,
                  lastModified: '2026-03-14T13:15:00.000Z'
                }
              }
            : project
        )
      });
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(getProjectWorkspace).toHaveBeenCalledTimes(1);
  });

  it('cycles workspace documents with Tab and Shift+Tab outside the editor', async () => {
    render(<App />);

    await screen.findByRole('heading', { name: 'Inbox' });
    fireEvent.keyDown(window, { key: '2' });

    expect(await screen.findByRole('document', { name: 'Desktop Rewrite Requirements' })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Tab' });

    expect(await screen.findByRole('document', { name: 'Desktop Rewrite Design' })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Tab' });

    expect(await screen.findByRole('document', { name: 'Desktop Rewrite Tasks (Markdown)' })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Tab' });

    expect(await screen.findByRole('button', { name: 'Tasks (Kanban)' })).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByRole('heading', { name: 'Pending' })).toBeInTheDocument();
    expect(screen.queryByText('Read only')).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });

    expect(await screen.findByRole('document', { name: 'Desktop Rewrite Tasks (Markdown)' })).toBeInTheDocument();
  });

  it('keeps specs read-only in the workspace view', async () => {
    render(<App />);

    await screen.findByRole('heading', { name: 'Inbox' });
    fireEvent.keyDown(window, { key: '2' });

    expect(await screen.findByRole('document', { name: 'Desktop Rewrite Requirements' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Save/i })).not.toBeInTheDocument();
  });

  it('responds to approvals through keyboard shortcuts and auto-advances to the next item', async () => {
    const respondToApproval = vi.fn<DesktopApi['respondToApproval']>().mockResolvedValue(undefined);
    const nextWorkspace: DesktopProjectWorkspace = {
      ...projectWorkspace,
      specs: projectWorkspace.specs.map((spec) => ({
        ...spec,
        pendingApprovalCount: spec.name === 'desktop-rewrite' ? 0 : spec.pendingApprovalCount
      })),
      pendingApprovals: [projectWorkspace.pendingApprovals[1]]
    };
    let workspaceRequestCount = 0;
    const getProjectWorkspace = vi.fn<DesktopApi['getProjectWorkspace']>().mockImplementation(async () => {
      workspaceRequestCount += 1;
      return workspaceRequestCount > 1 ? nextWorkspace : projectWorkspace;
    });
    window.desktop = createDesktopApiMock({
      respondToApproval,
      getProjectWorkspace
    });

    render(<App />);

    await screen.findByRole('heading', { name: 'Inbox' });
    fireEvent.keyDown(window, { key: '3' });
    await screen.findByRole('heading', { name: 'Approvals' });
    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });

    expect(respondToApproval).toHaveBeenCalledWith(
      'project-a',
      'approval-1',
      'approve',
      'Approved.',
      []
    );
    expect(await screen.findByText(/src\/core\/approval-storage\.ts/)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /^Reject$/i })).toBeEnabled();
  });

  it('allows rejecting an approval without comments', async () => {
    const user = userEvent.setup();
    const respondToApproval = vi.fn<DesktopApi['respondToApproval']>().mockResolvedValue(undefined);
    window.desktop = createDesktopApiMock({
      respondToApproval
    });

    render(<App />);

    await screen.findByRole('heading', { name: 'Inbox' });
    fireEvent.keyDown(window, { key: '3' });
    await screen.findByRole('heading', { name: 'Approvals' });

    await user.click(screen.getByRole('button', { name: /^Reject$/i }));

    expect(respondToApproval).toHaveBeenCalledWith(
      'project-a',
      'approval-1',
      'reject',
      'Rejected.',
      []
    );
  });

  it('switches from approve/reject to request revisions after a comment is saved', async () => {
    const user = userEvent.setup();
    const respondToApproval = vi.fn<DesktopApi['respondToApproval']>().mockResolvedValue(undefined);
    window.desktop = createDesktopApiMock({
      respondToApproval
    });

    render(<App />);

    await screen.findByRole('heading', { name: 'Inbox' });
    fireEvent.keyDown(window, { key: '3' });
    await screen.findByRole('heading', { name: 'Approvals' });

    expect(screen.getByRole('button', { name: /^Approve$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Reject$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Request revisions/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add comment' }));
    const commentField = await screen.findByLabelText('Approval comment');
    await user.type(
      commentField,
      'Clarify how restart recovery behaves after reconnect.'
    );
    await user.click(screen.getByRole('button', { name: 'Save comment' }));

    expect(screen.queryByRole('button', { name: /^Approve$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Reject$/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Request revisions/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Request revisions/i }));

    expect(respondToApproval).toHaveBeenCalledWith(
      'project-a',
      'approval-1',
      'reject',
      'Clarify how restart recovery behaves after reconnect.',
      [
        expect.objectContaining({
          type: 'general',
          comment: 'Clarify how restart recovery behaves after reconnect.'
        })
      ]
    );
  });

  it('keeps approval comment drafts when Escape is pressed inside the comment textarea', async () => {
    const user = userEvent.setup();

    render(<App />);

    await screen.findByRole('heading', { name: 'Inbox' });
    fireEvent.keyDown(window, { key: '3' });
    await screen.findByRole('heading', { name: 'Approvals' });
    await user.click(screen.getByRole('button', { name: 'Add comment' }));

    const commentField = await screen.findByLabelText('Approval comment');
    await user.type(commentField, 'Keep this draft.');
    await user.keyboard('{Escape}');

    expect(screen.getByRole('heading', { name: 'Approvals' })).toBeInTheDocument();
    expect(screen.getByLabelText('Approval comment')).toHaveValue('Keep this draft.');
  });

  it('autosaves approval draft comments through the desktop API', async () => {
    const user = userEvent.setup();
    const saveApprovalDraft = vi.fn<DesktopApi['saveApprovalDraft']>().mockResolvedValue(undefined);
    window.desktop = createDesktopApiMock({
      saveApprovalDraft
    });

    render(<App />);

    await screen.findByRole('heading', { name: 'Inbox' });
    fireEvent.keyDown(window, { key: '3' });
    await screen.findByRole('heading', { name: 'Approvals' });
    await user.click(screen.getByRole('button', { name: 'Add comment' }));

    const commentField = await screen.findByLabelText('Approval comment');
    await user.type(commentField, 'Persist this review note.');
    await user.click(screen.getByRole('button', { name: 'Save comment' }));

    await waitFor(() => {
      expect(saveApprovalDraft).toHaveBeenCalledWith(
        'project-a',
        'approval-1',
        expect.objectContaining({
          comments: [
            expect.objectContaining({
              type: 'general',
              comment: 'Persist this review note.'
            })
          ]
        })
      );
    });
  });
});

function createDesktopApiMock(
  overrides: Partial<DesktopApi> = {}
): DesktopApi {
  return {
    getRuntimeInfo: () => shellState.runtime,
    getShellState: vi.fn().mockResolvedValue(shellState),
    getProjectWorkspace: vi.fn().mockResolvedValue(projectWorkspace),
    getApprovalReview: vi.fn().mockImplementation((_projectId, approvalId) => Promise.resolve(
      approvalId === 'approval-2' ? approvalInboxReview : approvalReview
    )),
    saveApprovalDraft: vi.fn().mockResolvedValue(undefined),
    saveSpecDocument: vi.fn().mockResolvedValue({
      filePath: '/tmp/repo-a/.spec-workflow/specs/desktop-rewrite/requirements.md',
      savedAt: '2026-03-14T12:40:00.000Z'
    }),
    respondToApproval: vi.fn().mockResolvedValue(undefined),
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
