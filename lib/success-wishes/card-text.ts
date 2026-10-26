// Preserve all user text in SVG previews. Layout chooses spacing; wrapping never discards lines.
export function wrapCardText(text: string, maxChars: number): string[] {
  if (!Number.isInteger(maxChars) || maxChars < 1) throw new Error('Invalid card text width')
  const lines: string[] = []
  let line = ''
  for (const word of text.trim().split(/\s+/).filter(Boolean)) {
    const characters = Array.from(word)
    for (let start = 0; start < characters.length; start += maxChars) {
      const part = characters.slice(start, start + maxChars).join('')
      if (line && Array.from(line + ' ' + part).length > maxChars) {
        lines.push(line)
        line = part
      } else line = line ? line + ' ' + part : part
    }
  }
  if (line) lines.push(line)
  return lines
}
