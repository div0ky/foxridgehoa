import { expect, test } from 'vitest'

import { renderCommunityUpdateMarkdown } from './communityUpdateMarkdown'

test('renders community update formatting', () => {
  const html = renderCommunityUpdateMarkdown([
    '# Pool update',
    '## Hours',
    '**Open Saturday** from *noon*.',
    '- Bring your pass',
    '3. Sign in',
    '> Enter at the east gate.',
    '[Pool rules][rules] or https://example.org/pool',
    '[rules]: /documents/pool',
    '![East gate](/gate.jpg)',
    '```text\n12:00–18:00\n```',
    '| Day | Hours |\n| --- | --- |\n| Saturday | 12–6 |'
  ].join('\n\n'))

  expect(html).toContain('<h1 id="pool-update">Pool update</h1>')
  expect(html).toContain('<h2 id="hours">Hours</h2>')
  expect(html).toContain('<p><strong>Open Saturday</strong> from <em>noon</em>.</p>')
  expect(html).toContain('<ul>\n<li>Bring your pass</li>')
  expect(html).toContain('<ol start="3">\n<li>Sign in</li>')
  expect(html).toContain('<blockquote>\n<p>Enter at the east gate.</p>')
  expect(html).toContain('<a href="/documents/pool">Pool rules</a>')
  expect(html).toContain('<a href="https://example.org/pool">https://example.org/pool</a>')
  expect(html).toContain('<img src="/gate.jpg" alt="East gate">')
  expect(html).toContain('<pre><code class="language-text">12:00–18:00\n</code></pre>')
  expect(html).toContain('<table>')
  expect(html).toContain('<th>Hours</th>')
  expect(html).toContain('<td>12–6</td>')
})

test('keeps raw HTML and component and attribute markup as text', () => {
  const html = renderCommunityUpdateMarkdown([
    '<section class="notice">Pool hours</section>',
    '::notice{title="Hours"}\nOpen Saturday\n::',
    '# Pool rules {#pool-rules}',
    '[Read more](/pool){.notice}'
  ].join('\n\n'))

  expect(html).toContain('&lt;section class=&quot;notice&quot;&gt;Pool hours&lt;/section&gt;')
  expect(html).toContain('::notice{title=&quot;Hours&quot;}')
  expect(html).toContain('<h1 id="pool-rules-pool-rules">Pool rules {#pool-rules}</h1>')
  expect(html).toContain('<a href="/pool">Read more</a>{.notice}')
})

test('does not turn blocked link and image protocols into destinations', () => {
  const html = renderCommunityUpdateMarkdown([
    '[Link](javascript:blocked)',
    '[File](file:///example.txt)',
    '![Image](data:text/plain,blocked)'
  ].join('\n\n'))

  expect(html).not.toContain('href=')
  expect(html).not.toContain('src=')
})

test('preserves published fragment links across nested and repeated headings', () => {
  const html = renderCommunityUpdateMarkdown([
    '[Rules](#pool-rules)', '## Pool rules', '### 2. **Guests**', '## Pool rules'
  ].join('\n\n'))
  expect(html).toContain('href="#pool-rules"')
  expect(html).toContain('id="pool-rules"')
  expect(html).toContain('id="pool-rules-_2-strong-guests"')
  expect(html).toContain('id="pool-rules-1"')
})
