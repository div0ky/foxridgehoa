<script setup lang="ts">
interface Props {
  body: string
}

defineProps<Props>()
</script>

<template>
  <div
    class="w-full border-b-2 border-primary-900 bg-gradient-to-r from-primary-800 via-primary-700 to-primary-800 shadow-md shadow-primary-950/30 transition-colors duration-300 dark:border-primary-700 dark:from-primary-900 dark:via-primary-800 dark:to-primary-900 dark:shadow-black/35"
    role="region"
    aria-label="Site announcement"
  >
    <div class="mx-auto flex max-w-6xl items-start gap-3 px-4 py-3.5 sm:px-6 sm:py-4 lg:px-8">
      <Icon
        name="lucide:megaphone"
        class="mt-0.5 h-5 w-5 shrink-0 text-white drop-shadow-sm"
        aria-hidden="true"
      />
      <p class="break-words text-sm font-semibold leading-6 text-white drop-shadow-sm sm:text-body-lg">
        {{ body }}
      </p>
    </div>
  </div>
</template>
