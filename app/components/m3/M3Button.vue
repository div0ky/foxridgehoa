<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  icon?: string
  iconPosition?: 'left' | 'right'
  to?: string
  href?: string
}

const props = withDefaults(defineProps<Props>(), {
  href: undefined,
  icon: undefined,
  iconPosition: 'left',
  size: 'md',
  to: undefined,
  variant: 'primary',
})

const componentType = computed(() => {
  if (props.to) return resolveComponent('NuxtLink')
  if (props.href) return 'a'
  return 'button'
})

const variantClasses = {
  ghost: 'text-primary-600 hover:text-primary-700 hover:bg-primary-50 dark:text-primary-400 dark:hover:text-primary-300 dark:hover:bg-primary-950/50',
  primary: 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/25 hover:shadow-xl hover:shadow-primary-500/30 hover:from-primary-400 hover:to-primary-500 active:from-primary-600 active:to-primary-700',
  secondary: 'border-2 border-primary-200 text-primary-700 bg-primary-50/50 hover:bg-primary-100 hover:border-primary-300 dark:border-primary-800 dark:text-primary-300 dark:bg-primary-950/30 dark:hover:bg-primary-900/50 dark:hover:border-primary-700',
} as const

const sizeClasses = {
  lg: 'px-8 py-4 text-base gap-3',
  md: 'px-6 py-3 text-sm gap-2',
  sm: 'px-4 py-2 text-sm gap-2',
} as const
</script>

<template>
  <component
    :is="componentType"
    :to="to"
    :href="href"
    class="inline-flex items-center justify-center rounded-full font-semibold transition-all duration-300 focus-ring disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
    :class="[variantClasses[variant], sizeClasses[size]]"
  >
    <Icon
      v-if="icon && iconPosition === 'left'"
      :name="icon"
      class="shrink-0"
      :class="{ 'h-4 w-4': size === 'sm', 'h-5 w-5': size === 'md' || size === 'lg' }"
    />
    <slot />
    <Icon
      v-if="icon && iconPosition === 'right'"
      :name="icon"
      class="shrink-0"
      :class="{ 'h-4 w-4': size === 'sm', 'h-5 w-5': size === 'md' || size === 'lg' }"
    />
  </component>
</template>
