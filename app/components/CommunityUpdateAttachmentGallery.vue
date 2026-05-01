<script setup lang="ts">
import { DialogTitle } from 'reka-ui'
import { computed, ref } from 'vue'

import { getCommunityUpdateAttachmentAlt } from '~/utils/communityUpdateExcerpt'

const props = defineProps<{
  bodyMarkdown: string
  imageUrls: string[]
  postId?: string
  variant: 'detail' | 'timeline'
}>()

const lightboxOpen = ref(false)
const lightboxIndex = ref(0)

/** Indices + URLs as shown in the feed strip (timeline may collapse to first image only). */
const previewItems = computed(() => {
  if (props.variant === 'timeline' && props.imageUrls.length > 1) {
    if (props.imageUrls[0] == null)
      return []
    return [{ index: 0, src: props.imageUrls[0] }]
  }
  return props.imageUrls.map((src, index) => ({ index, src }))
})

const remainingImageCount = computed(() => {
  if (props.variant !== 'timeline' || props.imageUrls.length <= 1)
    return 0
  return props.imageUrls.length - 1
})

/** Max height only; width stays intrinsic so small assets are not upscaled. */
const detailFrameClass = computed(() =>
  props.variant === 'detail'
    ? 'max-h-[min(40rem,88svh)] sm:max-h-[min(44rem,90svh)]'
    : 'max-h-[min(32rem,85svh)]'
)

const lightboxSrc = computed(() => props.imageUrls[lightboxIndex.value] ?? '')
const lightboxAlt = computed(() =>
  props.imageUrls.length === 0
    ? ''
    : getCommunityUpdateAttachmentAlt(
      props.bodyMarkdown,
      lightboxIndex.value,
      props.imageUrls.length
    )
)

const lightboxCaption = computed(() => {
  const text = lightboxAlt.value
  if (text.length <= 72)
    return text
  return `${text.slice(0, 69)}…`
})

function attachmentAlt(imageIndex: number): string {
  return getCommunityUpdateAttachmentAlt(
    props.bodyMarkdown,
    imageIndex,
    props.imageUrls.length
  )
}

function openLightbox(imageIndex: number) {
  lightboxIndex.value = imageIndex
  lightboxOpen.value = true
}
</script>

<template>
  <div
    v-if="imageUrls.length > 0"
    class="border-slate-200/80 border-t dark:border-slate-700"
  >
    <div class="space-y-0">
      <div
        v-for="(item, displayedIdx) in previewItems"
        :key="`${postId ?? 'update'}-att-${item.index}-${displayedIdx}`"
        :class="[
          'flex cursor-zoom-in items-center justify-center bg-slate-100 px-4 py-5 sm:px-6 sm:py-6 dark:bg-slate-900/80',
          displayedIdx > 0 ? 'border-slate-200/80 border-t dark:border-slate-700' : ''
        ]"
      >
        <button
          type="button"
          class="focus-ring flex w-full items-center justify-center transition-opacity hover:opacity-95"
          :aria-label="`View larger: ${attachmentAlt(item.index)}`"
          @click="openLightbox(item.index)"
        >
          <img
            :src="item.src"
            :alt="attachmentAlt(item.index)"
            :class="[
              'h-auto w-auto max-w-full object-contain',
              detailFrameClass
            ]"
            decoding="async"
            loading="lazy"
          >
        </button>
      </div>
    </div>

    <div
      v-if="remainingImageCount > 0 && postId"
      class="border-slate-200/80 border-t px-4 py-3 dark:border-slate-700 sm:px-6"
    >
      <NuxtLink
        :to="`/updates/${postId}`"
        class="text-sm font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
      >
        {{ remainingImageCount }} more photo{{ remainingImageCount === 1 ? '' : 's' }} on full post
      </NuxtLink>
    </div>

    <UModal
      v-model:open="lightboxOpen"
      fullscreen
      :close="false"
      :ui="{
        body: 'p-0 flex flex-col flex-1 min-h-0 bg-slate-950 sm:max-w-none',
        content: 'max-w-none w-full h-[100dvh] flex flex-col rounded-none border-0 shadow-none bg-slate-950'
      }"
    >
      <template #body="{ close }">
        <DialogTitle class="sr-only">
          {{ lightboxAlt }}
        </DialogTitle>
        <div class="flex min-h-0 flex-1 flex-col bg-slate-950">
          <div
            class="flex shrink-0 items-center gap-3 border-white/10 border-b bg-slate-950 px-4 py-3"
          >
            <p class="min-w-0 flex-1 text-sm text-slate-200 leading-snug">
              {{ lightboxCaption }}
            </p>
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-x"
              class="shrink-0 text-white"
              aria-label="Close enlarged image"
              @click="close"
            />
          </div>
          <div
            class="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4 md:p-8"
          >
            <img
              v-if="lightboxSrc"
              :src="lightboxSrc"
              alt=""
              class="h-auto w-auto max-h-[min(calc(100dvh-8rem),100%)] max-w-full object-contain"
              decoding="async"
            >
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
