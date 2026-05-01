<script setup lang="ts">
import { Comark } from '@comark/vue'

defineProps<{
  markdown: string
}>()
</script>

<template>
  <div
    class="prose max-w-none text-slate-800 prose-img:mx-auto prose-img:my-4 prose-img:h-auto prose-img:max-h-[min(32rem,85svh)] prose-img:w-auto prose-img:max-w-full prose-img:rounded-xl prose-img:bg-slate-100 prose-img:object-contain prose-img:px-4 prose-img:py-4 prose-img:ring-1 prose-img:ring-slate-200/80 sm:prose-img:px-5 sm:prose-img:py-5 dark:text-slate-100 dark:prose-img:bg-slate-900/80 dark:prose-img:ring-slate-700"
  >
    <Comark :markdown="markdown" />
  </div>
</template>
