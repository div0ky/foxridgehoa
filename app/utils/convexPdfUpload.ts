/** POST a PDF to a Convex `generateUploadUrl` URL; returns `storageId`. */
export async function postPdfToConvexUploadUrl(uploadUrl: string, file: File): Promise<string> {
  const contentType = file.type === 'application/pdf' ? file.type : 'application/pdf'

  const result = await fetch(uploadUrl, {
    body: file,
    headers: { 'Content-Type': contentType },
    method: 'POST'
  })

  if (!result.ok)
    throw new Error(`Upload failed (${result.status}).`)

  const json = (await result.json()) as { storageId?: string }
  if (!json.storageId)
    throw new Error('Upload response missing storageId.')

  return json.storageId
}
