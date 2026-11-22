export const MAX_PDF_BYTES = 20 * 1024 * 1024

/** Validates a selected file is a non-empty PDF within the 20 MB limit before uploading. */
export async function validatePdfFile(file: File): Promise<null | string> {
  if (file.size === 0)
    return `${file.name} is empty.`

  if (file.size > MAX_PDF_BYTES)
    return `${file.name} exceeds the 20 MB PDF limit.`

  const hasPdfTypeOrExt = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  if (!hasPdfTypeOrExt)
    return `${file.name} is not a PDF file.`

  const headerBytes = new Uint8Array(await file.slice(0, 5).arrayBuffer())
  const header = String.fromCharCode(...headerBytes)
  if (header !== '%PDF-')
    return `${file.name} is not a valid PDF document.`

  return null
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
