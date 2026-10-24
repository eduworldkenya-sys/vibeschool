'use client'

import Link from 'next/link'
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, Heart, LockKeyhole, Mail, Mic, Search, ShieldCheck, Video } from 'lucide-react'
import styles from './SuccessWishes.module.css'
import PaidMediaUpload from './PaidMediaUpload'
import VoiceRecorder from './VoiceRecorder'
import WishCardExperience from './WishCardExperience'
import RecipientInbox from './RecipientInbox'
import type { CardDesignDraft } from './SuccessCardStudio'
import { CardArt } from './SuccessCardStudio'

type School = { id: string; name: string; county: string | null }
type Configuration = { enabled: boolean; mediaEnabled: boolean; paymentsEnabled: boolean; maxSeconds: number; maxBytes: number }
type Kind = 'text' | 'voice' | 'video'
type Message = { id: string; senderName: string; relationship: string; kind: Kind; state: 'request' | 'available'; text?: string | null; createdAt: string; mediaUrl?: string | null }
type ViewingWindow = { weekday: number; startsAt: string; endsAt: string; venue: string; guidance: string }
type Receipt = { reference?: string; managementToken?: string; status?: string; message?: string }
type SavedWishDraft = {
  savedAt: number; school: School; admissionNumber: string; candidateName: string;
  senderName: string; relationship: string; text: string; retryKey: string
}
const DRAFT_KEY = 'vs-success-wishes-private-tab-draft-v1'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', credentials: 'same-origin', ...options, headers: { 'Content-Type': 'application/json', ...options?.headers } })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(typeof body?.error === 'string' ? body.error : 'This could not be completed. Please try again.')
  return body as T
}

function SchoolPicker({ selected, onChange, disabled = false, purpose = 'sender' }: { selected: School | null; onChange: (value: School | null) => void; disabled?: boolean; purpose?: 'sender' | 'inbox' }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<School[]>([])
  const [busy, setBusy] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState('')
  const generation = useRef(0)

  async function search() {
    const current = ++generation.current
    setBusy(true); setError(''); setSearched(false)
    try {
      const data = await request<{ schools: School[]; available: boolean; error?: string }>(`/api/success-wishes/schools?q=${encodeURIComponent(query.trim())}`)
      if (current !== generation.current) return
      if (!data.available) throw new Error(data.error || 'School search is unavailable. Please try again later.')
      setResults(data.schools); setSearched(true)
    } catch (reason) {
      if (current === generation.current) { setResults([]); setError(reason instanceof Error ? reason.message : 'School search could not load.') }
    } finally { if (current === generation.current) setBusy(false) }
  }

  if (selected) return <div className={styles.chosen}><ShieldCheck size={20} aria-hidden="true"/><div><strong>{selected.name}</strong><small>{selected.county || 'Kenya'}</small></div><button className={styles.quiet} type="button" disabled={disabled} onClick={() => { generation.current++; onChange(null); setResults([]); setSearched(false) }}>Change</button></div>

  return <div>
    <label className={styles.field}><span>{purpose === 'inbox' ? 'School (to find your inbox)' : 'School'}</span><div className={styles.searchRow}><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search school name" disabled={disabled || busy} maxLength={100} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void search() } }}/><button type="button" className={styles.secondary} onClick={() => void search()} disabled={disabled || busy || query.trim().length < 2}><Search size={16} aria-hidden="true"/>{busy ? 'Searching…' : 'Find'}</button></div></label>
    {error && <p className={styles.status} role="alert">{error}</p>}
    {searched && results.length === 0 && <p className={styles.status} role="status">{purpose === 'inbox' ? 'This school’s private inbox is not available here yet. Contact the school about candidate access.' : 'Private inbox delivery is not available for this school yet. You can still download or share your card directly; creating a wish does not require school approval.'}</p>}
    <div className={styles.results} aria-live="polite">{results.map(school => <button type="button" className={styles.school} key={school.id} onClick={() => onChange(school)}><div><strong>{school.name}</strong><span>{school.county || 'Kenya'}</span></div><span aria-hidden="true">→</span></button>)}</div>
  </div>
}

function SendForm({ config, initialWish }: { config: Configuration | null; initialWish?: CardDesignDraft }) {
  const [school, setSchool] = useState<School | null>(null)
  const [admissionNumber, setAdmissionNumber] = useState('')
  const [candidateName, setCandidateName] = useState(initialWish?.candidate || '')
  const [senderName, setSenderName] = useState(initialWish?.sender || '')
  const [senderPhone, setSenderEmail] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [senderProof, setSenderProof] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [relationship, setRelationship] = useState('')
  const [kind, setKind] = useState<Kind>('text')
  const [text, setText] = useState(initialWish?.message || '')
  const [consent, setConsent] = useState(false)
  const [preview, setPreview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [mediaUrl, setMediaUrl] = useState('')
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const idempotencyKey = useRef('')
  const restoreKey = useRef('')
  const [saveDraft, setSaveDraft] = useState(false)
  const [storedDraft, setStoredDraft] = useState<SavedWishDraft | null>(null)

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY)
      if (!raw) return
      const value: unknown = JSON.parse(raw)
      if (!value || typeof value !== 'object') return
      const data = value as Partial<SavedWishDraft>
      if (typeof data.savedAt !== 'number' || Date.now() - data.savedAt > 30 * 60 * 1000
        || !data.school || typeof data.school.id !== 'string'
        || typeof data.candidateName !== 'string' || typeof data.text !== 'string'
        || typeof data.admissionNumber !== 'string' || typeof data.senderName !== 'string'
        || typeof data.relationship !== 'string' || data.text.length > 2000) {
        sessionStorage.removeItem(DRAFT_KEY)
        return
      }
      setStoredDraft(data as SavedWishDraft)
    } catch { try { sessionStorage.removeItem(DRAFT_KEY) } catch { /* storage unavailable */ } }
  }, [])

  function restoreDraft() {
    if (!storedDraft) return
    restoreKey.current = /^[a-f0-9]{64}$/.test(storedDraft.retryKey) ? storedDraft.retryKey : ''
    setSchool(storedDraft.school); setAdmissionNumber(storedDraft.admissionNumber)
    setCandidateName(storedDraft.candidateName); setSenderName(storedDraft.senderName)
    setRelationship(storedDraft.relationship); setKind('text'); setText(storedDraft.text)
    setConsent(false); setSaveDraft(true); setStoredDraft(null)
  }

  function discardDraft() {
    try { sessionStorage.removeItem(DRAFT_KEY) } catch { /* storage unavailable */ }
    restoreKey.current = ''; idempotencyKey.current = ''
    setSaveDraft(false); setStoredDraft(null)
  }

  // A failed request can be retried only if all submission details are unchanged.
  useEffect(() => {
    idempotencyKey.current = restoreKey.current || ''
    restoreKey.current = ''
  }, [school?.id, admissionNumber, candidateName, senderName, relationship, kind, text])

  useEffect(() => {
    if (!saveDraft || !school || kind !== 'text' || receipt) return
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
        savedAt: Date.now(), school, admissionNumber, candidateName, senderName,
        relationship, text, retryKey: idempotencyKey.current,
      } satisfies SavedWishDraft))
    } catch { /* user may have storage disabled; form still works */ }
  }, [saveDraft, school, admissionNumber, candidateName, senderName, relationship, kind, text, receipt])

  useEffect(() => {
    if (!file) { setMediaUrl(''); return }
    const url = URL.createObjectURL(file); setMediaUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  function chooseFile(next: File | undefined) {
    setError(''); setFile(null)
    if (!next) return
    if (!next.type.startsWith(kind === 'voice' ? 'audio/' : 'video/')) { setError('Choose a supported media file.'); return }
    if (next.size > (config?.maxBytes || 25 * 1024 * 1024)) { setError('This file is too large. Choose a smaller file.'); return }
    setFile(next)
  }

  function showPreview() {
    setError('')
    if (!candidateName.trim() || !senderName.trim() || (kind === 'text' ? !text.trim() : !file)) {
      setError('Add the candidate’s name, your name and a wish before previewing the card.'); return
    }
    setPreview(true)
  }

  async function requestSenderCode() {
    if (!config?.enabled || verifying) return
    setVerifying(true); setError('')
    try {
      await request('/api/success-wishes/verify-sender', {
        method: 'POST', body: JSON.stringify({ phone: senderPhone.trim() }),
      })
      setOtpSent(true); setOtpCode('')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Verification SMS could not be sent.') }
    finally { setVerifying(false) }
  }

  async function verifySenderCode() {
    if (!otpSent || verifying) return
    setVerifying(true); setError('')
    try {
      const verified = await request<{ verified: boolean; senderProof: string }>('/api/success-wishes/verify-sender', {
        method: 'PATCH', body: JSON.stringify({ phone: senderPhone.trim(), code: otpCode.trim() }),
      })
      if (!verified.verified) throw new Error('Phone verification failed.')
      setSenderProof(verified.senderProof); setOtpCode('')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Phone verification failed.') }
    finally { setVerifying(false) }
  }

  async function send() {
    if (!school || busy || !config?.enabled || kind !== 'text') return
    if (!candidateName.trim() || !admissionNumber.trim() || !senderName.trim() || !relationship.trim() || !text.trim() || !consent) {
      setError('Complete the recipient, message and permission details before submitting.'); return
    }
    if (!senderProof) { setError('Verify your phone before submitting.'); return }
    setBusy(true); setError('')
    if (!idempotencyKey.current) {
      const random = crypto.getRandomValues(new Uint8Array(32))
      idempotencyKey.current = Array.from(random, byte => byte.toString(16).padStart(2, '0')).join('')
    }
    try {
      if (saveDraft) {
        try {
          sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
            savedAt: Date.now(), school, admissionNumber, candidateName, senderName,
            relationship, text, retryKey: idempotencyKey.current,
          } satisfies SavedWishDraft))
        } catch { /* no persistent storage is required to send */ }
      }
      const result = await request<Receipt>('/api/success-wishes/messages', { method: 'POST', body: JSON.stringify({ schoolId: school.id, admissionNumber: admissionNumber.trim(), candidateName: candidateName.trim(), senderName: senderName.trim(), relationship: relationship.trim(), kind, text: text.trim(), consent: true, senderProof, idempotencyKey: idempotencyKey.current }) })
      discardDraft()
      setReceipt(result)
      setText(''); setCandidateName(''); setAdmissionNumber(''); setSenderName(''); setRelationship(''); setConsent(false); setFile(null)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Your message could not be submitted.') }
    finally { setBusy(false) }
  }

  if (receipt) return <section className={styles.panel} aria-live="polite"><CheckCircle2 size={34} className={styles.successIcon} aria-hidden="true"/><h2>Submission received</h2><p className={styles.hint}>{receipt.message || 'Your message has been received. Availability depends on recipient verification and any required payment.'}</p>{receipt.reference && <p className={styles.status}>Reference: <strong>{receipt.reference}</strong></p>}{receipt.managementToken && <div className={styles.section}><label className={styles.field}>Private withdrawal code<input readOnly value={receipt.managementToken} autoComplete="off" onFocus={event => event.target.select()}/><small>Save this code privately now. It is shown only here and lets you withdraw your message. Do not send it to the candidate.</small></label></div>}{receipt.status && <p className={styles.status}>Status: {receipt.status.replace(/_/g, ' ')}</p>}<div className={styles.actions}><button className={styles.secondary} type="button" onClick={() => { setReceipt(null); setPreview(false); idempotencyKey.current = '' }}>Send another wish</button></div></section>

  if (preview) return <section className={styles.panel}><h2>Review your wish</h2><p className={styles.hint}>Check the card before you send it.</p>{initialWish && <><p className={styles.status}>Selected design: {initialWish.theme}. This style is shown for your card download. The private inbox currently stores and sends the text only, so the candidate will see the VibeSchool inbox card design.</p><div className={styles.preview} style={{ maxWidth: 460, margin: '0 auto' }}><CardArt template={initialWish.theme} values={{ candidate: candidateName, sender: senderName, message: text }}/></div></>}<div className={styles.preview}><WishCardExperience recipient={candidateName} school={school?.name} sender={senderName} text={kind === 'text' ? text : null} kind={kind} mediaUrl={kind !== 'text' ? mediaUrl : undefined}/></div>{kind !== 'text' && <p className={styles.status}>This is a local preview. Media sending is not available yet; your file has not been uploaded.</p>}{config?.paymentsEnabled && <p className={styles.status}>Any required payment must be confirmed before delivery. Submitting does not confirm payment.</p>}{config?.enabled && school && <div className={styles.section}>
      <h3>Verify your phone</h3>
      <p className={styles.hint}>A six-digit SMS code confirms control of your phone. Your number is not shared with the candidate.</p>
      <p className={styles.status}>{senderPhone || 'Add your phone number in the form.'}</p>
      {senderProof ? <p className={styles.status} role="status"><ShieldCheck size={16} aria-hidden="true"/> Phone verified.</p> :
        <div className={styles.row}>
          <button className={styles.secondary} type="button" disabled={verifying || !senderPhone} onClick={() => void requestSenderCode()}>{verifying ? 'Please wait…' : otpSent ? 'Resend code' : 'Text me a code'}</button>
          {otpSent && <><label className={styles.field}>Six-digit code<input type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={otpCode} onChange={event => setOtpCode(event.target.value)} autoComplete="one-time-code"/></label><button type="button" className={styles.secondary} disabled={verifying || !/^[0-9]{6}$/.test(otpCode)} onClick={() => void verifySenderCode()}>Verify code</button></>}
        </div>}
    </div>}
    {!school && <p className={styles.status}>This is a local preview. Choose the candidate’s school before submitting.</p>}{error && <div className={styles.error} role="alert">{error}</div>}<div className={styles.actions}><button className={styles.secondary} type="button" onClick={() => setPreview(false)}>Edit</button><button className={styles.primary} type="button" onClick={() => void send()} disabled={busy || !config?.enabled || !school || kind !== 'text' || !consent || !senderProof}>{busy ? 'Submitting…' : 'Submit wish'}</button></div></section>

  return <form className={styles.panel} noValidate onSubmit={event => event.preventDefault()}>
    <h2>Who are you cheering on?</h2><p className={styles.hint}>Your message goes to one candidate’s private inbox.</p>
    {storedDraft && <div className={styles.notice} role="status">
      <p>A draft was saved in this browser tab. Only restore it on your own device.</p>
      <div className={styles.row}>
        <button className={styles.secondary} type="button" onClick={restoreDraft}>Restore draft</button>
        <button className={styles.quiet} type="button" onClick={discardDraft}>Discard</button>
      </div>
    </div>}
    <div className={styles.section}><SchoolPicker selected={school} onChange={setSchool}/><div className={styles.grid} style={{ marginTop: 16 }}><label className={styles.field}>Candidate’s name<input value={candidateName} onChange={event => setCandidateName(event.target.value)} required maxLength={120} autoComplete="off"/></label><label className={styles.field}>Admission number<input value={admissionNumber} onChange={event => setAdmissionNumber(event.target.value)} required maxLength={60} autoComplete="off"/><small>Use the number issued by their school.</small></label></div></div>
    <div className={styles.section}><h3>Your message</h3><div className={styles.kinds} role="group" aria-label="Message format">{([{ id: 'text', label: 'Text', Icon: Mail }, { id: 'voice', label: 'Voice', Icon: Mic }, { id: 'video', label: 'Video', Icon: Video }] as const).map(({ id, label, Icon }) => <button key={id} type="button" aria-pressed={kind === id} className={`${styles.kind} ${kind === id ? styles.selectedKind : ''}`} onClick={() => { setKind(id); setFile(null); setError('') }}><Icon size={17} aria-hidden="true"/>{label}</button>)}</div>{kind === 'text' ? <><label className={styles.field}>Your encouragement<textarea value={text} onChange={event => setText(event.target.value)} required maxLength={2000} placeholder="Tell them what you want them to hear."/></label><p className={styles.count}>{text.length}/2,000</p></> : <div className={styles.file}><label className={styles.field}>{kind === 'voice' ? 'Choose a voice message' : 'Choose a video'}<input key={kind} type="file" accept={kind === 'voice' ? 'audio/*' : 'video/*'} onChange={event => chooseFile(event.target.files?.[0])}/>{kind === 'voice' && <VoiceRecorder onFile={recording => chooseFile(recording)} />}{kind === 'video' && <label className={styles.field}>Record on your phone<input type="file" accept="video/*" capture="environment" onChange={event => chooseFile(event.target.files?.[0])}/></label>}<small>Up to {config?.maxSeconds || 60} seconds · {Math.round((config?.maxBytes || 25 * 1024 * 1024) / 1024 / 1024)} MB maximum.</small></label><p className={styles.status}>You can preview a file. Sending {kind === 'voice' ? 'voice messages' : 'videos'} is currently unavailable.</p></div>}</div>
    <div className={styles.section}><div className={styles.grid}><label className={styles.field}>Your name<input value={senderName} onChange={event => setSenderName(event.target.value)} required maxLength={100} autoComplete="off"/></label><label className={styles.field}>Relationship<input value={relationship} onChange={event => setRelationship(event.target.value)} required maxLength={60} placeholder="e.g. Mum, Uncle, Teacher" autoComplete="off"/></label></div><label className={styles.field}>Mobile number (for an SMS code)<input type="tel" inputMode="tel" value={senderPhone} onChange={event => { setSenderEmail(event.target.value); setSenderProof(''); setOtpSent(false); setOtpCode('') }} required maxLength={18} autoComplete="tel"/><small>Phone verification does not establish a legal guardian relationship.</small></label><label className={styles.consent}><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} required/><span>I have permission to share this content with this candidate. I understand it is a private message.</span></label></div>
    {kind === 'text' && <label className={styles.consent}>
      <input type="checkbox" checked={saveDraft} onChange={event => {
        if (!event.target.checked) discardDraft()
        else setSaveDraft(true)
      }}/>
      <span>Save a draft for up to 30 minutes in this browser tab. Use only on a private device; leave unchecked on shared phones.</span>
    </label>}
    {error && <div className={styles.error} role="alert">{error}</div>}<div className={styles.actions}><span className={styles.hint}><LockKeyhole size={12} aria-hidden="true"/> Enter the candidate, your name and a wish to preview.</span><button type="button" onClick={showPreview} className={styles.primary} disabled={!candidateName.trim() || !senderName.trim() || (kind === 'text' ? !text.trim() : !file)}>Preview wish <span aria-hidden="true">→</span></button></div>
  </form>
}

function Inbox({ registerExit }: { registerExit: (handler: (() => Promise<boolean>) | null) => void }) {
  const [school, setSchool] = useState<School | null>(null)
  const [admissionNumber, setAdmissionNumber] = useState('')
  const [code, setCode] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [viewingTimes, setViewingTimes] = useState<ViewingWindow[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [inboxLoaded, setInboxLoaded] = useState(false)
  const inboxGeneration = useRef(0)

  useEffect(() => () => { inboxGeneration.current += 1 }, [])

  const signOut = useCallback(async (expired = false) => {
    // Invalidate pending reads before attempting the network sign-out.
    inboxGeneration.current += 1
    setMessages([]); setViewingTimes([]); setInboxLoaded(false)
    setBusy(true); setError('')
    try {
      await request('/api/success-wishes/session', { method: 'DELETE' })
      setAuthenticated(false); setMessages([]); setViewingTimes([]); setAdmissionNumber(''); setCode(''); setInboxLoaded(false)
      setNotice(expired ? 'Your session ended after inactivity. Open your inbox again to continue.' : 'Signed out. Your messages are no longer shown on this device.')
      return true
    } catch { setAuthenticated(false); setMessages([]); setViewingTimes([]); setAdmissionNumber(''); setCode(''); setInboxLoaded(false); setError('Sign-out could not be confirmed. Close this browser and contact your school before sharing the device.'); return false }
    finally { setBusy(false) }
  }, [])

  useEffect(() => {
    registerExit(busy ? async () => false : authenticated ? () => signOut() : null)
    return () => registerExit(null)
  }, [authenticated, busy, registerExit, signOut])

  useEffect(() => {
    if (!authenticated) return
    let timer: ReturnType<typeof setTimeout>
    const reset = () => { clearTimeout(timer); timer = setTimeout(() => void signOut(true), 5 * 60 * 1000) }
    reset()
    window.addEventListener('pointerdown', reset); window.addEventListener('keydown', reset)
    return () => { clearTimeout(timer); window.removeEventListener('pointerdown', reset); window.removeEventListener('keydown', reset) }
  }, [authenticated, signOut])

  async function loadInbox() {
    const current = ++inboxGeneration.current
    setBusy(true); setError(''); setInboxLoaded(false)
    try {
      const [data, viewing] = await Promise.all([
        request<{ messages: Message[] }>('/api/success-wishes/inbox'),
        request<{ windows: ViewingWindow[] }>('/api/success-wishes/my-viewing-times').catch(() => null),
      ])
      if (current !== inboxGeneration.current) return
      setMessages(data.messages); setViewingTimes(viewing?.windows || []); setInboxLoaded(true)
    } catch (reason) {
      if (current === inboxGeneration.current) setError(reason instanceof Error ? reason.message : 'Messages could not load.')
    } finally {
      if (current === inboxGeneration.current) setBusy(false)
    }
  }

  async function openVoice(messageId: string) {
    setBusy(true); setError('')
    try {
      const playback = await request<{url:string;expiresAt:string}>(
        '/api/success-wishes/media/voice-playback?messageId='+encodeURIComponent(messageId),
      )
      const uri = new URL(playback.url)
      const supabase = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || window.location.origin)
      if (uri.protocol !== 'https:' || uri.hostname !== supabase.hostname
        || uri.username || uri.password || uri.port
        || !uri.pathname.startsWith('/storage/v1/object/sign/success-wishes-private-voice/'))
        throw new Error('Private voice playback is unavailable.')
      setMessages(previous => previous.map(message =>
        message.id === messageId && message.state === 'available'
          ? {...message,mediaUrl:uri.href} : message))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Private voice playback is unavailable.')
    } finally { setBusy(false) }
  }

  async function openVideo(messageId: string) {
    setBusy(true); setError('')
    try {
      const playback = await request<{url:string;expiresAt:string}>(
        '/api/success-wishes/media/playback?messageId='+encodeURIComponent(messageId),
      )
      const uri = new URL(playback.url)
      if (uri.protocol !== 'https:' || uri.hostname !== 'iframe.videodelivery.net' ||
        uri.username || uri.password) throw new Error('Video playback is unavailable.')
      setMessages(previous => previous.map(message =>
        message.id === messageId && message.state === 'available'
          ? {...message,mediaUrl:uri.href} : message))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Video playback is unavailable.')
    } finally { setBusy(false) }
  }

  async function act(messageId: string, action: 'accept' | 'hide' | 'block' | 'report') {
    if (action === 'block' && !window.confirm('Block this sender from sending future wishes to your inbox?')) return
    setBusy(true); setError('')
    try {
      await request('/api/success-wishes/actions', { method: 'POST', body: JSON.stringify({ messageId, action }) })
      setMessages(previous => previous.filter(message => message.id !== messageId))
      await loadInbox()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'This action could not be completed.'); setBusy(false) }
  }

  async function open(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!school || busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      await request('/api/success-wishes/session', { method: 'POST', body: JSON.stringify({ schoolId: school.id, admissionNumber: admissionNumber.trim(), code }) })
      setCode(''); setAuthenticated(true); await loadInbox()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Your inbox could not open.'); setBusy(false) }
  }

  if (authenticated) return <RecipientInbox schoolName={school?.name} messages={messages} viewingTimes={viewingTimes} loaded={inboxLoaded} busy={busy} error={error} onRetry={() => void loadInbox()} onSignOut={() => void signOut()} onAct={(id, action) => void act(id, action)} onPlayVoice={id => void openVoice(id)} onPlayVideo={id => void openVideo(id)} />

  return <form className={styles.panel} onSubmit={open}><h2>Open your messages</h2><p className={styles.hint}>Choose the school to find your private inbox. You’ll need your admission number and a private access code issued by the school. If personal phones are restricted, follow school rules and use an approved device or viewing time.</p>{notice && <p className={styles.notice} role="status" style={{ marginTop: 16 }}>{notice}</p>}<div className={styles.section}><SchoolPicker selected={school} onChange={setSchool} disabled={busy} purpose="inbox"/><div className={styles.grid} style={{ marginTop: 16 }}><label className={styles.field}>Admission number<input value={admissionNumber} onChange={event => setAdmissionNumber(event.target.value)} required maxLength={60} autoComplete="off" disabled={busy}/></label><label className={styles.field}>Private access code<input type="password" value={code} onChange={event => setCode(event.target.value)} required maxLength={100} autoComplete="off" disabled={busy}/></label></div></div>{error && <div className={styles.error} role="alert" style={{ marginTop: 16 }}>{error}</div>}<div className={styles.actions}><span className={styles.hint}>Forgot your code? Contact the school that issued it.</span><button className={styles.primary} type="submit" disabled={!school || busy}>{busy ? 'Opening…' : 'Open inbox'}<LockKeyhole size={14} aria-hidden="true"/></button></div></form>
}

function WithdrawMessage() {
  const [reference, setReference] = useState('')
  const [managementToken, setManagementToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [status, setStatus] = useState<{ status: string; paymentStatus: string; expiresAt: string } | null>(null)
  async function checkStatus() {
    if (!reference.trim() || !managementToken.trim()) { setError('Enter the reference and private code.'); return }
    setBusy(true); setError(''); setStatus(null)
    try {
      const result = await request<{ status: string; paymentStatus: string; expiresAt: string }>(
        '/api/success-wishes/status', {
          method: 'POST',
          body: JSON.stringify({ reference: reference.trim(), managementToken: managementToken.trim() }),
        },
      )
      setStatus(result)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Status could not be checked.') }
    finally { setBusy(false) }
  }
  async function withdraw(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setStatus(null)
    try {
      await request('/api/success-wishes/messages', { method: 'DELETE', body: JSON.stringify({ reference: reference.trim(), managementToken: managementToken.trim() }) })
      setDone(true); setReference(''); setManagementToken('')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'The message could not be withdrawn.') }
    finally { setBusy(false) }
  }
  return <details className={styles.section}>
    <summary style={{ cursor: 'pointer', fontSize: 12, color: '#526958', padding: '10px 0' }}>Check or withdraw a wish you sent</summary>
    {done ? <p className={styles.notice} role="status">Your withdrawal request has been completed.</p> : <form onSubmit={withdraw}>
      <div className={styles.grid} style={{ marginTop: 14 }}>
        <label className={styles.field}>Submission reference<input value={reference} disabled={busy} onChange={event => { setReference(event.target.value); setStatus(null) }} required autoComplete="off" maxLength={100}/></label>
        <label className={styles.field}>Private withdrawal code<input type="password" value={managementToken} disabled={busy} onChange={event => { setManagementToken(event.target.value); setStatus(null) }} required autoComplete="off" maxLength={200}/></label>
      </div>
      <p className={styles.hint} style={{ marginTop: 10 }}>Only someone with both the reference and private code can check or withdraw this wish. Do not share your code.</p>
      {status && <p className={styles.notice} role="status">Wish: <strong>{status.status.replace(/_/g, ' ')}</strong> · Payment: {status.paymentStatus.replace(/_/g, ' ')} · Available until {new Date(status.expiresAt).toLocaleDateString('en-KE')}</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.row} style={{ marginTop: 14 }}>
        <button className={styles.secondary} type="button" disabled={busy} onClick={() => void checkStatus()}>Check status</button>
        <button className={styles.secondary} type="submit" disabled={busy}>{busy ? 'Please wait…' : 'Withdraw message'}</button>
      </div>
    </form>}
  </details>
}

export default function SuccessWishes({ initialWish, initialMode = 'send', onBackToDesign }: { initialWish?: CardDesignDraft; initialMode?: 'send' | 'inbox'; onBackToDesign?: () => void }) {
  const [mode, setMode] = useState<'send' | 'inbox'>(initialMode)
  const [config, setConfig] = useState<Configuration | null>(null)
  const [configError, setConfigError] = useState('')
  const exitInbox = useRef<(() => Promise<boolean>) | null>(null)
  const registerExit = useCallback((handler: (() => Promise<boolean>) | null) => { exitInbox.current = handler }, [])
  async function changeMode(next: 'send' | 'inbox') {
    if (next === mode) return
    if (exitInbox.current && !(await exitInbox.current())) return
    setMode(next)
  }
  useEffect(() => {
    let live = true
    request<Configuration>('/api/success-wishes/config').then(value => { if (live) setConfig(value) }).catch(() => { if (live) setConfigError('Availability could not be checked. You can prepare a wish, but sending is unavailable.') })
    return () => { live = false }
  }, [])
  return <div className={styles.page}><header className={styles.header}><Link href="/" className={styles.brand} onClick={event => { if (exitInbox.current) { event.preventDefault(); void exitInbox.current().then(ok => { if (ok) window.location.assign('/') }) } }}>VibeSchool<span style={{ color: '#82927c', fontWeight: 400 }}> / </span><span style={{ fontSize: 13, letterSpacing: 0 }}>Success Wishes</span></Link><span className={styles.headerNote}><LockKeyhole size={13} aria-hidden="true"/>Private messages</span></header><main className={styles.main} id="main-content"><div className={styles.intro}><p className={styles.eyebrow}>VibeSchool Success Wishes</p><h1>Let them know you believe.</h1><p>Choose a design, write from the heart and share a beautiful card. To send privately, use the school to find the candidate’s inbox.</p></div>{onBackToDesign && <button type="button" className={styles.quiet} onClick={onBackToDesign}>← Back to card design</button>}<div className={styles.formColumn} id="wish-composer"><div className={styles.tabs} role="group" aria-label="Success wishes options"><button type="button" className={`${styles.tab} ${mode === 'send' ? styles.activeTab : ''}`} aria-pressed={mode === 'send'} onClick={() => void changeMode('send')}><Heart size={17} aria-hidden="true"/>Send wishes</button><button type="button" className={`${styles.tab} ${mode === 'inbox' ? styles.activeTab : ''}`} aria-pressed={mode === 'inbox'} onClick={() => void changeMode('inbox')}><Mail size={17} aria-hidden="true"/>Candidate inbox</button></div>{configError && <div className={styles.notice} role="status">{configError}</div>}{config && !config.enabled && <div className={styles.notice} role="status">Delivery is paused while the private service is being prepared. You can review the journey, but no message will be sent or charged.</div>}{mode === 'send' ? <><SendForm config={config} initialWish={initialWish}/>{config?.mediaEnabled && <PaidMediaUpload/>}<WithdrawMessage/></> : <Inbox registerExit={registerExit}/>}</div><p className={styles.footer}><ShieldCheck size={12} aria-hidden="true"/> Keep personal details private. <Link href="/legal/privacy" style={{ color: 'inherit' }} onClick={event => { if (exitInbox.current) { event.preventDefault(); void exitInbox.current().then(ok => { if (ok) window.location.assign('/legal/privacy') }) } }}>Privacy</Link> · <Link href="/success-wishes/school" style={{ color: 'inherit' }} onClick={event => { if (exitInbox.current) { event.preventDefault(); void exitInbox.current().then(ok => { if (ok) window.location.assign('/success-wishes/school') }) } }}>School access</Link></p></main></div>

}
