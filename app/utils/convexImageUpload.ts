/** POST an image to a Convex generateUpload URL; returns storageId. */
export async function postImageToConvexUploadUrl(uploadUrl: string, file: File): Promise<string> {
  const contentType
    = file.type && file.type.startsWith('image/') ? file.type : 'application/octet-stream'

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
