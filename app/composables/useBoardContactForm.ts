import { api } from '~~/convex/_generated/api'

const GENERIC_SUBMIT_ERROR
  = 'We couldn\'t send your message right now. Please try again in a few minutes.'

const MAX_NAME = 200
const MAX_STREET = 500
const MAX_MESSAGE = 10_000

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

  if (submitterName.length > MAX_NAME)
    return `Name must be at most ${MAX_NAME} characters.`
  if (streetAddress.length > MAX_STREET)
    return `Street address must be at most ${MAX_STREET} characters.`
  if (message.length > MAX_MESSAGE)
    return `Message must be at most ${MAX_MESSAGE} characters.`

  return null
}

export function useBoardContactForm() {
  const toast = useToast()
  const submitContact = useConvexAction(api.boardContact.submitBoardContactMessage)

  const submitterName = ref('')
  const streetAddress = ref('')
  const message = ref('')
  const isSubmitting = ref(false)

  async function submit() {
    const validationError = clientValidationMessage({
      message: message.value,
      streetAddress: streetAddress.value,
      submitterName: submitterName.value
    })

    if (validationError) {
      toast.add({
        color: 'warning',
        description: validationError,
        title: 'Check your form'
      })
      return
    }

    isSubmitting.value = true
    try {
      await submitContact.execute({
        message: message.value.trim(),
        streetAddress: streetAddress.value.trim(),
        submitterName: submitterName.value.trim()
      })
      toast.add({
        color: 'success',
        description: 'Your message was saved and emailed to the board.',
        title: 'Thank you'
      })
      submitterName.value = ''
      streetAddress.value = ''
      message.value = ''
    } catch {
      toast.add({
        color: 'error',
        description: GENERIC_SUBMIT_ERROR,
        title: 'Could not send'
      })
    } finally {
      isSubmitting.value = false
    }
  }

  return {
    isSubmitting,
    message,
    streetAddress,
    submit,
    submitterName
  }
}
