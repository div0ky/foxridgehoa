/** Plain-ish excerpt for teaser cards — avoids half-rendered Markdown. */
export function communityUpdateMarkdownExcerpt(markdown: string, maxChars = 160): string {
  const condensed = markdown.replace(/\s+/g, ' ').trim()
  if (condensed.length <= maxChars)
    return condensed

  return `${condensed.slice(0, maxChars)}…`
}

/** First non-empty line, heading markers stripped — for card titles. */
export function communityUpdateHeadline(markdown: string, maxChars = 88): string {
  const line = markdown.split('\n').find(l => l.trim()) ?? ''
  const stripped = line.replace(/^#+\s*/, '').trim()
  const head = stripped.slice(0, maxChars).trim()
  return head.length > 0 ? head : 'Community update'
}
