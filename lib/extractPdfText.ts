'use client'

/**
 * Extracts plain text from a PDF File object using pdfjs-dist (client-side only).
 * Includes parallel processing for performance, smart spacing, and memory cleanup.
 */
export async function extractPdfText(
  file: File,
  onProgress?: (current: number, total: number) => void
): Promise<string> {
  if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
    throw new Error('Invalid file type. Please provide a valid PDF file.')
  }

  try {
    const pdfjsLib = await import('pdfjs-dist')
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    const totalPages = pdf.numPages
    const pageIndices = Array.from({ length: totalPages }, (_, i) => i + 1)

    let completed = 0

    const pageTextPromises = pageIndices.map(async (pageNum) => {
      let page
      try {
        page = await pdf.getPage(pageNum)
        const textContent = await page.getTextContent()

        let lastY: number | null = null
        const pageLines: string[] = []
        let currentLine: string[] = []

        for (const item of textContent.items) {
          if ('str' in item && 'transform' in item) {
            const str = item.str
            const transform = item.transform as number[]
            const y = transform[5]

            if (lastY !== null && Math.abs(y - lastY) > 5) {
              if (currentLine.length > 0) {
                pageLines.push(currentLine.join(' '))
                currentLine = []
              }
            }

            if (str.trim() !== '') {
              currentLine.push(str)
              lastY = y
            }
          }
        }

        if (currentLine.length > 0) {
          pageLines.push(currentLine.join(' '))
        }

        if (onProgress) {
          completed++
          onProgress(completed, totalPages)
        }

        return pageLines.join('\n')
      } finally {
        if (page && typeof page.cleanup === 'function') {
          page.cleanup()
        }
      }
    })

    const extractedPages = await Promise.all(pageTextPromises)
    await pdf.destroy()

    return extractedPages.join('\n\n').trim()
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string }
    if (err?.name === 'PasswordException') {
      throw new Error('This PDF is password-protected. Please unlock it before uploading.')
    }
    throw new Error(`Failed to extract text from PDF: ${err?.message || String(error)}`)
  }
}
