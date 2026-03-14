import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TasksPage } from './TasksPage';

const apiState = {
  specs: [
    {
      name: 'alpha',
      displayName: 'Alpha',
      taskProgress: { total: 2, completed: 1 },
    },
  ],
  info: {
    projectName: 'Workspace',
  },
  reloadAll: vi.fn(),
  getSpecTasksProgress: vi.fn(),
  updateTaskStatus: vi.fn(),
};

const subscribe = vi.fn();
const unsubscribe = vi.fn();
const showNotification = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string | number>) => {
      if (!values) {
        return key;
      }
      return `${key} ${Object.values(values).join(' ')}`;
    },
  }),
}));

vi.mock('../api/api', () => ({
  useApi: () => apiState,
  useApiActions: () => apiState,
}));

vi.mock('../ws/WebSocketProvider', () => ({
  useWs: () => ({
    subscribe,
    unsubscribe,
  }),
}));

vi.mock('../notifications/NotificationProvider', () => ({
  useNotifications: () => ({
    showNotification,
  }),
}));

vi.mock('../modals/AlertModal', () => ({
  AlertModal: () => null,
}));

describe('TasksPage', () => {
  beforeEach(() => {
    apiState.getSpecTasksProgress.mockReset();
    apiState.updateTaskStatus.mockReset();
    subscribe.mockReset();
    unsubscribe.mockReset();
    showNotification.mockReset();
    window.localStorage.clear();
  });

  it('renders the list-only task flow and filters tasks by status', async () => {
    apiState.getSpecTasksProgress.mockResolvedValue({
      total: 2,
      completed: 1,
      progress: 50,
      inProgress: '2',
      taskList: [
        { id: '1', description: 'Pending task', status: 'pending', completed: false, isHeader: false },
        { id: '2', description: 'Completed task', status: 'completed', completed: true, isHeader: false },
      ],
    });

    const { container } = render(
      <MemoryRouter initialEntries={['/tasks?spec=alpha']}>
        <TasksPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Pending task')).toBeInTheDocument();
    expect(screen.getByText('Completed task')).toBeInTheDocument();
    expect(screen.queryByText(/kanban/i)).not.toBeInTheDocument();

    const selects = container.querySelectorAll('select');
    fireEvent.change(selects[0], { target: { value: 'pending' } });

    await waitFor(() => {
      expect(screen.getByText('Pending task')).toBeInTheDocument();
      expect(screen.queryByText('Completed task')).not.toBeInTheDocument();
    });
  });

  it('sorts task cards by description and toggles sort order', async () => {
    apiState.getSpecTasksProgress.mockResolvedValue({
      total: 2,
      completed: 0,
      progress: 0,
      inProgress: null,
      taskList: [
        { id: '2', description: 'Zulu task', status: 'pending', completed: false, isHeader: false },
        { id: '1', description: 'Alpha task', status: 'pending', completed: false, isHeader: false },
      ],
    });

    const { container } = render(
      <MemoryRouter initialEntries={['/tasks?spec=alpha']}>
        <TasksPage />
      </MemoryRouter>
    );

    await screen.findByText('Zulu task');

    const selects = container.querySelectorAll('select');
    fireEvent.change(selects[1], { target: { value: 'description' } });

    await waitFor(() => {
      const taskCards = Array.from(container.querySelectorAll('[data-task-id]'));
      expect(taskCards[0]?.textContent).toContain('Alpha task');
      expect(taskCards[1]?.textContent).toContain('Zulu task');
    });

    const sortToggle = screen.getByTitle('tasksPage.sort.sortDescending');
    fireEvent.click(sortToggle);

    await waitFor(() => {
      const taskCards = Array.from(container.querySelectorAll('[data-task-id]'));
      expect(taskCards[0]?.textContent).toContain('Zulu task');
      expect(taskCards[1]?.textContent).toContain('Alpha task');
    });
  });
});
