// path: vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Enable Vitest global APIs (describe, it, expect) across the monorepo.
    globals: true,
    // Run all test files that live under any __tests__ directory.
    include: ['**/__tests__/**/*.test.ts'],
    // Default exclusions.
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/e2e/**',
      '**/.{idea,git,cache,output,temp}/**',
      'apps/web/__tests__/collaboration.test.ts',
    ],
  },
});
