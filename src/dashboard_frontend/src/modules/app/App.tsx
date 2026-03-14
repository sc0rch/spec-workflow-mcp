import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '../theme/ThemeProvider';
import { WebSocketProvider, useWs } from '../ws/WebSocketProvider';
import { ProjectProvider, useProjects } from '../projects/ProjectProvider';
import { ApiProvider } from '../api/api';
import { HighlightStyles } from '../theme/HighlightStyles';
import { SpecsPage } from '../pages/SpecsPage';
import { TasksPage } from '../pages/TasksPage';
import { LogsPage } from '../pages/LogsPage';
import { ApprovalsPage } from '../pages/ApprovalsPage';
import { SpecViewerPage } from '../pages/SpecViewerPage';
import { NotificationProvider } from '../notifications/NotificationProvider';
import { useApi } from '../api/api';
import { I18nErrorBoundary } from '../../components/I18nErrorBoundary';
import { ProjectDropdown } from '../components/ProjectDropdown';
import { PageNavigationSidebar } from '../components/PageNavigationSidebar';
import { LegacyDashboardNotice } from '../components/LegacyDashboardNotice';

function Header({ toggleSidebar }: { toggleSidebar: () => void }) {
  const { t } = useTranslation();
  const { connected } = useWs();
  const { info } = useApi();

  // Update the browser tab title when project info is loaded
  useEffect(() => {
    if (info?.projectName) {
      document.title = t('documentTitle', { projectName: info.projectName });
    }
  }, [info?.projectName, t]);

  return (
    <>
      <header className="sticky top-0 z-10 bg-[var(--surface-panel)] border-b border-[var(--border-default)]">
        <div className="w-full px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Page Navigation Sidebar Toggle Button */}
            <button
              onClick={toggleSidebar}
              className="lg:hidden p-2 rounded-md text-[var(--text-muted)] hover:bg-[var(--surface-hover)] transition-colors"
              title={t('nav.toggleSidebar', 'Toggle navigation sidebar')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Project Dropdown */}
            <ProjectDropdown />

            {/* Version Badge */}
            {info?.version && (
              <span className="hidden lg:inline text-xs px-2 py-1 bg-[var(--surface-inset)] text-[var(--text-muted)] rounded-full">
                v{info.version}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${connected ? 'bg-[var(--status-success)]' : 'bg-[var(--status-error)]'}`} title={connected ? t('connectionStatus.connected') : t('connectionStatus.disconnected')} />
          </div>
        </div>
      </header>
    </>
  );
}

function AppInner() {
  const { t } = useTranslation();
  const { initial } = useWs();
  const { currentProjectId } = useProjects();
  const [sidebarOpen, setSidebarOpen] = useState(true); // Default open on desktop

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <ApiProvider initial={initial} projectId={currentProjectId}>
      <NotificationProvider>
        <div className="min-h-screen bg-[var(--surface-base)] text-[var(--text-primary)] lg:flex">
          {/* Page Navigation Sidebar */}
          <PageNavigationSidebar
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />
          <div className="flex-1 flex flex-col min-w-0">
            <Header toggleSidebar={toggleSidebar} />
            <HighlightStyles />
            <main className="w-full px-6 py-6">
            <LegacyDashboardNotice />
            {currentProjectId ? (
              <Routes>
                <Route path="/" element={<Navigate to="/specs" replace />} />
                <Route path="/specs" element={<SpecsPage />} />
                <Route path="/specs/view" element={<SpecViewerPage />} />
                <Route path="/tasks" element={<TasksPage />} />
                <Route path="/logs" element={<LogsPage />} />
                <Route path="/approvals" element={<ApprovalsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            ) : (
              <div className="flex items-center justify-center min-h-[60vh]">
                <div className="max-w-xl rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] px-6 py-8 text-center shadow-[var(--shadow-sm)]">
                  <div className="mb-3 inline-flex items-center rounded-full bg-[var(--surface-inset)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    {t('legacyDashboard.badge', 'Legacy browser UI')}
                  </div>
                  <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-3">
                    {t('legacyDashboard.emptyTitle', 'No projects visible in the browser view')}
                  </h2>
                  <p className="text-[var(--text-secondary)] mb-2">
                    {t(
                      'legacyDashboard.emptyDescription',
                      'This dashboard only shows workspaces after a live MCP session registers them or after they are remembered by the local app state.'
                    )}
                  </p>
                  <div className="text-sm text-[var(--text-muted)]">
                    {t(
                      'legacyDashboard.emptyHint',
                      'Use the Electron desktop shell for the preferred local workflow, or connect Codex/App MCP first and return here for compatibility or debugging.'
                    )}
                  </div>
                </div>
              </div>
            )}
            </main>
          </div>
        </div>
      </NotificationProvider>
    </ApiProvider>
  );
}

function AppWithProviders() {
  const { currentProjectId } = useProjects();

  return (
    <WebSocketProvider projectId={currentProjectId}>
      <AppInner />
    </WebSocketProvider>
  );
}

export default function App() {
  return (
    <I18nErrorBoundary>
      <ThemeProvider>
        <ProjectProvider>
          <AppWithProviders />
        </ProjectProvider>
      </ThemeProvider>
    </I18nErrorBoundary>
  );
}
