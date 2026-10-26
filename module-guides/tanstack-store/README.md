# @tanstack/store 用法解读

> 框架无关的响应式状态盒子（observable state container）。上游仓库：https://github.com/TanStack/store ｜ 官方文档：https://tanstack.com/store 本仓库版本：`@tanstack/store@0.11.2`、`@tanstack/vue-store@0.11.2`（`@vben-core/shared/store` 直接 re-export，见 `packages/@core/base/shared/src/store.ts`）。核心实现只有约 200 行，dist 产物可读，建议配合本文第 5 节源码导读一起看。 **本文所有代码都有可直接运行的配套示例，就在本目录（`module-guides/tanstack-store/`，本文即该包的 README）**。

## 0. 运行配套示例

本目录同时是一个 pnpm workspace 包（`@jalontsui/tanstack-store-playground`），首次使用前先 `pnpm install`（根目录）完成 workspace 链接，然后**在本目录下**执行：

```bash
# Node 示例（无需浏览器，演示 1-3 节的全部语义陷阱）
pnpm run demo:01   # 基础：创建/读取/订阅/退订
pnpm run demo:02   # 陷阱：替换不合并 / Object.is 去重 / 首跑不回调 / batch
pnpm run demo:03   # 进阶：actionsFactory / ReadonlyStore / atom / asyncAtom
pnpm run demo      # 一口气跑完 01-03

# Vue 测试（useSelector 的 4 个行为断言：切片更新 / 去重 / shallow compare / 卸载退订）
pnpm run test

# 浏览器 demo（细粒度订阅的可视化：点按钮看哪个组件重渲染）
pnpm run dev       # 打开 http://localhost:5173
```

示例清单：

| 文件 | 演示内容 | 对应本文 |
| --- | --- | --- |
| `examples/node/01-basics.mjs` | Store 创建 / subscribe / setState / unsubscribe | 2.1、3.1 |
| `examples/node/02-traps.mjs` | 四大陷阱现场复现（输出即证据） | 3.1 |
| `examples/node/03-advanced.mjs` | actionsFactory、ReadonlyStore、createAtom、createAsyncAtom | 3.2、3.3 |
| `examples/vue/use-selector.test.ts` | useSelector 行为测试（happy-dom） | 3.4 |
| `examples/vue/index.html + main.ts` | 浏览器可视化 demo（渲染函数写法） | 3.4 |

---

## 1. 它是什么 / 解决什么问题

一个与框架解耦的最小状态容器，核心模型三句话：

```
new Store(初始值)          建盒子
store.setState(updater)    换状态（整体替换），通知所有订阅者
store.subscribe(fn)        收通知
```

对比同类方案：

| 方案 | 体积/概念 | 与它的关系 |
| --- | --- | --- |
| Vue `ref + watch` | Vue 专用 | `useSelector` 本质就是"把 store 桥接成 readonly ref"，`ref + watch` 的跨组件版 |
| Pinia / Vuex | 模块化、actions、devtools、插件体系 | TanStack Store **没有**这些概念；Store 只是单个盒子，模块化靠你自己建多个 Store |
| Redux / Zustand | action/dispatch 或单一可变盒子 | 概念最接近 Zustand（vanilla 版），但更小：没有 middleware、没有 shallow merge |
| RxJS Subject | 流式操作符全家桶 | 只需要"订阅-广播"时用它是杀鸡用牛刀 |

**为什么值得学**：vben 的 FormApi（`form-api.ts:156`）和 TanStack Form 的底层状态都基于它。读懂这 200 行，你就读懂了"vben 表单配置变化如何触发 UI 更新"的整条链路。

---

## 2. 最小可用示例

### 2.1 框架无关（vanilla TS）

```ts
import { Store } from '@tanstack/store';

// 创建：传入初始状态（整体对象）
const store = new Store({ count: 0, user: { name: 'a' } });

// 订阅：返回 Subscription，{ unsubscribe } 停订
const sub = store.subscribe((state) => {
  console.log('changed:', state);
});

// 读取
console.log(store.state.count); // getter，等价 store.get()

// 更新：updater 收到旧状态，必须返回【完整新状态】——整体替换，不做浅合并！
store.setState((prev) => ({ ...prev, count: prev.count + 1 }));
// ❌ 常见错误：store.setState((prev) => ({ count: 1 }))
//    这会把 user 整个丢掉，因为返回值直接成为新 state

sub.unsubscribe();
```

### 2.2 Vue 组件中（`@tanstack/vue-store`）

```ts
import { useSelector } from '@tanstack/vue-store';
import { store } from './my-store';

// 在 setup 中：选择器订阅某个切片，返回 readonly ref
const count = useSelector(store, (state) => state.count);
// 模板里直接用 {{ count }}（自动解 ref）
// 组件卸载时自动 unsubscribe（内部 onScopeDispose）
```

---

## 3. 完整 API 与语义陷阱

### 3.1 `Store` 类（dist/store.js，24 行）

```ts
class Store<T, TActions extends StoreActionMap = never> {
  constructor(initialValue: T);
  constructor(initialValue: T, actionsFactory: (store) => TActions);
  setState(updater: (prev: T) => T): void;
  get state(): T;
  get(): T;
  subscribe(observerOrFn): Subscription; // 返回 { unsubscribe }
  readonly actions: TActions;
}
```

陷阱清单（均已在源码 `dist/atom.js` 中核实）：

1. **整体替换，不合并**。`setState` 的返回值直接成为新 state。更新部分字段必须自己 spread。
2. **去重比较是 `Object.is`**（store 创建时未传 compare 选项，走默认）。返回与旧状态**引用相同**的对象时**不通知任何订阅者**：
   ```ts
   store.setState((prev) => prev); // 静默无操作
   ```
   想改数组里一个元素，`map` 返回新数组才会触发；直接 `prev.list.push(x)` 后 return prev 则不会。
3. **订阅不会立即回调**。`subscribe` 内部先用 effect 跑一次做依赖登记（atom.js:110-117 的 `observed.current` 逻辑），**第一次 run 不发通知**，之后每次 setState 且值变化才发。
4. **`batch` / `flush` 可批量通知**（atom.js:35-57）：`batch(() => { ...多次 setState... })` 内的通知会入队，退出时统一 flush。Store 类没直接暴露，从 `@tanstack/store` 顶层导入：
   ```ts
   import { batch } from '@tanstack/store';
   ```
5. **actionsFactory 变体**：`new Store(initial, ({ setState, get }) => ({ increment: () => setState(...) }))`，把方法挂到 `store.actions` 上。vben 没用它（vben 用的是 class 方法 `bindMethods`），知道即可。

### 3.2 `createStore` 与只读 Store

```ts
import { createStore } from '@tanstack/store';

// 传对象 → 可变 Store
const store = createStore({ count: 0 });
store.setState((s) => ({ count: 1 }));

// 传函数 → ReadonlyStore（computed store，值由依赖自动推导，无 setState）
const doubled = createStore((prev?: number) => {
  // 函数体内读取其他 atom/store 会自动建立依赖
  return store.state.count * 2;
});
```

### 3.3 `createAtom` / `createAsyncAtom`（底层原语）

`Store` 内部就是包了一个 atom（`store.js:6`）。atom 是比 Store 更细的原语，两者二选一即可：

```ts
import { createAtom, createAsyncAtom } from '@tanstack/store';

const count = createAtom(0);
count.set(1);
count.subscribe((v) => console.log(v));

// 异步派生：内置 pending / done / error 三态
const userAtom = createAsyncAtom(async () => {
  const res = await fetch('/api/user');
  return res.json();
});
// userAtom.get() → { status: 'pending' } | { status: 'done', data } | { status: 'error', error }
```

### 3.4 Vue 绑定（`@tanstack/vue-store`，dist/useSelector.js 全文 39 行）

```ts
function useSelector<TSource, TSelected>(
  source, // 任何 { get, subscribe } 结构 —— Store 和 Atom 都行
  selector = (s) => s, // 不传则订阅整体
  options?: { compare?: (a, b) => boolean }, // 默认 ===
): Readonly<Ref<TSelected>>;
```

实现要点（读源码可知）：

- 内部 `shallowRef(selector(source.get()))` 存当前切片；store 每次通知时先跑 selector，**比较结果和旧切片，相等就跳过赋值**（默认 `===`）。所以 selector 要返回**稳定引用**的切片，或在 options 里给 `compare`（比如 `shallowEqual`）：
  ```ts
  // ❌ 每次返回新对象，导致无意义的 ref 赋值（不会死循环，但白触发）
  const bad = useSelector(store, (s) => ({ a: s.a }));
  // ✅ 用 compare 或选原始切片
  const good = useSelector(store, (s) => ({ a: s.a }), {
    compare: shallowEqual,
  });
  ```
- 用 `onScopeDispose` 自动退订 —— **必须在组件 setup / effect 作用域内调用**，在普通函数里调用会警告。
- `useStore` / `useAtom` 是同包的另外两个 hook（`useStore(store)` 拿 readonly state ref；`useAtom(atom)` 拿 `{ state, setState }`），vben 未使用。

> 示例包里的 `examples/vue/use-selector.test.ts` 把这四条做成了断言测试，可直接运行验证。

---

## 4. 本仓库里的使用位置

| 位置 | 用法 |
| --- | --- |
| `packages/@core/base/shared/src/store.ts` | 一行 re-export，vben 内统一走 `@vben-core/shared/store` 导入 |
| `packages/@core/ui-kit/form-ui/src/form-api.ts:156` | `new Store({...默认配置, ...options})` 存**表单配置**（schema、commonConfig 等 `FormApiProps`）；`:161` `store.subscribe` → 每次 setState 同步 `this.state` 并跑 `updateState()` 做 schema diff（删字段时清值，:669） |
| `packages/@core/ui-kit/form-ui/src/use-vben-form.ts:47-49` | 给 api 挂 `useStore = (selector) => useSelector(api.store, selector)` |
| `packages/@core/ui-kit/form-ui/src/vben-use-form.vue:41` | `formApi.useStore()` 把 store 状态桥接进组件，`useForwardPriorityValues` 逐 key 与 props 合并 |
| `packages/@core/ui-kit/form-ui/src/form-runtime.ts:42,46` | 字段值在另一个 store：`@tanstack/vue-form` 的 `useForm()` 内部也是 TanStack store，所以能用 `rawForm.useSelector` 直接抽 `values/errors/meta` |
| `@vben-core/shared/global-state` | `globalShareState`（组件注册共享）同样基于这套 store |

注意区分：**配置状态**（Store）与**字段值状态**（tanstack form 内部 store）是两个盒子，FormApi 只是同时持有两者（mount 时 `this.form = formActions`，`form-api.ts:343`）。

---

## 5. 源码导读（加起来约 300 行，半小时可读完）

本仓库 `node_modules` 里即对应版本的**未压缩 dist**，行号与上游 src 一一对应：

| 文件 | 读什么 |
| --- | --- |
| `@tanstack/store/dist/store.js`（24 行） | Store 就是 atom 的薄包装，验证 3.1 的全部语义 |
| `@tanstack/store/dist/atom.js`（209 行） | 核心：`_update` 的 Object.is 去重（:122-144）、`set` 的通知链（:159-168）、`subscribe` 的首跑不通知（:107-121）、`batch`/`flush` 队列（:35-57）、`createAsyncAtom` 三态（:58-92） |
| `@tanstack/store/dist/alien.js` | 依赖图传播算法（link/propagate/checkDirty），看不懂可跳过，不影响使用 |
| `@tanstack/vue-store/dist/useSelector.js`（39 行） | Vue 桥接层全文，3.4 的每个结论都能在这里找到对应行 |
| `@tanstack/vue-store/dist/index.d.ts`（6 行） | 确认导出面：vue-store = @tanstack/store 全量 + useSelector/useStore/useAtom/useAtom |
