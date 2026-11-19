<script setup lang="ts">
import type { FormErrorEvent } from '@nuxt/ui'

import {
  BOARD_CONTACT_LIMITS,
  useBoardContactForm
} from '~/composables/useBoardContactForm'

definePageMeta({
  layout: 'default'
})

defineOptions({ name: 'ContactTheBoardPage' })

useHead({
  meta: [
    {
      content: 'Send a message to the Fox Ridge HOA board. Include your name and street address.',
      name: 'description'
    }
  ],
  title: 'Contact the Board — Fox Ridge HOA'
})

const {
  draft,
  isSubmitting,
  statusAnnouncement,
  submit,
  validate
} = useBoardContactForm()

async function focusFirstInvalidField({ errors }: FormErrorEvent) {
  statusAnnouncement.value = null
  const id = errors[0]?.id
  if (id) {
    await nextTick()
    document.getElementById(id)?.focus()
  }
}
</script>

<template>
  <div>
    <M3Section
      background="mesh"
      padding="lg"
    >
      <template #background>
        <div class="pointer-events-none absolute -right-32 -top-32 h-64 w-64 rounded-full bg-primary-400/10 blur-3xl" />
        <div class="pointer-events-none absolute -bottom-32 -left-32 h-64 w-64 rounded-full bg-primary-500/10 blur-3xl" />
      </template>

      <div class="mx-auto max-w-xl">
        <M3Badge
          variant="soft"
          size="md"
          class="mb-4 inline-flex"
        >
          Contact the Board
        </M3Badge>
        <h1 class="mb-4 font-display text-display-sm text-slate-900 dark:text-white">
          Send us a message
        </h1>
        <p class="mb-8 text-body-lg leading-relaxed text-slate-600 dark:text-slate-400">
          Use this form for questions or concerns for the board. Include your name and street address so we can respond appropriately.
        </p>

        <M3Card
          variant="elevated"
          as="section"
        >
          <UForm
            :state="draft"
            :validate="validate"
            :validate-on="['blur', 'change']"
            :loading-auto="false"
            class="space-y-6"
            novalidate
            @error="focusFirstInvalidField"
            @submit="submit"
          >
            <UFormField
              label="Your name"
              name="submitterName"
              required
            >
              <UInput
                id="contact-name"
                v-model="draft.submitterName"
                autocomplete="name"
                class="w-full"
                :maxlength="BOARD_CONTACT_LIMITS.name"
                placeholder="Jane Resident"
                :readonly="isSubmitting"
                required
              />
            </UFormField>

            <UFormField
              label="Street address"
              name="streetAddress"
              required
              description="e.g. 123 Rifle Ridge or 456 Fox Creek"
            >
              <UInput
                id="contact-street"
                v-model="draft.streetAddress"
                autocomplete="street-address"
                class="w-full"
                :maxlength="BOARD_CONTACT_LIMITS.street"
                placeholder="123 Rifle Ridge"
                :readonly="isSubmitting"
                required
              />
            </UFormField>

            <UFormField
              label="Message"
              name="message"
              required
            >
              <UTextarea
                id="contact-message"
                v-model="draft.message"
                :rows="6"
                class="w-full"
                autoresize
                :maxlength="BOARD_CONTACT_LIMITS.message"
                placeholder="How can we help?"
                :readonly="isSubmitting"
                required
              />
            </UFormField>

            <div>
              <M3Button
                variant="primary"
                size="lg"
                button-type="submit"
                icon="lucide:send"
                icon-position="right"
                class="w-full aria-disabled:cursor-not-allowed aria-disabled:opacity-50 sm:w-auto"
                :aria-disabled="isSubmitting"
              >
                {{ isSubmitting ? 'Sending…' : 'Send message' }}
              </M3Button>
              <p
                role="status"
                class="text-sm text-slate-600 dark:text-slate-300"
                :class="{ 'mt-3': statusAnnouncement }"
              >
                {{ statusAnnouncement }}
              </p>
            </div>
          </UForm>
        </M3Card>

        <p class="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
          <NuxtLink
            class="font-medium text-primary-700 underline-offset-4 hover:underline dark:text-primary-400"
            to="/"
          >
            Back to home
          </NuxtLink>
        </p>
      </div>
    </M3Section>
  </div>
</template>
