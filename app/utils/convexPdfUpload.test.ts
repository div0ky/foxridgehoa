import { describe, expect, test } from 'vitest'

import { MAX_PDF_BYTES, validatePdfFile } from './convexPdfUpload'

describe('validatePdfFile', () => {
  test('accepts a valid PDF file with %PDF- header', async () => {
    const file = new File(['%PDF-1.7\n1 0 obj\n<<>>\nendobj\n'], 'bylaws.pdf', {
      type: 'application/pdf'
    })
    await expect(validatePdfFile(file)).resolves.toBeNull()
  })

  test('rejects an empty file', async () => {
    const file = new File([], 'empty.pdf', { type: 'application/pdf' })
    await expect(validatePdfFile(file)).resolves.toMatch(/empty/i)
  })

  test('rejects a file without PDF magic header bytes', async () => {
    const file = new File(['hello world'], 'fake.pdf', { type: 'application/pdf' })
    await expect(validatePdfFile(file)).resolves.toMatch(/valid pdf/i)
  })

  test('rejects non-PDF files', async () => {
    const file = new File(['%PDF-1.7'], 'notes.txt', { type: 'text/plain' })
    await expect(validatePdfFile(file)).resolves.toMatch(/not a pdf/i)
  })

  test('rejects files exceeding MAX_PDF_BYTES', async () => {
    const file = new File(['%PDF-1.7'], 'huge.pdf', { type: 'application/pdf' })
    Object.defineProperty(file, 'size', { value: MAX_PDF_BYTES + 1 })
    await expect(validatePdfFile(file)).resolves.toMatch(/20 mb/i)
  })
})
