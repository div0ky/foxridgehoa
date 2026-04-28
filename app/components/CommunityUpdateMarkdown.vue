<script setup lang="ts">
import { Comark } from '@comark/vue'

defineProps<{
  markdown: string
}>()
</script>

<template>
  <div class="prose max-w-none text-slate-800 dark:text-slate-100">
    <Comark :markdown="markdown" />
  </div>
</template>
