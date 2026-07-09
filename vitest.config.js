import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{js,mjs}'],
    testTimeout: 15_000,
    hookTimeout: 15_000,
    pool: 'forks',
  },
});
