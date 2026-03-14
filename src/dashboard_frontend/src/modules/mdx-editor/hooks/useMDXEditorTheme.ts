import { useMemo } from 'react';
import { useTheme } from '../../theme/ThemeProvider';

export interface MDXEditorThemeConfig {
  theme: 'light' | 'dark';
  isDarkMode: boolean;
  mermaidTheme: 'dark' | 'default';
  mermaidThemeVariables: Record<string, string>;
}

export function useMDXEditorTheme(): MDXEditorThemeConfig {
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';

  const darkMermaidThemeVariables: Record<string, string> = {
    primaryColor: '#3B82F6',
    primaryTextColor: '#E5E7EB',
    primaryBorderColor: '#6B7280',
    lineColor: '#9CA3AF',
    secondaryColor: '#1F2937',
    tertiaryColor: '#374151',
    background: '#111827',
    mainBkg: '#1F2937',
    secondBkg: '#374151',
    tertiaryBkg: '#4B5563',
  };

  const lightMermaidThemeVariables: Record<string, string> = {
    primaryColor: '#3B82F6',
    primaryTextColor: '#111827',
    primaryBorderColor: '#2563EB',
    lineColor: '#374151',
    secondaryColor: '#DBEAFE',
    tertiaryColor: '#EFF6FF',
    background: '#FFFFFF',
    mainBkg: '#FFFFFF',
    secondBkg: '#F9FAFB',
    tertiaryBkg: '#F3F4F6',
  };

  return useMemo(() => ({
    theme,
    isDarkMode,
    mermaidTheme: isDarkMode ? 'dark' : 'default',
    mermaidThemeVariables: isDarkMode ? darkMermaidThemeVariables : lightMermaidThemeVariables,
  }), [darkMermaidThemeVariables, isDarkMode, lightMermaidThemeVariables, theme]);
}
