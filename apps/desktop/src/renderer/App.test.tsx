import { fireEvent, render, screen } from '@testing-library/react';
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
      connectionState: 'live',
      source: 'mcp',
      addedAt: '2026-03-14T10:00:00.000Z',
      lastSeenAt: '2026-03-14T12:34:56.000Z',
      gitBranch: 'feature/demo',
      latestSpec: {
        name: 'desktop-rewrite',
        displayName: 'Desktop Rewrite',
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

const rememberedOnlyShellState: DesktopShellState = {
  ...shellState,
  projects: shellState.projects.map((project) => ({
    ...project,
    connectionState: 'remembered',
    instanceCount: 0
  }))
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

  it('hydrates shell state and project workspace from the preload bridge', async () => {
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Inbox' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'repo-a' })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/2 approvals/)
    ).toBeInTheDocument();
    expect(
      screen.getAllByText('Review desktop shell')
    ).toHaveLength(1);
    expect(
      screen.getByText('Desktop Rewrite · .spec-workflow/specs/desktop-rewrite/requirements.md')
    ).toBeInTheDocument();
    expect(screen.getByText('Desktop Rewrite · 1.2')).toBeInTheDocument();
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

    await user.click(await screen.findByRole('button', { name: 'Add folder' }));

    expect(pickProjectDirectory).toHaveBeenCalledTimes(1);
  });

  it('shows MCP visibility diagnostics for live workspaces and runtime details', async () => {
    const user = userEvent.setup();

    render(<App />);

    await screen.findByRole('heading', { name: 'Inbox' });
    await user.click(screen.getByRole('button', { name: 'Open MCP status' }));

    expect(await screen.findByRole('heading', { name: 'MCP status' })).toBeInTheDocument();
    expect(screen.getAllByText('1 live')).toHaveLength(3);
    expect(screen.getAllByText('/tmp/repo-a')).toHaveLength(2);
    expect(screen.getByText('Runtime details')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('heading', { name: 'MCP status' })).not.toBeInTheDocument();
  });

  it('shows waiting guidance when projects are remembered but MCP is not attached', async () => {
    const user = userEvent.setup();
    window.desktop = createDesktopApiMock({
      getShellState: vi.fn().mockResolvedValue(rememberedOnlyShellState)
    });

    render(<App />);

    await screen.findByRole('heading', { name: 'Inbox' });
    await user.click(screen.getByRole('button', { name: 'Open MCP status' }));

    expect(await screen.findAllByText('Waiting')).toHaveLength(2);
    expect(screen.getAllByText('Saved')).toHaveLength(1);
    expect(
      screen.getByText('Open a saved project in Codex and run any tool or prompt to start a live MCP session.')
    ).toBeInTheDocument();
  });

  it('forgets a remembered project through the desktop bridge', async () => {
    const user = userEvent.setup();
    const forgetProject = vi.fn<DesktopApi['forgetProject']>().mockResolvedValue(undefined);
    window.desktop = createDesktopApiMock({
      forgetProject
    });

    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'repo-a' }));
    await user.click(await screen.findByRole('button', { name: 'Forget repo-a' }));

    expect(forgetProject).toHaveBeenCalledWith('project-a');
  });

  it('supports keyboard-friendly spec and approval navigation', async () => {
    const user = userEvent.setup();

    render(<App />);

    await screen.findByRole('heading', { name: 'Inbox' });
    await user.keyboard('2');

    expect(await screen.findByText('Spec editor')).toBeInTheDocument();
    expect(await screen.findByText('Press Cmd/Ctrl+S to save. Press Esc to return to Inbox.')).toBeInTheDocument();
    expect(await screen.findByText(/Current task: 1\.1 Build desktop shell/)).toBeInTheDocument();

    await user.keyboard('l');

    expect(await screen.findByLabelText('Approval Inbox Requirements')).toHaveValue(
      '# Requirements\nMake review fast.'
    );

    await user.keyboard('{Escape}');

    expect(await screen.findByRole('heading', { name: 'Inbox' })).toBeInTheDocument();

    await user.keyboard('3');

    expect(await screen.findByRole('heading', { name: 'Approvals' })).toBeInTheDocument();
    expect(await screen.findByText('Select text to comment on a specific passage.')).toBeInTheDocument();
    expect(await screen.findByText('Keep restart recovery obvious.')).toBeInTheDocument();

    await user.keyboard('l');

    expect(await screen.findByRole('button', { name: /Reject/i })).toBeDisabled();
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

    await user.type(screen.getByLabelText('Command search'), 'design document');
    await user.keyboard('{Enter}');

    expect(await screen.findByText('Spec editor')).toBeInTheDocument();
    expect(await screen.findByLabelText('Desktop Rewrite Design')).toHaveValue(
      '# Design\nUse a left rail and detail panel.'
    );

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    await user.type(screen.getByLabelText('Command search'), 'review approval inbox');
    await user.keyboard('{Enter}');

    expect(await screen.findByRole('heading', { name: 'Approvals' })).toBeInTheDocument();
    expect(await screen.findByText(/src\/core\/approval-storage\.ts/)).toBeInTheDocument();
  });

  it('cycles workspace documents with Tab and Shift+Tab outside the editor', async () => {
    const user = userEvent.setup();

    render(<App />);

    await screen.findByRole('heading', { name: 'Inbox' });
    await user.keyboard('2');

    expect(await screen.findByLabelText('Desktop Rewrite Requirements')).toBeInTheDocument();

    await user.keyboard('{Tab}');

    expect(await screen.findByLabelText('Desktop Rewrite Design')).toBeInTheDocument();

    await user.keyboard('{Shift>}{Tab}{/Shift}');

    expect(await screen.findByLabelText('Desktop Rewrite Requirements')).toBeInTheDocument();
  });

  it('saves spec documents through the desktop bridge with a keyboard shortcut', async () => {
    const user = userEvent.setup();
    const saveSpecDocument = vi.fn<DesktopApi['saveSpecDocument']>().mockResolvedValue({
      filePath: '/tmp/repo-a/.spec-workflow/specs/desktop-rewrite/requirements.md',
      savedAt: '2026-03-14T12:40:00.000Z'
    });
    window.desktop = createDesktopApiMock({
      saveSpecDocument
    });

    render(<App />);

    await screen.findByRole('heading', { name: 'Inbox' });
    await user.keyboard('2');
    const editor = await screen.findByLabelText('Desktop Rewrite Requirements');
    await user.clear(editor);
    await user.type(editor, '# Requirements\n\nPersist save state');
    await user.keyboard('{Control>}s{/Control}');

    expect(saveSpecDocument).toHaveBeenCalledWith(
      'project-a',
      'desktop-rewrite',
      'requirements',
      '# Requirements\n\nPersist save state'
    );
    expect(await screen.findByText(/Saved/)).toBeInTheDocument();
  });

  it('responds to approvals through keyboard shortcuts and auto-advances to the next item', async () => {
    const user = userEvent.setup();
    const respondToApproval = vi.fn<DesktopApi['respondToApproval']>().mockResolvedValue(undefined);
    const nextWorkspace: DesktopProjectWorkspace = {
      ...projectWorkspace,
      specs: projectWorkspace.specs.map((spec) => ({
        ...spec,
        pendingApprovalCount: spec.name === 'desktop-rewrite' ? 0 : spec.pendingApprovalCount
      })),
      pendingApprovals: [projectWorkspace.pendingApprovals[1]]
    };
    const getProjectWorkspace = vi.fn<DesktopApi['getProjectWorkspace']>()
      .mockResolvedValueOnce(projectWorkspace)
      .mockResolvedValueOnce(nextWorkspace);
    window.desktop = createDesktopApiMock({
      respondToApproval,
      getProjectWorkspace
    });

    render(<App />);

    await screen.findByRole('heading', { name: 'Inbox' });
    await user.keyboard('3');
    await screen.findByRole('heading', { name: 'Approvals' });
    await user.keyboard('{Control>}{Enter}{/Control}');

    expect(respondToApproval).toHaveBeenCalledWith(
      'project-a',
      'approval-1',
      'approve',
      'Approved.',
      []
    );
    expect(await screen.findByText(/src\/core\/approval-storage\.ts/)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Reject/i })).toBeDisabled();
  });

  it('keeps reject disabled until a comment is saved and sends comments with the review action', async () => {
    const user = userEvent.setup();
    const respondToApproval = vi.fn<DesktopApi['respondToApproval']>().mockResolvedValue(undefined);
    window.desktop = createDesktopApiMock({
      respondToApproval
    });

    render(<App />);

    await screen.findByRole('heading', { name: 'Inbox' });
    await user.keyboard('3');
    await screen.findByRole('heading', { name: 'Approvals' });

    const rejectButton = screen.getByRole('button', { name: /Reject/i });
    expect(rejectButton).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Add note' }));
    await user.type(
      screen.getByLabelText('Approval comment'),
      'Clarify how restart recovery behaves after reconnect.'
    );
    await user.click(screen.getByRole('button', { name: 'Save comment' }));

    expect(screen.getByRole('button', { name: /Reject/i })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: /Reject/i }));

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
    await user.keyboard('3');
    await screen.findByRole('heading', { name: 'Approvals' });
    await user.click(screen.getByRole('button', { name: 'Add note' }));

    const commentField = screen.getByLabelText('Approval comment');
    await user.type(commentField, 'Keep this draft.');
    await user.keyboard('{Escape}');

    expect(screen.getByRole('heading', { name: 'Approvals' })).toBeInTheDocument();
    expect(screen.getByLabelText('Approval comment')).toHaveValue('Keep this draft.');
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
