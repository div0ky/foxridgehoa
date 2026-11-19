import type { ServerDraftSnapshot } from './useServerDraft'

import { expect, test, vi } from 'vitest'
import { nextTick, shallowRef } from 'vue'

import { useServerDraft } from './useServerDraft'

test('server draft survives reconnect, detects conflicts and adopts saved values', async () => {
  const latest = shallowRef<ServerDraftSnapshot<{ slots: string[] }>>()
  const editor = useServerDraft({ slots: [''] }, latest)
  expect(editor.hasDraft.value).toBe(false)
  expect(editor.canWrite.value).toBe(false)

  latest.value = { fields: { slots: ['Initial'] }, updatedAt: 1 }
  await nextTick()
  latest.value = { fields: { slots: ['Clean update'] }, updatedAt: 2 }
  await nextTick()
  expect(editor.draft.value.slots).toEqual(['Clean update'])

  editor.draft.value.slots[0] = 'Unsaved edit'
  latest.value = undefined
  await nextTick()
  expect(editor.hasDraft.value).toBe(true)
  expect(editor.canWrite.value).toBe(false)
  latest.value = { fields: { slots: ['Clean update'] }, updatedAt: 2 }
  await nextTick()
  expect(editor.draft.value.slots).toEqual(['Unsaved edit'])
  expect(editor.hasConflict.value).toBe(false)

  const save = vi.fn(async () => {
    throw Object.assign(new Error('Stale version'), { code: 'STALE_SERVER_DRAFT' })
  })
  expect(await editor.write(save)).toBe(false)
  expect(save).toHaveBeenCalledWith(2)
  expect(editor.hasConflict.value).toBe(true)
  expect(editor.canWrite.value).toBe(false)
  expect(editor.canLoadLatest.value).toBe(false)

  latest.value = { fields: { slots: ['Remote update'] }, updatedAt: 3 }
  await nextTick()
  expect(editor.draft.value.slots).toEqual(['Unsaved edit'])
  editor.loadLatest()
  expect(editor.draft.value.slots).toEqual(['Remote update'])
  expect(editor.hasConflict.value).toBe(false)

  editor.draft.value.slots[0] = 'Another edit'
  latest.value = { fields: { slots: ['Another remote update'] }, id: 'replacement', updatedAt: 3 }
  await nextTick()
  expect(editor.draft.value.slots).toEqual(['Another edit'])
  expect(editor.hasConflict.value).toBe(true)
  expect(editor.canWrite.value).toBe(false)
  editor.loadLatest()

  editor.draft.value.slots[0] = ' New value '
  await expect(editor.write(async () => {
    throw new Error('Temporary failure')
  })).rejects.toThrow('Temporary failure')
  expect(editor.draft.value.slots).toEqual([' New value '])
  expect(editor.canWrite.value).toBe(true)

  expect(await editor.write(async (expectedUpdatedAt) => {
    expect(expectedUpdatedAt).toBe(3)
    expect(editor.isWriting.value).toBe(true)
    expect(editor.canWrite.value).toBe(false)
    latest.value = { fields: { slots: ['New value'] }, id: 'replacement', updatedAt: 4 }
  })).toBe(true)
  await nextTick()
  expect(editor.draft.value.slots).toEqual(['New value'])
  expect(editor.isDirty.value).toBe(false)
  expect(editor.canWrite.value).toBe(true)

  editor.reset()
  latest.value = undefined
  await nextTick()
  expect(editor.hasDraft.value).toBe(false)
  latest.value = { fields: { slots: [''] }, updatedAt: null }
  await nextTick()
  expect(editor.draft.value.slots).toEqual([''])
  expect(editor.canWrite.value).toBe(true)
})

test('a rejected save can reload a current snapshot with the original revision', async () => {
  const emptyBanner = { fields: { body: '' }, updatedAt: null }
  const latest = shallowRef<ServerDraftSnapshot<{ body: string }>>(emptyBanner)
  const refresh = vi.fn(async () => {
    latest.value = { ...emptyBanner }
  })
  const editor = useServerDraft(emptyBanner.fields, latest, refresh)
  editor.draft.value.body = 'Unsaved announcement'

  expect(await editor.write(async () => {
    throw Object.assign(new Error('Stale version'), { code: 'STALE_SERVER_DRAFT' })
  })).toBe(false)
  expect(editor.draft.value.body).toBe('Unsaved announcement')

  await editor.loadLatest()
  expect(refresh).toHaveBeenCalledOnce()
  expect(editor.draft.value.body).toBe('')
  expect(editor.canWrite.value).toBe(true)
})
