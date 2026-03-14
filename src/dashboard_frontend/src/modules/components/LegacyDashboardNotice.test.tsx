import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LegacyDashboardNotice } from './LegacyDashboardNotice';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

describe('LegacyDashboardNotice', () => {
  beforeEach(() => {
    window.localStorage.removeItem('spec-workflow-legacy-notice-dismissed');
  });

  it('persists dismissal in local storage', () => {
    render(<LegacyDashboardNotice />);

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(window.localStorage.getItem('spec-workflow-legacy-notice-dismissed')).toBe('true');
    expect(screen.queryByText('Legacy browser UI')).not.toBeInTheDocument();
  });

  it('stays hidden when dismissed in a previous session', () => {
    window.localStorage.setItem('spec-workflow-legacy-notice-dismissed', 'true');

    render(<LegacyDashboardNotice />);

    expect(screen.queryByText('Legacy browser UI')).not.toBeInTheDocument();
  });
});
