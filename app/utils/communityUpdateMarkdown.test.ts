import { Comark } from '@comark/vue'
import { renderToString } from '@vue/server-renderer'
import { expect, test } from 'vitest'
import { createSSRApp, h } from 'vue'

import { communityUpdateMarkdownOptions } from './communityUpdateMarkdown'

async function renderCommunityMarkdown(markdown: string): Promise<string> {
  const app = createSSRApp(() =>
    h(Comark, {
      markdown,
      options: communityUpdateMarkdownOptions
    })
  )

  return await renderToString(app)
}

test('community update markdown renders ordinary markdown', async () => {
  const html = await renderCommunityMarkdown('## Pool update\n\n**Open Saturday.**')

  expect(html).toContain('<h2')
  expect(html).toContain('<strong>Open Saturday.</strong>')
})

test('community update markdown escapes raw HTML', async () => {
  const html = await renderCommunityMarkdown([
    '<script src="https://example.invalid/payload.js"></script>',
    '<iframe src="https://example.invalid"></iframe>',
    '<img src="x" onerror="alert(1)">'
  ].join('\n\n'))

  expect(html).not.toContain('<script')
  expect(html).not.toContain('<iframe')
  expect(html).not.toContain('<img')
  expect(html).toContain('&lt;script')
})

test('community update markdown rejects executable link schemes', async () => {
  const html = await renderCommunityMarkdown('[Open](javascript:alert(1))')

  expect(html).not.toContain('<a')
  expect(html).not.toContain('href=')
})
