'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronRight, Volume2, VolumeX, X } from 'lucide-react'
import SenderMediaCapture from './SenderMediaCapture'
import { supabase } from '@/lib/supabase'
import { playWishRevealSound } from '@/lib/success-wishes/signature-sound'
import styles from './SuccessCardStudio.module.css'

export type Template = 'heritage' | 'botanical' | 'nightfall' | 'sunrise'
export type CardValues = { candidate: string; sender: string; message: string; examYear?: string; school?: string }
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
  const headlineLines = wrapped(item.headline, 26, 2)
  const recipientLines = wrapped(recipient, 30, 2)
  const senderLines = wrapped('With love, ' + sender, 42, 1)
  const schoolLines = wrapped(values.school || '', 56, 1)
  const messageLines = wrapped(message, 53, 5)
  const messageStartY = 557 - Math.max(messageLines.length - 1, 0) * 17
  const ornaments: Record<Template, string> = { heritage: '✧', botanical: '✿', nightfall: '✦', sunrise: '✳' }
  return (
    <svg ref={svgRef} viewBox="0 0 1200 760" xmlns="http://www.w3.org/2000/svg" role="img"
      aria-label={`${item.name} Success Wishes card for ${recipient}, exam year ${values.examYear || 'not selected'}${values.school ? ', ' + values.school : ''}. Message: ${message || 'No message yet'}`} className={styles.art}
      preserveAspectRatio="xMidYMid meet">
      <defs>
        <radialGradient id={id} cx={template === 'botanical' ? '0%' : '50%'} cy="25%" r="95%">
          <stop offset="0%" stopColor={theme.top}/>
          <stop offset="100%" stopColor={theme.bottom}/>
        </radialGradient>
        <pattern id={id + '-paper'} width="34" height="34" patternUnits="userSpaceOnUse">
          <circle cx="4" cy="7" r="0.8" fill={theme.ink} opacity=".09"/><circle cx="25" cy="21" r="0.7" fill={theme.ink} opacity=".07"/>
          <path d="M15 3h2M8 27h1M29 10h1" stroke={theme.ink} strokeWidth=".7" opacity=".06"/>
        </pattern>
      </defs>
      <rect width="1200" height="760" rx="22" fill={'url(#' + id + ')'}/>
      <rect width="1200" height="760" rx="22" fill={'url(#' + id + '-paper)'}/>
      <rect x="20" y="20" width="1160" height="720" rx="12" fill="none" stroke={theme.border} strokeWidth="4"/>
      <rect x="40" y="40" width="1120" height="680" rx="8" fill="none" stroke={theme.accent} strokeWidth="2" opacity=".45"/>
      {template === 'nightfall' && <g fill={theme.accent} opacity=".45">
        <circle cx="170" cy="180" r="4"/><circle cx="990" cy="195" r="5"/><circle cx="740" cy="145" r="3"/>
        <circle cx="290" cy="315" r="3"/><circle cx="540" cy="165" r="4"/>
      </g>}
      <text x="75" y="92" fill={theme.ink} fontFamily="Arial, sans-serif" fontSize="19" fontWeight="bold" letterSpacing="4">VIBESCHOOL</text>
      <text x="1125" y="92" fill={theme.ink} fontFamily="Arial, sans-serif" fontSize="16" fontWeight="bold" letterSpacing="3" textAnchor="end">SUCCESS WISHES</text>
      <text x="600" y="183" fill={theme.accent} opacity=".24" fontSize="125" fontFamily="Georgia, serif" textAnchor="middle">{ornaments[template]}</text>
      {headlineLines.map((line, i) => <text key={i} x="600" y={270 + i * 65 - (headlineLines.length - 1) * 28} fill={theme.ink} fontFamily="Georgia, serif" fontStyle={template === 'heritage' || template === 'botanical' ? 'italic' : 'normal'} fontWeight="600" fontSize={preview ? 63 : 65} textAnchor="middle">{line}</text>)}
      <path d="M490 313 H710" stroke={theme.accent} strokeWidth="2.5" opacity=".65"/>
      {recipientLines.map((line, i) => <text key={i} x="600" y={370 + i * 40} fill={theme.ink} fontFamily="Arial, sans-serif" fontWeight="600" fontSize="39" textAnchor="middle">{line}</text>)}
      {schoolLines.map((line, i) => <text key={i} x="600" y={(recipientLines.length > 1 ? 444 : 428) + i * 24} fill={theme.ink} opacity=".85" fontFamily="Arial, sans-serif" fontSize="23" textAnchor="middle">{line}</text>)}
      {messageLines.length > 0 ? <g>
        <rect x="96" y="461" width="1008" height="178" rx="16" fill={theme.ink} opacity=".055"/>
        <rect x="96" y="461" width="1008" height="178" rx="16" fill="none" stroke={theme.accent} strokeWidth="1.5" opacity=".32"/>
        {messageLines.map((line, i) => <text key={i} x="600" y={messageStartY + i * 36} fill={theme.ink} fontFamily="Georgia, serif" fontSize="33" textAnchor="middle">{line}</text>)}
      </g> : <g>
        <path d="M425 531 H775" stroke={theme.accent} strokeWidth="2" opacity=".42"/>
        <text x="600" y="575" fill={theme.ink} fontFamily="Arial, sans-serif" fontSize="25" letterSpacing="5" opacity=".8" textAnchor="middle">GOOD LUCK IN YOUR EXAMS</text>
      </g>}
      {senderLines.map((line, i) => <text key={i} x="75" y={685 + i * 25} fill={theme.ink} fontFamily="Georgia, serif" fontStyle="italic" fontSize="20" fontWeight="600" letterSpacing=".3">{line}</text>)}
      <text x="1125" y="685" fill={theme.ink} fontFamily="Arial, sans-serif" fontSize="21" fontWeight="bold" letterSpacing="3" textAnchor="end">{values.examYear || '2026'}</text>
    </svg>
  )
}

export function BookCard({ template, values, soundEnabled, onOpen, onOpenedChange, mediaKind = 'text', mediaSrc = '', autoOpen = false, senderPreview = false }: { template: Template; values: CardValues; soundEnabled: boolean; onOpen: () => void; onOpenedChange?: (open: boolean) => void; mediaKind?: 'text' | 'voice' | 'video'; mediaSrc?: string; autoOpen?: boolean; senderPreview?: boolean }) {
  const [open, setOpen] = useState(false)
  const [envelopeOpened, setEnvelopeOpened] = useState(false)
  const replayTimer = useRef<number | null>(null)
  const item = templates.find(t => t.id === template) || templates[0]
  function openEnvelope() {
    if (envelopeOpened) return
    setEnvelopeOpened(true)
    if (soundEnabled) onOpen()
    replayTimer.current = window.setTimeout(() => {
      setOpen(true)
      onOpenedChange?.(true)
    }, 460)
  }
  function toggleCard() {
    if (replayTimer.current) window.clearTimeout(replayTimer.current)
    if (!open && soundEnabled) onOpen()
    onOpenedChange?.(!open)
    setOpen(value => !value)
  }
  useEffect(() => {
    if (!autoOpen) return
    if (replayTimer.current) window.clearTimeout(replayTimer.current)
    setEnvelopeOpened(true)
    setOpen(true)
    onOpenedChange?.(true)
  }, [autoOpen, onOpenedChange])
  useEffect(() => () => { if (replayTimer.current) window.clearTimeout(replayTimer.current) }, [])
  return <div className={styles.bookPreview}>
    <div className={styles.bookStage + (open ? ' ' + styles.bookIsOpen : '')}
        style={{ '--book-top': palette[template].top, '--book-bottom': palette[template].bottom, '--book-ink': palette[template].ink, '--book-accent': palette[template].accent } as React.CSSProperties}>
      <div className={styles.bookSpread} aria-hidden={!open}>
        <div className={styles.bookPage}>
          <span className={styles.bookEyebrow}>WITH LOVE</span>
          <strong>{values.sender.trim() || 'Your name'}</strong>
          <span>For {values.candidate.trim() || 'your candidate'}</span>
          {values.school?.trim() && <span>{values.school.trim()}</span>}
          <span>{values.examYear || '2026'} exams</span>
          <span className={styles.bookOrnament}>✧</span>
        </div>
        <div className={styles.bookPage + ' ' + styles.bookMessagePage}>
          <span className={styles.bookEyebrow}>{item.name}</span>
          <h3>{item.headline}</h3>
          <strong>{values.candidate.trim() || 'Candidate name'}</strong>
          <p data-testid="success-card-message-preview">{values.message.trim() || 'Your personal message will appear here.'}</p>
          <span className={styles.bookSignoff}>With every good wish, {values.sender.trim() || 'Your name'}</span>
        </div>
      </div>
      <div aria-hidden="true" className={styles.bookCover + (envelopeOpened ? ' ' + styles.bookCoverVisible : '') + (open ? ' ' + styles.bookCoverOpened : '')}
        style={{ '--book-top': palette[template].top, '--book-bottom': palette[template].bottom, '--book-ink': palette[template].ink, '--book-accent': palette[template].accent } as React.CSSProperties}
      >
        <span>VIBESCHOOL · SUCCESS WISHES</span><b aria-hidden="true">{template === 'botanical' ? '✿' : template === 'nightfall' ? '✦' : template === 'sunrise' ? '✳' : '✧'}</b>
        <strong>{item.headline}</strong><small>{values.candidate.trim() || 'A wish for someone special'}</small><small>{values.examYear || '2026'}</small>
      </div>
      {!envelopeOpened && <button type="button" className={styles.bookEnvelope} onClick={openEnvelope} aria-label="Open the envelope and reveal the success card">
        <span>VIBESCHOOL · SUCCESS WISHES</span><b aria-hidden="true">✉</b><strong>A little encouragement for {values.candidate.trim() || 'someone special'}</strong><small>{values.school?.trim() || `${values.examYear || '2026'} exams`}</small><em>Tap to open</em>
      </button>}
      {envelopeOpened && <div className={styles.bookEnvelope + ' ' + styles.bookEnvelopeOpened} aria-hidden="true"><span>VIBESCHOOL · SUCCESS WISHES</span><b>✉</b><strong>A little encouragement</strong><em>Opened</em></div>}
    </div>
    {!senderPreview && envelopeOpened && <div className={styles.bookActions}>
      <button type="button" className={styles.secondary} onClick={toggleCard} aria-expanded={open} aria-label={open ? 'Close the book card' : 'Open the book card'}>{open ? 'Close card' : 'Open card'}</button>
    </div>}
    {open && mediaSrc && mediaKind !== 'text' && <section className={styles.senderPlayback} aria-label="Sender recording preview">
      <strong>{mediaKind === 'voice' ? 'Listen to your voice wish' : 'Watch your video wish'}</strong>
      {mediaKind === 'voice'
        ? <audio controls preload="metadata" src={mediaSrc} aria-label="Preview your recorded voice wish"/>
        : <video controls playsInline preload="metadata" src={mediaSrc} aria-label="Preview your recorded video wish"/>}
    </section>}
  </div>
}

function CheckoutPreview({ theme, values, version, price, mediaFileName, onClose }: { theme: Template; values: CardValues; version: typeof versions[number]['id']; price: number; mediaFileName: string; onClose: () => void }) {
  const [mpesaNumber, setMpesaNumber] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const [review, setReview] = useState(false)
  const [detailsConfirmed, setDetailsConfirmed] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [sentMessage, setSentMessage] = useState('')
  const id = useId()
  async function sendWish() {
    if (sending) return
    setSending(true)
    setSendError('')
    try {
      const response = await fetch('/api/success-wishes/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          senderName: values.sender,
          candidateName: values.candidate,
          examYear: values.examYear,
          schoolAddress: values.school,
          theme,
          message: values.message,
          version,
          mpesaNumber,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(typeof payload.error === 'string' ? payload.error : 'Your wish could not be sent. Please try again.')
      }
      setSentMessage(typeof payload.customerMessage === 'string' ? payload.customerMessage : 'Check your phone to confirm the M-Pesa payment.')
      setDetailsConfirmed(true)
    } catch (reason) {
      setSendError(reason instanceof Error ? reason.message : 'Your wish could not be sent. Please try again.')
    } finally {
      setSending(false)
    }
  }
  function reviewCheckout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalized = mpesaNumber.replace(/[\s()-]/g, '')
    if (!/^(?:\+254|254|0)(?:7\d{8}|1\d{8})$/.test(normalized)) {
      setPhoneError('Enter a valid Kenyan M-Pesa number.')
      return
    }
    setPhoneError('')
    setReview(true)
  }
  return <div className={styles.modalBackdrop} role="presentation" onKeyDown={event => { if (event.key === 'Escape') onClose() }} onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className={styles.checkoutModal} role="dialog" aria-modal="true" aria-labelledby={id}>
      <button type="button" className={styles.modalClose} aria-label="Close checkout" onClick={onClose}><X size={20}/></button>
      {detailsConfirmed ? <><p className={styles.eyebrow}>M-PESA CHECKOUT</p><h2 id={id}>Check your phone</h2>
        <p className={styles.checkoutNotice}>{sentMessage} Your card is sent once the payment is confirmed.</p>
        <div className={styles.checkoutOrder}><CardArt template={theme} values={{ ...values, examYear: values.examYear || '2026' }} preview/><div><strong>{versions.find(item => item.id === version)?.name} · {values.candidate.trim()}</strong><span>M-Pesa number: {mpesaNumber}</span><span>Total · KES {price}</span></div></div>
        <button type="button" className={styles.primary} onClick={onClose}>Back to your card</button>
      </> : <><p className={styles.eyebrow}>CHECKOUT</p><h2 id={id}>{review ? 'Review your wish' : 'Your order'}</h2>
        <div className={styles.checkoutOrder}><CardArt template={theme} values={{ ...values, examYear: values.examYear || '2026' }} preview/><div><strong>{versions.find(item => item.id === version)?.name} · {values.candidate.trim()}</strong><span>For the {values.examYear || '2026'} exams</span><span>{values.school?.trim() || 'No school selected'}</span>{mediaFileName && <span>{mediaFileName}</span>}</div></div>
        {!review ? <form onSubmit={reviewCheckout} noValidate><fieldset className={styles.numberPicker}><legend>Choose a number prefix</legend>{['07', '01', '+254'].map(prefix => <button type="button" key={prefix} aria-pressed={mpesaNumber.startsWith(prefix)} onClick={() => { setMpesaNumber(prefix); setPhoneError('') }}>{prefix}</button>)}</fieldset><label className={styles.checkoutLabel} htmlFor={id + '-mpesa'}>M-Pesa number<input id={id + '-mpesa'} type="tel" inputMode="tel" autoComplete="tel" value={mpesaNumber} onChange={event => { setMpesaNumber(event.target.value); setPhoneError('') }} placeholder="07XX XXX XXX" maxLength={16} aria-describedby={id + '-phone-help'} required/></label>
          <small id={id + '-phone-help'} className={styles.checkoutDisclosure}>An M-Pesa prompt will be sent to this number.</small>
          {phoneError && <p role="alert" className={styles.checkoutError}>{phoneError}</p>}
          <div className={styles.orderTotal}>Total <strong>KES {price}</strong></div>
          <button type="submit" className={styles.primary}>Review order <ChevronRight size={18}/></button>
        </form> : <><p className={styles.checkoutFine}>M-Pesa number: <strong>{mpesaNumber}</strong></p><div className={styles.orderTotal}>Total <strong>KES {price}</strong></div>
          {sendError && <p role="alert" className={styles.checkoutError}>{sendError}</p>}
          <div className={styles.checkoutActions}><button type="button" className={styles.secondary} onClick={() => setReview(false)} disabled={sending}>Edit number</button><button type="button" className={styles.primary} onClick={() => void sendWish()} disabled={sending}>{sending ? 'Sending…' : 'Pay with M-Pesa'} <ChevronRight size={18}/></button></div>
        </>}
      </>}
    </section>
  </div>
}

const versions = [
  { id: 'text', name: 'Text Wish', price: 50, detail: 'A personalised success card with your message, exactly as you wrote it.' },
  { id: 'voice', name: 'Voice Wish', price: 75, detail: 'Choose a voice message or record your own.' },
  { id: 'video', name: 'Video Wish', price: 100, detail: 'Record a video message.' },
] as const

const messageStarters = [
  { label: 'Trust your work', message: 'You have worked so hard to reach this moment. Walk in with courage; we believe in you.' },
  { label: 'Proud of you', message: 'Whatever the results, we are proud of the person you are becoming. Keep going.' },
  { label: 'Bright beginning', message: 'May your hard work meet a bright new beginning. Your future is full of possibility.' },
]

type SchoolOption = {
  school_id: string
  school_name: string
  county: string | null
  sub_county: string | null
}

type DirectorySchoolOption = {
  directory_id: string
  school_name: string
  county: string | null
  sub_county: string | null
}

export default function SuccessCardStudio({ initialDraft, testMode = false }: { initialDraft?: CardDesignDraft; testMode?: boolean }) {
  const [theme, setTheme] = useState<Template>(initialDraft?.theme || 'heritage')
  const [selectedVersion, setSelectedVersion] = useState<'text' | 'voice' | 'video'>('text')
  const [mediaEnabled, setMediaEnabled] = useState(false)
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState('')
  const [previewSession, setPreviewSession] = useState(0)
  const [previewEditing, setPreviewEditing] = useState(false)
  const [candidate, setCandidate] = useState(initialDraft?.candidate || '')
  const [sender, setSender] = useState(initialDraft?.sender || '')
  const [message, setMessage] = useState(initialDraft?.message || '')
  const [examYear, setExamYear] = useState(initialDraft?.examYear || '2026')
  const [school, setSchool] = useState(initialDraft?.school || '')
  const [selectedSchool, setSelectedSchool] = useState<SchoolOption | null>(null)
  const [schoolOptions, setSchoolOptions] = useState<SchoolOption[]>([])
  const [schoolSearchState, setSchoolSearchState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const schoolInputId = useId()
  const schoolResultsId = useId()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [order, setOrder] = useState<{ id: string; invitationUrl: string; expiresAt: string } | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const stopSound = useRef<(() => void) | null>(null)
  const messageInputRef = useRef<HTMLTextAreaElement>(null)
  const values = { candidate, sender, message, examYear, school }
  const ready = Boolean(candidate.trim() && sender.trim() && message.trim() && /^20\d{2}$/.test(examYear) && (selectedVersion === 'text' || mediaFile))
  useEffect(() => {
    let active = true
    fetch('/api/success-wishes/config', { cache: 'no-store' })
      .then(response => response.ok ? response.json() : null)
      .then(config => { if (active) setMediaEnabled(config?.mediaEnabled === true) })
      .catch(() => { if (active) setMediaEnabled(false) })
    return () => { active = false }
  }, [])
  useEffect(() => {
    if (!mediaFile) { setMediaPreviewUrl(''); return }
    const url = URL.createObjectURL(mediaFile)
    setMediaPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [mediaFile])
  useEffect(() => () => {
    stopSound.current?.()
  }, [])
  useEffect(() => {
    const query = school.trim()
    if (query.length < 2 || selectedSchool?.school_name === query) {
      setSchoolOptions([])
      setSchoolSearchState('idle')
      return
    }

    let active = true
    setSchoolSearchState('loading')
    const timer = window.setTimeout(async () => {
      const { data, error: searchError } = await supabase.rpc('success_wishes_school_search_public_v1', {
        p_query: query,
        p_limit: 12,
      })
      if (!active) return
      if (searchError) {
        setSchoolOptions([])
        setSchoolSearchState('error')
        return
      }
      const options = (Array.isArray(data) ? data : []).filter((row): row is DirectorySchoolOption =>
        typeof row.directory_id === 'string' && typeof row.school_name === 'string'
      ).map(row => ({
        school_id: row.directory_id,
        school_name: row.school_name,
        county: typeof row.county === 'string' ? row.county : null,
        sub_county: typeof row.sub_county === 'string' ? row.sub_county : null,
      }))
      setSchoolOptions(options)
      setSchoolSearchState('ready')
    }, 250)

    return () => { active = false; window.clearTimeout(timer) }
  }, [school, selectedSchool])
  async function saveTestWish() {
    if (!ready || busy || !testMode) return
    setError(''); setStatus(''); setBusy(true)
    try {
      const response = await fetch('/api/success-wishes/test-orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
        body: JSON.stringify({ candidate, sender, message, examYear, school, theme, version: 'text' }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'The test wish could not be saved.')
      const invitationUrl = `${window.location.origin}/success-wishes/invitation#token=${encodeURIComponent(payload.invitationToken)}`
      setOrder({ id: payload.id, invitationUrl, expiresAt: payload.expiresAt })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The test wish could not be saved. Please try again.')
    } finally { setBusy(false) }
  }

  async function copyInvitation() {
    if (!order) return
    try { await navigator.clipboard.writeText(order.invitationUrl); setStatus('Private invitation copied. Share it directly with the intended candidate.') }
    catch { setStatus(order.invitationUrl) }
  }

  function toggleSound() {
    if (soundEnabled) {
      stopSound.current?.()
      stopSound.current = null
    }
    setSoundEnabled(!soundEnabled)
  }

  return <div className={styles.page}>
    <header className={styles.header}>
      <Link href="/" className={styles.brand}><span className={styles.brandMark}>V</span><span className={styles.brandText}>VIBESCHOOL<small>SUCCESS WISHES</small></span></Link>
      <div className={styles.headerActions}>
        <button type="button" className={styles.headerSound} aria-label={soundEnabled ? 'Mute card opening sound' : 'Turn card opening sound on'} aria-pressed={soundEnabled} onClick={toggleSound}>{soundEnabled ? <Volume2 size={17}/> : <VolumeX size={17}/>}</button>
      </div>
    </header>
    <main className={styles.main}>
      <section className={styles.intro}>
        <p className={styles.eyebrow}>DIGITAL SUCCESS CARDS</p>
        <h1>Wish students good luck <em>&amp; success.</em></h1>
        <p>A personal wish, beautifully made for someone special.</p>
        <button type="button" className={styles.heroCta} onClick={() => document.getElementById('choose-card')?.scrollIntoView({ behavior: 'smooth' })}>Explore Success Cards <ChevronRight size={16}/></button>
      </section>
      <section aria-labelledby="choose-card-title" className={styles.designSection} id="choose-card">
        <div className={styles.sectionHeading}><div><h2 id="choose-card-title">Choose a success card design</h2></div></div>
        <div className={styles.gallery}>{templates.map(item => <button type="button" key={item.id} onClick={() => {
          setTheme(item.id)
          document.getElementById('wish-composer')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
        }}
          className={styles.option + (theme === item.id ? ' ' + styles.active : '')} aria-pressed={theme === item.id} aria-label={`Choose ${item.name} card`}>
          <CardArt template={item.id} values={{ candidate: candidate || 'Your candidate', sender, message: '', examYear: examYear || '2026', school }} preview/>
          <span className={styles.optionCaption}><strong>{item.name}</strong></span>
        </button>)}</div>
      </section>
      <section className={styles.pricingStrip} aria-label="Wish versions and prices">
        <div className={styles.priceChoices} role="group" aria-label="Choose a wish version">
          {versions.map(version => <button key={version.id} type="button" className={styles.priceChoice} aria-pressed={selectedVersion === version.id} onClick={() => { setSelectedVersion(version.id); setMediaFile(null); setPreviewSession(current => current + 1) }}>
            {version.name} · KES {version.price}
          </button>)}
        </div>
      </section>
      <section className={styles.composer} id="wish-composer" aria-labelledby="personalise-card">
        <div className={styles.mobilePreview} aria-label="Live card preview">
          <CardArt template={theme} values={values} preview/>
          <div><span>LIVE PREVIEW</span><strong>{candidate.trim() || 'Your candidate'}</strong><p>{message.trim() || 'Your wish appears as you type.'}</p></div>
          <button type="button" onClick={() => document.getElementById('wish-preview')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>View card <ChevronRight size={15}/></button>
        </div>
        <div className={styles.form} onFocusCapture={event => {
          if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) { setPreviewEditing(true) }
        }}><div className={styles.heading}><span>DIGITAL SUCCESS CARD</span><h2 id="personalise-card">Write a wish they’ll remember.</h2></div>
          <div className={styles.formRow}>
            <label>Candidate name<input autoComplete="off" maxLength={48} value={candidate} onChange={e => setCandidate(e.target.value)} placeholder="Who are you celebrating?"/></label>
            <label>Exam year<input inputMode="numeric" type="text" pattern="20[0-9]{2}" maxLength={4} value={examYear} onChange={e => setExamYear(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="e.g. 2026"/></label>
          </div>
          <div className={styles.optionalField}>
            <div className={styles.optionalFieldHeading}><label htmlFor={schoolInputId}>School (optional)</label></div>
            <input id={schoolInputId} role="combobox" aria-autocomplete="list" aria-expanded={schoolOptions.length > 0} aria-controls={schoolResultsId} autoComplete="off" maxLength={80} value={school} onChange={e => { setSchool(e.target.value); setSelectedSchool(null) }} placeholder="Search school, e.g. Gilgil Township"/>
            {schoolSearchState === 'loading' && <p className={styles.schoolSearchStatus} role="status">Searching VibeSchool schools…</p>}
            {schoolSearchState === 'error' && <p className={styles.schoolSearchStatus} role="status">School search is unavailable right now. You can leave this optional field blank.</p>}
            {schoolSearchState === 'ready' && schoolOptions.length === 0 && <p className={styles.schoolSearchStatus} role="status">No matching school found. Try another name or leave this optional.</p>}
            {schoolOptions.length > 0 && <ul className={styles.schoolResults} id={schoolResultsId} role="listbox" aria-label="Matching VibeSchool schools">{schoolOptions.map(option => <li key={option.school_id}><button type="button" role="option" aria-selected={selectedSchool?.school_id === option.school_id} onClick={() => { setSelectedSchool(option); setSchool(option.school_name); setSchoolOptions([]); setSchoolSearchState('idle') }}><strong>{option.school_name}</strong><small>{[option.sub_county, option.county].filter(Boolean).join(', ') || 'School in VibeSchool directory'}</small></button></li>)}</ul>}
            {selectedSchool && <p className={styles.schoolSearchStatus} role="status">Selected from VibeSchool&apos;s school list: {selectedSchool.school_name}{selectedSchool.sub_county || selectedSchool.county ? ` · ${[selectedSchool.sub_county, selectedSchool.county].filter(Boolean).join(', ')}` : ''}</p>}
          </div>
          <label>Your name<input autoComplete="off" maxLength={48} value={sender} onChange={e => setSender(e.target.value)} placeholder="From whom?"/></label>
          <label>Your wish<textarea ref={messageInputRef} rows={6} maxLength={220} value={message} onChange={e => setMessage(e.target.value)}
            placeholder="Write something only you would say…"/></label>
          {selectedVersion !== 'text' && <>
            <SenderMediaCapture key={selectedVersion} kind={selectedVersion} file={mediaFile} onChange={setMediaFile}/>
            {mediaPreviewUrl && <div className={styles.localMediaReview}>
              {selectedVersion === 'voice' ? <audio className={styles.mediaPlayer} controls preload="metadata" src={mediaPreviewUrl} aria-label="Listen to your recorded voice message"/> : <video className={styles.mediaPlayer} controls playsInline preload="metadata" src={mediaPreviewUrl} aria-label="Watch your recorded video message"/>}
            </div>}
            {!mediaEnabled && <p className={styles.mediaDisclosure} role="status">You can record and preview here. Voice and video delivery is not active.</p>}
          </>}
          <div className={styles.messageIdeas}>
            <div className={styles.messageIdeasHeading}><strong>Need a wish to start with?</strong><small>Tap a phrase, then make it yours</small></div>
            <div>{messageStarters.map(starter => <button type="button" key={starter.label} aria-label={'Use wish starter: ' + starter.label} onClick={() => {
              setMessage(starter.message)
              window.requestAnimationFrame(() => {
                messageInputRef.current?.focus()
                messageInputRef.current?.setSelectionRange(starter.message.length, starter.message.length)
              })
            }}>{starter.label}</button>)}</div>
          </div>
          <p className={styles.counter}>{message.length}/220 characters</p>
          {!ready && <p className={styles.hint}>Add the candidate’s name, your name and a wish. School is optional.</p>}
          {error && <p role="alert" className={styles.error}>{error}</p>}
          {status && <p role="status" className={styles.status}>{status}</p>}
          <div className={styles.sendRow}>
            <p className={styles.orderTotal}>Total <strong>KES {versions.find(version => version.id === selectedVersion)?.price}</strong></p>
            <button type="button" className={styles.primary} disabled={!ready} onClick={() => {
              if (selectedVersion !== 'text' && !mediaEnabled) {
                setPreviewSession(current => current + 1)
                window.requestAnimationFrame(() => document.getElementById('wish-preview')?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
              } else setCheckoutOpen(true)
            }}>{selectedVersion !== 'text' && !mediaEnabled ? 'Preview your wish' : 'Send this wish'} <ChevronRight size={18}/></button>
          </div>
        </div>
        <div className={styles.live} id="wish-preview"><span>YOUR LIVE PREVIEW · SENDER VIEW</span>
          <BookCard senderPreview autoOpen={previewEditing} key={previewSession} template={theme} values={values} soundEnabled={soundEnabled} mediaKind={selectedVersion} mediaSrc={mediaPreviewUrl} onOpen={() => { stopSound.current?.(); stopSound.current = playWishRevealSound() }}/>
          <div className={styles.checkoutSummary}><h3>{versions.find(version => version.id === selectedVersion)?.name} <span>KES {versions.find(version => version.id === selectedVersion)?.price}</span></h3><p>{versions.find(version => version.id === selectedVersion)?.detail}</p>{mediaFile && <p>{mediaFile.name}</p>}
            {testMode && selectedVersion === 'text' ? <>
              {!order && <button type="button" className={styles.primary} disabled={busy} onClick={() => void saveTestWish()}>{busy ? 'Saving test wish…' : 'Complete test order · KES 50'}</button>}
            </> : null}
            {order && <div className={styles.orderConfirmation} role="status"><h3><Check size={18}/> Test wish saved</h3><p>No payment was taken. Copy the private invitation and share it directly with the intended candidate.</p>
              <label>Private invitation<input readOnly value={order.invitationUrl} onFocus={e => e.currentTarget.select()}/></label>
              <div className={styles.actions}><button className={styles.primary} type="button" onClick={() => void copyInvitation()}>Copy invitation</button><Link className={styles.secondary} href={`/success-wishes/invitation#token=${encodeURIComponent(new URL(order.invitationUrl).hash.slice(7))}`}>Open invitation</Link></div>
              <small>Reference {order.id} · Local retention until {new Date(order.expiresAt).toLocaleDateString()}</small>{status && <p role="status" className={styles.status}>{status}</p>}
            </div>}
          </div></div>
      </section>
      <footer className={styles.footer}>
        <p><Link href="/legal/privacy">Privacy</Link></p></footer>
    </main>
    {checkoutOpen && <CheckoutPreview theme={theme} values={values} version={selectedVersion} price={versions.find(version => version.id === selectedVersion)?.price || 50} mediaFileName={mediaFile?.name || ''} onClose={() => setCheckoutOpen(false)}/>}
  </div>
}
