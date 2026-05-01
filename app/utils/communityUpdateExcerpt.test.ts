import { describe, expect, test } from 'vitest'

import {
  communityUpdatePlainText,
  getCommunityUpdateCanonicalUrl,
  getCommunityUpdatePostedAtLabel,
  getCommunityUpdateSeoDescription,
  getCommunityUpdateSeoTitle
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

  test('builds bounded descriptions with author context', () => {
    expect(
      getCommunityUpdateSeoDescription({
        authorDisplayName: 'Fox Ridge Board',
        bodyMarkdown: 'Pool key pickup starts Saturday morning at the clubhouse.',
        maxChars: 64
      })
    ).toBe('Update from Fox Ridge Board: Pool key pickup starts Saturday...')
  })

  test('falls back when markdown has no readable text', () => {
    expect(
      getCommunityUpdateSeoDescription({
        authorDisplayName: 'Fox Ridge HOA',
        bodyMarkdown: '   '
      })
    ).toBe('Update from Fox Ridge HOA: News and reminders from the Fox Ridge HOA board.')
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
})
