<script setup lang="ts">
// 叶子组件：对应 vben 里的 FormField——定义插槽出口，并产生 slotProps 往上递
defineProps<{ userName: string }>();
</script>

<template>
  <div class="leaf">
    <h3>叶子组件 Leaf（定义插槽 + 产生 slotProps）</h3>
    <!-- 具名插槽出口：把"字段状态"作为插槽参数传上去，谁接谁用 -->
    <!-- 注意：slotProps 里不要用 name 当 key —— 它会和转发层的 :name="插槽名" 冲突 -->
    <slot name="user" :user="userName" source="leaf"></slot>
    <slot name="footer" from="leaf-footer"></slot>
  </div>
</template>
