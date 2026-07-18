/**
 * Returns a safe in-app path for post-login navigation. Rejects protocol-relative
 * and external URLs to avoid open redirects.
 */
export function safeInternalPath(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string' || raw.length === 0)
    return fallback

  if (
    !raw.startsWith('/')
    || raw.startsWith('//')
    || raw.includes('\\')
    || [...raw].some((character) => {
      const characterCode = character.charCodeAt(0)
      return characterCode <= 31 || characterCode === 127
    })
  ) {
    return fallback
  }

  return raw
}
