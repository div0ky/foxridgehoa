<script setup lang="ts">
interface Props {
  label?: string
  title: string
  description?: string
  align?: 'left' | 'center' | 'right'
  size?: 'sm' | 'md' | 'lg'
}

withDefaults(defineProps<Props>(), {
  align: 'center',
  description: undefined,
  label: undefined,
  size: 'md',
})

const alignClasses = {
  center: 'text-center mx-auto',
  left: 'text-left',
  right: 'text-right ml-auto',
} as const

const titleClasses = {
  lg: 'text-display-lg',
  md: 'text-display-md',
  sm: 'text-display-sm',
} as const
</script>

<template>
  <div
    :class="alignClasses[align]"
    class="max-w-3xl"
  >
    <M3Badge
      v-if="label"
      variant="soft"
      size="md"
      class="mb-4 inline-flex"
    >
      {{ label }}
    </M3Badge>
    <h2
      :class="titleClasses[size]"
      class="mb-4 font-display"
    >
      {{ title }}
    </h2>
    <p
      v-if="description"
      class="text-body-lg text-slate-600 dark:text-slate-400 leading-relaxed"
    >
      {{ description }}
    </p>
  </div>
</template>
