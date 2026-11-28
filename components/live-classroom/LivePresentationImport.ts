import { importDeck, MAX_DECK_FILE_BYTES } from './LiveSlideProtocol'

export async function importPresentationFile(file: File) {
  if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') {
    const { importPdfSlides } = await import('./LiveSlidePdfImport')
    return importPdfSlides(file)
  }
  if (/\.pptx$/i.test(file.name)) {
    const { importPowerPoint } = await import('./LiveSlidePowerPoint')
    return importPowerPoint(file)
  }
  if (file.size > MAX_DECK_FILE_BYTES) throw Error('Presentation file is too large.')
  return importDeck(await file.text())
}
