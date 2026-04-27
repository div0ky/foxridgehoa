<script setup lang="ts">
interface Props {
  icon: string
  label: string
  variant?: 'default' | 'elevated' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

withDefaults(defineProps<Props>(), {
  size: 'md',
  variant: 'default'
})

const variantClasses = {
  default: 'text-slate-600 hover:text-primary-600 hover:bg-primary-50 dark:text-slate-400 dark:hover:text-primary-400 dark:hover:bg-primary-950/50',
  elevated: 'bg-surface-elevated shadow-soft text-slate-600 hover:text-primary-600 hover:shadow-soft-lg dark:text-slate-400 dark:hover:text-primary-400',
  ghost: 'text-slate-500 hover:text-primary-600 dark:text-slate-500 dark:hover:text-primary-400'
} as const

const sizeClasses = {
  lg: 'h-12 w-12',
  md: 'h-10 w-10',
  sm: 'h-8 w-8'
} as const
</script>

<template>
  <button
    type="button"
    :aria-label="label"
    class="inline-flex items-center justify-center rounded-xl transition-all duration-300 focus-ring"
    :class="[variantClasses[variant], sizeClasses[size]]"
  >
    <Icon
      :name="icon"
      :class="{
        'h-4 w-4': size === 'sm',
        'h-5 w-5': size === 'md',
        'h-6 w-6': size === 'lg'
      }"
    />
  </button>
</template>
