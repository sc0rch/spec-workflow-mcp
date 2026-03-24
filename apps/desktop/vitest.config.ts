import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer'),
      '@shared': resolve(__dirname, 'src/shared')
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: [
      'src/bridge/**',
      'src/main/services/mcp-bridge-service.test.ts',
      'src/main/services/socket-mcp-transport.test.ts'
    ],
    coverage: {
      reporter: ['text', 'html'],
      exclude: [
        'dist/**',
        'e2e/**',
        'scripts/**',
        'src/bridge/**',
        '**/*.config.*',
        '**/*.d.ts'
      ]
    }
  }
});
