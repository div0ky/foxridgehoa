<script setup lang="ts">
import { computed, ref } from 'vue'
import { api } from '~~/convex/_generated/api'

import { useLiveSettingsQuery } from '~/composables/useLiveSettingsQuery'
import { useServerDraft } from '~/composables/useServerDraft'

definePageMeta({
  convexAuth: true,
  layout: 'admin-dashboard'
})

defineOptions({ name: 'AdminHoaMeetingsPage' })

const toast = useToast()

const profileState = await useConvexQuery(api.operatorProfiles.getMyOperatorProfile, {})

const profile = computed(() => profileState.data.value?.data.profile)
const loadingProfile = computed(() => profileState.status.value === 'pending')
const profileFailed = computed(() => profileState.status.value === 'error')
const isBoardMember = computed(() => profile.value?.role === 'boardMember')

const currentYear = new Date().getFullYear()
const scheduleYears = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2]
const scheduleYear = ref(currentYear)

const adminScheduleState = useLiveSettingsQuery(
  api.meetingSchedule.getAdminMeetingSchedule,
  () => isBoardMember.value
    ? { year: scheduleYear.value }
    : null
)

const scheduleFailed = computed(() => adminScheduleState.status.value === 'error')

function formatForDatetimeLocal(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const boardMeetingLabels = ['Board meeting 1', 'Board meeting 2', 'Board meeting 3', 'Board meeting 4']
const initialFields = { annualSlot: '', boardSlots: boardMeetingLabels.map(() => '') }
const latest = computed(() => {
  const response = adminScheduleState.data.value
  if (!isBoardMember.value || adminScheduleState.status.value !== 'success' || response?.data.year !== scheduleYear.value)
    return

  const schedule = response.data.schedule
  return {
    fields: schedule
      ? {
        annualSlot: formatForDatetimeLocal(schedule.annualMeeting),
        boardSlots: boardMeetingLabels.map((_, index) => {
          const meeting = schedule.boardMeetings[index]
          return meeting === undefined ? '' : formatForDatetimeLocal(meeting)
        })
      }
      : initialFields,
    id: schedule?.id,
    updatedAt: schedule?.updatedAt ?? null
  }
})
const { canLoadLatest, canWrite, draft, hasConflict, hasDraft, isDirty, isReady, isWriting, loadLatest, reset, write }
  = useServerDraft(initialFields, latest, adminScheduleState.refresh)

const setSchedule = useConvexMutation(api.meetingSchedule.setMeetingSchedule)

function selectScheduleYear(year: number) {
  if (isWriting.value || year === scheduleYear.value || !scheduleYears.includes(year))
    return
  if (isDirty.value && !window.confirm(`Discard unsaved changes for ${scheduleYear.value} and open ${year}?`))
    return

  reset()
  scheduleYear.value = year
}

function parseOrThrowLocalDatetime(value: string, label: string): number {
  const ms = new Date(value).getTime()
  if (!Number.isFinite(ms)) {
    throw new TypeError(`Invalid date/time for ${label}.`)
  }
  return ms
}

async function submitSave() {
  if (!canWrite.value)
    return

  const { annualSlot, boardSlots } = draft.value
  if (!annualSlot || boardMeetingLabels.some((_, index) => !boardSlots[index])) {
    toast.add({
      color: 'error',
      description: 'Enter a date and time for every board meeting and the annual meeting.',
      title: 'Validation'
    })
    return
  }

  try {
    const boardMeetings = boardMeetingLabels.map((label, index) => parseOrThrowLocalDatetime(boardSlots[index] ?? '', label))
    const annualMeeting = parseOrThrowLocalDatetime(annualSlot, 'Annual meeting')

    const saved = await write(expectedUpdatedAt => setSchedule({
      annualMeeting,
      boardMeetings,
      expectedUpdatedAt,
      year: scheduleYear.value
    }))
    if (!saved)
      return

    toast.add({
      color: 'success',
      description: 'The HOA meeting schedule is updated.',
      title: 'Saved'
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Save failed.'
    toast.add({
      color: 'error',
      description: message,
      title: 'Could not save'
    })
  }
}
</script>

<template>
  <div class="mx-auto w-full min-w-0 max-w-xl space-y-6">
    <UAlert
      v-if="profileFailed"
      color="error"
      variant="soft"
      title="Could not load your board profile"
      :actions="[{ label: 'Reload page', onClick: () => reloadNuxtApp() }]"
    />
    <UAlert
      v-else-if="!loadingProfile && !isBoardMember"
      color="warning"
      variant="soft"
      title="Restricted"
      description="Only board members can manage the HOA meeting schedule."
      icon="i-lucide-lock"
    />

    <UCard v-if="loadingProfile || isBoardMember">
      <template #header>
        <div>
          <h1 class="font-semibold text-highlighted">
            HOA meetings
          </h1>
          <p class="mt-1 text-sm text-muted">
            Set board meeting and annual meeting times. Times use your device’s local time when you pick them. The public site shows them in Central Time (Wentzville), matching the home page.
          </p>
        </div>
      </template>

      <UFormField
        v-if="isBoardMember"
        label="Schedule year"
        name="schedule-year"
        class="mb-5"
      >
        <USelect
          id="schedule-year"
          :model-value="scheduleYear"
          :items="scheduleYears"
          :disabled="isWriting"
          class="w-full max-w-xs"
          @update:model-value="selectScheduleYear"
        />
      </UFormField>

      <UAlert
        v-if="scheduleFailed"
        class="mb-5"
        color="error"
        variant="soft"
        title="Could not load the meeting schedule"
        :actions="[{ label: 'Retry', disabled: isWriting, onClick: () => adminScheduleState.refresh() }]"
      />
      <div
        v-else-if="!isReady"
        aria-live="polite"
        class="text-sm text-muted"
        role="status"
      >
        Loading…
      </div>

      <form
        v-if="hasDraft"
        class="space-y-5"
        novalidate
        @submit.prevent="submitSave"
      >
        <UAlert
          v-if="hasConflict && !isWriting"
          role="status"
          color="warning"
          variant="soft"
          title="The meeting schedule changed"
          description="Load the latest version to replace your draft before saving the schedule."
          :actions="[{ label: 'Load latest', disabled: !canLoadLatest, onClick: loadLatest }]"
        />
        <UFormField
          v-for="(label, index) in boardMeetingLabels"
          :key="label"
          :label="label"
          :name="`board-${index}`"
          required
        >
          <UInput
            :id="`board-${index}`"
            v-model="draft.boardSlots[index]"
            :disabled="!isReady || isWriting"
            class="w-full max-w-md"
            type="datetime-local"
          />
        </UFormField>

        <UFormField
          label="Annual meeting"
          name="annual-meeting"
          required
        >
          <UInput
            id="annual-meeting"
            v-model="draft.annualSlot"
            :disabled="!isReady || isWriting"
            class="w-full max-w-md"
            type="datetime-local"
          />
        </UFormField>

        <UButton
          color="primary"
          class="w-full sm:w-auto"
          :disabled="!canWrite"
          :loading="isWriting"
          type="submit"
        >
          Save schedule
        </UButton>
      </form>
    </UCard>
  </div>
</template>
