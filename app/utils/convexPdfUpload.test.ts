import { describe, expect, it } from 'vitest'

import { assertPdfFile, MAX_PDF_BYTES } from './convexPdfUpload'

describe('assertPdfFile', () => {
  it('accepts a PDF when the browser omits the MIME type or reports a generic one', async () => {
    for (const type of ['', 'application/octet-stream']) {
      await expect(assertPdfFile(new File(['%PDF-1.7 body'], 'a.pdf', { type }))).resolves.toBeUndefined()
    }
  })

  it('rejects wrong signatures and oversize files', async () => {
    await expect(assertPdfFile(new File(['hello'], 'a.pdf', { type: 'application/pdf' }))).rejects.toThrow('not a valid PDF')
    const big = new File(['%PDF-'], 'big.pdf')
    Object.defineProperty(big, 'size', { value: MAX_PDF_BYTES + 1 })
    await expect(assertPdfFile(big)).rejects.toThrow('20 MB')
  })
})
