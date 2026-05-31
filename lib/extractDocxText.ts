'use client'

/**
 * Extracts plain text from a DOC/DOCX File object using mammoth (client-side only).
 */
export async function extractDocxText(file: File): Promise<string> {
  const validTypes = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
  ]
  const validExts = ['.doc', '.docx']
  const hasValidType = validTypes.includes(file.type)
  const hasValidExt  = validExts.some(ext => file.name.toLowerCase().endsWith(ext))

  if (!hasValidType && !hasValidExt) {
    throw new Error('Invalid file type. Please provide a DOC or DOCX file.')
  }

  try {
    const mammoth   = await import('mammoth')
    const arrayBuffer = await file.arrayBuffer()
    const result    = await mammoth.extractRawText({ arrayBuffer })

    if (!result.value?.trim()) {
      throw new Error('No readable text found in this document.')
    }

    return result.value.trim()
  } catch (error: unknown) {
    const err = error as { message?: string }
    throw new Error(`Failed to extract text from document: ${err?.message || String(error)}`)
  }
}
