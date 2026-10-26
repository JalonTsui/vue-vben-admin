<script setup lang="ts">
// 对照组：中间层不转发，直接渲染叶子组件
// 页面传的插槽内容会"卡"在 Middle 的 $slots 里，永远到不了 Leaf 的出口
import Leaf from './Leaf.vue';
</script>

<template>
  <div class="middle no-forward">
    <h2>中间层（不转发）</h2>
    <Leaf user-name="jalon" />
  </div>
</template>
