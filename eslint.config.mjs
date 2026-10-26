import { defineConfig } from '@vben/eslint-config';

export default defineConfig([
  {
    // module-guides 下的 node 示例以 console 输出作为运行结果，放行 no-console
    files: [
      'module-guides/**/*.js',
      'module-guides/**/*.mjs',
      'module-guides/**/*.ts',
    ],
    rules: {
      'no-console': 'off',
    },
  },
]);
