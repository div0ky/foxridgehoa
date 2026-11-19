import MarkdownIt from 'markdown-it'

const markdownRenderer = new MarkdownIt({ html: false, linkify: true })

// Published Comark permalinks include inline tag names, parent sections and duplicate suffixes.
markdownRenderer.core.ruler.push('published_heading_ids', ({ tokens }) => {
  const sections: { level: number, slug: string }[] = []
  const occurrences = new Map<string, number>()

  for (const [index, token] of tokens.entries()) {
    if (token.type !== 'heading_open')
      continue

    const children = tokens[index + 1]?.children ?? []
    const text = children.map((child) => {
      if (child.nesting === 1 || child.type === 'image' || child.type === 'code_inline')
        return ` ${child.tag} ${child.type === 'code_inline' ? child.content : ''}`
      return child.type === 'text' ? child.content : ''
    }).join('')
    const level = Number(token.tag.slice(1))
    while (sections.length && sections.at(-1)!.level >= level)
      sections.pop()

    const parent = sections.at(-1)
    let slug = text.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')
      .replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '').replace(/^(?=\d)/, '_')
    if (parent && parent.level >= 2)
      slug = `${parent.slug}-${slug}`

    sections.push({ level, slug })
    const count = occurrences.get(slug) ?? 0
    occurrences.set(slug, count + 1)
    token.attrSet('id', count ? `${slug}-${count}` : slug)
  }
})

export function renderCommunityUpdateMarkdown(markdown: string): string {
  return markdownRenderer.render(markdown)
}
