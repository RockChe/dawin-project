import { defineConfig, configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Test toolchain for Wave 1. `@/` mirrors jsconfig.json paths so tests can
// import app modules the same way the app does. jsdom powers hook tests
// (@testing-library/react); server-action tests mock the db layer (no Neon).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    // 排除 cc-fleet 隔離 worktree——否則 vitest 會掃到 .worktrees/*/full-stack/src
    // 內的測試副本，灌水測試數且可能誤報 in-progress worktree 的紅燈。
    exclude: [...configDefaults.exclude, '**/.worktrees/**'],
  },
});
