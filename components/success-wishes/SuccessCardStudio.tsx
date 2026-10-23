'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronRight, Volume2, VolumeX, X } from 'lucide-react'
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
      {schoolLines.map((line, i) => <text key={i} x="450" y={730 + i * 28} fill={theme.ink} opacity=".9" fontFamily="Arial, sans-serif" fontSize="19" textAnchor="middle">{line}</text>)}
      {messageLines.length > 0 && <g>
        <path d="M310 786 H590" stroke={theme.accent} strokeWidth="2" opacity=".6"/>
        {messageLines.map((line, i) => <text key={i} x="450" y={834 + i * 34} fill={theme.ink} fontFamily="Georgia, serif" fontSize="27" textAnchor="middle">{line}</text>)}
      </g>}
      {senderLines.map((line, i) => <text key={i} x="75" y={1090 + i * 31} fill={theme.ink} fontFamily="Arial, sans-serif" fontSize="20" fontWeight="bold" letterSpacing="2">{line}</text>)}
      <text x="825" y="1110" fill={theme.ink} fontFamily="Arial, sans-serif" fontSize="24" fontWeight="bold" letterSpacing="3" textAnchor="end">{values.examYear || '2026'}</text>
    </svg>
  )
}

const versions = [
  { id: 'text', name: 'Text Wish', price: 50, detail: 'Personalised card and written wish', available: true },
  { id: 'voice', name: 'Voice Wish', price: 75, detail: 'Card, written wish and voice message', available: false },
  { id: 'video', name: 'Video Wish', price: 100, detail: 'Card, written wish and video message', available: false },
] as const

const messageStarters = [
  'You have worked so hard to reach this moment. Walk in with courage; we believe in you.',
  'Whatever the results, we are proud of the person you are becoming. Keep going.',
  'May your hard work meet a bright new beginning. Your future is full of possibility.',
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
  const [designModal, setDesignModal] = useState<Template | null>(null)
  const [candidate, setCandidate] = useState(initialDraft?.candidate || '')
  const [sender, setSender] = useState(initialDraft?.sender || '')
  const [message, setMessage] = useState(initialDraft?.message || '')
  const [examYear, setExamYear] = useState(initialDraft?.examYear || '')
  const [school, setSchool] = useState(initialDraft?.school || '')
  const [selectedSchool, setSelectedSchool] = useState<SchoolOption | null>(null)
  const [schoolOptions, setSchoolOptions] = useState<SchoolOption[]>([])
  const [schoolSearchState, setSchoolSearchState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const schoolInputId = useId()
  const schoolResultsId = useId()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [previewed, setPreviewed] = useState(false)
  const [order, setOrder] = useState<{ id: string; invitationUrl: string; expiresAt: string } | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [cardRevealed, setCardRevealed] = useState(false)
  const stopSound = useRef<(() => void) | null>(null)
  const values = { candidate, sender, message, examYear, school }
  const ready = Boolean(candidate.trim() && sender.trim() && message.trim() && /^20\d{2}$/.test(examYear))
  useEffect(() => () => { stopSound.current?.() }, [])
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
    if (!ready || !previewed || busy || !testMode) return
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

  function previewWish() {
    setError('')
    if (!ready) { setError('Add the candidate name, exam year, your name and a wish before previewing.'); return }
    setPreviewed(true)
    document.getElementById('wish-preview')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function showDesign(design: Template) {
    setCardRevealed(false)
    setDesignModal(design)
  }

  function closeDesign() {
    setDesignModal(null)
    setCardRevealed(false)
  }

  function openDesignCard() {
    setCardRevealed(true)
    if (soundEnabled) stopSound.current = playWishRevealSound()
  }

  function toggleSound() {
    if (soundEnabled) {
      stopSound.current?.()
      stopSound.current = null
    }
    setSoundEnabled(!soundEnabled)
  }

  return <div className={styles.page}>
    <header className={styles.header}><Link href="/" className={styles.brand}>VibeSchool <span>/ Success Wishes</span></Link><span>One wish · three versions</span></header>
    <main className={styles.main}>
      <div className={styles.intro}><p className={styles.eyebrow}>VIBESCHOOL SUCCESS WISHES</p><h1>A little encouragement. A card they&apos;ll remember.</h1>
        <p>Choose a design, add your words and preview it before checkout.</p></div>
      <p className={styles.availabilityNotice} role="status">{testMode ? 'LOCAL TEST MODE · Synthetic Text Wish orders only. No payment is taken and no invitation is sent outside this test.' : 'Prices shown are test prices. Checkout is disabled until private delivery is ready.'}</p>
      <section className={styles.pricePanel} aria-labelledby="versions-title">
        <div className={styles.heading}><span>ONE WISH · THREE VERSIONS</span><h2 id="versions-title">Choose what to include</h2></div>
        <div className={styles.versionGrid}>{versions.map(version => <article className={styles.versionCard + (version.available ? ' ' + styles.versionAvailable : '')} key={version.id}>
          <div><h3>{version.name}</h3><p>{version.detail}</p></div><strong>KES {version.price}</strong>
          {version.available ? <small>{testMode ? 'Text checkout is a local test only' : 'Text wish delivery is not available yet'}</small> : <small>Coming soon · not for sale</small>}
        </article>)}</div>
        <p className={styles.plainPrice}>One-time price per wish. The candidate pays nothing. School is an optional label.</p>
      </section>
      <section aria-labelledby="choose-card" className={styles.section}>
        <div className={styles.heading}><span>01 — DESIGN</span><h2 id="choose-card">Pick a look</h2></div>
        <div className={styles.gallery}>{templates.map(item => <button type="button" key={item.id} onClick={() => showDesign(item.id)}
          className={styles.option + (theme === item.id ? ' ' + styles.active : '')} aria-pressed={theme === item.id} aria-label={`Preview ${item.name}; versions and prices`}>
          <CardArt template={item.id} values={{ candidate: candidate || 'Your candidate', sender, message: '', examYear: examYear || '2026', school }} preview/>
          <span className={styles.optionCaption}><strong>{item.name}</strong><small>{item.subtitle} · View versions and prices</small></span>
        </button>)}</div>
      </section>
      <section className={styles.composer} aria-labelledby="personalise-card">
        <div className={styles.form}><div className={styles.heading}><span>02 — TEXT WISH · KES 50</span><h2 id="personalise-card">Make it personal</h2></div>
          <div className={styles.formRow}>
            <label>Candidate name<input autoComplete="off" maxLength={48} value={candidate} onChange={e => setCandidate(e.target.value)} placeholder="Who are you celebrating?"/></label>
            <label>Exam year<input inputMode="numeric" type="text" pattern="20[0-9]{2}" maxLength={4} value={examYear} onChange={e => setExamYear(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="e.g. 2026" aria-describedby="exam-year-help"/><small id="exam-year-help">Printed on card. Not a sign-in code.</small></label>
          </div>
          <details className={styles.optionalField}><summary>School (optional)</summary><label htmlFor={schoolInputId}>School<input id={schoolInputId} role="combobox" aria-autocomplete="list" aria-expanded={schoolOptions.length > 0} aria-controls={schoolResultsId} autoComplete="off" maxLength={80} value={school} onChange={e => { setSchool(e.target.value); setSelectedSchool(null) }} placeholder="Search your school"/><small>Search VibeSchool&apos;s school list. It helps describe the recipient; it does not verify identity or deliver the wish.</small></label>
            {schoolSearchState === 'loading' && <p className={styles.schoolSearchStatus} role="status">Searching VibeSchool schools…</p>}
            {schoolSearchState === 'error' && <p className={styles.schoolSearchStatus} role="status">School search is unavailable right now. You can leave this optional field blank.</p>}
            {schoolSearchState === 'ready' && schoolOptions.length === 0 && <p className={styles.schoolSearchStatus} role="status">No matching school found. Try another name or leave this optional.</p>}
            {schoolOptions.length > 0 && <ul className={styles.schoolResults} id={schoolResultsId} role="listbox" aria-label="Matching VibeSchool schools">{schoolOptions.map(option => <li key={option.school_id}><button type="button" role="option" aria-selected={selectedSchool?.school_id === option.school_id} onClick={() => { setSelectedSchool(option); setSchool(option.school_name); setSchoolOptions([]); setSchoolSearchState('idle') }}><strong>{option.school_name}</strong><small>{[option.sub_county, option.county].filter(Boolean).join(', ') || 'School in VibeSchool directory'}</small></button></li>)}</ul>}
            {selectedSchool && <p className={styles.schoolSearchStatus} role="status">Selected from VibeSchool&apos;s school list: {selectedSchool.school_name}{selectedSchool.sub_county || selectedSchool.county ? ` · ${[selectedSchool.sub_county, selectedSchool.county].filter(Boolean).join(', ')}` : ''}</p>}
          </details>
          <label>Your name<input autoComplete="off" maxLength={48} value={sender} onChange={e => setSender(e.target.value)} placeholder="From whom?"/></label>
          <label>Your wish<textarea rows={4} maxLength={220} value={message} onChange={e => setMessage(e.target.value)}
            placeholder="Write something only you would say…"/></label>
          <details className={styles.messageIdeas}><summary>Need a first line?</summary><div>{messageStarters.map(starter => <button type="button" key={starter} onClick={() => setMessage(starter)}>{starter}</button>)}</div><small>Pick one, then make it your own.</small></details>
          <p className={styles.counter}>{message.length}/220 characters</p>
          <div className={styles.actions}>
            <button type="button" className={styles.primary} disabled={!ready} onClick={previewWish}>Preview exact wish <ChevronRight size={18}/></button>
          </div>
          {!ready && <p className={styles.hint}>Add candidate name, exam year, your name and a wish. The school field is optional.</p>}
          {error && <p role="alert" className={styles.error}>{error}</p>}
          {status && <p role="status" className={styles.status}>{status}</p>}
          <p className={styles.privacy}>Candidate name and exam year are not credentials. The school is optional and is not an access credential. Anyone holding a private link can open the wish; the link cannot prove who they are.</p>
        </div>
        <div className={styles.live} id="wish-preview"><span>{previewed ? 'EXACT CANDIDATE PREVIEW' : 'CARD PREVIEW'}</span><CardArt template={theme} values={values}/>
          {previewed ? <div className={styles.checkoutSummary}><h3>Text Wish · KES 50</h3><p>This preview shows the card and the exact written wish. No voice or video is included.</p><p className={styles.orderTotal}>Total <strong>KES 50</strong></p>
            {testMode ? <><p className={styles.testNotice}>Local test checkout only. It saves synthetic test data; no payment is taken and no message is sent.</p>
              {!order && <button type="button" className={styles.primary} disabled={busy} onClick={() => void saveTestWish()}>{busy ? 'Saving test wish…' : 'Complete test order · KES 50'}</button>}
            </> : <p className={styles.hint}>Checkout is unavailable until private delivery is ready. No payment can be made from this page.</p>}
            {order && <div className={styles.orderConfirmation} role="status"><h3><Check size={18}/> Test wish saved</h3><p>No payment was taken. Copy the private invitation and share it directly with the intended candidate.</p>
              <label>Private invitation<input readOnly value={order.invitationUrl} onFocus={e => e.currentTarget.select()}/></label>
              <div className={styles.actions}><button className={styles.primary} type="button" onClick={() => void copyInvitation()}>Copy invitation</button><Link className={styles.secondary} href={`/success-wishes/invitation#token=${encodeURIComponent(new URL(order.invitationUrl).hash.slice(7))}`}>Open invitation</Link></div>
              <small>Reference {order.id} · Local retention until {new Date(order.expiresAt).toLocaleDateString()}</small>{status && <p role="status" className={styles.status}>{status}</p>}
            </div>}
          </div> : <p>Choose a design and write your wish. Review the exact card and total before the local test checkout.</p>}</div>
      </section>
      <footer className={styles.footer}><p>Local test only: synthetic data, no payment and no production delivery. This preview has not saved it to a candidate inbox or delivered it. Voice and Video remain unavailable until their full journey is verified.</p>
        <p><Link href="/legal/privacy">Privacy</Link></p></footer>
    </main>
    {designModal && <div className={styles.modalBackdrop} role="presentation" onKeyDown={e => { if (e.key === 'Escape') closeDesign() }} onMouseDown={e => { if (e.target === e.currentTarget) closeDesign() }}>
      <section className={styles.designModal} role="dialog" aria-modal="true" aria-labelledby="design-modal-title">
        <button autoFocus className={styles.modalClose} type="button" aria-label="Close design preview" onClick={closeDesign}><X size={20}/></button>
        <div className={styles.modalArt}>
          <div className={styles.modalCardWrap}>
            <div className={styles.modalCardArt} aria-hidden={!cardRevealed}><CardArt template={designModal} values={{ ...values, candidate: candidate || 'Your candidate', examYear: examYear || '2026' }}/></div>
            <button type="button" className={styles.modalCardCover + (cardRevealed ? ' ' + styles.modalCardOpened : '')} style={{ background: `linear-gradient(145deg, ${palette[designModal].top}, ${palette[designModal].bottom})`, color: palette[designModal].ink }} aria-label={`Open ${templates.find(item => item.id === designModal)?.name} card`} aria-hidden={cardRevealed} tabIndex={cardRevealed ? -1 : 0} disabled={cardRevealed} onClick={openDesignCard}>
              <span>VIBESCHOOL <small>SUCCESS WISHES</small></span><b aria-hidden="true">{designModal === 'heritage' ? '✧' : designModal === 'botanical' ? '✿' : designModal === 'nightfall' ? '✦' : '✳'}</b><strong>{templates.find(item => item.id === designModal)?.headline}</strong><small className={styles.tapToOpen}>Tap to open</small>
            </button>
          </div>
        </div>
        <div className={styles.modalInfo}><p className={styles.eyebrow}>CARD DESIGN</p><h2 id="design-modal-title">{templates.find(item => item.id === designModal)?.name}</h2><p>{templates.find(item => item.id === designModal)?.subtitle}</p>
          <button type="button" className={styles.soundToggle} aria-pressed={soundEnabled} onClick={toggleSound}>{soundEnabled ? <Volume2 size={15}/> : <VolumeX size={15}/>} Sound {soundEnabled ? 'on' : 'off'}</button>
          <h3>Choose a version</h3>{versions.map(version => <button type="button" className={styles.modalVersion + (selectedVersion === version.id ? ' ' + styles.modalVersionSelected : '')} key={version.id} aria-pressed={selectedVersion === version.id} disabled={!version.available} onClick={() => setSelectedVersion(version.id)}><span><strong>{version.name}</strong><small>{version.available && testMode ? 'Available for local test only' : version.available ? 'Not available for checkout yet' : 'Coming soon · not for sale'}</small></span><b>KES {version.price}</b></button>)}
          <p className={styles.hint}>This design is a choice within the same wish product; it does not change the price.</p>
          <button type="button" className={styles.primary} onClick={() => { setTheme(designModal); setSelectedVersion('text'); closeDesign(); document.getElementById('personalise-card')?.scrollIntoView({ behavior: 'smooth' }) }}>Choose Text Wish · KES 50 <ChevronRight size={18}/></button>
        </div>
      </section>
    </div>}
  </div>
}
