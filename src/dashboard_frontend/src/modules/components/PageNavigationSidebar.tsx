import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router-dom';
import { useTheme } from '../theme/ThemeProvider';
import { LanguageSelector } from '../../components/LanguageSelector';

interface PageNavigationSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavigationItem {
  path: string;
  labelKey: string;
  icon: React.ReactNode;
  end?: boolean;
}

export function PageNavigationSidebar({
  isOpen,
  onClose,
}: PageNavigationSidebarProps) {
  const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  // Handle ESC key to close sidebar on mobile
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    if (isOpen && window.innerWidth < 1024) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const workflowItems: NavigationItem[] = [
    {
      path: '/specs',
      labelKey: 'nav.specs',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      ),
    },
    {
      path: '/approvals',
      labelKey: 'nav.approvals',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
    {
      path: '/tasks',
      labelKey: 'nav.tasks',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
          />
        </svg>
      ),
    },
  ];

  return (
    <>
      {/* Backdrop for mobile - only show when open */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
        fixed lg:sticky inset-y-0 lg:top-0 left-0 z-50 lg:z-auto
        w-64
        lg:h-screen
        bg-[var(--surface-panel)]
        border-r border-[var(--border-default)]
        flex flex-col
        transition-transform duration-200 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
      `}
      >
        <div className="hidden lg:block p-4 border-b border-[var(--border-default)]">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Spec Workflow MCP
          </h2>
          <div className="mt-1 text-xs font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">
            {t('legacyDashboard.sidebarLabel', 'Legacy browser UI')}
          </div>
        </div>

        {/* Header - Mobile close button */}
        <div className="lg:hidden flex items-center justify-between p-4 border-b border-[var(--border-default)]">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              Spec Workflow MCP
            </h2>
            <div className="mt-1 text-xs font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">
              {t('legacyDashboard.sidebarLabel', 'Legacy browser UI')}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-[var(--surface-hover)] text-[var(--text-secondary)]"
            aria-label={t('nav.close', 'Close sidebar')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto p-4">
          <div className="space-y-1">
            {workflowItems.map((item) => {
              const isActive = item.end
                ? location.pathname === item.path
                : location.pathname.startsWith(item.path);

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.end}
                  onClick={() => {
                    if (window.innerWidth < 1024) {
                      onClose();
                    }
                  }}
                  className={() => `
                      flex items-center gap-3 py-2 px-3 rounded-md transition-colors
                      ${
                        isActive
                          ? 'bg-[color-mix(in_srgb,var(--interactive-primary)_10%,transparent)] text-[var(--interactive-primary)]'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
                      }
                    `}
                >
                  <div className="flex-shrink-0">{item.icon}</div>
                  <span className="text-sm font-medium">{t(item.labelKey)}</span>
                </NavLink>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-[var(--border-default)] p-4 space-y-3">
          <LanguageSelector className="w-full" />
          <button
            type="button"
            onClick={toggleTheme}
            className="w-full btn-secondary"
            title={t('theme.toggle')}
          >
            {theme === 'dark' ? t('theme.dark') : t('theme.light')}
          </button>
        </div>
      </div>
    </>
  );
}
