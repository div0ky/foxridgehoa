import { computed, ref } from 'vue'
import { api } from '~~/convex/_generated/api'

import { formatHoaMeetingLine } from '~/utils/hoaMeetingDisplay'

export interface PublicMeetingRow {
  atMs: number
  displayTime: string
  isPast: boolean
  kind: 'annual' | 'board'
  label: string
}

export async function usePublicMeetingSchedule() {
  const displayYear = ref(new Date().getFullYear())

  const state = await useConvexQuery(api.meetingSchedule.getPublicMeetingSchedule, () => ({
    year: displayYear.value
  }))

  const schedule = computed(() => state.data.value?.data.schedule ?? null)
  const isPending = computed(() => state.status.value === 'pending')

  const meetingRows = computed((): PublicMeetingRow[] => {
    const s = schedule.value
    if (!s)
      return []

    const now = Date.now()
    const board = [...s.boardMeetings]
      .map(atMs => ({
        atMs,
        displayTime: formatHoaMeetingLine({ atMs }),
        isPast: atMs < now,
        kind: 'board' as const,
        label: 'Board Meeting'
      }))
      .sort((a, b) => a.atMs - b.atMs)

    const annual: PublicMeetingRow = {
      atMs: s.annualMeeting,
      displayTime: formatHoaMeetingLine({ atMs: s.annualMeeting }),
      isPast: s.annualMeeting < now,
      kind: 'annual',
      label: 'Annual Meeting'
    }

    return [...board, annual]
  })

  return {
    displayYear,
    isPending,
    meetingRows,
    schedule,
    state
  }
}
