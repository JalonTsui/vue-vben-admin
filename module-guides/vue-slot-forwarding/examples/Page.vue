<script setup lang="ts">
// 调用方页面：对应你在业务页面里写的 <Form #username="...">
// 这两段内容会被中间层转发到叶子组件的对应插槽出口
import Middle from './Middle.vue';
</script>

<template>
  <div class="page">
    <h1>调用方 Page（插槽内容的生产者）</h1>
    <Middle>
      <template #user="props">
        <p class="user-content">
          页面自定义内容 ｜ user={{ props.user }} ｜ source={{
            props.source
          }}
          ｜ injected={{ props.injectedByMiddle }}
        </p>
      </template>
      <template #footer="props">
        <p class="footer-content">footer 内容 ｜ from={{ props.from }}</p>
      </template>
    </Middle>
  </div>
</template>
