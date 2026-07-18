import type { Id } from './_generated/dataModel'

import { ConvexError, v } from 'convex/values'

import { mutation, query } from './_generated/server'
import { requireBoardMember } from './authz/requireBoardMember'

const MAX_FILES_PER_DOCUMENT = 10
const MAX_DOCUMENTS = 100
const MAX_TITLE_CHARS = 160
const MAX_DESCRIPTION_CHARS = 2_000
const MAX_FILE_LABEL_CHARS = 160
/** Convex storage single-file size guidance — stay below platform limits. */
const MAX_PDF_BYTES = 20 * 1024 * 1024

const fileEntryValidator = v.object({
  label: v.string(),
  storageId: v.id('_storage')
})

type StorageMeta = {
  _creationTime: number
  _id: Id<'_storage'>
  contentType?: string
  sha256: string
  size: number
}

async function assertPdfStorage(
  ctx: { db: { system: { get: (table: '_storage', id: Id<'_storage'>) => Promise<StorageMeta | null> } } },
  storageId: Id<'_storage'>
): Promise<void> {
  const meta: StorageMeta | null = await ctx.db.system.get('_storage', storageId)
  if (!meta)
    throw new ConvexError('Uploaded file not found. Try uploading again.')

  if (meta.contentType !== 'application/pdf')
    throw new ConvexError('Only PDF files are allowed.')

  if (meta.size > MAX_PDF_BYTES)
    throw new ConvexError('PDF exceeds maximum size (20 MB).')
}

function assertFilesLength(count: number): void {
  if (count < 1)
    throw new ConvexError('Add at least one PDF.')

  if (count > MAX_FILES_PER_DOCUMENT)
    throw new ConvexError(`At most ${MAX_FILES_PER_DOCUMENT} PDFs per document.`)
}

function assertTextLength(value: string, maximum: number, fieldName: string): void {
  if (value.length > maximum)
    throw new ConvexError(`${fieldName} must be at most ${maximum} characters.`)
}

function assertUniqueFileStorageIds(
  files: Array<{ storageId: Id<'_storage'> }>
): void {
  const storageIds = files.map(file => file.storageId)
  if (new Set(storageIds).size !== storageIds.length)
    throw new ConvexError('The same PDF cannot be attached more than once.')
}

export const listImportantDocumentsPublic = query({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db
      .query('importantDocuments')
      .withIndex('by_sortOrder')
      .take(MAX_DOCUMENTS)

    const documents = await Promise.all(
      docs.map(async (doc) => {
        const files = await Promise.all(
          doc.files.map(async file => ({
            downloadUrl: await ctx.storage.getUrl(file.storageId),
            label: file.label
          }))
        )

        return {
          description: doc.description,
          files,
          icon: doc.icon,
          id: doc._id,
          title: doc.title
        }
      })
    )

    return { data: { documents }, ok: true as const }
  }
})

export const listImportantDocumentsAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireBoardMember(ctx)

    const docs = await ctx.db
      .query('importantDocuments')
      .withIndex('by_sortOrder')
      .take(MAX_DOCUMENTS)

    return {
      data: {
        documents: docs.map(doc => ({
          description: doc.description,
          files: doc.files,
          icon: doc.icon,
          id: doc._id,
          sortOrder: doc.sortOrder,
          title: doc.title
        }))
      },
      ok: true as const
    }
  }
})

export const generateImportantDocumentUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireBoardMember(ctx)
    return await ctx.storage.generateUploadUrl()
  }
})

export const createImportantDocument = mutation({
  args: {
    description: v.string(),
    files: v.array(fileEntryValidator),
    icon: v.optional(v.string()),
    title: v.string()
  },
  handler: async (ctx, args) => {
    await requireBoardMember(ctx)

    assertFilesLength(args.files.length)
    assertUniqueFileStorageIds(args.files)

    const trimmedTitle = args.title.trim()
    const trimmedDescription = args.description.trim()
    if (!trimmedTitle || !trimmedDescription)
      throw new ConvexError('Title and description are required.')
    assertTextLength(trimmedTitle, MAX_TITLE_CHARS, 'Title')
    assertTextLength(trimmedDescription, MAX_DESCRIPTION_CHARS, 'Description')

    for (const file of args.files) {
      const label = file.label.trim()
      if (!label)
        throw new ConvexError('Each PDF needs a label.')
      assertTextLength(label, MAX_FILE_LABEL_CHARS, 'PDF label')

      await assertPdfStorage(ctx, file.storageId)
    }

    const existing = await ctx.db.query('importantDocuments').take(MAX_DOCUMENTS)
    if (existing.length >= MAX_DOCUMENTS)
      throw new ConvexError(`At most ${MAX_DOCUMENTS} important documents are allowed.`)
    const maxOrder = existing.reduce((max, d) => Math.max(max, d.sortOrder), -1)

    const files = args.files.map(file => ({
      label: file.label.trim(),
      storageId: file.storageId
    }))

    const id = await ctx.db.insert('importantDocuments', {
      description: trimmedDescription,
      files,
      icon: args.icon?.trim() || undefined,
      sortOrder: maxOrder + 1,
      title: trimmedTitle
    })

    return { data: { documentId: id }, ok: true as const }
  }
})

export const updateImportantDocumentMeta = mutation({
  args: {
    description: v.optional(v.string()),
    documentId: v.id('importantDocuments'),
    icon: v.optional(v.union(v.string(), v.null())),
    title: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    await requireBoardMember(ctx)

    const doc = await ctx.db.get(args.documentId)
    if (!doc)
      throw new ConvexError('Document not found.')

    const patch: Partial<typeof doc> = {}

    if (args.title !== undefined) {
      const t = args.title.trim()
      if (!t)
        throw new ConvexError('Title cannot be empty.')
      assertTextLength(t, MAX_TITLE_CHARS, 'Title')
      patch.title = t
    }

    if (args.description !== undefined) {
      const d = args.description.trim()
      if (!d)
        throw new ConvexError('Description cannot be empty.')
      assertTextLength(d, MAX_DESCRIPTION_CHARS, 'Description')
      patch.description = d
    }

    if (args.icon !== undefined)
      patch.icon = args.icon === null ? undefined : args.icon.trim() || undefined

    await ctx.db.patch(args.documentId, patch)

    return { ok: true as const }
  }
})

export const appendFilesToImportantDocument = mutation({
  args: {
    documentId: v.id('importantDocuments'),
    files: v.array(fileEntryValidator)
  },
  handler: async (ctx, args) => {
    await requireBoardMember(ctx)

    const doc = await ctx.db.get(args.documentId)
    if (!doc)
      throw new ConvexError('Document not found.')

    if (args.files.length === 0)
      throw new ConvexError('Add at least one PDF.')

    assertFilesLength(doc.files.length + args.files.length)
    assertUniqueFileStorageIds([...doc.files, ...args.files])

    for (const file of args.files) {
      const label = file.label.trim()
      if (!label)
        throw new ConvexError('Each PDF needs a label.')
      assertTextLength(label, MAX_FILE_LABEL_CHARS, 'PDF label')

      await assertPdfStorage(ctx, file.storageId)
    }

    const newFiles = args.files.map(file => ({
      label: file.label.trim(),
      storageId: file.storageId
    }))

    await ctx.db.patch(args.documentId, {
      files: [...doc.files, ...newFiles]
    })

    return { ok: true as const }
  }
})

export const removeFileFromImportantDocument = mutation({
  args: {
    documentId: v.id('importantDocuments'),
    storageId: v.id('_storage')
  },
  handler: async (ctx, args) => {
    await requireBoardMember(ctx)

    const doc = await ctx.db.get(args.documentId)
    if (!doc)
      throw new ConvexError('Document not found.')

    const remaining = doc.files.filter(f => f.storageId !== args.storageId)
    if (remaining.length === doc.files.length)
      throw new ConvexError('That file is not part of this document.')

    if (remaining.length === 0)
      throw new ConvexError('Cannot remove the last PDF. Delete the whole document instead.')

    await ctx.db.patch(args.documentId, { files: remaining })
    await ctx.storage.delete(args.storageId)

    return { ok: true as const }
  }
})

export const replaceFileOnImportantDocument = mutation({
  args: {
    documentId: v.id('importantDocuments'),
    newStorageId: v.id('_storage'),
    oldStorageId: v.id('_storage')
  },
  handler: async (ctx, args) => {
    await requireBoardMember(ctx)

    const doc = await ctx.db.get(args.documentId)
    if (!doc)
      throw new ConvexError('Document not found.')

    const idx = doc.files.findIndex(f => f.storageId === args.oldStorageId)
    if (idx === -1)
      throw new ConvexError('That file is not part of this document.')

    if (args.newStorageId === args.oldStorageId)
      return { ok: true as const }

    if (doc.files.some(file => file.storageId === args.newStorageId))
      throw new ConvexError('The replacement PDF is already attached to this document.')

    await assertPdfStorage(ctx, args.newStorageId)

    const prev = doc.files[idx]!
    const nextFiles = [...doc.files]
    nextFiles[idx] = {
      label: prev.label,
      storageId: args.newStorageId
    }

    await ctx.db.patch(args.documentId, { files: nextFiles })
    await ctx.storage.delete(args.oldStorageId)

    return { ok: true as const }
  }
})

export const deleteImportantDocument = mutation({
  args: {
    documentId: v.id('importantDocuments')
  },
  handler: async (ctx, args) => {
    await requireBoardMember(ctx)

    const doc = await ctx.db.get(args.documentId)
    if (!doc)
      throw new ConvexError('Document not found.')

    for (const file of doc.files)
      await ctx.storage.delete(file.storageId)

    await ctx.db.delete(args.documentId)

    return { ok: true as const }
  }
})

export const reorderImportantDocuments = mutation({
  args: {
    orderedDocumentIds: v.array(v.id('importantDocuments'))
  },
  handler: async (ctx, args) => {
    await requireBoardMember(ctx)

    if (args.orderedDocumentIds.length === 0)
      throw new ConvexError('Nothing to reorder.')

    const unique = new Set(args.orderedDocumentIds)
    if (unique.size !== args.orderedDocumentIds.length)
      throw new ConvexError('Duplicate entries in order.')

    const all = await ctx.db.query('importantDocuments').take(MAX_DOCUMENTS + 1)
    if (all.length > MAX_DOCUMENTS)
      throw new ConvexError('Too many documents to reorder safely.')
    if (args.orderedDocumentIds.length !== all.length)
      throw new ConvexError('Order must include every document.')

    const idSet = new Set(all.map(d => d._id))
    for (const id of args.orderedDocumentIds) {
      if (!idSet.has(id))
        throw new ConvexError('Invalid document id in order.')
    }

    for (let i = 0; i < args.orderedDocumentIds.length; i++) {
      const docId = args.orderedDocumentIds[i]
      if (docId === undefined)
        continue

      await ctx.db.patch(docId, { sortOrder: i })
    }

    return { ok: true as const }
  }
})
