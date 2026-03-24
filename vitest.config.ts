import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.{test,spec}.{js,ts}'],
    exclude: [
      'node_modules/**/*',
      'src/dashboard/**/*',
      'src/dashboard_frontend/**/*',
      'src/prompts/**/*',
      'src/tools/**/*',
      'src/__tests__/config.test.ts',
      'src/__tests__/index-args.test.ts',
      'src/__tests__/index-entrypoint.test.ts',
      'src/core/**/project-binding.test.ts',
      'src/core/**/project-catalog.test.ts',
      'src/core/**/project-registry.test.ts',
      'src/core/**/remembered-projects.test.ts',
      'src/core/**/security-utils.test.ts'
    ],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'src/dashboard/**',
        'src/dashboard_frontend/**',
        'src/prompts/**',
        'src/tools/**',
        'dist/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/test/**',
        '**/__tests__/**',
      ]
    }
  }
});
