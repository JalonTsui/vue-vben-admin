import { createApp, defineComponent, h } from 'vue';

// 浏览器示例：useSelector 细粒度订阅
// 运行：pnpm run dev（在 module-guides/tanstack-store 目录下），然后打开终端里提示的地址
import { Store } from '@tanstack/store';
import { useSelector } from '@tanstack/vue-store';

// 共享的 Store（通常放在单独文件里导出）
export const store = new Store({
  count: 0,
  user: { name: 'jalon', role: 'admin' },
});

// 组件 A：只订阅 count —— user 变化时它不应重渲染
const CountPanel = defineComponent({
  name: 'CountPanel',
  setup() {
    // 等同于 vben use-vben-form.ts:47 给 api 挂 useStore 的用法
    const count = useSelector(store, (s) => s.count);
    // 注意：用普通变量而不是 ref 计数 —— ref 在渲染函数里读+写会自我触发无限重渲染
    let renders = 0;
    return () => {
      renders++;
      return h('div', { class: 'box' }, [
        h('p', `count = ${count.value}（本组件渲染次数：${renders}）`),
        h(
          'button',
          {
            onClick: () =>
              store.setState((s) => ({ ...s, count: s.count + 1 })),
          },
          'count + 1',
        ),
        h(
          'button',
          {
            onClick: () =>
              store.setState((s) => ({
                ...s,
                user: { ...s.user, role: 'user' },
              })),
          },
          '改 user（count 面板不应重渲染）',
        ),
      ]);
    };
  },
});

// 组件 B：只订阅 user.role
const UserPanel = defineComponent({
  name: 'UserPanel',
  setup() {
    const role = useSelector(store, (s) => s.user.role);
    return () =>
      h('div', { class: 'box' }, [
        h('p', `user.role = ${role.value}`),
        h(
          'button',
          {
            onClick: () =>
              store.setState((s) => ({ ...s, count: s.count + 100 })),
          },
          '改 count（role 面板不应变）',
        ),
      ]);
  },
});

const App = defineComponent({
  name: 'App',
  setup() {
    const snapshot = useSelector(store); // 不传 selector = 订阅整体
    return () =>
      h('div', [
        h(CountPanel),
        h(UserPanel),
        h('div', { class: 'box' }, [
          h('p', `整体快照：${JSON.stringify(snapshot.value)}`),
        ]),
      ]);
  },
});

createApp(App).mount('#app');
