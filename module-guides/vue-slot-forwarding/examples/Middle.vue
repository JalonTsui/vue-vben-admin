<script setup lang="ts">
// 中间层：对应 vben 里的 VbenUseForm——useSlots 拿名单 + 动态桥接转发
// 这就是 vben-use-form.vue:136-147 的最小复刻
import { computed, useSlots } from 'vue';

import Leaf from './Leaf.vue';

// 对应 delegatedSlots：名单来自"调用方（页面）到底传了哪些插槽"
const slots = useSlots();
const forwardedNames = computed(() =>
  Object.keys(slots).filter((key) => key !== 'default'),
);
</script>

<template>
  <div class="middle">
    <h2>中间层 Middle（转发者）</h2>
    <Leaf user-name="jalon">
      <!-- 动态桥：为名单里每个名字建一座"template 接 / slot 透"的双向桥 -->
      <template v-for="name in forwardedNames" :key="name" #[name]="slotProps">
        <slot :name="name" v-bind="slotProps" injected-by-middle="M"></slot>
      </template>
    </Leaf>
  </div>
</template>
