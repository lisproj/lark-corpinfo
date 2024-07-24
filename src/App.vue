<script setup lang="ts">
import { useTheme } from '@/hooks/useTheme'
import Form from '@/components/Form.vue'

useTheme()
</script>

<template>
  <div class="app">
    <Form />
  </div>
</template>

<style scoped>
* {
  user-select: none;
}

.app {
  display: flex;
  padding: 0.5rem;
}
</style>
