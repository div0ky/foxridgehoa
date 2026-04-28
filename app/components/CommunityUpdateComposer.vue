<script setup lang="ts">
import type { Id } from '~~/convex/_generated/dataModel'

import { ref } from 'vue'
import { api } from '~~/convex/_generated/api'

import { postImageToConvexUploadUrl } from '~/utils/convexImageUpload'

interface Props {
  /** Waiting on auth/profile */
  pendingAuth?: boolean
  /** Board member with display name — show Markdown editor */
  canPublish?: boolean
  /** Board member missing name — prompt only */
  needsDisplayName?: boolean
}

withDefaults(defineProps<Props>(), {
  canPublish: false,
  needsDisplayName: false,
  pendingAuth: false
})

const emit = defineEmits<{
  published: []
}>()

const toast = useToast()

const bodyMarkdown = ref('# Community update\n\nWrite your message in **Markdown**.')
const pendingFiles = ref<File[]>([])
const postDateTime = ref(toLocalDateTimeInputValue(new Date()))
const publishing = ref(false)

const editorToolbarItems = [
  [
    {
      kind: 'heading',
      label: 'H1',
      level: 1
    },
    {
      kind: 'heading',
      label: 'H2',
      level: 2
    },
    {
      icon: 'i-lucide-pilcrow',
      kind: 'paragraph',
      label: 'Paragraph'
    }
  ],
  [
    {
      icon: 'i-lucide-bold',
      kind: 'mark',
      mark: 'bold',
      tooltip: { text: 'Bold' }
    },
    {
      icon: 'i-lucide-italic',
      kind: 'mark',
      mark: 'italic',
      tooltip: { text: 'Italic' }
    },
    {
      icon: 'i-lucide-code',
      kind: 'mark',
      mark: 'code',
      tooltip: { text: 'Inline code' }
    }
  ],
  [
    {
      icon: 'i-lucide-list',
      kind: 'bulletList',
      tooltip: { text: 'Bullet list' }
    },
    {
      icon: 'i-lucide-list-ordered',
      kind: 'orderedList',
      tooltip: { text: 'Numbered list' }
    },
    {
      icon: 'i-lucide-quote',
      kind: 'blockquote',
      tooltip: { text: 'Quote' }
    }
  ],
  [
    {
      icon: 'i-lucide-undo-2',
      kind: 'undo',
      tooltip: { text: 'Undo' }
    },
    {
      icon: 'i-lucide-redo-2',
      kind: 'redo',
      tooltip: { text: 'Redo' }
    }
  ]
]

const generateUploadUrl = useConvexMutation(api.communityUpdates.generateCommunityUpdateImageUploadUrl)
const createUpdate = useConvexMutation(api.communityUpdates.createCommunityUpdate)

function toLocalDateTimeInputValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')

  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  ].join('T')
}

function getPostDateTimeMs(): null | number {
  const ms = new Date(postDateTime.value).getTime()
  return Number.isFinite(ms) ? ms : null
}

function onFileInputChange(event: Event) {
  const input = event.target as HTMLInputElement
  const picked = input.files ? Array.from(input.files) : []
  pendingFiles.value = [...pendingFiles.value, ...picked].slice(0, 3)
  input.value = ''
}

function removePendingFile(index: number) {
  pendingFiles.value = pendingFiles.value.filter((_, i) => i !== index)
}

async function submitPublish() {
  const md = bodyMarkdown.value.trim()
  if (!md) {
    toast.add({
      color: 'warning',
      description: 'Enter update content.',
      title: 'Missing content'
    })
    return
  }

  const postedAt = getPostDateTimeMs()
  if (postedAt === null) {
    toast.add({
      color: 'warning',
      description: 'Choose a valid date and time for the post.',
      title: 'Invalid post date'
    })
    return
  }

  publishing.value = true
  try {
    const storageIds: Id<'_storage'>[] = []
    for (const file of pendingFiles.value) {
      const uploadUrl = await generateUploadUrl.execute({}) as string
      const storageId = await postImageToConvexUploadUrl(uploadUrl, file)
      storageIds.push(storageId as Id<'_storage'>)
    }

    await createUpdate.execute({
      bodyMarkdown: bodyMarkdown.value,
      imageStorageIds: storageIds.length > 0 ? storageIds : undefined,
      postedAt
    })

    pendingFiles.value = []
    bodyMarkdown.value = '# Community update\n\n'
    postDateTime.value = toLocalDateTimeInputValue(new Date())
    toast.add({
      color: 'success',
      description: 'The update is published.',
      title: 'Published'
    })
    emit('published')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Publish failed.'
    toast.add({
      color: 'error',
      description: message,
      title: 'Could not publish'
    })
  } finally {
    publishing.value = false
  }
}
</script>

<template>
  <div class="community-update-composer">
    <div
      v-if="pendingAuth"
      aria-live="polite"
      class="text-sm text-muted"
      role="status"
    >
      Loading…
    </div>

    <UAlert
      v-else-if="needsDisplayName"
      color="warning"
      variant="soft"
      title="Display name required"
      description="Set your name before publishing updates."
      icon="i-lucide-user-round"
    >
      <template #actions>
        <UButton
          color="primary"
          size="sm"
          to="/admin/account"
        >
          Open Account settings
        </UButton>
      </template>
    </UAlert>

    <div
      v-else-if="canPublish"
      class="space-y-6"
    >
      <UFormField
        label="Post date and time"
        name="community-update-posted-at"
        hint="Defaults to now. This controls the date shown on the site; the database still records the actual creation time."
      >
        <UInput
          v-model="postDateTime"
          type="datetime-local"
          class="w-full max-w-sm"
        />
      </UFormField>

      <UEditor
        v-model="bodyMarkdown"
        content-type="markdown"
        class="min-w-0 w-full"
        placeholder="Write your update…"
        :ui="{
          root: 'flex min-h-[300px] min-w-0 flex-col overflow-hidden rounded-md border border-default bg-default shadow-sm',
          content: 'flex-1',
          base: 'min-h-[240px] px-4 py-4 sm:px-4'
        }"
      >
        <template #default="{ editor }">
          <div class="overflow-x-auto border-b border-default bg-muted/40">
            <UEditorToolbar
              :editor="editor"
              :items="editorToolbarItems"
              class="min-w-max px-2 py-1"
            />
          </div>
        </template>
      </UEditor>

      <div class="space-y-2">
        <UFormField
          label="Images (optional)"
          name="community-update-images"
          hint="Up to 3 images, 5 MB each."
        >
          <UInput
            accept="image/*"
            :disabled="pendingFiles.length >= 3"
            multiple
            type="file"
            class="w-full max-w-md"
            @change="onFileInputChange"
          />
        </UFormField>

        <div
          v-if="pendingFiles.length > 0"
          class="flex flex-wrap gap-2"
        >
          <UBadge
            v-for="(file, i) in pendingFiles"
            :key="`${file.name}-${i}`"
            class="max-w-full"
            color="neutral"
            variant="subtle"
          >
            <span class="inline-block max-w-48 truncate align-bottom">
              {{ file.name }}
            </span>
            <button
              type="button"
              class="ml-1 shrink-0 text-muted underline"
              @click="removePendingFile(i)"
            >
              Remove
            </button>
          </UBadge>
        </div>
      </div>

      <UButton
        color="primary"
        class="w-full sm:w-auto"
        :loading="publishing"
        @click="submitPublish"
      >
        Publish update
      </UButton>
    </div>
  </div>
</template>
