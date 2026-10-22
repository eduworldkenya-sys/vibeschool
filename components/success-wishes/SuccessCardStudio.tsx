'use client'

import Link from 'next/link'
import { useId, useRef, useState } from 'react'
import { Download, Share2 } from 'lucide-react'
import styles from './SuccessCardStudio.module.css'

type Template = 'heritage' | 'botanical' | 'nightfall' | 'sunrise'
type CardValues = { candidate: string; sender: string; message: string; examYear?: string; school?: string }
export type CardDesignDraft = CardValues & { theme: Template }
const templates: { id: Template; name: string; subtitle: string; headline: string }[] = [
  { id: 'heritage', name: 'Golden Hour', subtitle: 'Warm & timeless', headline: 'The future is yours' },
  { id: 'botanical', name: 'New Beginnings', subtitle: 'Fresh & graceful', headline: 'Bloom into greatness' },
  { id: 'nightfall', name: 'Bright Star', subtitle: 'Bold & confident', headline: 'You were made to shine' },
  { id: 'sunrise', name: 'Above & Beyond', subtitle: 'Joyful & uplifting', headline: 'Go make it happen' },
]
const palette: Record<Template, { top: string; bottom: string; ink: string; accent: string; border: string }> = {
  heritage: { top: '#fbf2d0', bottom: '#d1bb84', ink: '#624928', accent: '#b4954d', border: '#b4954d' },
  botanical: { top: '#f3f2e9', bottom: '#c4d6bf', ink: '#285b49', accent: '#63866a', border: '#b1c5ad' },
  nightfall: { top: '#314a75', bottom: '#111b36', ink: '#fff6dc', accent: '#f0ce85', border: '#5e5874' },
  sunrise: { top: '#ffe9bc', bottom: '#ac829c', ink: '#613653', accent: '#ffedc4', border: '#eab8a0' },
}

function wrapped(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    // Break unusually long tokens rather than clipping the card image.
    const parts = word.match(new RegExp('.{1,' + maxChars + '}', 'g')) || [word]
    for (const part of parts) {
      if (line && (line + ' ' + part).length > maxChars) {
        lines.push(line); line = part
      } else {
        line = line ? line + ' ' + part : part
      }
    }
  }
  if (line) lines.push(line)
  return lines.slice(0, maxLines)
}

export function CardArt({ template, values, svgRef, preview = false }: {
  template: Template; values: CardValues; svgRef?: React.Ref<SVGSVGElement>; preview?: boolean
}) {
  const id = useId().replace(/:/g, '')
  const theme = palette[template]
  const item = templates.find(t => t.id === template) || templates[0]
  const recipient = values.candidate.trim() || 'Candidate name'
  const sender = values.sender.trim() || 'Your name'
  const message = values.message.trim()
  const recipientLines = wrapped(recipient, 26, 2)
  const senderLines = wrapped('FROM ' + sender, 38, 2)
  const schoolLines = wrapped(values.school || '', 52, 2)
  const messageLines = wrapped(message, 43, 6)
  const ornaments: Record<Template, string> = { heritage: '✧', botanical: '✿', nightfall: '✦', sunrise: '✳' }
  return (
    <svg ref={svgRef} viewBox="0 0 900 1200" xmlns="http://www.w3.org/2000/svg" role="img"
      aria-label={`${item.name} Success Wishes card for ${recipient}, exam year ${values.examYear || 'not selected'}${values.school ? ', ' + values.school : ''}. Message: ${message || 'No message yet'}`} className={styles.art}
      preserveAspectRatio="xMidYMid meet">
      <defs>
        <radialGradient id={id} cx={template === 'botanical' ? '0%' : '50%'} cy="25%" r="95%">
          <stop offset="0%" stopColor={theme.top}/>
          <stop offset="100%" stopColor={theme.bottom}/>
        </radialGradient>
      </defs>
      <rect width="900" height="1200" rx="22" fill={'url(#' + id + ')'}/>
      <rect x="20" y="20" width="860" height="1160" rx="12" fill="none" stroke={theme.border} strokeWidth="4"/>
      <rect x="40" y="40" width="820" height="1120" rx="8" fill="none" stroke={theme.accent} strokeWidth="2" opacity=".45"/>
      {template === 'nightfall' && <g fill={theme.accent} opacity=".45">
        <circle cx="150" cy="275" r="4"/><circle cx="680" cy="320" r="5"/><circle cx="740" cy="220" r="3"/>
        <circle cx="290" cy="410" r="3"/><circle cx="540" cy="285" r="4"/>
      </g>}
      <text x="75" y="104" fill={theme.ink} fontFamily="Arial, sans-serif" fontSize="22" fontWeight="bold" letterSpacing="4">VIBESCHOOL</text>
      <text x="825" y="104" fill={theme.ink} fontFamily="Arial, sans-serif" fontSize="18" fontWeight="bold" letterSpacing="3" textAnchor="end">SUCCESS WISHES</text>
      <text x="450" y="390" fill={theme.accent} opacity=".28" fontSize="285" fontFamily="Georgia, serif" textAnchor="middle">{ornaments[template]}</text>
      <text x="450" y="480" fill={theme.ink} fontFamily="Arial, sans-serif" fontSize="19" fontWeight="bold" letterSpacing="4" textAnchor="middle">TO A REMARKABLE CANDIDATE</text>
      <text x="450" y="568" fill={theme.ink} fontFamily="Georgia, serif" fontStyle={template === 'heritage' || template === 'botanical' ? 'italic' : 'normal'} fontSize={preview ? 56 : 61} textAnchor="middle" textLength="730" lengthAdjust="spacingAndGlyphs">{item.headline}</text>
      {recipientLines.map((line, i) => <text key={i} x="450" y={640 + i * 46} fill={theme.ink} fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="36" textAnchor="middle">{line}</text>)}
      {schoolLines.map((line, i) => <text key={i} x="450" y={730 + i * 28} fill={theme.ink} opacity=".9" fontFamily="Arial, sans-serif" fontSize="19" textAnchor="middle" textLength="700" lengthAdjust="spacingAndGlyphs">{line}</text>)}
      {messageLines.length > 0 && <g>
        <path d="M310 786 H590" stroke={theme.accent} strokeWidth="2" opacity=".6"/>
        {messageLines.map((line, i) => <text key={i} x="450" y={834 + i * 34} fill={theme.ink} fontFamily="Georgia, serif" fontSize="27" textAnchor="middle">{line}</text>)}
      </g>}
      {senderLines.map((line, i) => <text key={i} x="75" y={1090 + i * 31} fill={theme.ink} fontFamily="Arial, sans-serif" fontSize="20" fontWeight="bold" letterSpacing="2">{line}</text>)}
      <text x="825" y="1110" fill={theme.ink} fontFamily="Arial, sans-serif" fontSize="24" fontWeight="bold" letterSpacing="3" textAnchor="end">2026</text>
    </svg>
  )
}

async function pngFromSvg(svg: SVGSVGElement): Promise<Blob> {
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('width', '900')
  clone.setAttribute('height', '1200')
  const xml = new XMLSerializer().serializeToString(clone)
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('The card image could not be prepared.'))
      image.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = 1800
    canvas.height = 2400
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Image export is unavailable in this browser.')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('The image could not be saved.')), 'image/png')
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30000)
}

export default function SuccessCardStudio({ initialDraft }: { initialDraft?: CardDesignDraft }) {
  const [theme, setTheme] = useState<Template>(initialDraft?.theme || 'heritage')
  const [candidate, setCandidate] = useState(initialDraft?.candidate || '')
  const [sender, setSender] = useState(initialDraft?.sender || '')
  const [message, setMessage] = useState(initialDraft?.message || '')
  const [examYear, setExamYear] = useState(initialDraft?.examYear || '')
  const [school, setSchool] = useState(initialDraft?.school || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const svgRef = useRef<SVGSVGElement>(null)
  const values = { candidate, sender, message, examYear, school }
  const ready = Boolean(candidate.trim() && sender.trim() && message.trim() && /^20\d{2}$/.test(examYear))
  async function exportCard(mode: 'download' | 'share') {
    if (!ready || !svgRef.current || busy) return
    setError(''); setStatus(''); setBusy(true)
    try {
      const png = await pngFromSvg(svgRef.current)
      const fileName = 'vibeschool-success-wishes.png'
      if (mode === 'share') {
        const file = new File([png], fileName, { type: 'image/png' })
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          try {
            await navigator.share({ files: [file], title: 'A Success Wish for ' + candidate.trim() })
            setStatus('Your phone sharing options were opened.')
          } catch (reason) {
            if (reason instanceof Error && reason.name === 'AbortError') return
            // Some phones reject native sharing after asynchronous image creation.
            // Keep the card useful by falling back to a real downloadable image.
            if (reason instanceof Error && (reason.name === 'NotAllowedError' || reason.name === 'InvalidStateError' || reason.name === 'TypeError')) {
              download(png, fileName)
              setStatus('Direct sharing was unavailable. Your PNG was downloaded so you can share it from your phone.')
            } else throw reason
          }
        } else {
          download(png, fileName)
          setStatus('Your image was downloaded. Share it using WhatsApp or your preferred app.')
        }
      } else {
        download(png, fileName)
        setStatus('Your personalised PNG card has been downloaded.')
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The card could not be generated. Please try again.')
    } finally { setBusy(false) }
  }

  return <div className={styles.page}>
    <header className={styles.header}><Link href="/" className={styles.brand}>VibeSchool <span>/ Success Wishes</span></Link><span>Personal cards</span></header>
    <main className={styles.main}>
      <div className={styles.intro}><p className={styles.eyebrow}>VIBESCHOOL SUCCESS WISHES</p><h1>A little encouragement. A card they&apos;ll remember.</h1>
        <p>Choose a design, write from the heart and share a beautiful personalised card. Free to create.</p></div>
      <section aria-labelledby="choose-card" className={styles.section}>
        <div className={styles.heading}><span>01 — CHOOSE YOUR CARD</span><h2 id="choose-card">Find their perfect wish</h2></div>
        <div className={styles.gallery}>{templates.map(item => <button type="button" key={item.id} onClick={() => setTheme(item.id)}
          className={styles.option + (theme === item.id ? ' ' + styles.active : '')} aria-pressed={theme === item.id}>
          <CardArt template={item.id} values={{ candidate: candidate || 'Your candidate', sender, message: '', examYear: examYear || '2026', school }} preview/>
          <span className={styles.optionCaption}><strong>{item.name}</strong><small>{item.subtitle}</small></span>
        </button>)}</div>
      </section>
      <section className={styles.composer} aria-labelledby="personalise-card">
        <div className={styles.form}><div className={styles.heading}><span>02 — MAKE IT PERSONAL</span><h2 id="personalise-card">Write your wish</h2></div>
          <label>Candidate&apos;s name<input autoComplete="off" maxLength={48} value={candidate} onChange={e => setCandidate(e.target.value)} placeholder="Who are you celebrating?"/></label>
          <label>Exam year<input inputMode="numeric" type="text" pattern="20[0-9]{2}" maxLength={4} value={examYear} onChange={e => setExamYear(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="e.g. 2026" aria-describedby="exam-year-help"/><small id="exam-year-help">The year is shown on the card. It is not an access code.</small></label>
          <label>School (optional)<input autoComplete="off" maxLength={80} value={school} onChange={e => setSchool(e.target.value)} placeholder="Add a school name if helpful"/><small>A label for the recipient; it does not verify who can open a wish.</small></label>
          <label>Your name<input autoComplete="off" maxLength={48} value={sender} onChange={e => setSender(e.target.value)} placeholder="From whom?"/></label>
          <label>Your personal wish<textarea rows={5} maxLength={220} value={message} onChange={e => setMessage(e.target.value)}
            placeholder="You have worked so hard. Walk into your exams with courage and confidence. We believe in you!"/></label>
          <p className={styles.counter}>{message.length}/220 characters</p>
          <div className={styles.actions}>
            <button type="button" className={styles.primary} disabled={!ready || busy} onClick={() => void exportCard('download')}><Download size={18}/>{busy ? 'Preparing image…' : 'Download card'}</button>
            <button type="button" className={styles.secondary} disabled={!ready || busy} onClick={() => void exportCard('share')}><Share2 size={18}/>Share card</button>
          </div>
          {!ready && <p className={styles.hint}>Enter the candidate&apos;s name, a four-digit exam year, your name and a wish to download or share your card.</p>}
          {error && <p role="alert" className={styles.error}>{error}</p>}
          {status && <p role="status" className={styles.status}>{status}</p>}
          <p className={styles.privacy}>This card is created on this device. VibeSchool has not saved it to a candidate inbox or delivered it. Download or share the PNG yourself; the school is optional and is not an access credential.</p>
        </div>
        <div className={styles.live}><span>LIVE CARD PREVIEW</span><CardArt template={theme} values={values} svgRef={svgRef}/>
          <p>Designed with your actual words. It becomes downloadable after you add a name and exam year.</p></div>
      </section>
      <footer className={styles.footer}><p>Private VibeSchool delivery is being prepared. A candidate will need a private invitation to open a saved wish; name, school and exam year are not enough to identify or authenticate them.</p>
        <p><Link href="/legal/privacy">Privacy</Link></p></footer>
    </main>
  </div>
}
