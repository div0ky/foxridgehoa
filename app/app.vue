<script setup lang="ts">
useHead({
  htmlAttrs: { lang: 'en' },
  meta: [
    {
      content: 'Official community information, updates, meetings, and resident resources for Fox Ridge HOA in Wentzville, Missouri.',
      name: 'description'
    }
  ],
  title: 'Fox Ridge HOA'
})
</script>

<template>
  <UApp>
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
