'use client'

import { useState } from 'react'
import { palette, templates, type Template } from './card-themes'

type GiftDetails = { theme: Template; candidate: string; sender: string | null; school: string; examYear: string; message?: string }

function wrapped(ctx: CanvasRenderingContext2D, value: string, maxWidth: number): string[] {
  const lines: string[] = []
  for (const paragraph of value.split(/\r?\n/)) {
    if (!paragraph.trim()) { lines.push(''); continue }
    let line = ''
    for (const word of paragraph.split(/\s+/)) {
      const next = line ? line + ' ' + word : word
      if (ctx.measureText(next).width <= maxWidth) { line = next; continue }
      if (line) { lines.push(line); line = '' }
      for (const char of Array.from(word)) {
        if (ctx.measureText(line + char).width > maxWidth && line) { lines.push(line); line = '' }
        line += char
      }
    }
    lines.push(line)
  }
  return lines
}

function render(gift: GiftDetails): HTMLCanvasElement {
  // Render the two-page keepsake as an image, using the same palette and wording
  // as BookCard. Height grows to fit content instead of silently cutting it off.
  const width = 1200
  const pagePadding = 100
  const canvas = document.createElement('canvas')
  const measuringContext = document.createElement('canvas').getContext('2d')
  if (!measuringContext) throw new Error('Your browser cannot create this image.')
  const measure: CanvasRenderingContext2D = measuringContext
  const theme = palette[gift.theme]
  const item = templates.find(t => t.id === gift.theme) || templates[0]
  const candidate = gift.candidate.trim()
  const sender = gift.sender?.trim() || 'Your well-wisher'
  const school = gift.school.trim()
  const year = gift.examYear || '2026'
  const maxWidth = width - pagePadding * 2

  function layout(value: string, font: string, lineHeight: number) {
    measure.font = font
    const lines = wrapped(measure, value, maxWidth)
    return { lines, height: Math.max(1, lines.length) * lineHeight }
  }
  const headline = layout(item.headline, 'bold 58px Georgia, serif', 74)
  const candidateBlock = layout(candidate, 'bold 49px Georgia, serif', 65)
  const schoolBlock = school ? layout(school, '27px Georgia, serif', 38) : null
  const senderBlock = layout(sender, 'bold 35px Georgia, serif', 48)
  const messageBlock = layout(gift.message?.trim() || '', '37px Georgia, serif', 55)
  const signoff = layout('With every good wish, ' + sender, 'italic 29px Georgia, serif', 40)

  // Page 1: sender, recipient, school and year. Page 2: the personal wish.
  const firstPageHeight = 520 + senderBlock.height + candidateBlock.height +
    (schoolBlock?.height || 0)
  const secondPageHeight = 600 + headline.height + candidateBlock.height + messageBlock.height + signoff.height
  const pageHeight = Math.max(780, firstPageHeight, secondPageHeight)
  const height = pageHeight * 2
  if (height > 16000) throw new Error('This message is too long for one image. Please reopen the card to read it.')
  canvas.width = width
  canvas.height = height
  const canvasContext = canvas.getContext('2d')
  if (!canvasContext) throw new Error('Your browser cannot create this image.')
  const ctx: CanvasRenderingContext2D = canvasContext
  const gradient = ctx.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, theme.top)
  gradient.addColorStop(1, theme.bottom)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)
  ctx.strokeStyle = theme.accent
  ctx.lineWidth = 5
  ctx.strokeRect(40, 40, width - 80, height - 80)
  ctx.lineWidth = 2
  ctx.strokeRect(60, 60, width - 120, height - 120)
  ctx.beginPath()
  ctx.moveTo(65, pageHeight)
  ctx.lineTo(width - 65, pageHeight)
  ctx.stroke()

  function lineText(lines: string[], font: string, y: number, lineHeight: number) {
    ctx.font = font
    ctx.fillStyle = theme.ink
    ctx.textAlign = 'center'
    lines.forEach((line, index) => ctx.fillText(line, width / 2, y + index * lineHeight))
    return y + lines.length * lineHeight
  }
  ctx.textAlign = 'center'
  ctx.fillStyle = theme.accent
  ctx.font = '29px Georgia, serif'
  ctx.fillText('VIBESCHOOL · SUCCESS WISHES', width / 2, 140)
  ctx.fillText('WITH LOVE', width / 2, 215)
  let y = lineText(senderBlock.lines, 'bold 35px Georgia, serif', 285, 48) + 90
  y = lineText(['For ' + candidateBlock.lines[0], ...candidateBlock.lines.slice(1)],
    'bold 49px Georgia, serif', y, 65) + 60
  if (schoolBlock) y = lineText(schoolBlock.lines, '27px Georgia, serif', y, 38) + 30
  lineText([year + ' exams'], '27px Georgia, serif', y, 38)

  const offset = pageHeight
  ctx.fillStyle = theme.accent
  ctx.font = '26px Georgia, serif'
  ctx.fillText(item.name.toUpperCase(), width / 2, offset + 130)
  y = lineText(headline.lines, 'bold 58px Georgia, serif', offset + 220, 74) + 60
  y = lineText(candidateBlock.lines, 'bold 43px Georgia, serif', y, 65) + 75
  y = lineText(messageBlock.lines, '37px Georgia, serif', y, 55) + 90
  lineText(signoff.lines, 'italic 29px Georgia, serif', y, 40)
  return canvas
}

export default function DownloadSuccessCard({ gift }: { gift: GiftDetails }) {
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  async function download() {
    if (working) return
    setWorking(true)
    setError('')
    try {
      await document.fonts.ready
      const canvas = render(gift)
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error('Could not save the card image.')
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'success-card-' + (gift.candidate.replace(/[^a-z0-9-]+/gi, '-').slice(0, 50) || 'wish') + '.png'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Download failed. Please try again.')
    } finally {
      setWorking(false)
    }
  }
  return <div style={{ textAlign: 'center' }}>
    <button type="button" onClick={() => void download()} disabled={working}
      style={{ background: '#D4AF37', color: '#101522', border: 0, borderRadius: 10, padding: '13px 22px', fontWeight: 700, cursor: working ? 'wait' : 'pointer' }}>
      {working ? 'Preparing card…' : 'Download card'}
    </button>
    {error && <p role="alert" style={{ color: '#FCA5A5', fontSize: 13 }}>{error}</p>}
  </div>
}
