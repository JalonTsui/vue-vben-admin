// 示例 03：进阶 —— actionsFactory / ReadonlyStore（computed）/ createAtom / createAsyncAtom
// 运行：pnpm run demo:03（在 module-guides/tanstack-store 目录下）
import {
  createAsyncAtom,
  createAtom,
  createStore,
  Store,
} from '@tanstack/store';

// ── 1. actionsFactory：把方法挂到 store.actions ───────────────
{
  const counter = new Store({ count: 0 }, ({ setState, get }) => ({
    increment: () => setState((s) => ({ ...s, count: s.count + 1 })),
    reset: () => setState((s) => ({ ...s, count: 0 })),
    // getter 可以在 action 里读当前值
    describe: () => `当前 count = ${get().count}`,
  }));
  counter.actions.increment();
  counter.actions.increment();
  console.log('[actions]', counter.actions.describe());
  counter.actions.reset();
  console.log('[actions] reset 后 count =', counter.state.count);
}

// ── 2. createStore(函数) → ReadonlyStore：值由依赖自动推导 ──
{
  const source = createStore({ price: 10, quantity: 2 });
  const total = createStore(() => source.state.price * source.state.quantity);
  // total 没有 setState；source 变化时 total 自动重算并通知
  total.subscribe((v) => console.log('[readonly] total 变成', v));
  source.setState((s) => ({ ...s, quantity: 3 }));
}

// ── 3. createAtom：Store 的底层原语，用法几乎一样 ────────────
{
  const atom = createAtom('hello');
  atom.subscribe((v) => console.log('[atom] 值变成', v));
  atom.set('world');
}

// ── 4. createAsyncAtom：异步派生，内置 pending/done/error 三态 ──
{
  const userAtom = createAsyncAtom(async () => {
    // 模拟接口请求
    await new Promise((r) => setTimeout(r, 50));
    return { id: 1, name: 'jalon' };
  });
  console.log('[asyncAtom] 初始状态:', userAtom.get().status);
  userAtom.subscribe((state) => console.log('[asyncAtom] 状态变化:', state));
  await new Promise((r) => setTimeout(r, 100)); // 等请求完成
  console.log('[asyncAtom] 最终状态:', userAtom.get());
}
