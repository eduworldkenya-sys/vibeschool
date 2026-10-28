'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Check, Pencil, ChevronRight, Volume2, VolumeX } from 'lucide-react'
import SenderMediaCapture from './SenderMediaCapture'
import WishCheckout from './WishCheckout'
import { useSenderDraft } from './useSenderDraft'
import type { SenderDraft } from '@/lib/success-wishes/sender-draft'
import { wrapCardText } from '@/lib/success-wishes/card-text'
import { supabase } from '@/lib/supabase'
import { playWishRevealSound } from '@/lib/success-wishes/signature-sound'
import styles from './SuccessCardStudio.module.css'
import { templates, palette } from './card-themes'
import { BookCard } from './BookCard'
export { BookCard } from './BookCard'

export type Template = SenderDraft['theme']
export type CardValues = { candidate: string; sender: string; message: string; examYear?: string; school?: string; deliveryPhone?: string }
export type CardDesignDraft = CardValues & { theme: Template }

type WishField = 'candidate' | 'school' | 'phone' | 'sender' | 'message'
function CompletedSection({ title, value, completed, open, onOpenChange, onBlurCapture, children }: {title:string;value:string;completed:boolean;open:boolean;onOpenChange:(open:boolean)=>void;onBlurCapture?:React.FocusEventHandler<HTMLDetailsElement>;children:React.ReactNode}) {
  return <details className={`${styles.completedField} ${completed ? styles.isComplete : ''}`} open={open} onBlurCapture={onBlurCapture} onToggle={event => { if(event.currentTarget.open !== open) onOpenChange(event.currentTarget.open) }}>
    <summary className={styles.fieldSummary}><span className={styles.summaryCheck} aria-hidden="true">{completed && <Check size={17} strokeWidth={3}/>}</span><span className={styles.summaryText}><strong>{title}</strong>{completed && !open && <span className={styles.summaryValue}>{value}</span>}</span>{completed && <Pencil className={styles.summaryEdit} size={17} aria-hidden="true"/>}</summary>
    <div className={styles.fieldContent}>{children}</div>
  </details>
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
  const headlineLines = wrapCardText(item.headline, 26)
  const recipientLines = wrapCardText(recipient, 30)
  const senderLines = wrapCardText('With love, ' + sender, 42)
  const schoolLines = wrapCardText(values.school || '', 56)
  const messageLines = wrapCardText(message, 53)
  const messageLineHeight = Math.min(36, 150 / Math.max(messageLines.length, 1))
  const messageFontSize = Math.min(33, messageLineHeight * .9, 960 / Math.max(1, ...messageLines.map(line => Array.from(line).length)))
  const recipientFontSize = Math.min(39, 1000 / Math.max(1, ...recipientLines.map(line => Array.from(line).length)))
  const schoolFontSize = Math.min(21, 1000 / Math.max(1, ...schoolLines.map(line => Array.from(line).length)))
  const messageStartY = 550 - Math.max(messageLines.length - 1, 0) * messageLineHeight / 2
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
      {recipientLines.map((line, i) => <text key={i} x="600" y={370 + i * 40} fill={theme.ink} fontFamily="Arial, sans-serif" fontWeight="600" fontSize={recipientFontSize} textAnchor="middle">{line}</text>)}
      {schoolLines.map((line, i) => <text key={i} x="600" y={(recipientLines.length > 1 ? 444 : 428) + i * 24} fill={theme.ink} opacity=".85" fontFamily="Arial, sans-serif" fontSize={schoolFontSize} textAnchor="middle">{line}</text>)}
      {messageLines.length > 0 ? <g>
        <rect x="96" y="461" width="1008" height="178" rx="16" fill={theme.ink} opacity=".055"/>
        <rect x="96" y="461" width="1008" height="178" rx="16" fill="none" stroke={theme.accent} strokeWidth="1.5" opacity=".32"/>
        {messageLines.map((line, i) => <text key={i} x="600" y={messageStartY + i * messageLineHeight} fill={theme.ink} fontFamily="Georgia, serif" fontSize={messageFontSize} textAnchor="middle">{line}</text>)}
      </g> : <g>
        <path d="M425 531 H775" stroke={theme.accent} strokeWidth="2" opacity=".42"/>
        <text x="600" y="575" fill={theme.ink} fontFamily="Arial, sans-serif" fontSize="25" letterSpacing="5" opacity=".8" textAnchor="middle">GOOD LUCK IN YOUR EXAMS</text>
      </g>}
      {senderLines.map((line, i) => <text key={i} x="75" y={665 + i * 22} fill={theme.ink} fontFamily="Georgia, serif" fontStyle="italic" fontSize="20" fontWeight="600" letterSpacing=".3">{line}</text>)}
      <text x="1125" y="685" fill={theme.ink} fontFamily="Arial, sans-serif" fontSize="21" fontWeight="bold" letterSpacing="3" textAnchor="end">{values.examYear || '2026'}</text>
    </svg>
  )
}


const versions = [
  { id: 'text', name: 'Text Wish', price: 50 },
  { id: 'voice', name: 'Voice Wish', price: 75 },
  { id: 'video', name: 'Video Wish', price: 100 },
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
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState('')
  const [previewSession, setPreviewSession] = useState(0)
  const [previewReached, setPreviewReached] = useState(false)
  const previewRef = useRef<HTMLDivElement>(null)
  const [candidate, setCandidate] = useState(initialDraft?.candidate || '')
  const [sender, setSender] = useState(initialDraft?.sender || '')
  const [message, setMessage] = useState(initialDraft?.message || '')
  const [examYear, setExamYear] = useState(initialDraft?.examYear || '2026')
  const [school, setSchool] = useState(initialDraft?.school || '')
  const [deliveryPhone, setDeliveryPhone] = useState(initialDraft?.deliveryPhone || '')
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
  const formStartSoundPlayed = useRef(false)
  const messageInputRef = useRef<HTMLTextAreaElement>(null)
  const values = { candidate, sender, message, examYear, school, deliveryPhone }
  const [editingStarted, setEditingStarted] = useState(false)
  const [expandedFields, setExpandedFields] = useState<Record<string, boolean>>({ candidate: true, phone: true, sender: true, message: true, school: true })
  const setFieldExpanded = (field: WishField, expanded: boolean) => setExpandedFields(previous => ({ ...previous, [field]: expanded }))
  const fieldErrors = {
    candidate: candidate.trim() ? '' : 'Enter the candidate’s name.',
    sender: sender.trim() ? '' : 'Enter your name.',
    message: message.trim() ? '' : 'Write a wish or choose a starter below.',
    examYear: /^20\d{2}$/.test(examYear) ? '' : 'Enter a four-digit exam year, such as 2026.',
    deliveryPhone: /^(?:0[17]\d{8}|254[17]\d{8}|\+254[17]\d{8})$/.test(deliveryPhone.trim().replace(/[ ()-]/g, '')) ? '' : 'Enter the phone number that should receive this wish.',
  }
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const completion = [!fieldErrors.candidate && !fieldErrors.examYear, !fieldErrors.deliveryPhone, !fieldErrors.sender, !fieldErrors.message]
  const completedCount = completion.filter(Boolean).length
  const collapseOnLeave = (field: WishField, valid: boolean, event: React.FocusEvent<HTMLDetailsElement>) => {
    if (!editingStarted || !valid || event.currentTarget.contains(event.relatedTarget as Node)) return
    const element = event.currentTarget
    requestAnimationFrame(() => { if (!element.contains(document.activeElement)) setFieldExpanded(field, false) })
  }
  useEffect(() => {
    const element = previewRef.current
    if (!element) return
    if (typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) setPreviewReached(true)
    }, { threshold: 0.1 })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const ready = Boolean(!Object.values(fieldErrors).some(Boolean) && (selectedVersion === 'text' || mediaFile))
  function handleSendWish() {
    if (!ready) return
    if (selectedVersion !== 'text') {
      setPreviewSession(current => current + 1)
      window.requestAnimationFrame(() => document.getElementById('wish-preview')?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
    } else {
      setCheckoutOpen(true)
    }
  }
  const restoreDraft = useCallback((draft: SenderDraft) => {
    setTheme(draft.theme); setCandidate(draft.candidate); setSender(draft.sender)
    setMessage(draft.message); setExamYear(draft.examYear); setSchool(draft.school)
    setDeliveryPhone(draft.deliveryPhone || '')
    setSelectedSchool(null)
  }, [])
  const draftStatus = useSenderDraft({ theme, candidate, sender, message, examYear, school, deliveryPhone }, Boolean(initialDraft), restoreDraft)
  function clearDraft() {
    if (!window.confirm('Clear this wish and start again?')) return
    restoreDraft({ theme: 'heritage', candidate: '', sender: '', message: '', examYear: '2026', school: '' })
    setDeliveryPhone(''); setSelectedVersion('text'); setMediaFile(null); setTouched({}); setError(''); setStatus(''); setOrder(null)
    setPreviewSession(current => current + 1)
  }
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

  function playFormStartSound() {
    if (!soundEnabled || formStartSoundPlayed.current) return
    formStartSoundPlayed.current = true
    stopSound.current?.()
    stopSound.current = playWishRevealSound()
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
      <Link href="/" className={styles.brand} aria-label="VibeSchool home"><Image src="/brand/vibeschool-wordmark-dark.svg" alt="VibeSchool" width={620} height={160} className={styles.brandLogo}/><small>SUCCESS WISHES</small></Link>
      <div className={styles.headerActions}>
        <Link className={styles.headerWishes} href="/success-wishes/inbox">My wishes</Link>
        <button type="button" className={styles.headerSound} aria-label={soundEnabled ? 'Mute card opening sound' : 'Turn card opening sound on'} aria-pressed={soundEnabled} onClick={toggleSound}>{soundEnabled ? <Volume2 size={17}/> : <VolumeX size={17}/>}</button>
      </div>
    </header>
    <main className={styles.main}>
      <section className={styles.intro}>
        <p className={styles.eyebrow}>DIGITAL SUCCESS CARDS</p>
        <h1>Wish students good luck <em>&amp; success.</em></h1>
        <p>A personal wish, beautifully made for someone special.</p>
        <div className={styles.entryActions}>
          <a className={styles.heroCta} href="#choose-card">Send a wish <ChevronRight size={16}/></a>
          <Link className={styles.openWishCta} href="/success-wishes/open">Open a wish</Link>
        </div>
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
            {version.name} · {version.id !== 'text' ? 'Preview only' : `KES ${version.price}`}
          </button>)}
        </div>
      </section>
      <section className={styles.composer} id="wish-composer" aria-labelledby="personalise-card">
        <div className={styles.mobilePreview} aria-label="Live card preview">
          <CardArt template={theme} values={values} preview/>
          <div><span>LIVE PREVIEW</span><strong>{candidate.trim() || 'Your candidate'}</strong>{message.trim() && <p>{message.trim()}</p>}</div>
          <button type="button" onClick={() => document.getElementById('wish-preview')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>View card <ChevronRight size={15}/></button>
        </div>
        <div className={styles.form} onFocusCapture={event => {
          if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) { playFormStartSound() }
        }}><div className={styles.heading}><span>DIGITAL SUCCESS CARD</span><h2 id="personalise-card">Create your wish</h2>{editingStarted && <><div className={styles.progressHeading}><span>YOUR PROGRESS</span><span>{completedCount}/4</span></div><div className={styles.progressTrack} role="progressbar" aria-label="Wish details completed" aria-valuemin={0} aria-valuemax={4} aria-valuenow={completedCount}>{completion.map((done, index) => <span key={index} className={done ? styles.progressDone : undefined}/>)}</div></>}</div>
          {(draftStatus.unavailable || draftStatus.restored || draftStatus.saved) && <div className={styles.draftStatus}>
            {draftStatus.unavailable && <p role="alert">Draft saving unavailable.</p>}
            {draftStatus.restored && <p role="status">Draft restored.</p>}
            {draftStatus.saved && <button type="button" className={styles.secondary} onClick={clearDraft}>Clear draft</button>}
          </div>}
          <CompletedSection title="Candidate details" value={candidate.trim() + ' · ' + examYear} completed={completion[0]} open={expandedFields.candidate} onOpenChange={open => setFieldExpanded('candidate', open)} onBlurCapture={event => collapseOnLeave('candidate', completion[0] && touched.examYear, event)}><div className={styles.formRow}>
            <label>Candidate name<input aria-label="Candidate name" aria-invalid={touched.candidate && Boolean(fieldErrors.candidate)} aria-describedby={touched.candidate && fieldErrors.candidate ? schoolInputId + '-candidate-error' : undefined} onBlur={() => setTouched(current => ({ ...current, candidate: true }))} autoComplete="off" maxLength={48} value={candidate} onChange={e => { setEditingStarted(true); setCandidate(e.target.value) }} placeholder="Who are you celebrating?"/>{touched.candidate && fieldErrors.candidate && <small id={schoolInputId + '-candidate-error'} className={styles.fieldError}>{fieldErrors.candidate}</small>}</label>
            <label>Exam year<input aria-label="Exam year" aria-invalid={touched.examYear && Boolean(fieldErrors.examYear)} aria-describedby={touched.examYear && fieldErrors.examYear ? schoolInputId + '-year-error' : undefined} onBlur={() => setTouched(current => ({ ...current, examYear: true }))} inputMode="numeric" type="text" pattern="20[0-9]{2}" maxLength={4} value={examYear} onChange={e => { setEditingStarted(true); setExamYear(e.target.value.replace(/\D/g, '').slice(0, 4)) }} placeholder="e.g. 2026"/>{touched.examYear && fieldErrors.examYear && <small id={schoolInputId + '-year-error'} className={styles.fieldError}>{fieldErrors.examYear}</small>}</label>
          </div></CompletedSection>
          <CompletedSection title="Find their school" value={selectedSchool?.school_name || school} completed={Boolean(selectedSchool)} open={expandedFields.school} onOpenChange={open => setFieldExpanded('school', open)} onBlurCapture={event => collapseOnLeave('school', Boolean(selectedSchool), event)}><div className={styles.optionalField}>
            <div className={styles.optionalFieldHeading}><label htmlFor={schoolInputId}>School (optional)</label></div><p className={styles.schoolInvitation}>Make their card even more personal</p>
            <input id={schoolInputId} role="combobox" aria-autocomplete="list" aria-expanded={schoolOptions.length > 0} aria-controls={schoolResultsId} autoComplete="off" maxLength={80} value={school} onChange={e => { setEditingStarted(true); setSchool(e.target.value); setSelectedSchool(null) }} placeholder="Search school name"/>
            {schoolSearchState === 'loading' && <p className={styles.schoolSearchStatus} role="status">Searching VibeSchool schools…</p>}
            {schoolSearchState === 'error' && <p className={styles.schoolSearchStatus} role="status">School search is unavailable right now. You can leave this optional field blank.</p>}
            {schoolSearchState === 'ready' && schoolOptions.length === 0 && <p className={styles.schoolSearchStatus} role="status">No matching school found. Try another name or leave this optional.</p>}
            {schoolOptions.length > 0 && <ul className={styles.schoolResults} id={schoolResultsId} role="listbox" aria-label="Matching VibeSchool schools">{schoolOptions.map(option => <li key={option.school_id}><button type="button" role="option" aria-selected={selectedSchool?.school_id === option.school_id} onClick={() => { setSelectedSchool(option); setSchool(option.school_name); setSchoolOptions([]); setSchoolSearchState('idle'); setFieldExpanded('school', false) }}><strong>{option.school_name}</strong><small>{[option.sub_county, option.county].filter(Boolean).join(', ') || 'School in VibeSchool directory'}</small></button></li>)}</ul>}
            {selectedSchool && <p className={styles.schoolSearchStatus} role="status">Selected from VibeSchool&apos;s school list: {selectedSchool.school_name}{selectedSchool.sub_county || selectedSchool.county ? ` · ${[selectedSchool.sub_county, selectedSchool.county].filter(Boolean).join(', ')}` : ''}</p>}
          </div></CompletedSection>
          <CompletedSection title="Receiver's phone" value={deliveryPhone} completed={completion[1]} open={expandedFields.phone} onOpenChange={open => setFieldExpanded('phone', open)} onBlurCapture={event => collapseOnLeave('phone', completion[1], event)}><label>Phone to receive this wish<input aria-label="Phone to receive this wish" aria-invalid={touched.deliveryPhone && Boolean(fieldErrors.deliveryPhone)} onBlur={() => setTouched(current => ({ ...current, deliveryPhone: true }))} autoComplete="tel" inputMode="tel" type="tel" maxLength={20} value={deliveryPhone} onChange={e => { setEditingStarted(true); setDeliveryPhone(e.target.value) }} placeholder="07XX XXX XXX"/>{touched.deliveryPhone && fieldErrors.deliveryPhone && <small className={styles.fieldError}>{fieldErrors.deliveryPhone}</small>}</label></CompletedSection>
          <CompletedSection title="Your name" value={sender.trim()} completed={completion[2]} open={expandedFields.sender} onOpenChange={open => setFieldExpanded('sender', open)} onBlurCapture={event => collapseOnLeave('sender', completion[2], event)}><label>Your name<input aria-label="Your name" aria-invalid={touched.sender && Boolean(fieldErrors.sender)} aria-describedby={touched.sender && fieldErrors.sender ? schoolInputId + '-sender-error' : undefined} onBlur={() => setTouched(current => ({ ...current, sender: true }))} autoComplete="off" maxLength={48} value={sender} onChange={e => { setEditingStarted(true); setSender(e.target.value) }} placeholder="From whom?"/>{touched.sender && fieldErrors.sender && <small id={schoolInputId + '-sender-error'} className={styles.fieldError}>{fieldErrors.sender}</small>}</label></CompletedSection>
          <CompletedSection title="Your wish" value={message.trim()} completed={completion[3]} open={expandedFields.message} onOpenChange={open => setFieldExpanded('message', open)} onBlurCapture={event => collapseOnLeave('message', completion[3], event)}><label>Your wish<textarea aria-label="Your wish" aria-invalid={touched.message && Boolean(fieldErrors.message)} aria-describedby={touched.message && fieldErrors.message ? schoolInputId + '-message-error' : undefined} onBlur={() => setTouched(current => ({ ...current, message: true }))} ref={messageInputRef} rows={3} maxLength={220} value={message} onChange={e => { setEditingStarted(true); setMessage(e.target.value) }}
            placeholder="Write something only you would say…"/>{touched.message && fieldErrors.message && <small id={schoolInputId + '-message-error'} className={styles.fieldError}>{fieldErrors.message}</small>}</label></CompletedSection>
          {selectedVersion !== 'text' && <>
            <SenderMediaCapture key={selectedVersion} kind={selectedVersion} file={mediaFile} onChange={setMediaFile}/>
            {mediaPreviewUrl && <div className={styles.localMediaReview}>
              {selectedVersion === 'voice' ? <audio className={styles.mediaPlayer} controls preload="metadata" src={mediaPreviewUrl} aria-label="Listen to your recorded voice message"/> : <video className={styles.mediaPlayer} controls playsInline preload="metadata" src={mediaPreviewUrl} aria-label="Watch your recorded video message"/>}
            </div>}
            {<p className={styles.mediaDisclosure} role="status">You can record and preview here. Voice and video delivery is not active.</p>}
          </>}
          <div className={styles.messageIdeas}>
            <div className={styles.messageIdeasHeading}><strong>Need a wish to start with?</strong><small>Tap a phrase, then make it yours</small></div>
            <div>{messageStarters.map(starter => <button type="button" key={starter.label} aria-label={'Use wish starter: ' + starter.label} onClick={() => {
              setEditingStarted(true)
              setFieldExpanded('message', true)
              setMessage(starter.message)
              // Keep focus inside the user gesture so mobile keyboards open reliably.
              messageInputRef.current?.focus()
              // Do not move the cursor later: the sender may already be replacing this text.
            }}>{starter.label}</button>)}</div>
          </div>
          <p className={styles.counter}>{message.length}/220 characters</p>
          {editingStarted && completedCount === 4 && <p className={styles.readyMessage} role="status">Ready to send</p>}
          {error && <p role="alert" className={styles.error}>{error}</p>}
          {status && <p role="status" className={styles.status}>{status}</p>}
          <div className={styles.sendRow}>
            <p className={styles.orderTotal}>Total <strong>{selectedVersion !== 'text' ? 'Preview only' : `KES ${versions.find(version => version.id === selectedVersion)?.price}`}</strong></p>
            {(selectedVersion !== 'text' || ready) && <button type="button" className={styles.primary} disabled={!ready} onClick={handleSendWish}>{selectedVersion !== 'text' ? 'Preview your wish' : 'Send this wish'} <ChevronRight size={18}/></button>}
          </div>
        </div>
        <div className={styles.live} id="wish-preview" ref={previewRef} onClickCapture={() => setPreviewReached(true)}><span>YOUR LIVE PREVIEW · SENDER VIEW</span>
          <BookCard senderPreview key={previewSession} template={theme} values={values} soundEnabled={soundEnabled} mediaKind={selectedVersion} mediaSrc={mediaPreviewUrl} onOpen={() => { stopSound.current?.(); stopSound.current = playWishRevealSound() }}/>
          {selectedVersion === 'text' && ready && previewReached && <div className={styles.previewSend}>
            <button type="button" className={styles.primary} onClick={handleSendWish}>Send this wish <ChevronRight size={18}/></button>
          </div>}
          {(testMode && selectedVersion === 'text' || order) && <div className={styles.checkoutSummary}>
            {testMode && selectedVersion === 'text' ? <>
              {!order && <button type="button" className={styles.primary} disabled={busy} onClick={() => void saveTestWish()}>{busy ? 'Saving test wish…' : 'Complete test order · KES 50'}</button>}
            </> : null}
            {order && <div className={styles.orderConfirmation} role="status"><h3><Check size={18}/> Test wish saved</h3><p>No payment was taken. Copy the private invitation and share it directly with the intended candidate.</p>
              <label>Private invitation<input readOnly value={order.invitationUrl} onFocus={e => e.currentTarget.select()}/></label>
              <div className={styles.actions}><button className={styles.primary} type="button" onClick={() => void copyInvitation()}>Copy invitation</button><Link className={styles.secondary} href={`/success-wishes/invitation#token=${encodeURIComponent(new URL(order.invitationUrl).hash.slice(7))}`}>Open invitation</Link></div>
              <small>Reference {order.id} · Local retention until {new Date(order.expiresAt).toLocaleDateString()}</small>{status && <p role="status" className={styles.status}>{status}</p>}
            </div>}
          </div>}</div>
      </section>
      <footer className={styles.footer}>
        <p><Link href="/legal/privacy">Privacy</Link></p></footer>
    </main>
    {checkoutOpen && <WishCheckout theme={theme} values={values} onClose={() => setCheckoutOpen(false)}/>}
  </div>
}
