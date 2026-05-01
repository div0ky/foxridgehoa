<script setup lang="ts">
import type { HoaOperatorRole } from '~/types/hoa'

import { computed } from 'vue'

import { isHomeownerInviteEnabled } from '~/config/product-features'

const model = defineModel<HoaOperatorRole>({ required: true })

interface Props {
  disabled?: boolean
}

withDefaults(defineProps<Props>(), {
  disabled: false
})

const items = computed(() => {
  const opts: { label: string, value: HoaOperatorRole }[] = []
  if (isHomeownerInviteEnabled) {
    opts.push({ label: 'Home owner', value: 'homeOwner' })
  }
  opts.push(
    { label: 'Board member', value: 'boardMember' },
    { label: 'Management company', value: 'managementCompany' }
  )
  return opts
})
</script>

<template>
  <USelect
    v-model="model"
    :disabled="disabled"
    :items="items"
    label-key="label"
    placeholder="Choose a role"
    size="lg"
    value-key="value"
    class="w-full"
  />
</template>
