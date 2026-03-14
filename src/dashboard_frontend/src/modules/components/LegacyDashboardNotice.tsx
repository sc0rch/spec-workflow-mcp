import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

export function LegacyDashboardNotice() {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return window.localStorage.getItem('spec-workflow-legacy-notice-dismissed') === 'true';
    } catch {
      return false;
    }
  });

  if (dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem('spec-workflow-legacy-notice-dismissed', 'true');
    } catch {
      // Ignore storage failures and keep the notice dismissed for this session.
    }
  };

  return (
    <section className="mb-4 rounded-md border border-[var(--border-default)] bg-[var(--surface-panel)] px-3 py-2 shadow-[var(--shadow-sm)]">
      <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--text-secondary)]">
        <span className="inline-flex items-center rounded-full bg-[var(--surface-inset)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
          {t('legacyDashboard.badge', 'Legacy browser UI')}
        </span>
        <span className="flex-1 min-w-[16rem]">
          {t(
            'legacyDashboard.description',
            'The Electron desktop shell is now the preferred daily interface. Keep this browser dashboard for compatibility and debugging.'
          )}
        </span>
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-md px-2 py-1 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-secondary)] transition-colors"
        >
          {t('legacyDashboard.dismiss', 'Dismiss')}
        </button>
      </div>
    </section>
  );
}
