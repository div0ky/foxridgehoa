import type { FormError } from '@nuxt/ui'

import { ConvexError } from 'convex/values'
import { api } from '~~/convex/_generated/api'

export const BOARD_CONTACT_LIMITS = {
  message: 10_000,
  name: 200,
  street: 500
} as const

const GENERIC_SUBMIT_ERROR
  = 'We couldn’t confirm your submission. Your draft is still here. Please try again in a few minutes.'

function boardContactDeliveryFeedback(error: unknown): { message: string, saved: boolean } {
  const originalError = error instanceof Error && error.cause instanceof ConvexError ? error.cause : error
  const message = originalError instanceof ConvexError && typeof originalError.data === 'string'
    ? originalError.data
    : error instanceof Error ? error.message : ''

  if (message.includes('CONTACT_SUBMIT_RATE_LIMITED'))
    return { message: 'The contact form has reached its submission limit. Your draft is still here. Please try again later.', saved: false }
  if (message.includes('CONTACT_SUBMIT_NO_RECIPIENTS'))
    return { message: 'We saved your message for the board to review. Email notifications aren’t set up yet. You don’t need to send it again.', saved: true }
  if (message.includes('CONTACT_SUBMIT_DELIVERY_FAILED'))
    return { message: 'We saved your message for the board to review. The email notification failed. You don’t need to send it again.', saved: true }
  if (message.includes('CONTACT_SUBMIT_DELIVERY_INCOMPLETE'))
    return { message: 'We saved your message for the board to review. We couldn’t confirm the email notification. You don’t need to send it again.', saved: true }
  return { message: GENERIC_SUBMIT_ERROR, saved: false }
}

interface BoardContactDraft {
  message: string
  streetAddress: string
  submitterName: string
}

function validateBoardContactDraft(draft: BoardContactDraft): FormError[] {
  const fields = [
    { label: 'Name', max: BOARD_CONTACT_LIMITS.name, name: 'submitterName', required: 'Enter your name.' },
    { label: 'Street address', max: BOARD_CONTACT_LIMITS.street, name: 'streetAddress', required: 'Enter your street address.' },
    { label: 'Message', max: BOARD_CONTACT_LIMITS.message, name: 'message', required: 'Enter a message.' }
  ] as const

  const errors: FormError[] = []
  for (const { label, max, name, required } of fields) {
    const value = draft[name].trim()
    if (!value)
      errors.push({ message: required, name })
    else if (value.length > max)
      errors.push({ message: `${label} must be at most ${max} characters.`, name })
  }
  return errors
}

export function useBoardContactForm() {
  const submitContact = useConvexAction(api.boardContact.submitBoardContactMessage)

  const initialDraft: BoardContactDraft = { message: '', streetAddress: '', submitterName: '' }
  const draft = reactive({ ...initialDraft })
  const isSubmitting = ref(false)
  const statusAnnouncement = ref<null | string>(null)

  async function submit() {
    if (isSubmitting.value)
      return

    statusAnnouncement.value = null
    isSubmitting.value = true
    try {
      await submitContact({
        message: draft.message.trim(),
        streetAddress: draft.streetAddress.trim(),
        submitterName: draft.submitterName.trim()
      })
      statusAnnouncement.value = 'Your message was saved and emailed to the board.'
      Object.assign(draft, initialDraft)
    } catch (error) {
      const feedback = boardContactDeliveryFeedback(error)
      statusAnnouncement.value = feedback.message
      if (feedback.saved)
        Object.assign(draft, initialDraft)
    } finally {
      isSubmitting.value = false
    }
  }

  return {
    draft,
    isSubmitting,
    statusAnnouncement,
    submit,
    validate: validateBoardContactDraft
  }
}
