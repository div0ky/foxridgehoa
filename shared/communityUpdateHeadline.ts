/** First non-empty line, heading markers stripped. */
export function communityUpdateHeadlineText(markdown: string, maxChars = 88): string | null {
  const line = markdown.split('\n').find(l => l.trim()) ?? ''
  const stripped = line.replace(/^#+\s*/, '').trim()
  return stripped.slice(0, maxChars).trim() || null
}

export function communityUpdateHeadline(markdown: string, maxChars = 88): string {
  return communityUpdateHeadlineText(markdown, maxChars) ?? 'Community update'
}
