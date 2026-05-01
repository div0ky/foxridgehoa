<script setup lang="ts">
import type { Id } from '~~/convex/_generated/dataModel'

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

interface SubmissionRow {
  createdAt: number
  emailDeliveryStatus: string
  emailLastError?: string
  message: string
  streetAddress: string
  submissionId: Id<'boardContactSubmissions'>
  submitterName: string
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

const accumulatedSubmissions = ref<SubmissionRow[]>([])
const listInitialized = ref(false)
const viewedSubmission = ref<SubmissionRow | null>(null)
const messageModalOpen = ref(false)
const submissionPendingDeletion = ref<SubmissionRow | null>(null)
const deleteModalOpen = ref(false)
const deletingSubmissionId = ref<Id<'boardContactSubmissions'> | null>(null)
const deleteSubmission = useConvexMutation(api.boardContact.deleteBoardContactSubmission)

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
  { deep: true, immediate: true }
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

function previewMessage(message: string): string {
  const compact = message.replace(/\s+/g, ' ').trim()
  return compact.length > 180 ? `${compact.slice(0, 177)}...` : compact
}

function openMessageModal(row: SubmissionRow) {
  viewedSubmission.value = row
  messageModalOpen.value = true
}

function openDeleteModal(row: SubmissionRow) {
  submissionPendingDeletion.value = row
  deleteModalOpen.value = true
}

async function confirmDeleteSubmission() {
  const row = submissionPendingDeletion.value
  if (!row)
    return

  deletingSubmissionId.value = row.submissionId
  try {
    await deleteSubmission.execute({ submissionId: row.submissionId })
    accumulatedSubmissions.value = accumulatedSubmissions.value.filter(
      submission => submission.submissionId !== row.submissionId
    )

    if (viewedSubmission.value?.submissionId === row.submissionId) {
      viewedSubmission.value = null
      messageModalOpen.value = false
    }

    toast.add({
      color: 'success',
      description: 'The contact submission was deleted.',
      title: 'Submission deleted'
    })
    deleteModalOpen.value = false
    submissionPendingDeletion.value = null
  } catch (error) {
    const description = error instanceof Error ? error.message : 'Delete failed.'
    toast.add({
      color: 'error',
      description,
      title: 'Could not delete'
    })
  } finally {
    deletingSubmissionId.value = null
  }
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
  <div class="mx-auto w-full min-w-0 max-w-4xl space-y-8">
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
              Board contact: email recipients
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
                class="min-w-0 flex-1"
                :label="index === 0 ? 'Display name' : undefined"
              >
                <UInput
                  v-model="row.displayName"
                  class="w-full"
                  placeholder="Jane Director"
                />
              </UFormField>
              <UFormField
                class="min-w-0 flex-1"
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
                class="w-full sm:w-auto"
                type="button"
                variant="outline"
                aria-label="Remove recipient"
                @click="removeRecipientRow(index)"
              />
            </div>
          </div>

          <div class="flex flex-wrap gap-3">
            <UButton
              color="neutral"
              icon="i-lucide-plus"
              class="w-full sm:w-auto"
              type="button"
              variant="outline"
              @click="addRecipientRow"
            >
              Add recipient
            </UButton>
            <UButton
              color="primary"
              class="w-full sm:w-auto"
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
                Review, open, and delete messages from the public form (newest first in each batch).
              </p>
            </div>
            <UButton
              color="neutral"
              icon="i-lucide-refresh-cw"
              class="w-full sm:w-auto"
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
          class="flex gap-4 rounded-xl border border-dashed border-default px-4 py-5"
        >
          <Icon
            class="size-10 shrink-0 text-muted"
            name="lucide:inbox"
            aria-hidden="true"
          />
          <div class="min-w-0 space-y-2">
            <p class="font-medium text-highlighted">
              No submissions yet
            </p>
            <p class="text-sm text-muted">
              When neighbors use Contact the Board, messages appear here in order along with delivery status so you know who saw them.
            </p>
            <NuxtLink
              class="text-sm font-medium text-primary hover:underline"
              external
              target="_blank"
              to="/contact-the-board"
            >
              Open the public contact form
            </NuxtLink>
          </div>
        </div>

        <div
          v-else
          class="space-y-4"
        >
          <div class="space-y-3 md:hidden">
            <article
              v-for="row in accumulatedSubmissions"
              :key="row.submissionId"
              class="rounded-lg border border-default p-4"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-sm font-medium text-highlighted">
                    {{ row.submitterName }}
                  </p>
                  <p class="mt-1 break-words text-xs text-muted">
                    {{ row.streetAddress }}
                  </p>
                </div>
                <UBadge
                  class="shrink-0"
                  :color="statusColor(row.emailDeliveryStatus)"
                  variant="subtle"
                >
                  {{ row.emailDeliveryStatus }}
                </UBadge>
              </div>

              <p
                v-if="row.emailLastError"
                class="mt-2 break-words text-xs text-error"
              >
                {{ formatBoardContactDeliveryError(row.emailLastError) }}
              </p>

              <p class="mt-3 text-xs text-muted">
                {{ formatWhen(row.createdAt) }}
              </p>
              <p class="mt-3 line-clamp-4 break-words text-sm text-muted">
                {{ previewMessage(row.message) }}
              </p>

              <div class="mt-4 flex flex-col gap-2">
                <UButton
                  block
                  color="neutral"
                  icon="i-lucide-eye"
                  size="sm"
                  type="button"
                  variant="subtle"
                  @click="openMessageModal(row)"
                >
                  Read message
                </UButton>
                <UButton
                  block
                  color="error"
                  icon="i-lucide-trash-2"
                  :loading="deletingSubmissionId === row.submissionId"
                  size="sm"
                  type="button"
                  variant="soft"
                  @click="openDeleteModal(row)"
                >
                  Delete
                </UButton>
              </div>
            </article>
          </div>

          <div class="hidden overflow-x-auto rounded-lg border border-default md:block">
            <table class="w-full min-w-[640px] text-left text-sm">
              <thead class="border-b border-default bg-muted/40">
                <tr>
                  <th
                    scope="col"
                    class="px-3 py-2 font-medium text-muted"
                  >
                    Received
                  </th>
                  <th
                    scope="col"
                    class="px-3 py-2 font-medium text-muted"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    class="px-3 py-2 font-medium text-muted"
                  >
                    Name
                  </th>
                  <th
                    scope="col"
                    class="px-3 py-2 font-medium text-muted"
                  >
                    Address
                  </th>
                  <th
                    scope="col"
                    class="px-3 py-2 font-medium text-muted"
                  >
                    Message
                  </th>
                  <th
                    scope="col"
                    class="px-3 py-2 font-medium text-muted"
                  >
                    Actions
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
                  <td class="max-w-[280px] px-3 py-2 align-top">
                    <div class="space-y-2">
                      <p class="line-clamp-3 break-words text-muted">
                        {{ previewMessage(row.message) }}
                      </p>
                      <UButton
                        color="neutral"
                        icon="i-lucide-eye"
                        size="xs"
                        type="button"
                        variant="subtle"
                        @click="openMessageModal(row)"
                      >
                        Read message
                      </UButton>
                    </div>
                  </td>
                  <td class="px-3 py-2 align-top">
                    <UButton
                      color="error"
                      icon="i-lucide-trash-2"
                      :loading="deletingSubmissionId === row.submissionId"
                      size="xs"
                      type="button"
                      variant="soft"
                      @click="openDeleteModal(row)"
                    >
                      Delete
                    </UButton>
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

      <UModal
        v-model:open="messageModalOpen"
        scrollable
        title="Contact submission"
        :description="viewedSubmission ? `${viewedSubmission.submitterName} · ${formatWhen(viewedSubmission.createdAt)}` : undefined"
        :ui="{ content: 'sm:max-w-2xl' }"
      >
        <template #body>
          <div
            v-if="viewedSubmission"
            class="space-y-5"
          >
            <dl class="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt class="font-medium text-muted">
                  Name
                </dt>
                <dd class="mt-1 text-highlighted">
                  {{ viewedSubmission.submitterName }}
                </dd>
              </div>
              <div>
                <dt class="font-medium text-muted">
                  Address
                </dt>
                <dd class="mt-1 text-highlighted">
                  {{ viewedSubmission.streetAddress }}
                </dd>
              </div>
            </dl>

            <div>
              <p class="text-sm font-medium text-muted">
                Message
              </p>
              <div class="mt-2 max-h-[60vh] overflow-auto rounded-lg border border-default bg-muted/20 p-4 text-sm leading-6 whitespace-pre-wrap text-highlighted">
                {{ viewedSubmission.message }}
              </div>
            </div>
          </div>
        </template>
      </UModal>

      <UModal
        v-model:open="deleteModalOpen"
        title="Delete submission?"
        :description="submissionPendingDeletion ? `This permanently removes the message from ${submissionPendingDeletion.submitterName}.` : undefined"
      >
        <template #body>
          <p class="text-sm text-muted">
            This cannot be undone. The saved submission will disappear from the admin log, but any email already sent to board recipients will not be recalled.
          </p>
        </template>

        <template #footer>
          <div class="flex w-full flex-col-reverse justify-end gap-3 sm:flex-row">
            <UButton
              color="neutral"
              class="w-full sm:w-auto"
              :disabled="deletingSubmissionId !== null"
              type="button"
              variant="outline"
              @click="deleteModalOpen = false"
            >
              Cancel
            </UButton>
            <UButton
              color="error"
              icon="i-lucide-trash-2"
              class="w-full sm:w-auto"
              :loading="deletingSubmissionId !== null"
              type="button"
              @click="confirmDeleteSubmission"
            >
              Delete submission
            </UButton>
          </div>
        </template>
      </UModal>
    </template>
  </div>
</template>
