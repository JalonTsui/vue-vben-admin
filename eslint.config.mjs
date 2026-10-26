import { defineConfig } from '@vben/eslint-config';

export default defineConfig([
  {
    // module-guides 下的 node 示例以 console 输出作为运行结果；
    // vue demo 故意把多个小组件放一个文件方便对照阅读
    files: [
      'module-guides/**/*.js',
      'module-guides/**/*.mjs',
      'module-guides/**/*.ts',
    ],
    rules: {
      'no-console': 'off',
      'vue/one-component-per-file': 'off',
    },
  },
]);
