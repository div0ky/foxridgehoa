<script setup lang="ts">
interface Props {
  id?: string
  background?: 'default' | 'dim' | 'gradient' | 'mesh'
  padding?: 'sm' | 'md' | 'lg' | 'xl'
}

withDefaults(defineProps<Props>(), {
  background: 'default',
  id: undefined,
  padding: 'lg',
})

const backgroundClasses = {
  default: 'bg-surface',
  dim: 'bg-surface-dim',
  gradient: 'gradient-hero',
  mesh: 'bg-surface mesh-gradient',
} as const

const paddingClasses = {
  lg: 'py-20 lg:py-28',
  md: 'py-16 lg:py-20',
  sm: 'py-12 lg:py-16',
  xl: 'py-24 lg:py-32',
} as const
</script>

<template>
  <section
    :id="id"
    class="relative w-full overflow-hidden transition-colors duration-300"
    :class="[backgroundClasses[background], paddingClasses[padding]]"
  >
    <slot name="background" />
    <div class="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
      <slot />
    </div>
  </section>
</template>
