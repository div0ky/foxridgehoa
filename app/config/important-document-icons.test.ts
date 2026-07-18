import { describe, expect, it } from 'vitest'

import {
  defaultImportantDocumentIcon,
  normalizeImportantDocumentIcon
} from './important-document-icons'

describe('normalizeImportantDocumentIcon', () => {
  it('keeps allowed Lucide icons', () => {
    expect(normalizeImportantDocumentIcon('lucide:scale')).toBe('lucide:scale')
  })

  it('maps persisted Heroicons to Lucide', () => {
    expect(normalizeImportantDocumentIcon('heroicons:document-text')).toBe('lucide:file-text')
  })

  it('falls back for unsupported icons', () => {
    expect(normalizeImportantDocumentIcon('unknown:icon')).toBe(defaultImportantDocumentIcon)
  })
})
