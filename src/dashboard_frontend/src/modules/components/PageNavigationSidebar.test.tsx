import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PageNavigationSidebar } from './PageNavigationSidebar';

const toggleTheme = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

vi.mock('../theme/ThemeProvider', () => ({
  useTheme: () => ({
    theme: 'dark',
    toggleTheme,
  }),
}));

vi.mock('../../components/LanguageSelector', () => ({
  LanguageSelector: ({ className = '' }: { className?: string }) => (
    <div className={className} data-testid="language-selector">
      language-selector
    </div>
  ),
}));

describe('PageNavigationSidebar', () => {
  beforeEach(() => {
    toggleTheme.mockReset();
  });

  it('keeps workflow sections and footer controls visible', () => {
    render(
      <MemoryRouter initialEntries={['/tasks']}>
        <PageNavigationSidebar isOpen onClose={vi.fn()} />
      </MemoryRouter>
    );

    expect(screen.getByText('Workflow')).toBeInTheDocument();
    expect(screen.getByText('Utilities')).toBeInTheDocument();
    expect(screen.getByTestId('language-selector')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'theme.dark' }));
    expect(toggleTheme).toHaveBeenCalledTimes(1);
  });

  it('closes itself after navigation on mobile', () => {
    const onClose = vi.fn();
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 375,
    });

    render(
      <MemoryRouter initialEntries={['/specs']}>
        <PageNavigationSidebar isOpen onClose={onClose} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText('nav.tasks'));
    expect(onClose).toHaveBeenCalled();
  });
});
