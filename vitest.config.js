import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/**/test*/**/*.test.js', 'packages/**/*.test.js'],
    exclude: ['node_modules', 'dist'],
  },
});
