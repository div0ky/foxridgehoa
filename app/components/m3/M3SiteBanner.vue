<script setup lang="ts">
interface Props {
  body: string
}

defineProps<Props>()
</script>

<template>
  <div
    class="w-full border-b-2 border-primary-800 bg-gradient-to-r from-primary-600 via-primary-500 to-primary-600 shadow-md shadow-primary-900/30 transition-all duration-300 dark:border-primary-300 dark:from-primary-500 dark:via-primary-400 dark:to-primary-500 dark:shadow-black/35"
    role="region"
    aria-label="Site announcement"
  >
    <div class="mx-auto flex max-w-6xl items-start gap-3 px-4 py-3.5 sm:px-6 sm:py-4 lg:px-8">
      <Icon
        name="heroicons:megaphone"
        class="mt-0.5 h-5 w-5 shrink-0 text-white drop-shadow-sm"
        aria-hidden="true"
      />
      <p class="break-words text-sm font-semibold leading-6 text-white drop-shadow-sm sm:text-body-lg">
        {{ body }}
      </p>
    </div>
  </div>
</template>
