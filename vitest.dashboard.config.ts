import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/dashboard_frontend/src/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['src/dashboard_frontend/src/test/setup.ts'],
  },
});
