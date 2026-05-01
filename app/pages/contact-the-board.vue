<script setup lang="ts">
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
  isSubmitting,
  message,
  statusAnnouncement,
  streetAddress,
  submit,
  submitterName
} = useBoardContactForm()
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

        <p
          aria-live="polite"
          class="sr-only"
          role="status"
        >
          {{ statusAnnouncement }}
        </p>

        <M3Card
          variant="elevated"
          as="section"
        >
          <form
            class="space-y-6"
            novalidate
            @submit.prevent="submit"
          >
            <UFormField
              label="Your name"
              name="contact-name"
              required
            >
              <UInput
                id="contact-name"
                v-model="submitterName"
                autocomplete="name"
                class="w-full"
                :disabled="isSubmitting"
                :maxlength="BOARD_CONTACT_LIMITS.name"
                placeholder="Jane Resident"
              />
            </UFormField>

            <UFormField
              label="Street address"
              name="contact-street"
              required
              description="e.g. 123 Rifle Ridge or 456 Fox Creek"
            >
              <UInput
                id="contact-street"
                v-model="streetAddress"
                autocomplete="street-address"
                class="w-full"
                :disabled="isSubmitting"
                :maxlength="BOARD_CONTACT_LIMITS.street"
                placeholder="123 Rifle Ridge"
              />
            </UFormField>

            <UFormField
              label="Message"
              name="contact-message"
              required
            >
              <UTextarea
                id="contact-message"
                v-model="message"
                :rows="6"
                class="w-full"
                autoresize
                :disabled="isSubmitting"
                :maxlength="BOARD_CONTACT_LIMITS.message"
                placeholder="How can we help?"
              />
            </UFormField>

            <M3Button
              variant="primary"
              size="lg"
              button-type="submit"
              icon="heroicons:paper-airplane"
              icon-position="right"
              class="w-full sm:w-auto"
              :disabled="isSubmitting"
            >
              {{ isSubmitting ? 'Sending…' : 'Send message' }}
            </M3Button>
          </form>
        </M3Card>

        <p class="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
          <NuxtLink
            class="font-medium text-primary-600 underline-offset-4 hover:underline dark:text-primary-400"
            to="/"
          >
            Back to home
          </NuxtLink>
        </p>
      </div>
    </M3Section>
  </div>
</template>
