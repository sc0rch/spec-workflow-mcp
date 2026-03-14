import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { DesktopProjectWorkspace } from '../../shared/desktop-api.js';
import { TaskKanbanBoard } from './TaskKanbanBoard.js';

const spec: DesktopProjectWorkspace['specs'][number] = {
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
      content: '- [-] 1.1 Build desktop shell\n- [ ] 1.2 Add approval inbox\n- [x] 1.3 Ship tray icon'
    }
  },
  taskSummary: {
    total: 3,
    completed: 1,
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
      prompt: 'Role: Desktop engineer | Task: Build shell',
      purposes: ['Introduce Electron shell']
    },
    {
      id: '1.2',
      description: 'Add approval inbox',
      status: 'pending',
      lineNumber: 1,
      indentLevel: 0,
      isHeader: false,
      requirements: ['REQ-1'],
      files: ['apps/desktop/src/renderer/App.tsx']
    },
    {
      id: '1.3',
      description: 'Ship tray icon',
      status: 'completed',
      lineNumber: 2,
      indentLevel: 0,
      isHeader: false,
      implementationDetails: ['Ship tray support with platform icon wiring.']
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
  implementationEntries: []
};

describe('TaskKanbanBoard', () => {
  it('renders tasks in three status columns and shows hover details', async () => {
    render(<TaskKanbanBoard spec={spec} />);

    expect(screen.getByRole('heading', { name: 'Pending' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'In progress' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Completed' })).toBeInTheDocument();
    expect(screen.getByText('Add approval inbox')).toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Prompt' }));

    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Role: Desktop engineer | Task: Build shell'
    );
  });

  it('preserves column scroll positions across task updates', async () => {
    const { rerender } = render(<TaskKanbanBoard spec={spec} />);
    const pendingColumn = screen.getByLabelText('Pending tasks');

    Object.defineProperty(pendingColumn, 'scrollTop', {
      configurable: true,
      writable: true,
      value: 120
    });

    fireEvent.scroll(pendingColumn);

    rerender(
      <TaskKanbanBoard
        spec={{
          ...spec,
          taskSummary: {
            ...spec.taskSummary,
            pending: 2,
            total: 4
          },
          tasks: [
            ...spec.tasks,
            {
              id: '1.4',
              description: 'Polish tray launch flow',
              status: 'pending',
              lineNumber: 3,
              indentLevel: 0,
              isHeader: false
            }
          ]
        }}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Pending tasks').scrollTop).toBe(120);
    });
  });
});
