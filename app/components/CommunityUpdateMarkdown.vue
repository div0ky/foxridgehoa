<script setup lang="ts">
import { computed } from 'vue'

import { renderCommunityUpdateMarkdown } from '~/utils/communityUpdateMarkdown'

const props = defineProps<{
  markdown: string
}>()

const renderedMarkdown = computed(() => renderCommunityUpdateMarkdown(props.markdown))
</script>

<template>
  <!-- eslint-disable vue/no-v-html -- markdown-it escapes raw HTML and validates link destinations. -->
  <div
    class="prose"
    v-html="renderedMarkdown"
  />
  <!-- eslint-enable vue/no-v-html -->
</template>
