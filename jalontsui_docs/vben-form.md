# VbenForm 学习指南

> 基于本仓库（JalonTsui/vue-vben-admin fork, v5.7.0）源码整理。注意：本 fork 与上游 vbenjs/vue-vben-admin 差异很大 —— **校验引擎已从 vee-validate 换成 `@tanstack/vue-form` + zod**，组件注册也改成了两段式（见下文）。看官方文档时要留心这一点。

---

## 一、学习入口

- 演示页面：`apps/web-ele/src/views/demos/form/basic.vue`（`useVbenForm` 的各种 schema 写法：ApiSelect、RadioGroup、renderComponentContent 等）
- 运行它：

```bash
pnpm dev:ele          # 等价于 pnpm -F @vben/web-ele run dev
```

打开页面路由 `/demos/form/basic` 即可。应用启动时会执行 `apps/web-ele/src/bootstrap.ts`，其中依次调用：

1. `initComponentAdapter()` —— 注册 element-plus 组件
2. `initSetupVbenForm()` —— 注册表单规则与特殊 model 映射

---

## 二、源码位置地图

### 应用层（你自己改代码的地方）

| 文件 | 作用 |
| --- | --- |
| `apps/web-ele/src/adapter/form.ts` | `useVbenForm` 封装：调 `setupVbenForm({ config, rules })` 注册规则，注入本应用的组件类型泛型后转发给 `@vben/common-ui` 的 `useForm`；重导出 `z`、`VbenFormSchema`、`VbenFormProps` |
| `apps/web-ele/src/adapter/component/index.ts` | 组件适配器：`defineAsyncComponent` 按需加载 element-plus 组件，包装成 `ComponentType → Component` 映射，最后 `globalShareState.setComponents(components)` 写入全局共享状态 |
| `apps/web-ele/src/bootstrap.ts` | 应用启动时执行两个 init |
| `apps/web-ele/package.json` | `"imports": { "#/*": "./src/*" }` —— `#/adapter/form` 就是这里的 Node 子路径导入 |

### 核心库层 `packages/@core/ui-kit/form-ui`（包名 `@vben-core/form-ui`，约 6000 行）

经 `packages/effects/common-ui/src/components/index.ts` 以 `@vben/common-ui` 名义导出。

| 文件 | 行数 | 职责 |
| --- | --- | --- |
| `src/use-vben-form.ts` | 81 | hook 本体：`new FormApi(options)`，渲染 `VbenUseForm`，返回 `[Form, formApi]` 元组；options 是 reactive 时会 watch schema |
| `src/form-api.ts` | 751 | `FormApi` 类：`setValues / getValues / validate / submit / reset / updateSchema / setFieldValue / scrollToFirstError / getFieldComponentRef` 等。状态存在 `@vben-core/shared/store` 里 |
| `src/use-form-context.ts` | 148 | 从 schema 的 `defaultValue` / zod rules 提取初始值（用 `zod-defaults`），创建 form runtime，provide context |
| `src/form-runtime.ts` | 320 | **值与校验引擎**：基于 `@tanstack/vue-form` 的 `useForm()`，暴露 `values/meta/errors/validate/submit/useFieldValue...`，维护手动错误与异步校验竞态 |
| `src/form-runtime-field.ts` | 77 | 包装 tanstack 的 `Field` 组件，给 async validator 加竞态保护 |
| `src/vben-use-form.vue` | 187 | 挂载层：创建 form → `formApi.mount()` → 渲染 `Form`，处理 submitOnEnter / submitOnChange |
| `src/form-render/form.vue` | 206 | 渲染入口：schema 规范化（合并 commonConfig）→ 逐条渲染 `FormField` / `FormGroup` |
| `src/form-render/form-field.vue` | 645 | **核心渲染文件**：`COMPONENT_MAP` 解析组件、`useDependencies` 计算动态 props/rules、zod 校验、组装 v-model 绑定 |
| `src/form-render/schema.ts` | 534 | schema 增删改查工具（`createFormFieldSchema` / `updateFormSchemaList` ...） |
| `src/form-render/dependencies.ts` | 297 | 依赖系统：`triggerFields` 变化时调 `resolve(context)` 动态返回 props/rules/show/disabled/required |
| `src/config.ts` | 117 | **组件注册枢纽**：内置 `BUILT_IN_COMPONENT_MAP`（shadcn 组件）；`setupVbenForm()` 把 `globalShareState` 里的组件合并进 `COMPONENT_MAP`，并生成 `COMPONENT_BIND_EVENT_MAP`（特殊 model 属性名映射） |
| `src/rule-registry.ts` | 17 | 字符串规则名 → 校验函数 的 Map（`registerFormRules`） |
| `src/types.ts` | 1048 | 全部类型定义（FormSchema 的主文件） |
| `src/form-codec.ts` | ~40 | 提交值双向编解码（推荐的 valueFormat 替代品） |
| `src/__tests__/` | 20 个文件 | form-api、form-runtime、dependencies、codec 等单测 + benchmark |

### ApiSelect / ApiTreeSelect

- 通用封装：`packages/effects/common-ui/src/components/api-component/api-component.vue`（273 行）
- 应用侧包装：`apps/web-ele/src/adapter/component/index.ts:225-251`
- 机制：props 传 `api`（请求函数）、`params`、`labelField/valueField/childrenField`、`beforeFetch/afterFetch` 钩子、`immediate`；`watch([api, params])` 触发 `fetchApi()`，结果递归转成 `{ label, value, disabled, children }`，经 `optionsPropName` 喂给内层组件（ApiSelect 内层是 `ElSelectV2`，ApiTreeSelect 内层是 `ElTreeSelect`）。

### 官方文档（仓库内）

- 主文档：`docs/src/components/common-ui/vben-form.md`（英文：`docs/src/en/components/common-ui/vben-form.md`）
- zod v4 迁移深度指南：`docs/src/guide/in-depth/zod-v4-form-migration.md`
- 在线示例源码：`docs/src/demos/vben-form/`（api / basic / custom / dynamic / query / rules / value-format）
- 文档站：`pnpm dev:docs`

---

## 三、架构说明

### 调用链（一句话）

```
useVbenForm(options)                     ← apps/web-ele 的 adapter 转发到 @vben/common-ui
  └─ FormApi(options)                    ← form-api.ts，状态存 Store，提供 setValues/validate...
      └─ VbenUseForm (vben-use-form.vue) ← 创建 form、api.mount()、提交行为
          └─ useFormInitial              ← 提取初始值（defaultValue + zod-defaults）
          └─ useFormRuntime              ← form-runtime.ts，@tanstack/vue-form 引擎
              └─ Form (form-render/form.vue)   ← schema 规范化、分组、布局
                  └─ FormField (form-field.vue) ← 核心：组件解析 + 依赖 + 校验 + v-model
```

### 五条核心机制（按数据流向编号 0-4）

**0. Facade（门面）模式 —— 引擎隔离层**

整个表单系统对上层暴露的操作都定义在引擎无关的接口 `FormContextApi`（`types.ts:160`，别名 `FormActions`）里：`setFieldValue / getFieldValue / validate / submit / reset / useFieldError / meta / errors`……方法名全是中性词汇，不出现任何 `@tanstack` 或 `vee-validate` 的 API。

依赖方向：

- 只有 `form-runtime.ts` 直接 import `@tanstack/vue-form`，在内部组装出 `FormActions` 对象；
- 上层全部只面向这个接口：`form-api.ts:124` 的 `public form = {} as FormActions`、dependencies 回调的 `actions` 参数、`form-field.vue:97` 的 `getFormApi()`；
- 渲染层的值绑定也用自己的协议 `FormComponentField`（`modelValue` + `onUpdate:modelValue` + `onBlur`），不依赖引擎的组件。

这就是本 fork 能从 vee-validate 平滑迁到 @tanstack/vue-form 的原因：迁移只重写了 `form-runtime.ts`（约 320 行）+ form-field 的 validators 挂法，FormApi、schema 系统、渲染层、依赖系统原封不动。代码里的迁移痕迹：`resetForm`/`submitForm` 是 vee-validate 风格的命名遗留（标了 `@deprecated`）。

注意：这层门面是为了"上层代码不感知引擎"而存在，不是可插拔引擎架构——没有注入点，换引擎仍需改写门面内部，但改动被收敛到一个文件里。

**1. 组件注册（两段式，本 fork 特有）**

- 第一段：`initComponentAdapter()` 把 element-plus 组件（含 ApiSelect 等包装件）放进 `globalShareState`；
- 第二段：`initSetupVbenForm()` 调 `setupVbenForm({ config, rules })`，form-ui 内部把全局组件合并进 `COMPONENT_MAP`（form-field.vue 里 `componentMap[component]` 解析动态组件，未注册会 warn）；
- `config.modelPropNameMap` 处理特殊 model 属性名（如 antd 的 `checked`、本项目的 `CheckboxGroup: 'model-value'`），生成 `COMPONENT_BIND_EVENT_MAP`；
- `rules` 注册字符串规则名（如 `'required'`），供 schema 里 `rules: 'required'` 使用。

**2. 值绑定（不依赖组件内部 v-model 实现）**

form-field.vue 手工组装绑定对象：`{ modelValue, 'onUpdate:modelValue', onChange, onBlur, name }`，数据来源是 tanstack Field 的 `field.handleChange / handleBlur`。如果组件的 model 属性名特殊，`fieldBindEvent()` 会改写成对应的 `onUpdate:xxx`。所以任意第三方组件只要"值属性 + update 事件"的约定一致，就能直接接入。

**3. 校验链**

```
schema.rules（zod schema 或字符串规则名）
  → form-field.vue 的 validateFieldValue()（zod safeParseAsync 或 rule-registry 查表）
  → 包装成 tanstack validators: { onBlurAsync, onChangeAsync, onSubmitAsync }
  → @tanstack/vue-form 的 Field 执行
```

- 校验触发时机由 `validateOn` 控制，默认 blur + change；
- zod 还用于初始值提取（`zod-defaults`）和 label 必填星号判断（`rules.isOptional()`）；
- 嵌套 fieldName（`a.b`、`a[0]`）由 `src/field-name.ts` 解析。

**4. 依赖系统（dependencies）**

```ts
dependencies: {
  triggerFields: ['type'],        // 监听哪些字段
  resolve: ({ values, actions, controller, schema }) => ({
    componentProps: { disabled: values.type === 'A' },
    show: values.type !== 'B',
    required: true,
  }),
}
```

`triggerFields` 变化 → 重新执行 `resolve` → 返回的 patch 作用到该字段的 props/rules/显隐/必填。

### Schema 关键字段速查（types.ts）

- `fieldName`（必填，支持 `a.b` 嵌套）、`label`、`component`、`componentProps`（对象或函数）
- `rules`：`'required' | 'selectRequired' | null | ZodType`
- `dependencies`、`defaultValue`、`help`、`description`、`hide`、`suffix`
- `renderComponentContent`：自定义组件插槽内容
- `type: 'group'` 分组、`type: 'array'` + `children` 数组字段
- 提交值转换：推荐 `codec`（deprecated 的有 `valueFormat` / `fieldMappingTime` / `arrayToStringFields`）

---

## 四、调试方法

> 更详细的手动调试指南（完整调用链路 + 断点地图 + 故障排查手册）：见 `jalontsui_docs/vben-form-debug.md`。

**1. 跑起来看**

```bash
pnpm dev:ele     # 启动 web-ele，端口见 apps/web-ele/.env 的 VITE_PORT，默认 5666
```

`/api` 请求代理到 `http://localhost:5320/api`（nitro mock，见 `apps/web-ele/vite.config.ts`）。

**2. Vue DevTools**

`Component` 面板可以直接看到 `FormApi` 的状态（存在 Store 里）和 form-field 的 props；配合浏览器断点看 `form-field.vue` 的 `componentMap` 解析最直观。

**3. 单元测试（强烈推荐当调试工具用）**

```bash
pnpm test:unit        # vitest run --dom（happy-dom），含 form-ui 全部单测
pnpm test:benchmark   # form-api/form-runtime 的 benchmark
```

调试某个机制时，先看 `packages/@core/ui-kit/form-ui/__tests__/` 里对应的测试文件（form-api.test / form-runtime.test / dependencies.test / form-codec.test ...），比从页面入手快得多。改完跑 `pnpm test:unit` 验证。

**4. 源码断点**

关键断点位置：

- `form-field.vue` —— 看组件解析、依赖计算、校验触发
- `form-api.ts` 的 `setValues` / `getValues` —— 看值如何过滤/格式化
- `config.ts` 的 `setupVbenForm` —— 看组件注册是否生效
- `use-vben-form.ts` —— hook 入口

**5. e2e**

`pnpm test:e2e`（playwright，用例在 `playground/__tests__/e2e`）。

---

## 五、自己动手写一个动态表单

建议按这个顺序渐进：

**Step 1 — 纯 schema 驱动**：抄 `basic.vue`，只用 `Input/Select/DatePicker` + `rules: 'required'`，跑通 `handleSubmit` 拿 values。

**Step 2 — 掌握 formApi**：在页面里加按钮调 `formApi.setValues()` / `formApi.validate()` / `formApi.getValues()`，理解 api 与 UI 的分离。

**Step 3 — 动态化**：

- 用 `dependencies` 实现字段联动（显隐、禁用、必填）；
- 用 `formApi.updateSchema()` 运行时改 schema；
- 把 schema 抽出来由后端接口下发，前端只负责渲染 —— 这就是"动态表单"的核心闭环。

**Step 4 — 接入自定义组件**：

1. 在 `apps/web-ele/src/adapter/component/index.ts` 注册你的组件（注意约定：值属性默认 `modelValue` + `onUpdate:modelValue`，不一致就用 `config.modelPropNameMap` 声明）；
2. 扩展 `ComponentPropsMap` 类型让 `componentProps` 有类型提示；
3. 在 `adapter/form.ts` 的 `useVbenForm` 泛型里带上新类型。

**Step 5 — 自定义校验**：在 `adapter/form.ts` 的 `rules` 里加自己的字符串规则（函数签名为 `(value, params, ctx) => true | string 错误消息`），或直接写 zod schema（`z.string().min(3)`，可组合、可复用）。

**Step 6 — 进阶**：参考 `docs/src/demos/vben-form/dynamic`（动态 schema 示例）和 `playground/src/views/demos/form-array/`（数组字段 + 自带 README）。

一句话总结架构思想：**schema 是数据，FormApi 是控制器，form-field.vue 是渲染器，组件映射和规则注册是插件点**。写自己的动态表单，本质就是设计你的 schema 协议 + 往这三个插件点里注册东西。
