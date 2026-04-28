<script setup lang="ts">
import type { Id } from '~~/convex/_generated/dataModel'

import { computed, reactive, ref, watch } from 'vue'
import { api } from '~~/convex/_generated/api'

import {
  defaultImportantDocumentIcon,
  importantDocumentIconOptions,
  type ImportantDocumentCardIcon
} from '~/config/important-document-icons'
import { postPdfToConvexUploadUrl } from '~/utils/convexPdfUpload'

definePageMeta({
  convexAuth: true,
  layout: 'admin-dashboard'
})

defineOptions({ name: 'AdminImportantDocumentsPage' })

const toast = useToast()

const profileState = await useConvexQuery(api.operatorProfiles.getMyOperatorProfile, {})

const profile = computed(() => profileState.data.value?.data.profile)
const loadingProfile = computed(() => profileState.status.value === 'pending')
const isBoardMember = computed(() => profile.value?.role === 'boardMember')

const adminListState = await useConvexQuery(
  api.importantDocuments.listImportantDocumentsAdmin,
  {},
  { enabled: computed(() => isBoardMember.value) }
)

const documents = computed(() => adminListState.data.value?.data.documents ?? [])

const loadingDocuments = computed(() => {
  if (!isBoardMember.value)
    return false

  return adminListState.status.value === 'pending'
})

const generateUploadUrl = useConvexMutation(api.importantDocuments.generateImportantDocumentUploadUrl)
const createDocument = useConvexMutation(api.importantDocuments.createImportantDocument)
const updateMeta = useConvexMutation(api.importantDocuments.updateImportantDocumentMeta)
const appendFiles = useConvexMutation(api.importantDocuments.appendFilesToImportantDocument)
const removeFile = useConvexMutation(api.importantDocuments.removeFileFromImportantDocument)
const replaceFile = useConvexMutation(api.importantDocuments.replaceFileOnImportantDocument)
const deleteDocument = useConvexMutation(api.importantDocuments.deleteImportantDocument)
const reorderDocuments = useConvexMutation(api.importantDocuments.reorderImportantDocuments)

/** Create form */
const createTitle = ref('')
const createDescription = ref('')
const createIcon = ref<ImportantDocumentCardIcon>(defaultImportantDocumentIcon)

interface PdfRow {
  label: string
  file: File | null
}

const createRows = ref<PdfRow[]>([{ file: null, label: '' }])

function addCreatePdfRow() {
  createRows.value.push({ file: null, label: '' })
}

function removeCreatePdfRow(index: number) {
  if (createRows.value.length <= 1)
    return

  createRows.value.splice(index, 1)
}

const creating = ref(false)

async function submitCreate() {
  const title = createTitle.value.trim()
  const description = createDescription.value.trim()
  if (!title || !description) {
    toast.add({
      color: 'warning',
      description: 'Enter a title and description.',
      title: 'Missing fields'
    })
    return
  }

  const rows = createRows.value.filter(r => r.file && r.label.trim())
  if (createRows.value.some(r => (r.label.trim() && !r.file) || (!r.label.trim() && r.file))) {
    toast.add({
      color: 'warning',
      description: 'Each PDF needs both a label and a chosen file.',
      title: 'Incomplete uploads'
    })
    return
  }

  if (rows.length === 0) {
    toast.add({
      color: 'warning',
      description: 'Add at least one PDF.',
      title: 'No files'
    })
    return
  }

  creating.value = true
  try {
    const uploaded: { label: string, storageId: Id<'_storage'> }[] = []
    for (const row of rows) {
      const uploadUrl = await generateUploadUrl.execute({}) as string
      const storageId = await postPdfToConvexUploadUrl(uploadUrl, row.file!)
      uploaded.push({ label: row.label.trim(), storageId: storageId as Id<'_storage'> })
    }

    await createDocument.execute({
      description,
      files: uploaded,
      icon: createIcon.value || undefined,
      title
    })

    toast.add({
      color: 'success',
      description: 'The landing page will show this document.',
      title: 'Document published'
    })

    createTitle.value = ''
    createDescription.value = ''
    createIcon.value = defaultImportantDocumentIcon
    createRows.value = [{ file: null, label: '' }]
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not create document.'
    toast.add({
      color: 'error',
      description: message,
      title: 'Create failed'
    })
  } finally {
    creating.value = false
  }
}

/** Edit meta */
const editingMetaId = ref<Id<'importantDocuments'> | null>(null)
const editTitle = ref('')
const editDescription = ref('')
const editIcon = ref<ImportantDocumentCardIcon>(defaultImportantDocumentIcon)
const savingMeta = ref(false)

function startEditMeta(doc: { description: string, icon?: string, id: Id<'importantDocuments'>, title: string }) {
  editingMetaId.value = doc.id
  editTitle.value = doc.title
  editDescription.value = doc.description
  editIcon.value = (doc.icon as ImportantDocumentCardIcon | undefined) ?? defaultImportantDocumentIcon
}

function cancelEditMeta() {
  editingMetaId.value = null
}

async function saveEditMeta(documentId: Id<'importantDocuments'>) {
  savingMeta.value = true
  try {
    await updateMeta.execute({
      description: editDescription.value.trim(),
      documentId,
      icon: editIcon.value,
      title: editTitle.value.trim()
    })

    toast.add({ color: 'success', title: 'Saved changes' })
    editingMetaId.value = null
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Save failed.'
    toast.add({ color: 'error', description: message, title: 'Could not save' })
  } finally {
    savingMeta.value = false
  }
}

/** Append PDF (per document id) */
const appendDrafts = reactive<Record<string, { file: File | null, label: string }>>({})
const appendingForId = ref<string | null>(null)

watch(
  documents,
  (docs) => {
    for (const d of docs) {
      if (!appendDrafts[d.id])
        appendDrafts[d.id] = { file: null, label: '' }
    }
  },
  { immediate: true }
)

function setAppendFile(documentId: Id<'importantDocuments'>, event: Event) {
  const input = event.target as HTMLInputElement
  const draft = appendDrafts[documentId]
  if (!draft)
    return

  draft.file = input.files?.[0] ?? null
}

async function submitAppend(documentId: Id<'importantDocuments'>) {
  const draft = appendDrafts[documentId]
  if (!draft)
    return

  const label = draft.label.trim()
  if (!label || !draft.file) {
    toast.add({
      color: 'warning',
      description: 'Choose a label and a PDF file.',
      title: 'Incomplete'
    })
    return
  }

  appendingForId.value = documentId
  try {
    const uploadUrl = await generateUploadUrl.execute({}) as string
    const storageId = await postPdfToConvexUploadUrl(uploadUrl, draft.file)

    await appendFiles.execute({
      documentId,
      files: [{ label, storageId: storageId as Id<'_storage'> }]
    })

    toast.add({ color: 'success', title: 'PDF added' })
    draft.label = ''
    draft.file = null
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Append failed.'
    toast.add({ color: 'error', description: message, title: 'Could not add PDF' })
  } finally {
    appendingForId.value = null
  }
}

async function onRemoveFile(documentId: Id<'importantDocuments'>, storageId: Id<'_storage'>) {
  try {
    await removeFile.execute({
      documentId,
      storageId
    })

    toast.add({ color: 'success', title: 'PDF removed' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Remove failed.'
    toast.add({ color: 'error', description: message, title: 'Could not remove' })
  }
}

const replaceInputEl = ref<HTMLInputElement | null>(null)
const replaceJob = ref<{ documentId: Id<'importantDocuments'>, oldStorageId: Id<'_storage'> } | null>(null)

function openReplacePicker(documentId: Id<'importantDocuments'>, oldStorageId: Id<'_storage'>) {
  replaceJob.value = { documentId, oldStorageId }
  replaceInputEl.value?.click()
}

async function onReplaceFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  const job = replaceJob.value
  replaceJob.value = null
  if (!file || !job)
    return

  try {
    const uploadUrl = await generateUploadUrl.execute({}) as string
    const storageId = await postPdfToConvexUploadUrl(uploadUrl, file)

    await replaceFile.execute({
      documentId: job.documentId,
      newStorageId: storageId as Id<'_storage'>,
      oldStorageId: job.oldStorageId
    })

    toast.add({ color: 'success', title: 'PDF replaced' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Replace failed.'
    toast.add({ color: 'error', description: message, title: 'Could not replace' })
  }
}

async function onDeleteDocument(documentId: Id<'importantDocuments'>) {
  if (!confirm('Delete this document and all PDF files? This cannot be undone.'))
    return

  try {
    await deleteDocument.execute({ documentId })
    toast.add({ color: 'success', title: 'Document deleted' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Delete failed.'
    toast.add({ color: 'error', description: message, title: 'Could not delete' })
  }
}

async function moveDocument(documentId: Id<'importantDocuments'>, direction: -1 | 1) {
  const ids = documents.value.map((d: { id: Id<'importantDocuments'> }) => d.id)
  const idx = ids.indexOf(documentId)
  const swap = idx + direction
  if (swap < 0 || swap >= ids.length)
    return

  const next = [...ids]
  const temp = next[idx]!
  next[idx] = next[swap]!
  next[swap] = temp

  try {
    await reorderDocuments.execute({
      orderedDocumentIds: next
    })
    toast.add({ color: 'success', title: 'Order updated' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Reorder failed.'
    toast.add({ color: 'error', description: message, title: 'Could not reorder' })
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-8">
    <input
      ref="replaceInputEl"
      accept=".pdf,application/pdf"
      aria-hidden="true"
      class="hidden"
      tabindex="-1"
      type="file"
      @change="onReplaceFileSelected"
    >
    <UAlert
      v-if="!loadingProfile && !isBoardMember"
      color="warning"
      variant="soft"
      title="Restricted"
      description="Only board members can manage important documents."
      icon="i-lucide-lock"
    />

    <template v-if="loadingProfile || isBoardMember">
      <UCard>
        <template #header>
          <div>
            <h1 class="font-semibold text-highlighted">
              Important Documents
            </h1>
            <p class="mt-1 text-sm text-muted">
              Published PDFs appear on the home page under Important Documents.
            </p>
          </div>
        </template>

        <p
          v-if="loadingProfile || (isBoardMember && loadingDocuments)"
          class="text-sm text-muted"
          role="status"
          aria-live="polite"
        >
          Loading…
        </p>

        <div
          v-else-if="isBoardMember"
          class="space-y-10"
        >
          <!-- Create -->
          <section class="space-y-4">
            <h2 class="text-sm font-semibold text-highlighted">
              Add document
            </h2>
            <form
              class="space-y-4"
              novalidate
              @submit.prevent="submitCreate"
            >
              <UFormField
                label="Title"
                required
              >
                <UInput
                  v-model.trim="createTitle"
                  class="w-full"
                  maxlength="200"
                  placeholder="e.g. HOA indentures"
                  size="lg"
                />
              </UFormField>
              <UFormField
                label="Description"
                required
              >
                <UTextarea
                  v-model.trim="createDescription"
                  class="w-full min-h-[88px]"
                  maxlength="2000"
                  placeholder="Short text shown on the landing page card."
                  size="lg"
                />
              </UFormField>
              <UFormField label="Icon">
                <USelect
                  v-model="createIcon"
                  class="w-full"
                  :items="[...importantDocumentIconOptions]"
                  size="lg"
                  value-key="value"
                  label-key="label"
                />
              </UFormField>

              <div class="space-y-3">
                <p class="text-sm font-medium text-highlighted">
                  PDF files
                </p>
                <div
                  v-for="(row, index) in createRows"
                  :key="index"
                  class="flex flex-wrap items-end gap-3 rounded-lg border border-default p-3"
                >
                  <UFormField
                    label="Label"
                    class="min-w-[140px] flex-1"
                  >
                    <UInput
                      v-model.trim="row.label"
                      maxlength="120"
                      placeholder="e.g. Original filing"
                      size="md"
                    />
                  </UFormField>
                  <UFormField
                    label="PDF file"
                    class="min-w-[200px] flex-1"
                  >
                    <input
                      accept=".pdf,application/pdf"
                      class="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-elevated file:px-3 file:py-1.5"
                      type="file"
                      @change="(e) => {
                        const input = e.target as HTMLInputElement
                        row.file = input.files?.[0] ?? null
                      }"
                    >
                  </UFormField>
                  <UButton
                    v-if="createRows.length > 1"
                    color="neutral"
                    icon="i-lucide-trash-2"
                    size="sm"
                    variant="ghost"
                    @click="removeCreatePdfRow(index)"
                  />
                </div>
                <UButton
                  color="neutral"
                  icon="i-lucide-plus"
                  label="Add another PDF"
                  size="sm"
                  variant="outline"
                  @click="addCreatePdfRow"
                />
              </div>

              <div class="flex justify-end">
                <UButton
                  icon="i-lucide-upload"
                  label="Publish document"
                  type="submit"
                  trailing
                  :loading="creating"
                />
              </div>
            </form>
          </section>

          <!-- Existing -->
          <section
            v-if="documents.length > 0"
            class="space-y-6"
          >
            <h2 class="text-sm font-semibold text-highlighted">
              Published documents
            </h2>

            <UCard
              v-for="doc in documents"
              :key="doc.id"
              variant="outline"
            >
              <div class="flex flex-col gap-4">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 class="font-semibold text-highlighted">
                      {{ doc.title }}
                    </h3>
                    <p class="mt-1 text-sm text-muted">
                      {{ doc.description }}
                    </p>
                  </div>
                  <div class="flex flex-wrap gap-2">
                    <UButton
                      color="neutral"
                      icon="i-lucide-arrow-up"
                      size="xs"
                      variant="outline"
                      @click="moveDocument(doc.id, -1)"
                    />
                    <UButton
                      color="neutral"
                      icon="i-lucide-arrow-down"
                      size="xs"
                      variant="outline"
                      @click="moveDocument(doc.id, 1)"
                    />
                    <UButton
                      color="neutral"
                      icon="i-lucide-pencil"
                      size="xs"
                      variant="soft"
                      @click="startEditMeta(doc)"
                    />
                    <UButton
                      color="error"
                      icon="i-lucide-trash-2"
                      size="xs"
                      variant="ghost"
                      @click="onDeleteDocument(doc.id)"
                    />
                  </div>
                </div>

                <!-- Edit meta -->
                <div
                  v-if="editingMetaId === doc.id"
                  class="space-y-3 rounded-lg bg-elevated/40 p-4"
                >
                  <UFormField label="Title">
                    <UInput
                      v-model.trim="editTitle"
                      class="w-full"
                      maxlength="200"
                    />
                  </UFormField>
                  <UFormField label="Description">
                    <UTextarea
                      v-model.trim="editDescription"
                      class="w-full min-h-[80px]"
                      maxlength="2000"
                    />
                  </UFormField>
                  <UFormField label="Icon">
                    <USelect
                      v-model="editIcon"
                      class="w-full"
                      :items="[...importantDocumentIconOptions]"
                      value-key="value"
                      label-key="label"
                    />
                  </UFormField>
                  <div class="flex gap-2">
                    <UButton
                      label="Save"
                      :loading="savingMeta"
                      @click="saveEditMeta(doc.id)"
                    />
                    <UButton
                      color="neutral"
                      label="Cancel"
                      variant="ghost"
                      @click="cancelEditMeta"
                    />
                  </div>
                </div>

                <!-- Files -->
                <ul class="space-y-2 border-muted border-t pt-4">
                  <li
                    v-for="file in doc.files"
                    :key="file.storageId"
                    class="flex flex-wrap items-center justify-between gap-2 text-sm"
                  >
                    <span class="text-highlighted">{{ file.label }}</span>
                    <div class="flex gap-2">
                      <UButton
                        color="neutral"
                        label="Replace"
                        size="xs"
                        variant="outline"
                        @click="openReplacePicker(doc.id, file.storageId)"
                      />
                      <UButton
                        color="error"
                        icon="i-lucide-x"
                        size="xs"
                        variant="ghost"
                        @click="onRemoveFile(doc.id, file.storageId)"
                      />
                    </div>
                  </li>
                </ul>

                <!-- Append -->
                <div class="flex flex-wrap items-end gap-3 border-muted border-t pt-4">
                  <UFormField
                    label="Add PDF label"
                    class="min-w-[140px]"
                  >
                    <UInput
                      v-model.trim="appendDrafts[doc.id]!.label"
                      maxlength="120"
                      placeholder="Label"
                      size="sm"
                    />
                  </UFormField>
                  <UFormField label="File">
                    <input
                      accept=".pdf,application/pdf"
                      class="block text-sm"
                      type="file"
                      @change="setAppendFile(doc.id, $event)"
                    >
                  </UFormField>
                  <UButton
                    icon="i-lucide-plus"
                    label="Add PDF"
                    size="sm"
                    :loading="appendingForId === doc.id"
                    @click="submitAppend(doc.id)"
                  />
                </div>
              </div>
            </UCard>
          </section>
        </div>
      </UCard>
    </template>
  </div>
</template>
