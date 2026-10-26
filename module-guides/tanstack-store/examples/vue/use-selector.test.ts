import { createApp, defineComponent, h, nextTick } from 'vue';

// useSelector 行为测试（happy-dom + 渲染函数，无需 SFC 编译）
// 运行：pnpm run test（在 module-guides/tanstack-store 目录下）
import { shallow, Store } from '@tanstack/store';
import { useSelector } from '@tanstack/vue-store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

let host: HTMLElement;

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
});

afterEach(() => {
  // 每个测试可能挂载多个 app，全部清掉
  document.body.innerHTML = '';
});

describe('useSelector', () => {
  it('订阅的切片变化时组件更新', async () => {
    const store = new Store({ count: 0, text: 'a' });
    useSelectorInComponent(store, (s) => s.text);

    store.setState((s) => ({ ...s, count: 1 })); // 无关字段
    await nextTick();
    expect(host.textContent).toBe('a');

    store.setState((s) => ({ ...s, text: 'b' }));
    await nextTick();
    expect(host.textContent).toBe('b');
  });

  it('返回相同引用（Object.is 去重）的 setState 不触发更新', async () => {
    const store = new Store({ count: 0 });
    const count = useSelectorInComponent(store, (s) => s.count);

    store.setState((s) => s); // 静默无操作
    await nextTick();
    expect(count.renderCount).toBe(1); // 只渲染过初始一次
  });

  it('selector 每次返回新对象时，默认 === 比较导致每次都刷新（陷阱演示）', async () => {
    const store = new Store({ a: 1, b: 1 });
    // ❌ selector 返回新对象：即使 a 没变，任何 setState 都会让切片换引用
    const bad = useSelectorInComponent(store, (s) => ({ a: s.a }));
    // ✅ 传 compare: shallow 解决
    const good = useSelectorInComponent(store, (s) => ({ a: s.a }), {
      compare: shallow,
    });

    store.setState((s) => ({ ...s, b: 2 })); // 与 a 无关的更新
    await nextTick();
    expect(bad.renderCount).toBe(2); // 白渲染一次
    expect(good.renderCount).toBe(1); // shallow 比较挡掉了
  });

  it('组件卸载后自动退订，setState 不再触发其回调', async () => {
    const store = new Store({ count: 0 });
    const count = useSelectorInComponent(store, (s) => s.count);

    count.app.unmount();
    expect(() => store.setState((s) => ({ ...s, count: 1 }))).not.toThrow();
    await nextTick();
    expect(count.renderCount).toBe(1);
  });
});

// 辅助函数：挂载一个最小组件，展示 useSelector 的值，并记录渲染次数
function useSelectorInComponent(
  store: Store<any>,
  selector: any,
  options?: any,
) {
  // 注意用普通变量而非 ref —— ref 的 .value++ 是"读+写"，渲染函数会跟踪自己导致无限重渲染
  let renders = 0;
  let selected: any;
  const App = defineComponent({
    setup() {
      selected = useSelector(store as any, selector, options);
      return () => {
        renders++;
        return h('span', String(selected.value?.a ?? selected.value));
      };
    },
  });
  // 每个 app 必须挂到独立容器 —— 共享同一个 host 会让第二个 mount 复用容器的 _vnode，
  // 把第一个 app 当旧树 patch 掉（组件被卸载 → useSelector 自动退订）
  const el = document.createElement('div');
  host.append(el);
  const app = createApp(App);
  app.mount(el);
  return {
    get value() {
      return selected.value;
    },
    get renderCount() {
      return renders;
    },
    app,
  };
}
