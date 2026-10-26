# VbenForm 手动 Debug 调试指南（附完整调用链路）

> 配套文档：`jalontsui_docs/vben-form.md`（架构学习指南）。本文专注"出了问题怎么查"。
> 所有行号基于 `packages/@core/ui-kit/form-ui/src`（下称 `src/`），已针对当前 fork 源码核对。
> 校验引擎是 `@tanstack/vue-form` + zod（不是 vee-validate），浏览器控制台断点调试前请先记住这一点。

---

## 〇、调试前的三个前提

1. **跑起来**：`pnpm dev:ele`，打开 `/demos/form/basic`。
2. **源码定位**：浏览器 DevTools → Sources → 按 `Ctrl+P` 搜文件名（如 `form-field.vue`），或直接在框架代码里打断点。`packages/@core` 下的包在 dev 模式下是源码直出，行号与本指南一致。
3. **控制台关键字**：form-ui 的所有告警/报错都带 `[Vben Form]` 前缀或直接写明模块，先全局搜控制台，对照文末《控制台消息对照表》。

---

## 一、四条主调用链路

### 链路 A：初始化与挂载（值从哪来）

```
页面 useVbenForm(options)                apps/web-ele/src/adapter/form.ts:37
  └─ useForm(options)                    src/use-vben-form.ts:40
      ├─ :43 isReactive(options)？是 → :65 watch(options.schema) → api.setState({schema})
      │      （只 watch 顶层引用；schema 数组原地 mutate 不触发）
      ├─ :44 new FormApi(options)        src/form-api.ts:148
      │      ├─ :153 new Store(默认14项配置 + options)
      │      ├─ :158 store.subscribe → updateState()（form-api.ts:665）
      │      │      schema 字段数变少时，被删字段 setFieldValue(name, undefined) :669
      │      └─ :166 bindMethods(this)
      └─ :50 defineComponent(Form)（只定义不执行，页面渲染 <Form /> 时才跑）
            └─ Form setup:
                ├─ :55 api.setState({...props, ...attrs})
                └─ :57 h(VbenUseForm, {...props, attrs, formApi})

VbenUseForm setup（src/vben-use-form.vue:36）
  ├─ :37 formApi 为空直接 throw 'Form api is required in <VbenUseForm />'
  ├─ :43 useForwardPriorityValues(props, state)   逐 key：props 优先，store 兜底
  ├─ :47 useFormInitial(forward)        src/use-form-context.ts:78
  │    ├─ :97 generateInitialValues()   ← 初始值合成的核心
  │    │    每个展平字段（分组被 schema.ts:277 展平）：
  │    │    ① 有 defaultValue（Reflect.has 判定，值为 undefined 也算有）
  │    │         → :102 直接写入，【不走 zod 分支】
  │    │    ② 否则 rules 存在且非字符串 →
  │    │         :106 getCustomDefaultValue（string→''、number→null、object→递归）
  │    │         :108 normalizeSchemaForDefaults（把 zod-defaults 不认得的节点换成裸 zod）
  │    │         :109 custom 值非 undefined → 覆盖该字段 zod 结果
  │    │    ③ :115 getDefaultsForSchema(object(zodObject))  ← zod-defaults 统一取默认值
  │    │    ④ :121 mergeWithArrayOverride(initialValues, zodDefaults)
  │    │         defu 语义：initialValues 已有键优先，缺失键由 zodDefaults 补齐
  │    └─ :84 useFormRuntime(initialValues)      src/form-runtime.ts:39
  │         ├─ :42 useForm({defaultValues, onSubmit: noop}) ← tanstack 实例诞生
  │         ├─ :46-55 useSelector 抽出 values/meta/errors/isValid...
  │         ├─ :56 manualErrors = shallowRef(new Map)      ← 手动错误存储
  │         ├─ :87 createRuntimeFieldComponent(Field)      ← formApi.fieldComponent
  │         └─ :243 组装 FormActions 返回（门面接口）
  ├─ :50-51 provideFormProps / provideComponentRefMap
  ├─ :53 formApi.mount(form, componentRefMap)   ← 挂载点（form-api.ts:338）
  │      ├─ :342 isMounted 守卫（重复 mount 跳过）
  │      ├─ :343 this.form = formActions
  │      ├─ :344 stateHandler.setConditionTrue()  ← 解除所有挂起的 getForm()
  │      ├─ :346-360 初始值 formatValues 编码
  │      │      无 codec → :351 失败直接 throw
  │      │      有 codec → :354 console.warn 并回退 raw 值
  │      └─ :364 isMounted = true
  └─ :81 onMounted + nextTick → valuesChangeReady = true
         （:87 watch(values) 在此之前直接 return，防初始值误触发 handleValuesChange）
```

**关键认知**：`useFormRuntime` 只在 setup 跑一次 → **初始值是挂载那一刻的快照**。之后 reactive 换 schema / updateSchema 新增字段，都不会自动生成初始值（值是 undefined，需自己 `setValues`）。

### 链路 B：渲染（schema 到 DOM）

```
Form setup（src/form-render/form.vue）
  ├─ :69 formFieldSchemas = getFormFieldSchemas(schema)   分组 flatMap 展平
  ├─ :73 shapes（默认插槽用）: 每项算 default（zod safeParse(undefined)）和 required
  └─ :118 computedSchema    ← schema 变化的响应点
        逐条：
        ├─ :125 hidden = showCollapseButton && formCollapsed && index >= keepIndex
        ├─ 分组（type==='group'）: :132 hide 或无 children → 跳过
        │      否则 children.map → NormalizedFormGroupSchema :135
        └─ 单字段: :144 normalizeFieldSchema
               └─ schema.ts:421 createFormFieldSchema
                    ① :425 mergeWithArrayOverride(局部commonConfig, 全局globalCommonConfig)
                    ② :446 isFormArraySchema → createArrayFieldSchema（强制 VbenFormFieldArray）
                    ③ :429-444 展开默认值（labelWidth=100、colon=false 等）
                    ④ :492 disabled 链：options.disabled ?? schema.disabled ?? commonConfig.disabled

FormField（src/form-render/form-field.vue，每字段一个实例，:key = fieldName）
  ├─ :81 useFormContext()   拿 componentMap / componentBindEventMap
  ├─ :88-89 useFieldError / useFieldValue(fieldName)   tanstack useSelector 桥
  ├─ :105 FieldComponent computed
  │      字符串 → componentMap[component]；未注册 → :111 warn，渲染为空
  ├─ :116 useDependencies(...)     见链路 C
  ├─ :141 currentRules = dynamicRules ?? props.rules(toRaw)
  ├─ :152 shouldRequired  ← 必填星号判断（zod 看 isOptional()，字符串规则看白名单）
  ├─ :172 fieldRules      ← 真正进校验的规则
  ├─ :225 fieldValidators ← { onSubmitAsync 恒有; onBlurAsync/onChangeAsync 看 validateOn }
  └─ 模板 :508 <component :is="formApi.fieldComponent">（RuntimeField 包装层）
       RuntimeField（form-runtime-field.ts）: 给 validator 包 validationRunId 竞态保护
```

**v-model 绑定组装**（`createComponentProps`，form-field.vue:417）：

```
createFieldSlotProps :353
  componentField = { name, modelValue, onBlur, onChange/'onUpdate:modelValue' }
  handleChange: ① :356 先 setFieldError(name) 清手动错误  ② field.handleChange(value) 写入 tanstack
resolveModelPropName :372 = modelPropName ?? componentBindEventMap[component]
fieldBindEvent :379    特殊 model 属性名（如 checked）时改写绑定
合成顺序 :425-436       computedProps < componentField < bindEvents < disabled < 用户 onChange 兜底
name 剥离 :451-459     与 <form> 固有属性冲突时删掉 name（防 issue #8214）
```

### 链路 C：校验（什么时候、谁执行）

```
触发源：
① blur/change  → tanstack Field 自动调 validators.onBlurAsync / onChangeAsync
                 （由 formFieldProps.validateOn ?? ['blur','change'] 决定挂哪些，form-field.vue:221）
② formApi.validate()        form-api.ts:605 → form-runtime.ts:165 validateAllFields('submit')
③ formApi.validateField(n)  form-api.ts:634 → form-runtime.ts:156 validateField(name, 'submit')

执行体（每次都进这里）：
validateFieldValue({value})   form-field.vue:193
  ├─ 无规则           → return undefined（通过）
  ├─ 字符串规则名     → :200 getFormRule(name)（src/rule-registry.ts:5 查模块级 Map）
  │                     未注册 → :202 warn 'Form rule X is not registered'，【静默跳过该校验】
  │                     已注册 → :213 validator(value, [], ctx)，true→通过，否则返回错误文案
  └─ zod 规则         → :217 safeParseAsync(value)，取 error.issues[0].message

错误汇总：form-runtime.ts:92 getErrors()
  逐字段合并两路：manualErrors.get(name) ?? tanstack fieldMeta.errors[0]
  → formApi.validate() 的返回值 / meta.valid / 提交拦截都以此为准
```

### 链路 D：提交（validate → encode → 回调 的精确顺序）

```
【路径 1】提交按钮 click（form-actions.vue:33）
  └─ formApi.validateAndSubmit()     form-api.ts:619
       ├─ :605 this.validate()       ← 先全量校验
       │      失败 → :621 直接 return，【不进入提交】
       └─ :658 submitValues()
            ├─ :278 getValueSnapshot()
            │    ├─ :261 getRawValues() = cloneDeep(toRaw(form.values))
            │    └─ :176 formatValues()
            │         有 codec → form-codec.ts:31 encodeFormValues
            │           （encode 抛错 → 包成 FormCodecError 向上 throw，回调不执行）
            │         无 codec → formatFormValues（旧 valueFormat/时间字段转换）
            ├─ :660 setLatestSubmissionValues(values)
            └─ :661 await state.handleSubmit(values, rawValues)   ← 你的业务回调

【路径 2】回车 / submitOnEnter（vben-use-form.vue:61）→ 同样走 validateAndSubmit()

【路径 3】原生 <form> submit（form.vue:93）→ props.form.handleSubmit → 内嵌 validate → emit('submit')

【路径 4】formApi.submit()（form-api.ts:560）⚠️ 与路径 1 不同：
      校验内嵌在 tanstack rawForm.handleSubmit() 里，过了才走 submitValues()
      排查"submit 行为不一致"时先确认走的是哪条路径。

【路径 5】submitOnChange（vben-use-form.vue:87 watch values）
      → debounce（默认 300ms 或 changeDebouncedTime）→ validateAndSubmit()（即路径 1）

handleValuesChange 回调签名（:96-111）：(values, changedFields, formatValuesFn)
  changedFields 由 isEqual 逐字段比对得出。
```

---

## 二、打断点地图（按"我想看什么"查）

### 初始化问题（值不对 / 不渲染 / api 死等）

| 想看的 | 断点 | 备注 |
|---|---|---|
| FormApi 构造入参 | `use-vben-form.ts:44` | options 是否 reactive 看 :43 |
| props 与 reactive schema 两条 setState 入口 | `use-vben-form.ts:55` / `:69` | |
| Store 初始 state | `form-api.ts:148-167` | |
| schema 变更 diff、被删字段 | `form-api.ts:665` updateState | |
| 展平后的 schema 列表 | `use-form-context.ts:101` | 分组是否展开 |
| 字段走 defaultValue 还是 zod 分支 | `use-form-context.ts:102` / `:104` | |
| zodObject 内容、zod-defaults 原始结果 | `use-form-context.ts:115` | |
| 合并前后 initialValues 与 zodDefaults | `use-form-context.ts:121` | |
| 传给 tanstack 的最终 defaultValues | `form-runtime.ts:42` | |
| mount 时序、初始值编码成败 | `form-api.ts:338-366` | catch 分支在 :351/:354 |
| api 调用挂起/恢复 | `form-api.ts:647` getForm | waitForCondition / throw 点 :653 |

### 渲染问题（组件不显示 / props 不对 / 星号不对）

| 想看的 | 断点 | 备注 |
|---|---|---|
| 每次 schema 变化后的最终渲染列表 | `form-render/form.vue:118` computedSchema | |
| commonConfig 合并、规范化结果 | `form-render/schema.ts:421` | 数组分支 :446 |
| 组件解析结果 | `form-field.vue:105` | 未注册 warn 在 :111 |
| 必填星号判断 | `form-field.vue:152` | |
| 实际生效的校验触发器集合 | `form-field.vue:225` fieldValidators | |
| refMap 写入/删除（getFieldComponentRef 相关） | `form-field.vue:495` | onUnmounted 时 delete |
| 特殊 model 属性名改写 | `form-field.vue:372` / `:379` | |
| 最终 COMPONENT_MAP 内容 | `config.ts:115` replaceRecord | |

### 校验 / 提交问题

| 想看的 | 断点 | 备注 |
|---|---|---|
| 每次字段校验的入参值与分支 | `form-field.vue:193` validateFieldValue | zod 走 :217，字符串规则走 :200 |
| 全量校验后两路错误合并 | `form-runtime.ts:165` / `:92` getErrors | manualErrors 是否混入 |
| 手动错误写入/清除 | `form-runtime.ts:174` setFieldError | |
| 异步校验竞态丢弃 | `form-runtime-field.ts:48` | validationRunId |
| 提交主入口、校验失败分支 | `form-api.ts:619` validateAndSubmit | :621 valid=false 直接 return |
| 提交前的 encode 结果 | `form-api.ts:658` submitValues | |
| codec.encode 抛错第一现场 | `form-codec.ts:31` | FormCodecError |
| submitOnChange / handleValuesChange 触发 | `vben-use-form.vue:87` | |
| setValues 的过滤前后差异 | `form-api.ts:504` | filtered 在 :556 |
| updateSchema 补丁与报错 | `form-api.ts:586` | 无 fieldName 报错在 :592 |

### dependencies 联动问题

| 想看的 | 断点 | 备注 |
|---|---|---|
| triggerFields 值变化、context 内容、resolve vs legacy 分支 | `form-render/dependencies.ts:222` watch cb | |
| 字段取值方式（嵌套名 `'[a.b]'` 不拆分） | `form-render/dependencies.ts:59` | |
| 竞态丢弃过期结果 | `form-render/dependencies.ts:262` | |

---

## 三、故障排查手册（症状 → 第一个出问题位置 → 怎么验证）

### 3.1 渲染类

**症状：某字段整个不渲染**
- 首查 `form.vue:132`：分组 `hide` 或 children 为空会被跳过。
- 再看 form-field 的 `v-if="!hide && isIf"`（:507）：`hide` 来自 schema，`isIf` 来自 dependencies 的 `if`（patch.if === false 时 legacy 模式后续 patch 全部不求值，dependencies.ts:136）。
- 验证：断 `computedSchema`（form.vue:118）确认该字段是否进了渲染列表；进了再看 `isIf/isShow`。

**症状：字段渲染了但是空的（组件没出来）**
- 控制台必有 warn：`Component X is not registered`（form-field.vue:111）。
- 原因链：组件名拼错 / `initComponentAdapter()` 没执行 / `setupVbenForm` 在首次渲染之后才调用。
- 验证：断 `config.ts:115` 看最终 COMPONENT_MAP 有没有这个 key；`apps/web-ele/src/bootstrap.ts` 确认两个 init 的顺序。

**症状：必填星号或必填行为不对**
- 断 `form-field.vue:152` shouldRequired。zod 规则看 `!rules.isOptional()`；字符串规则看白名单 `['required','selectRequired']`。
- 注意：`rules: 'required'`（字符串）和 zod 的 `z.string().optional()` 表现不同，前者恒必填。

### 3.2 值类

**症状：初始值缺失 / 不对**
- 断 `use-form-context.ts:102`：该字段是否走了 defaultValue 分支短路。
  - `defaultValue: undefined` 也会短路（Reflect.has 判定），zod 兜底被跳过——这是最常见的坑。
- 断 `:104`：rules 是字符串名（如 `'required'`）时进不了 zod 分支，初始值为 undefined。
- 断 `:115` / `:121`：zod-defaults 原始结果与合并结果是否符合预期。
- 最后断 `form-runtime.ts:42` 确认传给 tanstack 的 defaultValues。

**症状：updateSchema 新增了字段，值为 undefined**
- 原因：`useFormRuntime` 只在 setup 跑一次，initialValues 是挂载快照；`updateState` 只处理**被删**字段（form-api.ts:669），不补新字段值。
- 解法：updateSchema 后手动 `formApi.setValues({ 新字段: 初始值 })`。

**症状：setValues 设置了值但界面上某字段没更新**
- setValues 默认 `filterFields=true`：值会按 schema 字段路径过滤（form-api.ts:523-557），不在任何 schema 路径前缀上的 key 被丢弃。
- 验证：断 :556 看 filtered 结果；fieldName 写错（如嵌套名写成 `a.b` 但实际 schema 是扁平的）是最常见原因。

**症状：change 回调里拿到的 values 是上一次提交的**
- submitValues 之后才 `setLatestSubmissionValues`（form-api.ts:660）；若你在 handleSubmit 内部又调 getValues，拿到的是本次值，若在外面 watch 则需注意时序。

### 3.3 校验类

**症状：必填规则没拦住提交**
- 控制台是否有 `Form rule X is not registered`（form-field.vue:202）？→ 字符串规则没注册会被**静默跳过**。
- 该字段是否可见？不可见字段 fieldRules 为 null（form-field.vue:172），校验直接通过。
- 断 `form-field.vue:225` 确认 onSubmitAsync 是否真的挂了。

**症状：手动 setFieldError 的错误不显示 / 不消失**
- 显示：断 `form-runtime.ts:130` useFieldError（manualErrors 优先于 tanstack 错误）。
- 消失：用户输入触发 handleChange 会先清手动错误（form-field.vue:356）。若业务依赖"错误持续显示"，别在用户输入路径上覆盖。
- 阻止提交：manualErrors 会并入 getErrors（form-runtime.ts:92），validate() 同样失败。

**症状：异步校验结果错乱（旧结果覆盖新结果）**
- 看竞态保护是否生效：断 `form-runtime-field.ts:48`。若你在 resolve 里自己另起请求而不复用 validators 机制，则无此保护。

**症状：dependencies 联动不触发 / 触发错**
- `triggerFields` 写错字段名**无任何 warn**，resolve 收到 undefined，可能把字段错误地 show/disabled 掉（dependencies.ts:59）。先核字段名拼写。
- 断 `dependencies.ts:222` 看 watch 是否真的进了 cb；`isEqual` 相同值会直接 return（:232）。
- legacy 回调里 `if` 返回 false 会直接 return，show/componentProps/rules 等全部不求值（:136）。

### 3.4 提交类

**症状：点提交按钮业务回调没执行**
按顺序查：
1. 控制台有 `Form rule X is not registered`？→ 校验被跳过通常不是原因（跳过=通过）；更常见是有字段校验失败但 UI 没显示（字段被 hide/if 隐藏，错误渲染不出来）。
2. 断 `form-api.ts:619` → `:605` → form-runtime.ts:165，看 validate 返回值和 getErrors() 的合并结果。
3. 若 validate 过了，断 `:658` submitValues → `form-codec.ts:31`：codec.encode 抛错会**整体 throw**，回调不执行且无业务侧 catch 时只在控制台看到 FormCodecError。
4. 确认走的是哪条提交路径（validateAndSubmit / submit / 原生 submit / submitOnChange，见链路 D）。

**症状：提交的值格式不对（日期、数组等）**
- 断 `form-api.ts:176` formatValues：有 codec 走 codec.encode，无 codec 走旧 formatFormValues。codec 与 valueFormat/fieldMappingTime/arrayToStringFields 混用会 console deprecation warn（:685）。

**症状：submitOnChange 频繁触发或一次改动触发两次**
- 防抖时间默认 300ms 或 `changeDebouncedTime`（vben-use-form.vue:75-77）。
- 初始值同步是否误触发？`valuesChangeReady`（:79-85）在 onMounted + nextTick 之后才为 true。

**症状：api 调用不返回 / 抛 `<VbenForm /> is not mounted`**
- `<VbenUseForm>` 根本没渲染（比如 v-if 包着）时，所有经 getForm 的调用会一直等 stateHandler。
- 组件已卸载后调用也会 reject/throw。排查：确认 Form 组件在模板里真实挂载，断 `form-api.ts:647` 看挂起点。

### 3.5 控制台消息对照表

| 消息 | 出处 | 含义 |
|---|---|---|
| `Form api is required in <VbenUseForm />` | vben-use-form.vue:37 | 手工 h() 或封装时漏传 formApi |
| `Component X is not registered` | form-field.vue:111 | 组件名未注册，字段渲染为空，值恒 undefined |
| `Form rule X is not registered` | form-field.vue:202 | 字符串规则未注册，该校验被静默跳过 |
| `All items in the schema array must have a valid 'fieldName' property to be updated` | form-api.ts:592 | updateSchema 某项缺 fieldName，**整批不更新** |
| `[Vben Form] Failed to encode initial values. Falling back to raw form values.` | form-api.ts:354 | mount 时 codec.encode 初始值失败，回退原始值 |
| `[Vben Form] Failed to encode form values.`（FormCodecError） | form-codec.ts:38 | 提交时 codec.encode 抛错，handleSubmit 不执行 |
| `[Vben Form] setSubmitValues() requires a form codec.` | form-api.ts:486 | 无 codec 时调 setSubmitValues |
| `[Vben Form] 'dependencies.resolve' cannot be combined with legacy dependency callbacks.` | dependencies.ts:110 | resolve 与 legacy 混用，resolve 优先（仅 dev warn） |
| `<VbenForm /> is not mounted` | form-api.ts:653 | mount 前/卸载后调 api |

---

## 四、推荐调试工作流

1. **先控制台，后断点**：所有 warn/error 都在上表，先对照能省一半时间。
2. **单测当 REPL 用**：`pnpm test:unit`，对应测试在 `src/__tests__/`（form-api.test / form-runtime.test / dependencies.test / form-codec.test ...）。想验证"setValues 过滤逻辑""zod 初始值合成"这类纯逻辑，写个临时 test 比在页面里点快得多。
3. **二分定位**：渲染问题从 `form.vue:118`（进没进渲染列表）→ `form-field.vue:105`（组件解析）→ `:507/:521`（v-if/v-show）逐层下钻；值问题从 `use-form-context.ts:97`（初始值）→ `form-runtime.ts:42`（引擎快照）→ `form-api.ts:504`（setValues 过滤）逐层下钻。
4. **DevTools 辅助**：Vue DevTools 组件面板可看 FormField 的 props（尤其 dependencies 算出的 dynamicComponentProps）和 FormApi store 状态；Store 状态在 form-api.ts:153 创建的 `@vben-core/shared/store` 里。
5. **e2e 复现**：playground 有 e2e 用例（`pnpm test:e2e`），复杂联动问题可先在 `apps/web-ele/src/views/demos/form/` 加最小复现页。
