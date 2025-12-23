<script setup lang="ts">
interface Props {
  variant?: 'elevated' | 'outlined' | 'filled'
  hoverable?: boolean
  as?: 'div' | 'article' | 'section'
}

withDefaults(defineProps<Props>(), {
  as: 'div',
  hoverable: false,
  variant: 'elevated',
})

const variantClasses = {
  elevated: 'bg-surface-elevated border border-slate-100 shadow-soft dark:border-slate-800 dark:shadow-none',
  filled: 'bg-primary-50 dark:bg-primary-950/40',
  outlined: 'border-2 border-slate-200 dark:border-slate-700',
} as const
</script>

<template>
  <component
    :is="as"
    class="rounded-3xl p-6 transition-all duration-300"
    :class="[variantClasses[variant], hoverable && 'card-interactive cursor-pointer']"
  >
    <slot />
  </component>
</template>
