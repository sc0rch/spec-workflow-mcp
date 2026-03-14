import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationProvider } from './NotificationProvider';

const apiState = {
  approvals: [] as Array<{ id: string; title: string }>,
  specs: [] as Array<{ name: string; displayName: string }>,
  getSpecTasksProgress: vi.fn(),
};

const subscribe = vi.fn();
const unsubscribe = vi.fn();

vi.mock('../api/api', () => ({
  useApi: () => apiState,
}));

vi.mock('../ws/WebSocketProvider', () => ({
  useWs: () => ({
    subscribe,
    unsubscribe,
  }),
}));

function NotificationProbe() {
  return <div data-testid="probe" />;
}

describe('NotificationProvider', () => {
  beforeEach(() => {
    apiState.approvals = [];
    apiState.specs = [];
    apiState.getSpecTasksProgress.mockReset();
    subscribe.mockReset();
    unsubscribe.mockReset();
  });

  it('waits for specs before bootstrapping task baseline', async () => {
    apiState.getSpecTasksProgress.mockResolvedValue({
      total: 1,
      completed: 0,
      inProgress: null,
      taskList: [],
    });

    const view = render(
      <NotificationProvider>
        <NotificationProbe />
      </NotificationProvider>
    );

    expect(apiState.getSpecTasksProgress).not.toHaveBeenCalled();

    apiState.specs = [{ name: 'alpha', displayName: 'Alpha' }];
    view.rerender(
      <NotificationProvider>
        <NotificationProbe />
      </NotificationProvider>
    );

    await waitFor(() => {
      expect(apiState.getSpecTasksProgress).toHaveBeenCalledWith('alpha');
    });
  });

  it('skips initial approvals and only notifies on newly added ones', async () => {
    apiState.approvals = [{ id: 'approval-1', title: 'Requirements' }];

    const view = render(
      <NotificationProvider>
        <NotificationProbe />
      </NotificationProvider>
    );

    expect(screen.queryByText('New approval request: Requirements')).not.toBeInTheDocument();

    apiState.approvals = [
      { id: 'approval-1', title: 'Requirements' },
      { id: 'approval-2', title: 'Design' },
    ];
    view.rerender(
      <NotificationProvider>
        <NotificationProbe />
      </NotificationProvider>
    );

    expect(await screen.findByText('New approval request: Design')).toBeInTheDocument();
  });
});
