import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/business/**/*.test.ts', 'tests/ui/**/*.test.tsx'],
    setupFiles: ['./tests/setup.ts'],
  },
});
