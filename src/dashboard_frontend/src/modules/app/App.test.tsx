import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallbackOrValues?: string | Record<string, string>, values?: Record<string, string>) => {
      if (key === 'documentTitle' && typeof fallbackOrValues === 'object' && fallbackOrValues?.projectName) {
        return `${fallbackOrValues.projectName} - Spec Workflow MCP`;
      }
      if (typeof fallbackOrValues === 'string' && values?.projectName) {
        return fallbackOrValues.replace('{{projectName}}', values.projectName);
      }
      return typeof fallbackOrValues === 'string' ? fallbackOrValues : key;
    },
  }),
}));

vi.mock('../theme/ThemeProvider', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useTheme: () => ({
    theme: 'dark',
    toggleTheme: vi.fn(),
  }),
}));

vi.mock('../ws/WebSocketProvider', () => ({
  WebSocketProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useWs: () => ({
    connected: true,
    initial: undefined,
  }),
}));

vi.mock('../projects/ProjectProvider', () => ({
  ProjectProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useProjects: () => ({
    currentProjectId: null,
  }),
}));

vi.mock('../api/api', () => ({
  ApiProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useApi: () => ({
    info: {
      projectName: 'Workspace',
      version: '9.9.9',
    },
  }),
}));

vi.mock('../notifications/NotificationProvider', () => ({
  NotificationProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../components/I18nErrorBoundary', () => ({
  I18nErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../components/ProjectDropdown', () => ({
  ProjectDropdown: () => <div>project-dropdown</div>,
}));

vi.mock('../components/PageNavigationSidebar', () => ({
  PageNavigationSidebar: () => <div>sidebar</div>,
}));

vi.mock('../components/LegacyDashboardNotice', () => ({
  LegacyDashboardNotice: () => <div>legacy-notice</div>,
}));

vi.mock('../theme/HighlightStyles', () => ({
  HighlightStyles: () => null,
}));

vi.mock('../pages/SpecsPage', () => ({ SpecsPage: () => <div>specs-page</div> }));
vi.mock('../pages/SteeringPage', () => ({ SteeringPage: () => <div>steering-page</div> }));
vi.mock('../pages/TasksPage', () => ({ TasksPage: () => <div>tasks-page</div> }));
vi.mock('../pages/LogsPage', () => ({ LogsPage: () => <div>logs-page</div> }));
vi.mock('../pages/ApprovalsPage', () => ({ ApprovalsPage: () => <div>approvals-page</div> }));
vi.mock('../pages/SpecViewerPage', () => ({ SpecViewerPage: () => <div>viewer-page</div> }));
vi.mock('../pages/SettingsPage', () => ({ SettingsPage: () => <div>settings-page</div> }));

describe('App', () => {
  beforeEach(() => {
    document.title = 'Spec Workflow MCP';
  });

  it('renders the legacy empty state when no project is selected', () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText('No projects visible in the browser view')).toBeInTheDocument();
    expect(screen.getByText('Legacy browser UI')).toBeInTheDocument();
    expect(screen.getByText('v9.9.9')).toBeInTheDocument();
    expect(document.title).toBe('Workspace - Spec Workflow MCP');
  });
});
