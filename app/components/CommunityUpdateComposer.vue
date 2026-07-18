<script setup lang="ts">
import type { Id } from '~~/convex/_generated/dataModel'

import { onBeforeUnmount, ref, watch } from 'vue'
import { api } from '~~/convex/_generated/api'

import { postImageToConvexUploadUrl } from '~/utils/convexImageUpload'

interface Props {
  /** Waiting on auth/profile */
  pendingAuth?: boolean
  /** Board member with display name — show Markdown editor */
  canPublish?: boolean
  /** Board member missing name — prompt only */
  needsDisplayName?: boolean
  /** Update being edited (optional) */
  update?: {
    id: Id<'communityUpdates'>
    bodyMarkdown: string
    postedAt: number
    images: Array<{ storageId: Id<'_storage'> }>
    imageUrls: Array<string>
  }
}

const props = withDefaults(defineProps<Props>(), {
  canPublish: false,
  needsDisplayName: false,
  pendingAuth: false
})

const emit = defineEmits<{
  published: []
  updated: []
}>()

const toast = useToast()

interface ComposerImage {
  id: string
  type: 'existing' | 'new'
  file?: File
  storageId?: Id<'_storage'>
  url: string
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const allowedImageTypes = new Set([
  'image/avif',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp'
])

const bodyMarkdown = ref('# Community update\n\nWrite your message in **Markdown**.')
const images = ref<ComposerImage[]>([])
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
const updateUpdate = useConvexMutation(api.communityUpdates.updateCommunityUpdate)

watch(
  () => props.update,
  (newVal) => {
    if (newVal) {
      bodyMarkdown.value = newVal.bodyMarkdown
      postDateTime.value = toLocalDateTimeInputValue(new Date(newVal.postedAt))
      images.value = newVal.images.map((img, i) => ({
        id: img.storageId,
        storageId: img.storageId,
        type: 'existing',
        url: newVal.imageUrls[i] ?? ''
      }))
    } else {
      bodyMarkdown.value = '# Community update\n\nWrite your message in **Markdown**.'
      postDateTime.value = toLocalDateTimeInputValue(new Date())
      images.value = []
    }
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  for (const img of images.value) {
    if (img.type === 'new' && img.url.startsWith('blob:'))
      URL.revokeObjectURL(img.url)
  }
})

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
  const remainingSlots = 3 - images.value.length
  const validImages: File[] = []

  for (const file of picked) {
    if (!allowedImageTypes.has(file.type)) {
      toast.add({
        color: 'warning',
        description: `${file.name} is not a supported JPEG, PNG, WebP, GIF, or AVIF image.`,
        title: 'Unsupported image'
      })
      continue
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.add({
        color: 'warning',
        description: `${file.name} is larger than 5 MB.`,
        title: 'Image too large'
      })
      continue
    }
    validImages.push(file)
  }

  if (validImages.length > remainingSlots) {
    toast.add({
      color: 'warning',
      description: 'Only the first images that fit the three-image limit were added.',
      title: 'Image limit'
    })
  }

  for (const file of validImages.slice(0, remainingSlots)) {
    const url = URL.createObjectURL(file)
    images.value.push({
      file,
      id: Math.random().toString(36).substring(7),
      type: 'new',
      url
    })
  }
  input.value = ''
}

function removeImage(index: number) {
  const img = images.value[index]
  if (img && img.type === 'new' && img.url.startsWith('blob:'))
    URL.revokeObjectURL(img.url)

  images.value = images.value.filter((_, i) => i !== index)
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
    for (const img of images.value) {
      if (img.type === 'existing' && img.storageId) {
        storageIds.push(img.storageId)
      } else if (img.type === 'new' && img.file) {
        const uploadUrl = await generateUploadUrl({}) as string
        const storageId = await postImageToConvexUploadUrl(uploadUrl, img.file)
        storageIds.push(storageId as Id<'_storage'>)
      }
    }

    if (props.update) {
      await updateUpdate({
        bodyMarkdown: md,
        imageStorageIds: storageIds,
        postedAt,
        updateId: props.update.id
      })
      toast.add({
        color: 'success',
        description: 'The update is saved.',
        title: 'Saved'
      })
      emit('updated')
    } else {
      await createUpdate({
        bodyMarkdown: md,
        imageStorageIds: storageIds.length > 0 ? storageIds : undefined,
        postedAt
      })

      bodyMarkdown.value = '# Community update\n\n'
      postDateTime.value = toLocalDateTimeInputValue(new Date())
      images.value = []

      toast.add({
        color: 'success',
        description: 'The update is published.',
        title: 'Published'
      })
      emit('published')
    }
  } catch (error) {
    const isEdit = !!props.update
    const actionLabel = isEdit ? 'save' : 'publish'
    const message = error instanceof Error ? error.message : `${actionLabel} failed.`
    toast.add({
      color: 'error',
      description: message,
      title: `Could not ${actionLabel}`
    })
  } finally {
    publishing.value = false
  }
}
</script>

<template>
  <div class="community-update-composer min-w-0 w-full">
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
          class="w-full sm:w-auto"
          size="md"
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
          class="w-full max-w-full sm:max-w-sm"
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

      <div class="space-y-4">
        <UFormField
          label="Images (optional)"
          name="community-update-images"
          hint="Up to 3 images, 5 MB each."
        >
          <UInput
            accept="image/avif,image/gif,image/jpeg,image/png,image/webp"
            :disabled="images.length >= 3"
            multiple
            type="file"
            class="w-full max-w-md"
            @change="onFileInputChange"
          />
        </UFormField>

        <div
          v-if="images.length > 0"
          class="grid grid-cols-3 gap-4 max-w-md"
        >
          <div
            v-for="(img, i) in images"
            :key="img.id"
            class="group relative aspect-square w-full overflow-hidden rounded-lg border border-default bg-muted"
          >
            <img
              :src="img.url"
              alt=""
              class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            >
            <div class="absolute inset-0 bg-slate-950/20 opacity-0 transition-opacity duration-200 group-hover:opacity-100 flex items-center justify-center">
              <UButton
                color="error"
                icon="i-lucide-trash-2"
                size="sm"
                variant="solid"
                class="rounded-full shadow-lg"
                aria-label="Remove image"
                @click="removeImage(i)"
              />
            </div>
            <span
              class="absolute bottom-1 left-1 rounded px-1 text-[10px] font-medium leading-none shadow-sm"
              :class="img.type === 'existing' ? 'bg-slate-900/80 text-slate-100' : 'bg-mint-500/90 text-slate-900'"
            >
              {{ img.type === 'existing' ? 'Saved' : 'New' }}
            </span>
          </div>
        </div>
      </div>

      <UButton
        color="primary"
        class="w-full sm:w-auto"
        :loading="publishing"
        @click="submitPublish"
      >
        {{ update ? 'Save update' : 'Publish update' }}
      </UButton>
    </div>
  </div>
</template>
