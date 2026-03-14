import React from 'react';
import { useTranslation } from 'react-i18next';

export function LegacyDashboardNotice() {
  const { t } = useTranslation();

  return (
    <section className="mb-4 rounded-md border border-[var(--border-default)] bg-[var(--surface-panel)] px-3 py-2 shadow-[var(--shadow-sm)]">
      <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--text-secondary)]">
        <span className="inline-flex items-center rounded-full bg-[var(--surface-inset)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
          {t('legacyDashboard.badge', 'Legacy browser UI')}
        </span>
        <span>
          {t(
            'legacyDashboard.description',
            'The Electron desktop shell is now the preferred daily interface. Keep this browser dashboard for compatibility and debugging.'
          )}
        </span>
      </div>
    </section>
  );
}
