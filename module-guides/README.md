# Module Guides —— 独立模块解读

本目录专门存放仓库依赖链中**独立模块**的源码/用法解读。与 `jalontsui_docs/`（面向项目整体的学习与调试指南）不同，这里每个文件只讲透一个模块，读完不需要了解 vben 业务上下文。

## 为什么需要这个目录

vben 的表单、表格、弹窗等核心能力都建立在一层"薄而陌生"的第三方模块之上（TanStack Store、TanStack Form、Radix Vue…）。这些模块本身体量小（核心实现往往只有一两百行）、文档散落在各框架版本中，但读懂它们是读懂上层封面的捷径。每个模块文档遵循统一结构：

1. **它是什么 / 解决什么问题** —— 一句话定位 + 与同类方案的对比
2. **最小可用示例** —— 可直接运行的代码（本仓库 `node_modules` 里就有对应版本）
3. **完整 API 与语义陷阱** —— 每个方法的精确行为（替换还是合并？什么情况下不通知？）
4. **源码导读** —— dist 产物是可读的，给出值得读的函数清单
5. **本仓库里的使用位置** —— 该模块在 vben 哪里被用到、怎么被封装

## 模块索引

| 模块 | 上游仓库 | 文档 + 示例包（同一目录，可直接运行） | 版本（本仓库） |
| --- | --- | --- | --- |
| `@tanstack/store` / `@tanstack/vue-store` | [TanStack/store](https://github.com/TanStack/store) | [tanstack-store/](./tanstack-store/)（README 即模块文档；含 node 脚本 + Vue 测试 + 浏览器 demo） | 0.11.2 |
| Vue 插槽转发（语言特性，非第三方模块） | [vuejs/core](https://github.com/vuejs/core) | [vue-slot-forwarding/](./vue-slot-forwarding/)（SFC 三层转发链路 + 5 个行为断言 + 不转发对照组 demo） | Vue 3.5 |

目录约定：**一个模块一个目录**，目录本身就是 pnpm workspace 包（根 `pnpm-workspace.yaml` 的 `module-guides/*` 直接匹配），模块文档放在包根的 `README.md`，示例放 `examples/`。依赖走仓库 catalog，与主项目共用 lockfile，不参与 turbo 构建。新增模块时复制 `tanstack-store/` 的结构即可。
