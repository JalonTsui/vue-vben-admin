// 浏览器入口：左边有转发、右边对照组不转发
// 运行：pnpm run dev（在 module-guides/vue-slot-forwarding 目录下）
import { createApp, h } from 'vue';

import NoForwardMiddle from './NoForwardMiddle.vue';
import Page from './Page.vue';

createApp(Page).mount('#app');

// 对照组：同样传 user 插槽，但中间层不转发 → Leaf 的出口是空的
createApp({
  render() {
    return h(NoForwardMiddle, null, {
      user: () => h('p', { class: 'user-content' }, '页面内容（到不了叶子）'),
    });
  },
}).mount('#app-no-forward');
