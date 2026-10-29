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
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 1600
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Your browser cannot create this image.')
  const theme = palette[gift.theme]
  const item = templates.find(t => t.id === gift.theme) || templates[0]
  const gradient = ctx.createLinearGradient(0, 0, 1200, 1600)
  gradient.addColorStop(0, theme.top)
  gradient.addColorStop(1, theme.bottom)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 1200, 1600)
  ctx.strokeStyle = theme.accent
  ctx.lineWidth = 5
  ctx.strokeRect(40, 40, 1120, 1520)
  ctx.lineWidth = 2
  ctx.strokeRect(60, 60, 1080, 1480)
  ctx.textAlign = 'center'
  ctx.fillStyle = theme.ink
  ctx.font = 'bold 29px Georgia, serif'
  ctx.fillText('VIBESCHOOL · SUCCESS WISHES', 600, 143)
  ctx.fillStyle = theme.accent
  ctx.font = '64px Georgia, serif'
  ctx.fillText('✧', 600, 240)
  ctx.fillStyle = theme.ink
  ctx.font = 'bold 58px Georgia, serif'
  const titleLines = wrapped(ctx, item.headline, 970)
  titleLines.forEach((line, i) => ctx.fillText(line, 600, 335 + i * 67))
  const titleBottom = 335 + (titleLines.length - 1) * 67
  ctx.font = '28px Georgia, serif'
  ctx.fillText('A PERSONAL WISH FOR', 600, titleBottom + 95)
  ctx.font = 'bold 53px Georgia, serif'
  const nameLines = wrapped(ctx, gift.candidate.trim(), 960)
  nameLines.forEach((line, i) => ctx.fillText(line, 600, titleBottom + 166 + i * 59))
  const detailsY = titleBottom + 166 + nameLines.length * 59
  ctx.font = '27px Georgia, serif'
  if (gift.school.trim()) ctx.fillText(gift.school.trim().slice(0, 95), 600, detailsY + 20)
  ctx.fillText((gift.examYear || '2026') + ' exams', 600, detailsY + 68)
  const messageTop = detailsY + 140
  const bottomReserved = 225
  const available = Math.max(170, canvas.height - bottomReserved - messageTop)
  const message = gift.message?.trim() || ''
  let fontSize = 38, lineHeight = 53, lines: string[] = []
  while (fontSize >= 18) {
    ctx.font = fontSize + 'px Georgia, serif'
    lines = wrapped(ctx, message, 930)
    lineHeight = Math.round(fontSize * 1.4)
    if (lines.length * lineHeight <= available) break
    fontSize -= 2
  }
  if (lines.length * lineHeight > available) {
    // Preserve the full message rather than silently cutting off text.
    throw new Error('This message is too long for a single image.')
  }
  ctx.fillStyle = theme.ink
  ctx.font = fontSize + 'px Georgia, serif'
  lines.forEach((line, i) => ctx.fillText(line, 600, messageTop + i * lineHeight))
  ctx.fillStyle = theme.accent
  ctx.font = '40px Georgia, serif'
  ctx.fillText('✧', 600, 1450)
  ctx.fillStyle = theme.ink
  ctx.font = 'italic 30px Georgia, serif'
  const signoff = 'With every good wish, ' + (gift.sender?.trim() || 'Your well-wisher')
  ctx.font = 'italic 30px Georgia, serif'
  const signoffLines = wrapped(ctx, signoff, 950)
  signoffLines.forEach((line, i) => ctx.fillText(line, 600, 1500 + i * 33))
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
