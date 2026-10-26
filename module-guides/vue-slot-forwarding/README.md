# Vue 插槽转发（slot forwarding）最小示例

> 解释 `vben-use-form.vue:136-147` 的动态插槽转发写法。说明：本目录是**语言特性解释示例**（不是第三方模块解读），但沿用 module-guides 的同一套约定：目录即 workspace 包，README 即文档，示例可直接运行。

## 运行示例

```bash
# 行为测试（5 个断言：穿透 / 参数合并 / 不转发对照 / 名单来自调用方）
pnpm run test        # 在 module-guides/vue-slot-forwarding 目录下

# 浏览器 demo：上半有转发、下半对照组不转发，肉眼对比
pnpm run dev         # 打开 http://localhost:5173
```

## 三层角色与 vben 的对应关系

| 本示例 | vben 对应 | 职责 |
| --- | --- | --- |
| `Page.vue` | 业务页面（写 `<Form #username="...">` 的人） | 插槽内容的**生产者** |
| `Middle.vue` | `VbenUseForm`（vben-use-form.vue） | **转发者**：`useSlots` 拿名单 + 动态建桥 |
| `Leaf.vue` | `FormField`（form-field.vue） | 插槽出口的定义者，产生 slotProps |

核心代码就四行（`Middle.vue`）：

```vue
<template v-for="name in forwardedNames" :key="name" #[name]="slotProps">
  <slot :name="name" v-bind="slotProps" injected-by-middle="M" />
</template>
```

- `<template #[name]>`：朝子组件方向——告诉 Leaf"你的这个插槽内容由我提供"；
- `<slot :name="name">`：朝父组件方向——从自己的 `$slots` 里取出页面传入的同名内容渲染；
- 每转发一层就是一座这样的"双向桥"，slotProps 沿途被各层追加。

## 插槽内容不会自动穿透（对照组）

`NoForwardMiddle.vue` 演示了不传发的结果：页面传了 `#user` 内容，但它只能停在 Middle 的 `$slots` 里——Leaf 的 `<slot name="user">` 出口渲染为空。**每经过一层组件，都必须显式重声明一次插槽**，这就是 vben 需要 `delegatedSlots` 名单做动态转发的原因（字段插槽名来自 schema 的 fieldName，写模板时不可预知）。

## 本示例实测发现的两个坑（写转发代码时要避开）

**坑 1：slotProps 的 key 别用 `name`。** `v-bind="slotProps"` 展开在 `:name="slotName"` 之后，若 slotProps 里恰好有 `name` 键，会把插槽名覆盖掉，转发直接失效且无任何报错。本示例最初就在 Leaf 里传了 `:name="userName`，导致 `user` 插槽静默丢失，改用 `:user="userName"` 解决。vben 里没踩这个坑只是因为 FormField 的 slotProps 恰好不含 `name`。

**坑 2：`<slot>` 元素上的 kebab-case 静态属性会被 camelize。** `<slot injected-by-middle="M">` 到达插槽消费方时，key 变成了 `injectedByMiddle`（Vue 对静态属性的处理），页面模板里要用 `props.injectedByMiddle` 取。想保留原 key，用动态绑定 `:['injected-by-middle']="'M'"`。

## 测试覆盖（examples/slot-forwarding.test.ts）

1. 页面内容穿透中间层，渲染在 Leaf 内部
2. 插槽参数沿途合并：Leaf 产的（user/source）+ Middle 注入的（injectedByMiddle）页面全拿到
3. 对照组：不转发则 Leaf 出口为空（插槽不自动穿透）
4. 基线：Leaf 单独使用、无插槽内容时出口为空
5. 转发名单来自调用方（useSlots）：多传的名字也会建桥，但下游没有对应出口时内容不渲染
