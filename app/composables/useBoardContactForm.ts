import { api } from '~~/convex/_generated/api'

export const BOARD_CONTACT_LIMITS = {
  message: 10_000,
  name: 200,
  street: 500
} as const

const GENERIC_SUBMIT_ERROR
  = 'We couldn\'t send your message right now. Please try again in a few minutes.'

function boardContactDeliveryErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (
    message.includes('CONTACT_SUBMIT_NO_RECIPIENTS')
    || message.includes('skipped_no_recipients')
  ) {
    return 'The board hasn\'t finished email routing yet. Try again later or reach out another way if this keeps happening.'
  }
  if (message.includes('CONTACT_SUBMIT_DELIVERY_FAILED'))
    return 'We saved your message, but email couldn\'t be delivered. Try again in a few minutes.'
  if (message.includes('CONTACT_SUBMIT_DELIVERY_INCOMPLETE'))
    return 'We couldn\'t confirm the email was sent. Please try again in a few minutes.'
  if (message.includes('CONTACT_SUBMIT_INTERNAL'))
    return GENERIC_SUBMIT_ERROR
  if (/Name is required|Street address is required|Message is required/.test(message))
    return GENERIC_SUBMIT_ERROR
  if (/must be at most \d+ characters/.test(message))
    return message
  return GENERIC_SUBMIT_ERROR
}

export interface BoardContactFieldErrors {
  message?: string
  streetAddress?: string
  submitterName?: string
}

function validateContactFields(args: {
  message: string
  streetAddress: string
  submitterName: string
}): BoardContactFieldErrors {
  const errors: BoardContactFieldErrors = {}
  const submitterName = args.submitterName.trim()
  const streetAddress = args.streetAddress.trim()
  const message = args.message.trim()

  if (!submitterName)
    errors.submitterName = 'Enter your name.'
  else if (submitterName.length > BOARD_CONTACT_LIMITS.name)
    errors.submitterName = `Name must be at most ${BOARD_CONTACT_LIMITS.name} characters.`

  if (!streetAddress)
    errors.streetAddress = 'Enter your street address (e.g. 123 Rifle Ridge).'
  else if (streetAddress.length > BOARD_CONTACT_LIMITS.street)
    errors.streetAddress = `Street address must be at most ${BOARD_CONTACT_LIMITS.street} characters.`

  if (!message)
    errors.message = 'Enter a message.'
  else if (message.length > BOARD_CONTACT_LIMITS.message)
    errors.message = `Message must be at most ${BOARD_CONTACT_LIMITS.message} characters.`

  return errors
}

export function useBoardContactForm() {
  const toast = useToast()
  const submitContact = useConvexAction(api.boardContact.submitBoardContactMessage)

  const submitterName = ref('')
  const streetAddress = ref('')
  const message = ref('')
  const fieldErrors = ref<BoardContactFieldErrors>({})
  const isSubmitting = ref(false)
  const statusAnnouncement = ref<null | string>(null)

  watch(submitterName, () => {
    if (fieldErrors.value.submitterName)
      fieldErrors.value = { ...fieldErrors.value, submitterName: undefined }
  })

  watch(streetAddress, () => {
    if (fieldErrors.value.streetAddress)
      fieldErrors.value = { ...fieldErrors.value, streetAddress: undefined }
  })

  watch(message, () => {
    if (fieldErrors.value.message)
      fieldErrors.value = { ...fieldErrors.value, message: undefined }
  })

  async function submit() {
    statusAnnouncement.value = null

    const errors = validateContactFields({
      message: message.value,
      streetAddress: streetAddress.value,
      submitterName: submitterName.value
    })
    fieldErrors.value = errors

    const firstValidationError = errors.submitterName ?? errors.streetAddress ?? errors.message ?? null
    if (firstValidationError) {
      statusAnnouncement.value = firstValidationError
      toast.add({
        color: 'warning',
        description: firstValidationError,
        title: 'Check your form'
      })
      return
    }

    isSubmitting.value = true
    try {
      await submitContact({
        message: message.value.trim(),
        streetAddress: streetAddress.value.trim(),
        submitterName: submitterName.value.trim()
      })
      const sentLine = 'Your message was saved and emailed to the board.'
      statusAnnouncement.value = sentLine
      toast.add({
        color: 'success',
        description: sentLine,
        title: 'Thank you'
      })
      submitterName.value = ''
      streetAddress.value = ''
      message.value = ''
      fieldErrors.value = {}
    } catch (error) {
      const description = boardContactDeliveryErrorMessage(error)
      statusAnnouncement.value = description
      toast.add({
        color: 'error',
        description,
        title: 'Could not send'
      })
    } finally {
      isSubmitting.value = false
    }
  }

  return {
    fieldErrors,
    isSubmitting,
    message,
    statusAnnouncement,
    streetAddress,
    submit,
    submitterName
  }
}
