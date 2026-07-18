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

function clientValidationMessage(args: {
  message: string
  streetAddress: string
  submitterName: string
}): string | null {
  const submitterName = args.submitterName.trim()
  const streetAddress = args.streetAddress.trim()
  const message = args.message.trim()

  if (!submitterName)
    return 'Enter your name.'
  if (!streetAddress)
    return 'Enter your street address (e.g. 123 Rifle Ridge).'
  if (!message)
    return 'Enter a message.'

  if (submitterName.length > BOARD_CONTACT_LIMITS.name)
    return `Name must be at most ${BOARD_CONTACT_LIMITS.name} characters.`
  if (streetAddress.length > BOARD_CONTACT_LIMITS.street)
    return `Street address must be at most ${BOARD_CONTACT_LIMITS.street} characters.`
  if (message.length > BOARD_CONTACT_LIMITS.message)
    return `Message must be at most ${BOARD_CONTACT_LIMITS.message} characters.`

  return null
}

export function useBoardContactForm() {
  const toast = useToast()
  const submitContact = useConvexAction(api.boardContact.submitBoardContactMessage)

  const submitterName = ref('')
  const streetAddress = ref('')
  const message = ref('')
  const isSubmitting = ref(false)
  const statusAnnouncement = ref<null | string>(null)

  async function submit() {
    statusAnnouncement.value = null

    const validationError = clientValidationMessage({
      message: message.value,
      streetAddress: streetAddress.value,
      submitterName: submitterName.value
    })

    if (validationError) {
      statusAnnouncement.value = validationError
      toast.add({
        color: 'warning',
        description: validationError,
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
    isSubmitting,
    message,
    statusAnnouncement,
    streetAddress,
    submit,
    submitterName
  }
}
