import { getPublishedBlogStory } from '@/lib/blogContent'

export const revalidate = 300

function escapeXml(value: string) {
  return value.replace(/[<>&'\"]/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[char] || char)
}

function wrapTitle(title: string, max = 34) {
  const words = title.trim().split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (next.length > max && line) {
      lines.push(line)
      line = word
    } else line = next
    if (lines.length === 2) break
  }
  if (line && lines.length < 3) lines.push(line)
  const used = lines.join(' ').split(/\s+/).length
  if (used < words.length && lines.length) lines[lines.length - 1] = `${lines[lines.length - 1].replace(/[.,;:!?—–-]+$/, '')}…`
  return lines.slice(0, 3)
}

function themeFor(title: string, tags: string[]) {
  const text = `${title} ${tags.join(' ')}`.toLowerCase()
  if (/parent|tuition|disappoint/.test(text)) return { kicker: 'PARENTS · EXAM SEASON', mark: 'P' }
  if (/night|hours|remember|revision/.test(text)) return { kicker: 'STUDY SMARTER', mark: 'R' }
  if (/kcse|exam|marks|grade/.test(text)) return { kicker: 'KCSE · PRACTICAL GUIDANCE', mark: 'K' }
  return { kicker: 'KENYA EDUCATION', mark: 'V' }
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const story = await getPublishedBlogStory(params.id)
  if (!story) return new Response('Not found', { status: 404 })

  const title = story.publication.title?.trim() || 'VibeSchool Education Article'
  const theme = themeFor(title, story.publication.tags ?? [])
  const lines = wrapTitle(title).map(escapeXml)
  const lineSvg = lines.map((line, index) => `<text x="96" y="${330 + index * 82}" font-family="Georgia, 'Times New Roman', serif" font-size="58" font-weight="700" fill="#f8f5ec">${line}</text>`).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900" role="img" aria-label="${escapeXml(title)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#081727"/><stop offset="0.62" stop-color="#142b45"/><stop offset="1" stop-color="#233f5b"/></linearGradient>
    <radialGradient id="glow" cx="75%" cy="22%" r="55%"><stop offset="0" stop-color="#d0b154" stop-opacity=".34"/><stop offset="1" stop-color="#d0b154" stop-opacity="0"/></radialGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="20" stdDeviation="25" flood-color="#000" flood-opacity=".22"/></filter>
  </defs>
  <rect width="1600" height="900" fill="url(#bg)"/><rect width="1600" height="900" fill="url(#glow)"/>
  <circle cx="1360" cy="125" r="230" fill="none" stroke="#d0b154" stroke-width="2" opacity=".30"/><circle cx="1360" cy="125" r="160" fill="none" stroke="#d0b154" stroke-width="1" opacity=".20"/>
  <path d="M1115 640 C1260 530 1435 570 1545 465 L1600 900 H1040 Z" fill="#d0b154" opacity=".08"/>
  <rect x="96" y="105" width="118" height="8" rx="4" fill="#d0b154"/><text x="96" y="170" font-family="Arial, Helvetica, sans-serif" font-size="23" font-weight="700" letter-spacing="5" fill="#d0b154">VIBESCHOOL EDITORIAL</text>
  <text x="96" y="248" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" letter-spacing="3" fill="#c7d1db">${escapeXml(theme.kicker)}</text>
  ${lineSvg}
  <g transform="translate(1280 610)" filter="url(#shadow)"><rect width="210" height="210" rx="28" fill="#f4efe2"/><text x="105" y="148" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="120" font-weight="700" fill="#13243a">${theme.mark}</text><rect x="35" y="171" width="140" height="6" rx="3" fill="#d0b154"/></g>
  <text x="96" y="824" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="700" letter-spacing="3" fill="#d0b154">VIBESCHOOL.CO.KE</text>
</svg>`

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
