import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'miniflare',
    environmentOptions: {
      bindings: {
        JWT_SECRET: 'test-secret'
      }
    }
  }
});