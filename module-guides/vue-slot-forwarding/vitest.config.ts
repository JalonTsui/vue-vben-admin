import Vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

// 只跑本包内的测试，避免被仓库根 vitest.config.ts 的全局扫描带走
export default defineConfig({
  plugins: [Vue()],
  test: {
    include: ['examples/**/*.test.ts'],
    environment: 'happy-dom',
    environmentOptions: {
      happyDOM: {
        settings: {
          // happy-dom v20+ 默认禁用 JS 求值，与仓库根配置保持一致
          handleDisabledFileLoadingAsSuccess: true,
        },
      },
    },
  },
});
