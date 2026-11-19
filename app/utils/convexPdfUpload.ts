/** Mirrors MAX_PDF_BYTES in convex/importantDocuments.ts. */
export const MAX_PDF_BYTES = 20 * 1024 * 1024

/** Check size and signature before upload. Browsers may report a generic MIME type for PDFs. */
export async function assertPdfFile(file: File): Promise<void> {
  if (file.size > MAX_PDF_BYTES)
    throw new Error(`"${file.name}" exceeds the 20 MB limit.`)

  const header = await file.slice(0, 5).text()
  if (header !== '%PDF-')
    throw new Error(`"${file.name}" is not a valid PDF.`)
}

/** POST a PDF to a Convex `generateUploadUrl` URL; returns `storageId`. */
export async function postPdfToConvexUploadUrl(uploadUrl: string, file: File): Promise<string> {
  const result = await fetch(uploadUrl, {
    body: file,
    headers: { 'Content-Type': 'application/pdf' },
    method: 'POST'
  })

  if (!result.ok)
    throw new Error(`Upload failed (${result.status}).`)

  const json = (await result.json()) as { storageId?: string }
  if (!json.storageId)
    throw new Error('Upload response missing storageId.')

  return json.storageId
}
