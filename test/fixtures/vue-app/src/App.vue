<template>
  <div>
    <h1>$t('src/App.1')</h1>
    <p>{{ message }}</p>
    <button @click="handleClick">{{ buttonText }}</button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
const message = ref($t('src/App.2'))
const buttonText = ref($t('src/App.3'))

function handleClick() {
  console.log($t('src/App.4'))
}
</script>
