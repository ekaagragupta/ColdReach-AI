import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      ENCRYPTION_KEY: '1ab003d75849370369f0aae56e0f70dd15453590da0f2d03e1bcb0e7c2f28ad7',
      DATABASE_URL: 'file:./coldreach.db',
    },
    coverage: {
      provider: 'v8',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
