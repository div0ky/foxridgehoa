<script setup lang="ts">
interface Props {
  variant?: 'muted' | 'outline' | 'primary' | 'soft'
  size?: 'sm' | 'md'
}

withDefaults(defineProps<Props>(), {
  size: 'sm',
  variant: 'soft'
})

const variantClasses = {
  muted: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  outline: 'border border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-400',
  primary: 'bg-primary-500 text-white dark:bg-primary-600',
  soft: 'bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300'
} as const

const sizeClasses = {
  md: 'px-4 py-1.5 text-sm',
  sm: 'px-3 py-1 text-xs'
} as const
</script>

<template>
  <span
    class="inline-flex items-center rounded-full font-medium tracking-wide transition-all duration-300"
    :class="[variantClasses[variant], sizeClasses[size]]"
  >
    <slot />
  </span>
</template>
