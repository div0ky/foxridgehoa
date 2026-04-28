<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { api } from '~~/convex/_generated/api'

definePageMeta({
  convexAuth: true,
  layout: 'admin-dashboard'
})

defineOptions({ name: 'AdminHoaMeetingsPage' })

const toast = useToast()

const profileState = await useConvexQuery(api.operatorProfiles.getMyOperatorProfile, {})

const profile = computed(() => profileState.data.value?.data.profile)
const loadingProfile = computed(() => profileState.status.value === 'pending')
const isBoardMember = computed(() => profile.value?.role === 'boardMember')

const scheduleYear = ref(new Date().getFullYear())

const adminScheduleState = await useConvexQuery(
  api.meetingSchedule.getAdminMeetingSchedule,
  () => ({ year: scheduleYear.value }),
  { enabled: computed(() => isBoardMember.value) }
)

const serverSchedule = computed(() => adminScheduleState.data.value?.data.schedule ?? null)
const loadingSchedule = computed(() => {
  if (!isBoardMember.value)
    return false
  return adminScheduleState.status.value === 'pending'
})

function formatForDatetimeLocal(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const boardSlots = ref(['', '', '', ''])
const annualSlot = ref('')

watch(
  () =>
    ({
      loading: loadingSchedule.value,
      schedule: serverSchedule.value,
      year: scheduleYear.value
    }) as const,
  ({ loading, schedule }) => {
    if (loading)
      return
    if (!schedule) {
      boardSlots.value = ['', '', '', '']
      annualSlot.value = ''
      return
    }
    const b = schedule.boardMeetings
    boardSlots.value = b.map((t: number) => formatForDatetimeLocal(t))
    annualSlot.value = formatForDatetimeLocal(schedule.annualMeeting)
  },
  { immediate: true }
)

const setSchedule = useConvexMutation(api.meetingSchedule.setMeetingSchedule)

const saving = ref(false)

function parseOrThrowLocalDatetime(value: string, label: string): number {
  const ms = new Date(value).getTime()
  if (!Number.isFinite(ms)) {
    throw new TypeError(`Invalid date/time for ${label}.`)
  }
  return ms
}

async function submitSave() {
  const labels = [
    'Board meeting 1',
    'Board meeting 2',
    'Board meeting 3',
    'Board meeting 4',
    'Annual meeting'
  ] as const
  try {
    if (!Number.isInteger(scheduleYear.value)) {
      toast.add({
        color: 'error',
        description: 'Enter a valid schedule year.',
        title: 'Validation'
      })
      return
    }

    const b0 = boardSlots.value[0] ?? ''
    const b1 = boardSlots.value[1] ?? ''
    const b2 = boardSlots.value[2] ?? ''
    const b3 = boardSlots.value[3] ?? ''
    if (!b0 || !b1 || !b2 || !b3 || !annualSlot.value) {
      toast.add({
        color: 'error',
        description: 'Enter a date and time for every board meeting and the annual meeting.',
        title: 'Validation'
      })
      return
    }

    const boardMeetings = [
      parseOrThrowLocalDatetime(b0, labels[0]),
      parseOrThrowLocalDatetime(b1, labels[1]),
      parseOrThrowLocalDatetime(b2, labels[2]),
      parseOrThrowLocalDatetime(b3, labels[3])
    ]
    const annualMeeting = parseOrThrowLocalDatetime(annualSlot.value, labels[4])

    saving.value = true
    await setSchedule.execute({
      annualMeeting,
      boardMeetings,
      year: scheduleYear.value
    })
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
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-xl">
    <UAlert
      v-if="!loadingProfile && !isBoardMember"
      class="mb-6"
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

      <div
        v-if="loadingProfile || loadingSchedule"
        aria-live="polite"
        class="text-sm text-muted"
        role="status"
      >
        Loading…
      </div>

      <form
        v-else
        class="space-y-5"
        novalidate
        @submit.prevent="submitSave"
      >
        <UFormField
          label="Schedule year"
          name="schedule-year"
        >
          <UInput
            id="schedule-year"
            v-model.number="scheduleYear"
            class="w-full max-w-xs"
            type="number"
            :min="new Date().getFullYear() - 1"
            :max="new Date().getFullYear() + 2"
            step="1"
          />
        </UFormField>

        <UFormField
          label="Board meeting 1"
          name="board-0"
          required
        >
          <UInput
            id="board-0"
            v-model="boardSlots[0]"
            class="w-full max-w-md"
            type="datetime-local"
          />
        </UFormField>
        <UFormField
          label="Board meeting 2"
          name="board-1"
          required
        >
          <UInput
            id="board-1"
            v-model="boardSlots[1]"
            class="w-full max-w-md"
            type="datetime-local"
          />
        </UFormField>
        <UFormField
          label="Board meeting 3"
          name="board-2"
          required
        >
          <UInput
            id="board-2"
            v-model="boardSlots[2]"
            class="w-full max-w-md"
            type="datetime-local"
          />
        </UFormField>
        <UFormField
          label="Board meeting 4"
          name="board-3"
          required
        >
          <UInput
            id="board-3"
            v-model="boardSlots[3]"
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
            v-model="annualSlot"
            class="w-full max-w-md"
            type="datetime-local"
          />
        </UFormField>

        <UButton
          color="primary"
          class="w-full sm:w-auto"
          :loading="saving"
          type="submit"
        >
          Save schedule
        </UButton>
      </form>
    </UCard>
  </div>
</template>
