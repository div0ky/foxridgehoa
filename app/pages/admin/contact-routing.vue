<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { api } from '~~/convex/_generated/api'

definePageMeta({
  convexAuth: true,
  layout: 'admin-dashboard'
})

defineOptions({ name: 'AdminContactRoutingPage' })

const toast = useToast()

const profileState = await useConvexQuery(api.operatorProfiles.getMyOperatorProfile, {})

const profile = computed(() => profileState.data.value?.data.profile)
const loadingProfile = computed(() => profileState.status.value === 'pending')
const isBoardMember = computed(() => profile.value?.role === 'boardMember')

const routingState = await useConvexQuery(
  api.boardContact.getBoardContactRouting,
  {},
  { enabled: computed(() => isBoardMember.value) }
)

const serverRouting = computed(() => routingState.data.value?.data.routing ?? null)
const loadingRouting = computed(() => {
  if (!isBoardMember.value)
    return false
  return routingState.status.value === 'pending'
})

interface RecipientRow {
  displayName: string
  email: string
}

const recipientRows = ref<RecipientRow[]>([{ displayName: '', email: '' }])

watch(
  () =>
    ({
      loading: loadingRouting.value,
      routing: serverRouting.value
    }) as const,
  ({ loading, routing }) => {
    if (loading)
      return

    if (!routing || routing.recipients.length === 0) {
      recipientRows.value = [{ displayName: '', email: '' }]
      return
    }

    recipientRows.value = routing.recipients.map((r: { displayName: string, email: string }) => ({
      displayName: r.displayName,
      email: r.email
    }))
  },
  { immediate: true }
)

const setRouting = useConvexMutation(api.boardContact.setBoardContactRouting)
const savingRouting = ref(false)

function addRecipientRow() {
  recipientRows.value.push({ displayName: '', email: '' })
}

function removeRecipientRow(index: number) {
  if (recipientRows.value.length <= 1) {
    recipientRows.value = [{ displayName: '', email: '' }]
    return
  }
  recipientRows.value.splice(index, 1)
}

async function submitRouting() {
  const recipients = recipientRows.value
    .map(r => ({
      displayName: r.displayName.trim(),
      email: r.email.trim()
    }))
    .filter(r => r.displayName.length > 0 || r.email.length > 0)

  if (recipients.length === 0) {
    toast.add({
      color: 'warning',
      description: 'Add at least one recipient with name and email.',
      title: 'Recipients required'
    })
    return
  }

  if (recipients.some(r => !r.displayName || !r.email)) {
    toast.add({
      color: 'warning',
      description: 'Each row needs both a display name and an email.',
      title: 'Incomplete row'
    })
    return
  }

  savingRouting.value = true
  try {
    await setRouting.execute({ recipients })
    toast.add({
      color: 'success',
      description: 'Notification recipients are saved.',
      title: 'Saved'
    })
  } catch (error) {
    const description = error instanceof Error ? error.message : 'Save failed.'
    toast.add({
      color: 'error',
      description,
      title: 'Could not save'
    })
  } finally {
    savingRouting.value = false
  }
}

/** Submissions inbox (paginated) */
const PAGE_SIZE = 25
const paginationOpts = ref<{ cursor: null | string, numItems: number }>({
  cursor: null,
  numItems: PAGE_SIZE
})

const submissionsState = await useConvexQuery(
  api.boardContact.listBoardContactSubmissions,
  computed(() => ({ paginationOpts: paginationOpts.value })),
  { enabled: computed(() => isBoardMember.value) }
)

const submissionPage = computed(
  () => submissionsState.data.value?.data.page ?? []
)
const submissionIsDone = computed(
  () => submissionsState.data.value?.data.isDone ?? true
)
const submissionContinueCursor = computed(
  () => submissionsState.data.value?.data.continueCursor ?? null
)

const accumulatedSubmissions = ref<typeof submissionPage.value>([])
const listInitialized = ref(false)

watch(
  () =>
    ({
      cursor: paginationOpts.value.cursor,
      loading: submissionsState.status.value === 'pending',
      page: submissionPage.value
    }) as const,
  ({ cursor, loading, page }) => {
    if (loading || !submissionsState.data.value?.ok)
      return

    if (cursor === null) {
      accumulatedSubmissions.value = page
      listInitialized.value = true
    } else {
      accumulatedSubmissions.value = [...accumulatedSubmissions.value, ...page]
    }
  },
  { deep: true }
)

watch(isBoardMember, (board) => {
  if (!board) {
    accumulatedSubmissions.value = []
    listInitialized.value = false
    paginationOpts.value = { cursor: null, numItems: PAGE_SIZE }
  }
})

const loadingSubmissions = computed(() => {
  if (!isBoardMember.value)
    return false
  return submissionsState.status.value === 'pending'
})

const canLoadMoreSubmissions = computed(
  () => !submissionIsDone.value && submissionContinueCursor.value !== null
)

function loadMoreSubmissions() {
  if (!submissionContinueCursor.value)
    return
  paginationOpts.value = {
    cursor: submissionContinueCursor.value,
    numItems: PAGE_SIZE
  }
}

function refreshSubmissionList() {
  accumulatedSubmissions.value = []
  listInitialized.value = false
  paginationOpts.value = { cursor: null, numItems: PAGE_SIZE }
}

function formatWhen(ms: number): string {
  return new Date(ms).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  })
}

function statusColor(
  status: string
): 'error' | 'info' | 'neutral' | 'primary' | 'success' | 'warning' {
  switch (status) {
    case 'failed':
      return 'error'
    case 'pending':
    case 'sending':
      return 'warning'
    case 'sent':
      return 'success'
    case 'skipped_no_recipients':
      return 'neutral'
    default:
      return 'neutral'
  }
}

/** Maps stored delivery error codes to text for board members (not shown on public site). */
function formatBoardContactDeliveryError(raw: string | undefined): string {
  if (!raw)
    return ''

  if (raw === 'ERR_MISSING_RESEND_ENV') {
    return 'Convex env incomplete: set RESEND_API_KEY and RESEND_FROM on this deployment.'
  }

  if (raw === 'ERR_RESEND_NETWORK')
    return 'Network error while calling Resend.'

  if (raw.startsWith('ERR_RESEND_API:'))
    return `Resend API: ${raw.slice('ERR_RESEND_API:'.length)}`

  return raw
}
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-8">
    <UAlert
      v-if="!loadingProfile && !isBoardMember"
      color="warning"
      variant="soft"
      title="Restricted"
      description="Only board members can manage contact routing and view submissions."
      icon="i-lucide-lock"
    />

    <template v-if="loadingProfile || isBoardMember">
      <UCard>
        <template #header>
          <div>
            <h1 class="font-semibold text-highlighted">
              Board contact — email recipients
            </h1>
            <p class="mt-1 text-sm text-muted">
              When a resident submits the public form, each person listed here receives the message as a direct email recipient (via Resend). Use a verified sender domain in Convex (<code class="text-xs">RESEND_FROM</code>, <code class="text-xs">RESEND_API_KEY</code>).
            </p>
          </div>
        </template>

        <div
          v-if="loadingProfile || loadingRouting"
          aria-live="polite"
          class="text-sm text-muted"
          role="status"
        >
          Loading…
        </div>

        <form
          v-else
          class="space-y-4"
          @submit.prevent="submitRouting"
        >
          <div class="space-y-3">
            <div
              v-for="(row, index) in recipientRows"
              :key="index"
              class="flex flex-col gap-3 sm:flex-row sm:items-end"
            >
              <UFormField
                class="flex-1"
                :label="index === 0 ? 'Display name' : undefined"
              >
                <UInput
                  v-model="row.displayName"
                  class="w-full"
                  placeholder="Jane Director"
                />
              </UFormField>
              <UFormField
                class="flex-1"
                :label="index === 0 ? 'Email' : undefined"
              >
                <UInput
                  v-model="row.email"
                  class="w-full"
                  placeholder="jane@example.com"
                  type="email"
                />
              </UFormField>
              <UButton
                color="neutral"
                icon="i-lucide-minus"
                type="button"
                variant="outline"
                @click="removeRecipientRow(index)"
              />
            </div>
          </div>

          <div class="flex flex-wrap gap-3">
            <UButton
              color="neutral"
              icon="i-lucide-plus"
              type="button"
              variant="outline"
              @click="addRecipientRow"
            >
              Add recipient
            </UButton>
            <UButton
              color="primary"
              :loading="savingRouting"
              type="submit"
            >
              Save recipients
            </UButton>
          </div>
        </form>
      </UCard>

      <UCard>
        <template #header>
          <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 class="font-semibold text-highlighted">
                Contact submissions
              </h2>
              <p class="mt-1 text-sm text-muted">
                Read-only log of messages from the public form (newest first in each batch).
              </p>
            </div>
            <UButton
              color="neutral"
              icon="i-lucide-refresh-cw"
              type="button"
              variant="outline"
              @click="refreshSubmissionList"
            >
              Refresh list
            </UButton>
          </div>
        </template>

        <div
          v-if="loadingSubmissions && !listInitialized"
          aria-live="polite"
          class="text-sm text-muted"
          role="status"
        >
          Loading submissions…
        </div>

        <div
          v-else-if="accumulatedSubmissions.length === 0"
          class="text-sm text-muted"
        >
          No submissions yet.
        </div>

        <div
          v-else
          class="space-y-4"
        >
          <div class="overflow-x-auto rounded-lg border border-default">
            <table class="w-full min-w-[640px] text-left text-sm">
              <thead class="border-b border-default bg-muted/40">
                <tr>
                  <th class="px-3 py-2 font-medium text-muted">
                    Received
                  </th>
                  <th class="px-3 py-2 font-medium text-muted">
                    Status
                  </th>
                  <th class="px-3 py-2 font-medium text-muted">
                    Name
                  </th>
                  <th class="px-3 py-2 font-medium text-muted">
                    Address
                  </th>
                  <th class="px-3 py-2 font-medium text-muted">
                    Message
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in accumulatedSubmissions"
                  :key="row.submissionId"
                  class="border-b border-default last:border-0"
                >
                  <td class="whitespace-nowrap px-3 py-2 align-top text-muted">
                    {{ formatWhen(row.createdAt) }}
                  </td>
                  <td class="px-3 py-2 align-top">
                    <div class="flex flex-col gap-1">
                      <UBadge
                        :color="statusColor(row.emailDeliveryStatus)"
                        variant="subtle"
                      >
                        {{ row.emailDeliveryStatus }}
                      </UBadge>
                      <span
                        v-if="row.emailLastError"
                        class="text-xs text-error"
                      >{{ formatBoardContactDeliveryError(row.emailLastError) }}</span>
                    </div>
                  </td>
                  <td class="px-3 py-2 align-top">
                    {{ row.submitterName }}
                  </td>
                  <td class="max-w-[140px] px-3 py-2 align-top break-words">
                    {{ row.streetAddress }}
                  </td>
                  <td class="max-w-[280px] px-3 py-2 align-top break-words whitespace-pre-wrap">
                    {{ row.message }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <UButton
            v-if="canLoadMoreSubmissions"
            block
            color="neutral"
            :loading="loadingSubmissions"
            type="button"
            variant="outline"
            @click="loadMoreSubmissions"
          >
            Load older
          </UButton>
        </div>
      </UCard>
    </template>
  </div>
</template>
