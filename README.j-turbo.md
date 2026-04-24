# Turbo 相关命令详解

> 本文档从根目录 `package.json` 的 `scripts` 中提取所有与 **Turborepo** (`turbo`) 及项目内部封装工具 **turbo-run** 相关的命令，并结合 `turbo.json` 的配置进行详细说明。

---

## 一、直接使用 `turbo` CLI 的命令

这些命令直接调用 Turborepo 官方 CLI，利用其**任务管道（Pipeline）**、**缓存机制**和**拓扑排序**来高效执行 Monorepo 中的任务。

### 1. `pnpm build` → `turbo build`

```bash
cross-env NODE_OPTIONS=--max-old-space-size=8192 turbo build
```

**作用：** 构建 Monorepo 中**所有定义了 `build` 脚本**的包。

**详细说明：**
- `cross-env NODE_OPTIONS=--max-old-space-size=8192`：为 Node.js 进程分配最大 8GB 的堆内存，防止大型 Monorepo 构建时因内存不足而崩溃。
- `turbo build`：Turborepo 会读取 `turbo.json` 中 `tasks.build` 的配置：
  - `dependsOn: ["^build"]`：**拓扑排序构建**。先构建被其他包依赖的基础包（如 `@vben/vite-config`、`@vben/utils` 等），再构建上层应用。`^` 表示依赖包的同名任务。
  - `outputs: ["dist/**", "dist.zip", ".vitepress/dist.zip", ".vitepress/dist/**"]`：构建完成后，Turborepo 会将这些输出目录的内容进行**缓存**。下次如果源码和依赖没有变化，直接从缓存恢复，跳过重复构建。

**适用场景：** 全量打包，CI/CD 部署前的构建。

---

### 2. `pnpm build:analyze` → `turbo build:analyze`

```bash
turbo build:analyze
```

**作用：** 构建并输出**包体积分析（Bundle Analyze）**报告。

**详细说明：**
- 同样遵循 `dependsOn: ["^build"]`，先完成依赖包的构建。
- `outputs: ["dist/**"]`：产物输出到 `dist/` 并被缓存。
- 这个任务通常在各子包的 `build:analyze` 脚本中配置了 `rollup-plugin-visualizer` 或类似的分析插件，用于生成可视化的依赖体积报告（如 `stats.html`）。

**适用场景：** 分析前端应用的打包体积，排查冗余依赖。

---

### 3. `pnpm check:type` → `turbo run typecheck`

```bash
turbo run typecheck
```

**作用：** 在 Monorepo 的**所有包中并行执行 TypeScript 类型检查**。

**详细说明：**
- `turbo run typecheck` 会找到所有子包中 `scripts` 里定义了 `typecheck` 的任务并执行。
- `turbo.json` 中 `typecheck` 的配置：
  - `outputs: []`：类型检查不产生需要缓存的产物，所以输出为空。
  - 没有 `dependsOn`：各个包的类型检查可以**并行执行**，不需要等待其他包完成。
- Turborepo 的缓存机制仍然生效：如果源码和 `tsconfig.json` 没有变化，会直接返回缓存结果。

**适用场景：** CI 流程中统一检查全仓库类型安全，或在提交前本地验证。

---

### 4. `pnpm test:e2e` → `turbo run test:e2e`

```bash
turbo run test:e2e
```

**作用：** 在 Monorepo 中执行所有**端到端（E2E）测试**。

**详细说明：**
- 会找到所有子包中定义了 `test:e2e` 脚本的包（通常是 `apps/web-*`）并执行。
- `turbo.json` 中 `test:e2e` 的配置为空对象 `{}`：
  - 无 `dependsOn`：可以并行运行各应用的 E2E 测试。
  - 无 `outputs`：不缓存测试结果（测试通常需要每次重新运行）。

**适用场景：** 回归测试、发布前验证核心流程。

---

## 二、使用 `turbo-run` 的命令（交互式封装）

`turbo-run` 是项目内部封装的 CLI 工具（位于 `scripts/turbo-run/`），基于 `@clack/prompts` 提供**交互式选择**。它底层仍然是通过 `pnpm --filter=<pkg> run <command>` 来执行，但省去了手动输入包名的步骤。

### 5. `pnpm dev` → `turbo-run dev`

```bash
turbo-run dev
```

**作用：** **交互式选择**一个应用包，然后启动其开发服务器。

**详细说明：**
- `turbo-run` 会扫描整个 Monorepo 中所有 `package.json` 里定义了 `dev` 脚本的包。
- 如果匹配到多个包（如 `apps/web-antd`、`apps/web-ele`、`playground` 等），会在终端弹出选择列表：
  ```
  Select the app you need to run [dev]:
  ❯ @vben/web-antd
    @vben/web-ele
    @vben/playground
  ```
- 选择后，实际执行的是：
  ```bash
  pnpm --filter=@vben/web-antd run dev
  ```
- **注意**：虽然 `turbo.json` 中定义了 `dev` 任务（`persistent: true`, `cache: false`），但 `turbo-run` 并不是直接调用 `turbo dev`，而是调用 `pnpm --filter` 运行单个包的 `dev`。它的目的是提供交互式体验，而非 Turborepo 的任务调度。

**适用场景：** 快速启动某个应用的本地开发服务器，不需要记住完整的包名和 filter 命令。

---

### 6. `pnpm preview` → `turbo-run preview`

```bash
turbo-run preview
```

**作用：** **交互式选择**一个应用包，然后预览其生产构建产物。

**详细说明：**
- 逻辑与 `turbo-run dev` 完全一致，只是执行的脚本换成了 `preview`。
- 扫描所有定义了 `preview` 脚本的包，弹出选择器，然后执行 `pnpm --filter=<pkg> run preview`。
- `turbo.json` 中 `preview` 的配置为 `dependsOn: ["^build"]`，但这里因为是直接 `pnpm --filter` 执行单包命令，Turborepo 的全局 task 配置不直接参与。

**适用场景：** 构建完成后，快速预览某个应用的产物效果。

---

## 三、通过 `pnpm run build` 间接触发 turbo 的快捷命令

以下命令本身不直接调用 `turbo`，而是通过 `pnpm run build` 间接执行根目录的 `build` 脚本，从而进入 `turbo build` 流程。它们使用了 `--filter` 来限定只构建特定包及其依赖。

### 7. `pnpm build:antd`

```bash
pnpm run build --filter=@vben/web-antd
```

**作用：** 只构建 `apps/web-antd` 这个应用及其依赖。

**详细说明：**
- `pnpm run build` 会执行根目录的 `build` 脚本（即 `turbo build`）。
- `--filter=@vben/web-antd` 是 pnpm workspace filter，表示**只在这个包及其依赖范围内**执行任务。
- Turborepo 仍然会根据 `dependsOn: ["^build"]` 先构建 `@vben/web-antd` 所依赖的所有内部包（如 `@vben/icons`、`@vben/stores` 等），然后再构建 `@vben/web-antd` 本身。
- 其他不相关的包（如 `apps/web-ele`、`docs` 等）会被跳过。

---

### 8. `pnpm build:docs`

```bash
pnpm run build --filter=@vben/docs
```

**作用：** 只构建 `docs` 文档站点。

---

### 9. `pnpm build:ele`

```bash
pnpm run build --filter=@vben/web-ele
```

**作用：** 只构建基于 Element Plus 的后台应用 `apps/web-ele`。

---

### 10. `pnpm build:naive`

```bash
pnpm run build --filter=@vben/web-naive
```

**作用：** 只构建基于 Naive UI 的后台应用 `apps/web-naive`。

---

### 11. `pnpm build:tdesign`

```bash
pnpm run build --filter=@vben/web-tdesign
```

**作用：** 只构建基于 TDesign 的后台应用 `apps/web-tdesign`。

---

### 12. `pnpm build:play`

```bash
pnpm run build --filter=@vben/playground
```

**作用：** 只构建 `playground` 演示/测试应用。

---

## 四、`turbo.json` 核心配置对照表

| Task | `dependsOn` | `outputs` | `cache` | `persistent` | 说明 |
|------|-------------|-----------|---------|--------------|------|
| `build` | `["^build"]` | `dist/**`, `dist.zip`, `.vitepress/dist/**` | `true` | `false` | 拓扑排序构建，缓存产物 |
| `build:analyze` | `["^build"]` | `dist/**` | `true` | `false` | 构建并输出体积分析 |
| `preview` | `["^build"]` | `dist/**` | `true` | `false` | 预览任务 |
| `typecheck` | 无 | `[]` | `true` | `false` | 类型检查，无产物输出 |
| `test:e2e` | 无 | 无 | `true` | `false` | E2E 测试 |
| `dev` | `[]` | `[]` | `false` | `true` | 开发服务器，不缓存，持久运行 |

> `^build` 中的 `^` 是 Turborepo 的语法，表示"先执行依赖包中的同名任务"。

---

## 五、总结图

```
根目录 pnpm build
    └── cross-env NODE_OPTIONS=... turbo build
            └── turbo.json#tasks.build
                    ├── dependsOn: ["^build"] → 先构建依赖包
                    ├── 遍历 workspace 中所有定义了 build 脚本的包
                    ├── 拓扑排序，并行构建无依赖关系的包
                    └── 缓存 outputs 到 .turbo/cache/

根目录 pnpm build:antd
    └── pnpm run build --filter=@vben/web-antd
            └── 只对 @vben/web-antd 及其依赖执行上述流程

根目录 pnpm dev
    └── turbo-run dev
            └── 交互式选择包 → pnpm --filter=<pkg> run dev
```
