<script setup lang="ts">
import type { Id } from '~~/convex/_generated/dataModel'

import { computed, ref, watch } from 'vue'
import { api } from '~~/convex/_generated/api'

import { useLiveConvexPagination } from '~/composables/useLiveConvexPagination'
import { useLiveSettingsQuery } from '~/composables/useLiveSettingsQuery'
import { useServerDraft } from '~/composables/useServerDraft'

definePageMeta({
  convexAuth: true,
  layout: 'admin-dashboard'
})

defineOptions({ name: 'AdminContactRoutingPage' })

const toast = useToast()
const session = useConvexAuth()
const authenticatedUserId = computed(() => {
  if (session.isPending.value || session.authError.value || !session.isAuthenticated.value)
    return null
  return session.user.value?.id ?? null
})
const profileState = useLiveSettingsQuery(
  api.operatorProfiles.getMyOperatorProfile,
  () => authenticatedUserId.value ? {} : null
)

const loadingProfile = computed(() => session.isPending.value || profileState.status.value === 'pending')
const boardOwner = computed(() => {
  const profile = profileState.data.value?.data.profile
  if (profileState.status.value !== 'success' || profile?.role !== 'boardMember')
    return null
  const userId = authenticatedUserId.value
  return userId === profile.authUserId ? userId : null
})

const routingState = useLiveSettingsQuery(
  api.boardContact.getBoardContactRouting,
  () => boardOwner.value ? {} : null
)
const initialFields = { recipientRows: [{ displayName: '', email: '', key: 0 }] }
const latest = computed(() => {
  const result = routingState.data.value
  if (!boardOwner.value || routingState.status.value !== 'success' || !result?.ok)
    return

  const routing = result.data.routing
  return {
    fields: routing?.recipients.length
      ? { recipientRows: routing.recipients.map((recipient, key) => ({ ...recipient, key })) }
      : initialFields,
    id: routing?.routingId,
    updatedAt: routing?.updatedAt ?? null
  }
})
const { canLoadLatest, canWrite, draft, hasConflict, hasDraft, isReady, isWriting, loadLatest, reset, write }
  = useServerDraft(initialFields, latest, routingState.refresh)

watch(() => session.user.value?.id, reset, { flush: 'sync' })

const setRouting = useConvexMutation(api.boardContact.setBoardContactRouting)
const routingFieldsDisabled = computed(() => !isReady.value || isWriting.value || hasConflict.value)
let nextAddedRecipientKey = -1

function addRecipientRow() {
  draft.value.recipientRows.push({ displayName: '', email: '', key: nextAddedRecipientKey-- })
}

function removeRecipientRow(index: number) {
  const recipientRows = draft.value.recipientRows
  if (recipientRows.length === 1) {
    draft.value.recipientRows = [{ displayName: '', email: '', key: recipientRows[0]!.key }]
    return
  }
  recipientRows.splice(index, 1)
}

// EFFECT: Save recipients against the routing version used to start the draft.
async function submitRouting() {
  const owner = boardOwner.value
  if (!owner || !canWrite.value)
    return

  const recipients = draft.value.recipientRows
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

  try {
    const expectedRoutingId = latest.value?.id
    const saved = await write(expectedUpdatedAt => setRouting({
      expectedRoutingId,
      expectedUpdatedAt,
      recipients
    }))
    if (!saved || boardOwner.value !== owner)
      return

    toast.add({
      color: 'success',
      description: 'Notification recipients are saved.',
      title: 'Saved'
    })
  } catch (error) {
    if (boardOwner.value !== owner)
      return
    const description = error instanceof Error ? error.message : 'Save failed.'
    toast.add({
      color: 'error',
      description,
      title: 'Could not save'
    })
  }
}

const {
  canLoadMore: canLoadMoreSubmissions,
  error: submissionsError,
  initialized: submissionsInitialized,
  isPending: loadingSubmissions,
  loadMore: loadMoreSubmissions,
  refresh: refreshSubmissions,
  retry: retrySubmissions,
  rows: liveSubmissions
} = await useLiveConvexPagination(
  api.boardContact.listBoardContactSubmissions,
  {
    auth: 'required',
    enabled: () => boardOwner.value !== null,
    pageSize: 25,
    selectPage: ({ data }) => ({
      continueCursor: data.continueCursor,
      isDone: data.isDone,
      rows: data.page
    })
  }
)

const submissions = computed(() => boardOwner.value ? liveSubmissions.value : [])
const viewedSubmissionId = ref<Id<'boardContactSubmissions'> | null>(null)
const pendingDeletionId = ref<Id<'boardContactSubmissions'> | null>(null)
const viewedSubmission = computed(() => submissions.value.find(row => row.submissionId === viewedSubmissionId.value))
const submissionPendingDeletion = computed(() => submissions.value.find(row => row.submissionId === pendingDeletionId.value))
const deletingSubmissionId = ref<Id<'boardContactSubmissions'> | null>(null)
const deleteSubmission = useConvexMutation(api.boardContact.deleteBoardContactSubmission)

watch(boardOwner, () => {
  viewedSubmissionId.value = null
  pendingDeletionId.value = null
}, { flush: 'sync' })

watch(submissions, () => {
  if (!viewedSubmission.value)
    viewedSubmissionId.value = null
  if (!submissionPendingDeletion.value)
    pendingDeletionId.value = null
})

function previewMessage(message: string): string {
  const compact = message.replace(/\s+/g, ' ').trim()
  return compact.length > 180 ? `${compact.slice(0, 177)}...` : compact
}

// EFFECT: Permanently deletes a submission. Convex updates the active pages before acknowledging the write.
async function confirmDeleteSubmission() {
  const owner = boardOwner.value
  const submissionId = submissionPendingDeletion.value?.submissionId
  if (!owner || !submissionId || deletingSubmissionId.value)
    return

  deletingSubmissionId.value = submissionId
  try {
    const { data: { deleted } } = await deleteSubmission({ submissionId })
    if (boardOwner.value !== owner)
      return

    if (pendingDeletionId.value === submissionId)
      pendingDeletionId.value = null
    toast.add({
      color: deleted ? 'success' : 'info',
      title: deleted ? 'Submission deleted' : 'Submission already removed'
    })
  } catch {
    if (boardOwner.value !== owner)
      return
    toast.add({
      color: 'error',
      description: 'Try deleting the submission again.',
      title: 'Could not delete submission'
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

  if (raw === 'ERR_DELIVERY_UNCONFIRMED')
    return 'Email delivery could not be confirmed. Resend may have received the email.'

  if (raw === 'ERR_RESEND_TIMEOUT')
    return 'Resend took too long to respond and may have received the email.'

  if (raw.startsWith('ERR_RESEND_API:'))
    return `Resend API: ${raw.slice('ERR_RESEND_API:'.length)}`

  return raw
}
</script>

<template>
  <div class="mx-auto w-full min-w-0 max-w-4xl space-y-8">
    <div
      v-if="loadingProfile"
      class="text-sm text-muted"
      role="status"
    >
      Loading board profile…
    </div>
    <UAlert
      v-else-if="profileState.status.value === 'error'"
      color="error"
      variant="soft"
      title="Could not load your board profile"
      :actions="[{ label: 'Reload page', onClick: () => reloadNuxtApp() }]"
    />
    <UAlert
      v-else-if="!boardOwner"
      color="warning"
      variant="soft"
      title="Restricted"
      description="Only board members can manage contact routing and view submissions."
      icon="i-lucide-lock"
    />

    <template v-else>
      <UCard>
        <template #header>
          <div>
            <h1 class="font-semibold text-highlighted">
              Board contact: email recipients
            </h1>
            <p class="mt-1 text-sm text-muted">
              Resend emails these recipients when a resident submits the public form. If <code class="text-xs">RESEND_TO</code> is configured, those addresses go in To and any other recipients listed here receive a blind copy (BCC). Set <code class="text-xs">RESEND_API_KEY</code> and use a verified sender in <code class="text-xs">RESEND_FROM</code> in Convex.
            </p>
          </div>
        </template>

        <UAlert
          v-if="routingState.status.value === 'error'"
          color="error"
          variant="soft"
          title="Could not load contact routing"
          :actions="[{ label: 'Retry', disabled: isWriting, onClick: () => routingState.refresh() }]"
        />
        <div
          v-else-if="!isReady"
          aria-live="polite"
          class="text-sm text-muted"
          role="status"
        >
          Loading recipients…
        </div>

        <form
          v-if="hasDraft"
          class="space-y-4"
          :class="{ 'mt-4': !isReady }"
          @submit.prevent="submitRouting"
        >
          <UAlert
            v-if="hasConflict && !isWriting"
            role="status"
            color="warning"
            variant="soft"
            title="Contact routing changed"
            description="Load the latest recipients to replace your draft before saving."
            :actions="[{ label: 'Load latest', disabled: !canLoadLatest, onClick: loadLatest }]"
          />
          <div class="space-y-3">
            <div
              v-for="(row, index) in draft.recipientRows"
              :key="row.key"
              class="flex flex-col gap-3 sm:flex-row sm:items-end"
            >
              <UFormField
                class="min-w-0 flex-1"
                label="Display name"
              >
                <UInput
                  v-model="row.displayName"
                  :aria-label="`Display name for recipient ${index + 1}`"
                  :disabled="routingFieldsDisabled"
                  class="w-full"
                  placeholder="Jane Director"
                />
              </UFormField>
              <UFormField
                class="min-w-0 flex-1"
                label="Email"
              >
                <UInput
                  v-model="row.email"
                  :aria-label="`Email for recipient ${index + 1}`"
                  :disabled="routingFieldsDisabled"
                  class="w-full"
                  placeholder="jane@example.com"
                  type="email"
                />
              </UFormField>
              <UButton
                color="neutral"
                icon="i-lucide-minus"
                class="w-full sm:w-auto"
                :disabled="routingFieldsDisabled"
                type="button"
                variant="outline"
                :aria-label="`Remove recipient ${index + 1}`"
                @click="removeRecipientRow(index)"
              />
            </div>
          </div>

          <div class="flex flex-wrap gap-3">
            <UButton
              color="neutral"
              icon="i-lucide-plus"
              class="w-full sm:w-auto"
              :disabled="routingFieldsDisabled"
              type="button"
              variant="outline"
              @click="addRecipientRow"
            >
              Add recipient
            </UButton>
            <UButton
              color="primary"
              class="w-full sm:w-auto"
              :disabled="!canWrite"
              :loading="isWriting"
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
                Review and delete messages from the public form, newest first.
              </p>
            </div>
            <UButton
              color="neutral"
              icon="i-lucide-refresh-cw"
              class="w-full sm:w-auto"
              type="button"
              variant="outline"
              @click="refreshSubmissions"
            >
              Refresh list
            </UButton>
          </div>
        </template>

        <div
          v-if="!submissionsInitialized && !submissionsError"
          aria-live="polite"
          class="text-sm text-muted"
          role="status"
        >
          Loading submissions…
        </div>

        <div
          v-else-if="submissionsInitialized && !submissions.length && !submissionsError && !loadingSubmissions"
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
              When neighbors use Contact the Board, their messages and email delivery status appear here.
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

        <div v-else-if="submissions.length">
          <div class="space-y-3 md:hidden">
            <article
              v-for="row in submissions"
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
                  @click="viewedSubmissionId = row.submissionId"
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
                  @click="pendingDeletionId = row.submissionId"
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
                  v-for="row in submissions"
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
                        @click="viewedSubmissionId = row.submissionId"
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
                      @click="pendingDeletionId = row.submissionId"
                    >
                      Delete
                    </UButton>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <UAlert
          v-if="submissionsError"
          :class="{ 'mt-4': submissions.length }"
          color="error"
          variant="soft"
          icon="i-lucide-circle-alert"
          role="alert"
          :title="submissionsInitialized ? 'Could not update all submissions' : 'Could not load submissions'"
          :actions="[{ label: 'Retry', onClick: retrySubmissions }]"
        />
        <p
          v-else-if="submissionsInitialized && loadingSubmissions"
          class="mt-4 text-sm text-muted"
          role="status"
        >
          Updating submissions…
        </p>
        <UButton
          v-else-if="canLoadMoreSubmissions"
          block
          class="mt-4"
          color="neutral"
          type="button"
          variant="outline"
          @click="loadMoreSubmissions"
        >
          Load older
        </UButton>
      </UCard>

      <UModal
        :open="Boolean(viewedSubmission)"
        scrollable
        title="Contact submission"
        :description="viewedSubmission ? `${viewedSubmission.submitterName} · ${formatWhen(viewedSubmission.createdAt)}` : undefined"
        :ui="{ content: 'sm:max-w-2xl' }"
        @update:open="open => { if (!open) viewedSubmissionId = null }"
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
        :open="Boolean(submissionPendingDeletion)"
        title="Delete submission?"
        :description="submissionPendingDeletion ? `This permanently removes the message from ${submissionPendingDeletion.submitterName}.` : undefined"
        @update:open="open => { if (!open) pendingDeletionId = null }"
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
              @click="pendingDeletionId = null"
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
