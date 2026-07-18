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

const DEFAULT_SEO_DESCRIPTION = 'News and reminders from the Fox Ridge HOA board.'
const DEFAULT_SEO_TITLE = 'Community update'
const COMMUNITY_UPDATE_TIME_ZONE = 'America/Chicago'

function truncatePreviewText(text: string, maxChars: number): string {
  if (text.length <= maxChars)
    return text

  const clipped = text.slice(0, maxChars + 1)
  const wordBoundary = clipped.lastIndexOf(' ')
  const safeClip = wordBoundary > Math.floor(maxChars * 0.6)
    ? clipped.slice(0, wordBoundary)
    : clipped.slice(0, maxChars)

  return `${safeClip.trimEnd()}...`
}

/** First-line title from markdown, or `null` when there is no real heading line. */
function communityUpdateHeadlineForDedup(markdown: string, maxChars = 88): string | null {
  const line = markdown.split('\n').find(l => l.trim()) ?? ''
  const stripped = line.replace(/^#+\s*/, '').trim()
  const head = stripped.slice(0, maxChars).trim()
  return head.length > 0 ? head : null
}

function stripLeadingDuplicateHeadline(plainText: string, headline: string): string {
  const escaped = headline.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`^${escaped}\\s*[:,—–-]?\\s*`, 'i')
  let result = plainText.trim()
  while (pattern.test(result))
    result = result.replace(pattern, '').trim()

  return result
}

export function communityUpdatePlainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1 ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[\s>]*[-*+]\s+/gm, '')
    .replace(/^[\s>]*\d+\.\s+/gm, '')
    .replace(/^[\s>]+/gm, '')
    .replace(/[*_~]/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function getCommunityUpdateSeoTitle(
  { bodyMarkdown, maxChars = 72 }: { bodyMarkdown: string, maxChars?: number }
): string {
  const title = communityUpdateHeadline(bodyMarkdown, maxChars)
  return title.length > 0 ? title : DEFAULT_SEO_TITLE
}

export function getCommunityUpdateSeoDescription(
  args: {
    authorDisplayName: string
    bodyMarkdown: string
    maxChars?: number
  }
): string {
  const { bodyMarkdown, maxChars = 180 } = args
  const plainText = communityUpdatePlainText(bodyMarkdown)
  const headline = communityUpdateHeadlineForDedup(bodyMarkdown)
  const withoutDuplicateTitle = headline
    ? stripLeadingDuplicateHeadline(plainText, headline)
    : plainText
  const preview = withoutDuplicateTitle.length > 0
    ? withoutDuplicateTitle
    : (plainText.length > 0 ? plainText : DEFAULT_SEO_DESCRIPTION)
  return truncatePreviewText(preview, maxChars)
}

export function getCommunityUpdateCanonicalUrl(
  { siteUrl, updateId }: { siteUrl: string, updateId: string }
): string {
  return `${siteUrl.replace(/\/+$/, '')}/updates/${updateId}`
}

export function getCommunityUpdatePostedAtLabel(
  { postedAt }: { postedAt: number }
): string {
  return new Date(postedAt).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    timeZone: COMMUNITY_UPDATE_TIME_ZONE,
    year: 'numeric'
  })
}

export function getCommunityUpdateDetailPostedAt(
  { postedAt }: { postedAt: number }
): string {
  const postDate = new Date(postedAt)
  const time = postDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: COMMUNITY_UPDATE_TIME_ZONE
  })
  const date = postDate.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    timeZone: COMMUNITY_UPDATE_TIME_ZONE,
    year: 'numeric'
  })

  return `${time} · ${date}`
}

export function getCommunityUpdateTimelinePostedAt(
  { postedAt }: { postedAt: number }
): string {
  return new Date(postedAt).toLocaleDateString('en-US', {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'long',
    timeZone: COMMUNITY_UPDATE_TIME_ZONE,
    year: 'numeric'
  })
}

/** Accessible alt text for attachment strips (headline + position). */
export function getCommunityUpdateAttachmentAlt(
  bodyMarkdown: string,
  imageIndex: number,
  imageCount: number
): string {
  const topic = communityUpdateHeadline(bodyMarkdown, 88)
  const label = topic.length > 0 ? topic : 'Community update'
  if (imageCount <= 1)
    return `Image, ${label}`

  return `Image ${imageIndex + 1} of ${imageCount}, ${label}`
}
