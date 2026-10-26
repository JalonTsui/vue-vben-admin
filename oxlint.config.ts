import { oxlintConfig } from '@vben/oxlint-config';

import { defineConfig } from 'oxlint';

export default defineConfig({
  ...oxlintConfig,
  overrides: [
    ...(oxlintConfig.overrides ?? []),
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
  ],
});
