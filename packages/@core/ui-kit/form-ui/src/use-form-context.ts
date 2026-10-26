import type { ZodType } from 'zod';

import type { ComputedRef } from 'vue';

import type { ExtendedFormApi, FormActions, VbenFormProps } from './types';

import { computed, toRaw, unref, useSlots } from 'vue';

import { createContext } from '@vben-core/shadcn-ui';
import { isString, mergeWithArrayOverride, set } from '@vben-core/shared/utils';

import {
  object,
  ZodIntersection,
  ZodNumber,
  ZodObject,
  ZodString,
  string as zodString,
  ZodStringFormat,
} from 'zod';
import { getDefaultsForSchema } from 'zod-defaults';

import { getFormFieldSchemas } from './form-render/schema';
import { useFormRuntime } from './form-runtime';

type ExtendFormProps = VbenFormProps & {
  formApi?: ExtendedFormApi<any, any, any>;
};

export const [injectFormProps, provideFormProps] =
  createContext<[ComputedRef<ExtendFormProps> | ExtendFormProps, FormActions]>(
    'VbenFormProps',
  );

export const [injectComponentRefMap, provideComponentRefMap] =
  createContext<Map<string, unknown>>('ComponentRefMap');

/**
 * Rebuild the schema used by zod-defaults, replacing native format nodes that
 * zod-defaults does not recognise while retaining supported wrappers.
 */
function normalizeSchemaForDefaults(rule: ZodType): ZodType {
  const rawRule = toRaw(rule) as any;

  if (rawRule instanceof ZodStringFormat) {
    return zodString();
  }

  if (rawRule instanceof ZodObject) {
    const shape = Object.fromEntries(
      Object.entries(rawRule.shape).map(([key, value]) => [
        key,
        normalizeSchemaForDefaults(value as ZodType),
      ]),
    );
    return object(shape);
  }

  if (rawRule instanceof ZodIntersection) {
    const { left, right } = (rawRule as any).def;
    return normalizeSchemaForDefaults(left as ZodType).and(
      normalizeSchemaForDefaults(right as ZodType),
    );
  }

  if (rawRule.constructor.name === 'ZodDefault') {
    const inner = normalizeSchemaForDefaults(rawRule.unwrap());
    return inner.default(rawRule.def.defaultValue);
  }

  if (rawRule.constructor.name === 'ZodPipe') {
    return normalizeSchemaForDefaults(rawRule.in).pipe(rawRule.out);
  }

  return rawRule;
}

/**
 * 表单初始化：在组件 setup 阶段一次性完成三件事——
 * 1. generateInitialValues()：从 schema 提取初始值快照（defaultValue 优先，其次 zod 推导）
 * 2. useFormRuntime()：创建 tanstack 引擎实例并包装成引擎无关的门面 API（FormActions）
 * 3. delegatedSlots：收集调用方传入的具名插槽名单，供模板逐层透传
 * 注意：初始值只在 setup 时计算一次，之后 updateSchema 新增字段不会自动补初始值
 */
export function useFormInitial(
  props: ComputedRef<VbenFormProps> | VbenFormProps,
) {
  const slots = useSlots();
  const initialValues = generateInitialValues();

  // 引擎门面：渲染层（form-field 等）与 FormApi 最终都通过它操作表单数据
  const form = useFormRuntime(initialValues);

  // 调用方（页面）传入的非 default 插槽名字清单，如 ['username', 'actions']。
  // 只存名字不存插槽本体；vben-use-form 模板据此为每个名字开 <template #[name]> 转发通道，
  // 让页面写在 <Form> 上的字段级插槽能透传到对应 fieldName 的 FormField 里渲染
  const delegatedSlots = computed(() => {
    const resultSlots: string[] = [];

    for (const key of Object.keys(slots)) {
      if (key !== 'default') {
        resultSlots.push(key);
      }
    }
    return resultSlots;
  });

  /** 初始值合成：schema.defaultValue 优先，其次按 zod rules 推导，最后 merge 两者 */
  function generateInitialValues() {
    const initialValues: Record<string, any> = {};

    const zodObject: Record<string, ZodType> = {};
    getFormFieldSchemas(unref(props).schema ?? []).forEach((item) => {
      if (Reflect.has(item, 'defaultValue')) {
        set(initialValues, item.fieldName, item.defaultValue);
      } else if (item.rules && !isString(item.rules)) {
        // 检查规则是否适合提取默认值
        const rawRules = toRaw(item.rules);
        const customDefaultValue = getCustomDefaultValue(rawRules);
        zodObject[item.fieldName] = normalizeSchemaForDefaults(rawRules);
        if (customDefaultValue !== undefined) {
          initialValues[item.fieldName] = customDefaultValue;
        }
      }
    });

    const schemaInitialValues = getDefaultsForSchema(object(zodObject));

    const zodDefaults: Record<string, any> = {};
    for (const key in schemaInitialValues) {
      set(zodDefaults, key, schemaInitialValues[key]);
    }
    return mergeWithArrayOverride(initialValues, zodDefaults);
  }
  // 自定义默认值提取逻辑
  function getCustomDefaultValue(rule: any): any {
    rule = toRaw(rule);
    if (rule instanceof ZodString || rule instanceof ZodStringFormat) {
      return ''; // 字符串及其格式校验默认为空字符串
    } else if (rule instanceof ZodNumber) {
      return null; // 默认为 null（避免显示 0）
    } else if (rule instanceof ZodObject) {
      // 递归提取嵌套对象的默认值
      const defaultValues: Record<string, any> = {};
      for (const [key, valueSchema] of Object.entries(rule.shape)) {
        defaultValues[key] = getCustomDefaultValue(valueSchema);
      }
      return defaultValues;
    } else if (rule instanceof ZodIntersection) {
      return getDefaultsForSchema(normalizeSchemaForDefaults(rule) as any);
    } else {
      return undefined; // 其他类型不提供默认值
    }
  }

  return {
    delegatedSlots,
    form,
  };
}
