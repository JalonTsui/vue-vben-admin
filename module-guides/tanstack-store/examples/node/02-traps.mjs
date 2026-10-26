// 示例 02：语义陷阱 —— 替换不合并 / Object.is 去重 / 首跑不回调 / batch
// 运行：pnpm run demo:02（在 module-guides/tanstack-store 目录下）
import { batch, Store } from '@tanstack/store';

// ── 陷阱 1：整体替换，不做浅合并 ──────────────────────────────
{
  const store = new Store({ count: 0, user: { name: 'jalon' } });
  store.setState((_prev) => ({ count: 1 })); // ❌ 忘了展开 prev（这里故意不用 prev，演示丢字段）
  console.log(
    '[陷阱1] setState 返回残缺对象后，user 还在吗？',
    'user' in store.state ? '在' : '丢了！',
  );
}

// ── 陷阱 2：Object.is 去重 —— 原地 mutate 后返回同一引用 = 静默无操作 ──
{
  const store = new Store({ list: [1, 2, 3] });
  let notified = 0;
  store.subscribe(() => notified++);
  store.setState((prev) => {
    prev.list.push(4); // ❌ 原地改
    return prev; // ❌ 返回同一引用
  });
  console.log(
    '[陷阱2] 原地 push 后通知次数 =',
    notified,
    '（值变了但无人知晓）',
  );
  // ✅ 正确：返回新引用
  store.setState((prev) => ({ ...prev, list: [...prev.list, 5] }));
  console.log(
    '[陷阱2] 返回新数组后通知次数 =',
    notified,
    '，list =',
    store.state.list,
  );
}

// ── 陷阱 3：subscribe 首跑不回调 ────────────────────────────
{
  const store = new Store(0);
  const calls = [];
  store.subscribe((v) => calls.push(v));
  console.log(
    '[陷阱3] subscribe 刚完成，回调次数 =',
    calls.length,
    '（第一次 run 只做依赖登记）',
  );
  store.setState((v) => v + 1);
  console.log(
    '[陷阱3] setState 后回调次数 =',
    calls.length,
    '，收到的值 =',
    calls.at(-1),
  );
}

// ── batch：合并多次 setState 的通知 ─────────────────────────
{
  const store = new Store({ a: 0, b: 0 });
  let notified = 0;
  store.subscribe(() => notified++);
  batch(() => {
    store.setState((s) => ({ ...s, a: 1 }));
    store.setState((s) => ({ ...s, b: 2 }));
    console.log('[batch] batch 内部，通知次数 =', notified, '（入队未 flush）');
  });
  console.log('[batch] batch 退出后，通知次数 =', notified, '（统一 flush）');
}
