// 示例 01：Store 基础 —— 创建 / 读取 / setState / subscribe / unsubscribe
// 运行：pnpm run demo:01（在 module-guides/tanstack-store 目录下）
import { Store } from '@tanstack/store';

const store = new Store({ count: 0, user: { name: 'jalon' } });

// 1. subscribe：返回 { unsubscribe }。注意首跑不会回调（见示例 02）
const sub = store.subscribe((state) => {
  console.log('[subscribe] 收到通知:', state);
});
console.log('--- 订阅完成（此时没有回调输出，正常现象）---');

// 2. setState：updater 收到旧状态，返回【完整新状态】（整体替换）
store.setState((prev) => ({ ...prev, count: prev.count + 1 }));
store.setState((prev) => ({ ...prev, count: prev.count + 1 }));

// 3. 读取
console.log('[读取] store.state.count =', store.state.count);
console.log('[读取] store.get().user   =', store.get().user);

// 4. unsubscribe 之后不再收到通知
sub.unsubscribe();
console.log('--- 已退订，下面两次 setState 不会有 [subscribe] 输出 ---');
store.setState((prev) => ({ ...prev, count: 100 }));
console.log(
  '[读取] 退订后 store.state.count =',
  store.state.count,
  '（值照常在变，只是没人被通知）',
);
