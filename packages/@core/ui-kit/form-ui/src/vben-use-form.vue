<script setup lang="ts">
import type { ExtendedFormApi, VbenFormProps, VbenFormSlots } from './types';

import { nextTick, onMounted, readonly, watch } from 'vue';

import { useForwardPriorityValues } from '@vben-core/composables';
import { get, isEqual } from '@vben-core/shared/utils';

import { useDebounceFn } from '@vueuse/core';

import FormActions from './components/form-actions.vue';
import {
  COMPONENT_BIND_EVENT_MAP,
  COMPONENT_MAP,
  DEFAULT_FORM_COMMON_CONFIG,
} from './config';
import { Form } from './form-render';
import { getFormFieldSchemas } from './form-render/schema';
import {
  provideComponentRefMap,
  provideFormProps,
  useFormInitial,
} from './use-form-context';

// 通过 extends 会导致热更新卡死，所以重复写了一遍
interface Props extends VbenFormProps {
  formApi?: ExtendedFormApi<any, any, any, any>;
}

const props = defineProps<Props>();
defineSlots<
  Record<string, ((props: Record<string, any>) => any) | undefined> &
    VbenFormSlots<any, any, any>
>();

const formApi = props.formApi;
if (!formApi) {
  throw new Error('Form api is required in <VbenUseForm />');
}

const state = formApi.useStore();

// 表单配置（非字段值）：props 与 store 中的 options 按优先级合并后的视图（slot > attrs > props > store）
const forward = useForwardPriorityValues(props, state);

// 字段组件实例表：fieldName → 组件 ref，scrollToFirstError / getFieldComponentRef 使用
const componentRefMap = new Map<string, unknown>();

// 表单初始化（setup 阶段一次性）：
// - form：引擎门面（FormActions），渲染层直接用它做值绑定/校验，稍后经 mount 交给 FormApi
// - delegatedSlots：调用方传入的具名插槽名单，模板据此透传到对应字段
const { delegatedSlots, form } = useFormInitial(forward);
// 字段值（来自 tanstack 引擎，非上面的配置 state）；仅用于下方的 submitOnChange / handleValuesChange 监听
const values = form.useValues();

// 向下游 provide 渲染所需的全部上下文：配置视图 + 引擎门面，form-field 通过 inject 取用
provideFormProps([forward, form]);
provideComponentRefMap(componentRefMap);

// 交接点：FormApi 正式持有引擎门面，此后业务层调 formApi.xxx() 才会真正落到引擎上
formApi.mount(form, componentRefMap);

function handleUpdateCollapsed(value: boolean) {
  props.formApi?.setState({ collapsed: value });
  // 触发收起展开状态变化回调
  forward.value.handleCollapsedChange?.(value);
}

function handleKeyDownEnter(event: KeyboardEvent) {
  if (!state?.value.submitOnEnter || !forward.value.formApi?.isMounted) {
    return;
  }
  // 如果是 textarea 不阻止默认行为，否则会导致无法换行。
  // 跳过 textarea 的回车提交处理
  if (event.target instanceof HTMLTextAreaElement) {
    return;
  }
  event.preventDefault();

  forward.value.formApi?.validateAndSubmit();
}

// 值变化防抖提交：submitOnChange 开启后，值变化不会立刻提交，而是防抖聚合（默认 300ms，可用 changeDebouncedTime 调整）
const handleValuesChangeDebounced = useDebounceFn(async () => {
  state?.value.submitOnChange && forward.value.formApi?.validateAndSubmit();
}, state?.value?.changeDebouncedTime ?? 300);

// 守卫：挂载完成（且过了一个 tick）之前的值变化一律忽略，
// 否则初始值同步进 form.values 的过程会误触发 handleValuesChange / submitOnChange
let valuesChangeReady = false;

onMounted(async () => {
  // 只在挂载后开始监听，form.values会有一个初始化的过程
  await nextTick();
  valuesChangeReady = true;
});

// 表单级值变化响应（注意：字段间联动 disabled/show/required 走 schema 的 dependencies，
// 在 form-field.vue 的 useDependencies 里处理，不经过这里）
watch(values, (currentValues, previousValues) => {
  if (!valuesChangeReady) {
    return;
  }
  const handleValuesChange = forward.value.handleValuesChange;
  const submitOnChange = state?.value.submitOnChange;
  if (!handleValuesChange && !submitOnChange) {
    return;
  }
  // 逐字段比对，算出本次变化的字段名列表
  const fields = getFormFieldSchemas(state?.value.schema ?? []).map(
    (item) => item.fieldName,
  );
  if (handleValuesChange && fields.length > 0) {
    const changedFields = fields.filter((field) => {
      return !isEqual(
        get(currentValues, field),
        get(previousValues ?? {}, field),
      );
    });
    if (changedFields.length > 0) {
      // 回调签名：(最新值, 变化的字段名数组, 格式化函数——内部走 codec 编码，调用时才执行)
      handleValuesChange(readonly(currentValues), changedFields, () =>
        formApi.formatValues(currentValues),
      );
    }
  }
  // 自动提交：值变化 -> 防抖 -> 全量校验 -> 编码 -> handleSubmit（即 validateAndSubmit 链路）
  if (submitOnChange) {
    handleValuesChangeDebounced();
  }
});
</script>

<template>
  <Form
    @keydown.enter="handleKeyDownEnter"
    v-bind="forward"
    :collapsed="state?.collapsed"
    :component-bind-event-map="COMPONENT_BIND_EVENT_MAP"
    :component-map="COMPONENT_MAP"
    :form="form"
    :global-common-config="DEFAULT_FORM_COMMON_CONFIG"
  >
    <template
      v-for="slotName in delegatedSlots"
      :key="slotName"
      #[slotName]="slotProps"
    >
      <slot
        :name="slotName"
        v-bind="slotProps"
        :form-api="formApi"
        :values="form.values"
      ></slot>
    </template>
    <template #default="slotProps">
      <slot
        v-if="$slots.default"
        v-bind="slotProps"
        :form-api="formApi"
        :values="form.values"
      ></slot>
      <FormActions
        v-else-if="forward.showDefaultActions"
        :model-value="state?.collapsed"
        @update:model-value="handleUpdateCollapsed"
      >
        <template #reset-before="resetSlotProps">
          <slot
            name="reset-before"
            v-bind="resetSlotProps"
            :form-api="formApi"
            :values="form.values"
          ></slot>
        </template>
        <template #submit-before="submitSlotProps">
          <slot
            name="submit-before"
            v-bind="submitSlotProps"
            :form-api="formApi"
            :values="form.values"
          ></slot>
        </template>
        <template #expand-before="expandBeforeSlotProps">
          <slot
            name="expand-before"
            v-bind="expandBeforeSlotProps"
            :form-api="formApi"
            :values="form.values"
          ></slot>
        </template>
        <template #expand-after="expandAfterSlotProps">
          <slot
            name="expand-after"
            v-bind="expandAfterSlotProps"
            :form-api="formApi"
            :values="form.values"
          ></slot>
        </template>
      </FormActions>
    </template>
  </Form>
</template>
