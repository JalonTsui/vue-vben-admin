<script lang="ts" setup>
import type { RegionItem } from '#/api/core';

import { Page } from '@vben/common-ui';

import { ElButton, ElCard, ElMessage } from 'element-plus';

import { useVbenForm } from '#/adapter/form';
import { getCitiesApi, getDistrictsApi, getProvincesApi } from '#/api/core';

interface RegionOption {
  label: string;
  value: number;
}

// 缓存拉取过的行政区划，用于提交时按 id 回显名称
const regionCache = new Map<number, RegionItem>();

function toOptions(items: RegionItem[]): RegionOption[] {
  for (const item of items) {
    regionCache.set(item.id, item);
  }
  return items.map((item) => ({ label: item.name, value: item.id }));
}

// 加载下一级选项，失败时给出提示并清空选项
async function loadOptions(
  fetcher: () => Promise<RegionItem[]>,
  emptyPlaceholder: string,
): Promise<{ options: RegionOption[]; placeholder: string }> {
  try {
    const items = await fetcher();
    return { options: toOptions(items), placeholder: '请选择' };
  } catch (error) {
    ElMessage.error(
      error instanceof Error ? error.message : '行政区划加载失败',
    );
    return { options: [], placeholder: emptyPlaceholder };
  }
}

// jalontsui[002] useVbenForm 三级级联（省/市/区县）学习入口
// 通过 dependencies.resolve 监听上级字段变化，逐级拉取选项；
// 下级旧值不在新选项中才清空（人工切换会清空，程序按 id 回显则保留）
const [Form, formApi] = useVbenForm({
  commonConfig: {
    // 所有表单项
    componentProps: {
      class: 'w-full',
    },
  },
  layout: 'horizontal',
  handleSubmit: (values) => {
    const { city, district, province } = values as {
      city?: number;
      district?: number;
      province?: number;
    };
    const names = [province, city, district].map(
      (id) => (id ? regionCache.get(id)?.name : undefined) ?? '-',
    );
    ElMessage.success(
      `选中地区：${names.join(' / ')}（${JSON.stringify(values)}）`,
    );
  },
  schema: [
    {
      // 省份：进入页面即加载全部选项
      component: 'ApiSelect',
      componentProps: {
        // 省级列表接口
        api: getProvincesApi,
        // 接口返回的 RegionItem[] 转 options 格式
        afterFetch: toOptions,
        filterable: true,
        placeholder: '请选择省份',
      },
      fieldName: 'province',
      label: '省份',
      rules: 'required',
    },
    {
      component: 'Select',
      componentProps: {
        filterable: true,
        options: [],
        placeholder: '请先选择省份',
      },
      // 省份变化时：重新拉取该市下选项；旧城市值不在新选项中才清空下级
      dependencies: {
        triggerFields: ['province'],
        resolve: async ({ actions, values }) => {
          const provinceId = values.province as null | number | undefined;
          if (!provinceId) {
            await actions.setValues({ city: undefined, district: undefined });
            return {
              componentProps: { options: [], placeholder: '请先选择省份' },
            };
          }
          const result = await loadOptions(
            () => getCitiesApi({ province_id: provinceId }),
            '请先选择省份',
          );
          const cityValue = values.city as null | number | undefined;
          if (
            cityValue === null ||
            !result.options.some((o) => o.value === cityValue)
          ) {
            await actions.setValues({ city: undefined, district: undefined });
          }
          return { componentProps: result };
        },
      },
      fieldName: 'city',
      label: '城市',
      rules: 'required',
    },
    {
      component: 'Select',
      componentProps: {
        filterable: true,
        options: [],
        placeholder: '请先选择城市',
      },
      // 城市变化时：重新拉取该市下选项；旧区/县值不在新选项中才清空
      dependencies: {
        triggerFields: ['city'],
        resolve: async ({ actions, values }) => {
          const cityId = values.city as null | number | undefined;
          if (!cityId) {
            await actions.setValues({ district: undefined });
            return {
              componentProps: { options: [], placeholder: '请先选择城市' },
            };
          }
          const result = await loadOptions(
            () => getDistrictsApi({ city_id: cityId }),
            '请先选择城市',
          );
          const districtValue = values.district as null | number | undefined;
          if (
            districtValue === null ||
            !result.options.some((o) => o.value === districtValue)
          ) {
            await actions.setValues({ district: undefined });
          }
          return { componentProps: result };
        },
      },
      fieldName: 'district',
      label: '区/县',
      rules: 'required',
    },
  ],
});

async function setFormValues() {
  // 模拟详情接口返回：{"city":2,"district":9,"province":1}
  // 由于 resolve 只清空"不在新选项中"的旧值，可一次性整体赋值完成回显
  await formApi.setValues({ city: 2, district: 9, province: 1 });
}
</script>
<template>
  <Page
    description="省/市/区三级级联，选项由 region 后端接口逐级加载；切换上级会自动清空并重新加载下级选项"
    title="级联表单演示"
  >
    <ElCard>
      <template #header>
        <div class="flex items-center">
          <span class="flex-auto">省市区级联表单</span>
          <ElButton type="primary" @click="setFormValues">设置表单值</ElButton>
        </div>
      </template>
      <Form />
    </ElCard>
  </Page>
</template>
