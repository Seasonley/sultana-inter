<template>
  <div>
    <h1>你好世界</h1>
    <p>{{ greeting }}</p>
    <button @click="handleClick">{{ buttonText }}</button>
    <footer>版权信息</footer>
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue'
const greeting = ref('欢迎使用')
const buttonText = ref('点击这里')
function handleClick() {
  console.log('按钮被点击')
}
</script>