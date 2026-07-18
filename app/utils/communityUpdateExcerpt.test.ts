import { describe, expect, test } from 'vitest'

import {
  communityUpdatePlainText,
  getCommunityUpdateCanonicalUrl,
  getCommunityUpdateDetailPostedAt,
  getCommunityUpdatePostedAtLabel,
  getCommunityUpdateSeoDescription,
  getCommunityUpdateSeoTitle,
  getCommunityUpdateTimelinePostedAt
} from './communityUpdateExcerpt'

describe('community update SEO helpers', () => {
  test('uses the first markdown heading as the SEO title', () => {
    expect(
      getCommunityUpdateSeoTitle({
        bodyMarkdown: '# Pool keys available Saturday\n\nBring proof of residency.'
      })
    ).toBe('Pool keys available Saturday')
  })

  test('strips common markdown from preview text', () => {
    expect(
      communityUpdatePlainText(`
## Meeting reminder

Please review [the agenda](https://example.com) before **Thursday**.

![pool gate](https://example.com/pool.jpg)

- Bring questions
      `)
    ).toBe('Meeting reminder Please review the agenda before Thursday. pool gate Bring questions')
  })

  test('builds bounded descriptions from body text without repeating the headline', () => {
    expect(
      getCommunityUpdateSeoDescription({
        authorDisplayName: 'Fox Ridge Board',
        bodyMarkdown: '# Pool keys\n\nPool key pickup starts Saturday morning at the clubhouse.',
        maxChars: 40
      })
    ).toBe('Pool key pickup starts Saturday morning...')
  })

  test('builds bounded plain descriptions when there is no heading line', () => {
    expect(
      getCommunityUpdateSeoDescription({
        authorDisplayName: 'Fox Ridge Board',
        bodyMarkdown: 'Pool key pickup starts Saturday morning at the clubhouse.',
        maxChars: 40
      })
    ).toBe('Pool key pickup starts Saturday morning...')
  })

  test('drops a leading plain-text repeat of the headline before truncating', () => {
    expect(
      getCommunityUpdateSeoDescription({
        authorDisplayName: 'Aaron Spurlock',
        bodyMarkdown:
          '# Playground Updates / Fence Cleaning\n\nPlayground Updates / Fence Cleaning At this time, the playground is fine.',
        maxChars: 80
      })
    ).toBe('At this time, the playground is fine.')
  })

  test('falls back when markdown has no readable text', () => {
    expect(
      getCommunityUpdateSeoDescription({
        authorDisplayName: 'Fox Ridge HOA',
        bodyMarkdown: '   '
      })
    ).toBe('News and reminders from the Fox Ridge HOA board.')
  })

  test('builds canonical update URLs without duplicate slashes', () => {
    expect(
      getCommunityUpdateCanonicalUrl({
        siteUrl: 'https://thefoxridgehoa.org/',
        updateId: 'abc123'
      })
    ).toBe('https://thefoxridgehoa.org/updates/abc123')
  })

  test('formats posted date for social cards', () => {
    expect(
      getCommunityUpdatePostedAtLabel({
        postedAt: Date.UTC(2026, 3, 27, 18, 30)
      })
    ).toBe('Apr 27, 2026')
  })

  test('formats public timestamps in the HOA time zone', () => {
    const postedAt = Date.UTC(2026, 0, 1, 2, 30)

    expect(getCommunityUpdatePostedAtLabel({ postedAt })).toBe('Dec 31, 2025')
    expect(getCommunityUpdateDetailPostedAt({ postedAt })).toBe('8:30 PM · Dec 31, 2025')
    expect(getCommunityUpdateTimelinePostedAt({ postedAt })).toBe('December 31, 2025 at 8:30 PM')
  })
})
