'use client'

import Link from 'next/link'
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Heart, MailOpen, Mic, Play, ShieldCheck, Trash2, Video } from 'lucide-react'
import VoiceRecorder from './VoiceRecorder'
import styles from './PilotJourney.module.css'

type Template = 'heritage' | 'botanical' | 'nightfall' | 'sunrise'
type Format = 'text' | 'voice' | 'video'
type Status = 'request' | 'accepted' | 'hidden' | 'reported'
type Wish = { id: string; template: Template; sender: string; relationship: string; text: string; format: Format; fileName?: string; status: Status; createdAt: string }
type Report = { wishId: string; reason: string; resolved: boolean }
type Pilot = { version: 1; open: boolean; code: string; wishes: Wish[]; reports: Report[]; blocked: string[] }
const KEY = 'vibeschool-gilgil-success-wishes-pilot-v1'
const SCHOOL = 'Gilgil Township · Test school'
const CANDIDATE = 'Pilot Candidate 01'
const TEMPLATES: { id: Template; title: string; subtitle: string; line: string }[] = [
  { id: 'heritage', title: 'Golden Hour', subtitle: 'Warm & timeless', line: 'The future is yours' },
  { id: 'botanical', title: 'New Beginnings', subtitle: 'Fresh & graceful', line: 'Bloom into greatness' },
  { id: 'nightfall', title: 'Bright Star', subtitle: 'Bold & confident', line: 'You were made to shine' },
  { id: 'sunrise', title: 'Above & Beyond', subtitle: 'Joyful & uplifting', line: 'Go make it happen' },
]
const initial = (): Pilot => ({ version: 1, open: true, code: 'GILGIL-TEST', wishes: [], reports: [], blocked: [] })

function safeRead(): Pilot {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (!parsed || typeof parsed !== 'object') return initial()
    const p = parsed as Partial<Pilot>
    if (p.version !== 1 || !Array.isArray(p.wishes) || !Array.isArray(p.reports) || !Array.isArray(p.blocked)
      || typeof p.open !== 'boolean' || typeof p.code !== 'string') return initial()
    return { version: 1, open: p.open, code: p.code, wishes: p.wishes.slice(0, 20), reports: p.reports.slice(0, 20), blocked: p.blocked.slice(0, 20) }
  } catch { return initial() }
}
function openMediaDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('vibeschool-gilgil-pilot-media-v1', 1)
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('media')) request.result.createObjectStore('media') }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new Error('Media storage is unavailable in this browser. Try text or enable browser storage.'))
  })
}
async function mediaAction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openMediaDB()
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction('media', mode)
      const request = action(transaction.objectStore('media'))
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(new Error('Local media operation failed.'))
      transaction.onerror = () => reject(new Error('Local media storage could not be completed.'))
    })
  } finally { db.close() }
}
function Card({ template, recipient, sender, text, compact = false }: { template: Template; recipient: string; sender?: string; text?: string; compact?: boolean }) {
  const chosen = TEMPLATES.find(t => t.id === template) || TEMPLATES[0]
  return <div className={[styles.cardArtwork, styles[template], compact ? styles.compact : ''].join(' ')}>
    <div className={styles.cardTop}>VIBESCHOOL <span>SUCCESS WISHES</span></div>
    <div className={styles.cardOrnament} aria-hidden="true">{template === 'botanical' ? '✿' : template === 'nightfall' ? '✦' : template === 'sunrise' ? '✳' : '✧'}</div>
    <div className={styles.cardCenter}><span className={styles.cardKicker}>To a remarkable candidate</span><strong>{chosen.line}</strong><span className={styles.cardRecipient}>{recipient}</span></div>
    {text && <p className={styles.cardMessage}>{text}</p>}
    <div className={styles.cardBottom}>{sender ? 'From ' + sender : 'WITH ALL OUR BEST WISHES'} <span>2026</span></div>
  </div>
}

export default function PilotJourney() {
  const [state, setState] = useState<Pilot>(initial)
  const [ready, setReady] = useState(false)
  const [mode, setMode] = useState<'sender' | 'candidate' | 'school'>('sender')
  const [template, setTemplate] = useState<Template>('heritage')
  const [format, setFormat] = useState<Format>('text')
  const [sender, setSender] = useState('Test Parent')
  const [relationship, setRelationship] = useState('Parent')
  const [message, setMessage] = useState('You have worked so hard. Walk into your exams with courage and confidence. We believe in you!')
  const [file, setFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState('')
  const [candidateCode, setCandidateCode] = useState('')
  const [candidateUnlocked, setCandidateUnlocked] = useState(false)
  const [viewId, setViewId] = useState('')
  const [mediaUrl, setMediaUrl] = useState('')
  const [receipt, setReceipt] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [reason, setReason] = useState('Unwanted message')
  const [preview, setPreview] = useState(false)

  useEffect(() => {
    setState(safeRead()); setReady(true)
    const sync = (e: StorageEvent) => { if (e.key === KEY) { setState(safeRead()); setViewId('') } }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])
  useEffect(() => {
    if (!file) { setFilePreview(''); return }
    const url = URL.createObjectURL(file)
    setFilePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  const view = useMemo(() => state.wishes.find(w => w.id === viewId), [state.wishes, viewId])
  useEffect(() => {
    let active = true
    let objectUrl = ''
    if (view?.status === 'accepted' && view.format !== 'text') {
      void mediaAction('readonly', store => store.get(view.id)).then(blob => {
        if (active && blob instanceof Blob) { objectUrl = URL.createObjectURL(blob); setMediaUrl(objectUrl) }
      }).catch(() => { if (active) setError('This browser cannot retrieve the test recording.') })
    } else setMediaUrl('')
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); setMediaUrl('') }
  }, [view?.id, view?.status, view?.format])
  function update(next: Pilot) {
    setState(next)
    try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { setError('Browser storage is disabled. The changes may not survive a refresh.') }
  }
  function setModeSafe(next: 'sender' | 'candidate' | 'school') {
    setMode(next); setError(''); setPreview(false); setViewId('')
    if (next !== 'candidate') { setCandidateUnlocked(false); setCandidateCode('') }
  }
  function chooseMedia(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) setRecording(f)
  }
  function setRecording(f: File) {
    setError('')
    if (!f.type.startsWith(format === 'voice' ? 'audio/' : 'video/')) { setError('Choose a matching audio or video file.'); return }
    if (f.size > 20 * 1024 * 1024) { setError('Test files must be 20 MB or smaller.'); return }
    setFile(f)
  }
  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError('')
    if (!state.open) { setError('School sending is closed in this pilot. Open it in School controls.'); return }
    if (!sender.trim() || !relationship.trim() || !message.trim()) { setError('Complete the sender, relationship and personal message.'); return }
    if (state.blocked.includes(sender.trim().toLowerCase())) { setError('The test candidate has blocked this sender.'); return }
    if (format !== 'text' && !file) { setError('Add a local test recording or video first.'); return }
    setBusy(true)
    const id = crypto.randomUUID()
    try {
      if (file && format !== 'text') await mediaAction('readwrite', store => store.put(file, id))
      const wish: Wish = { id, template, sender: sender.trim().slice(0, 80), relationship: relationship.trim().slice(0, 50),
        text: message.trim().slice(0, 800), format, fileName: file?.name.slice(0, 100), status: 'request',
        createdAt: new Date().toISOString() }
      update({ ...state, wishes: [wish, ...state.wishes].slice(0, 20) })
      setReceipt(id.slice(0, 8).toUpperCase()); setFile(null); setPreview(false)
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save test card.') }
    finally { setBusy(false) }
  }
  function act(id: string, status: Status) {
    update({ ...state, wishes: state.wishes.map(w => w.id === id ? { ...w, status } : w) })
    if (status === 'hidden' || status === 'reported') setViewId('')
  }
  function block(wish: Wish) {
    update({ ...state, blocked: [...new Set([...state.blocked, wish.sender.toLowerCase()])],
      wishes: state.wishes.map(w => w.sender.toLowerCase() === wish.sender.toLowerCase() ? { ...w, status: 'hidden' } : w) })
    setViewId('')
  }
  function report(wish: Wish) {
    update({ ...state, reports: [...state.reports, { wishId: wish.id, reason, resolved: false }], wishes: state.wishes.map(w => w.id === wish.id ? { ...w, status: 'reported' } : w) })
    setViewId('')
  }
  async function reset() {
    if (!window.confirm('Erase all fictional Gilgil pilot wishes and recordings stored in this browser?')) return
    try { await mediaAction('readwrite', store => store.clear()) } catch { /* storage may be unavailable */ }
    try { localStorage.removeItem(KEY) } catch { /* storage may be unavailable */ }
    setState(initial()); setCandidateUnlocked(false); setViewId(''); setReceipt(''); setError('')
  }
  if (!ready) return <div className={styles.loading}>Opening pilot…</div>
  return <div className={styles.page}>
    <header className={styles.header}>
      <Link href="/success-wishes" className={styles.back}><ArrowLeft size={17}/> Back to Success Wishes</Link>
      <span className={styles.testBadge}>CONTROLLED BROWSER PILOT</span>
    </header>
    <section className={styles.hero}>
      <div><p className={styles.eyebrow}>Gilgil Township · Free sponsored test</p>
        <h1>Give them a moment to remember.</h1>
        <p className={styles.lead}>Choose a beautiful card, make it personal and open it as a candidate. This pilot uses a fictional learner and test-only school participation.</p>
      </div>
      <div className={styles.heroMeta}><ShieldCheck size={19}/><strong>Safe to explore</strong><span>No live messages, payments, OTP or school records are changed. Test data stays in this browser.</span></div>
    </section>
    <nav className={styles.tabs} aria-label="Choose test role">
      <button className={mode === 'sender' ? styles.active : ''} onClick={() => setModeSafe('sender')}>01 <strong>Create a wish</strong></button>
      <button className={mode === 'candidate' ? styles.active : ''} onClick={() => setModeSafe('candidate')}>02 <strong>Candidate inbox</strong><span className={styles.count}>{state.wishes.filter(w => w.status === 'request').length}</span></button>
      <button className={mode === 'school' ? styles.active : ''} onClick={() => setModeSafe('school')}>03 <strong>School controls</strong></button>
    </nav>
    {error && <div className={styles.error} role="alert">{error}</div>}
    {mode === 'sender' && <>
      {receipt ? <section className={styles.success} role="status"><Check size={28}/><div><h2>Your test wish was saved.</h2><p>Reference {receipt}. Open the candidate inbox on this browser, enter the test code and accept the card. No real delivery or payment occurred.</p>
        <div className={styles.row}><button className={styles.primary} onClick={() => { setReceipt(''); setModeSafe('candidate') }}>Open candidate inbox <ArrowRight size={16}/></button><button className={styles.outline} onClick={() => { setReceipt(''); setPreview(false) }}>Create another card</button></div></div></section> :
      <form onSubmit={send}>
        <div className={styles.sectionTitle}><div><span>STEP ONE</span><h2>Choose your card</h2><p>Four finished, responsive styles. Your choice follows the wish into the inbox.</p></div></div>
        <div className={styles.gallery}>
          {TEMPLATES.map(t => <button type="button" key={t.id} className={[styles.templateChoice, template === t.id ? styles.chosen : ''].join(' ')} aria-pressed={template === t.id} onClick={() => setTemplate(t.id)}>
            <Card compact template={t.id} recipient={CANDIDATE}/>
            <div className={styles.templateLabel}><span><strong>{t.title}</strong><small>{t.subtitle}</small></span>{template === t.id && <span className={styles.selected}><Check size={15}/></span>}</div>
          </button>)}
        </div>
        <div className={styles.composer}>
          <div className={styles.composeFields}>
            <div className={styles.sectionTitle}><div><span>STEP TWO</span><h2>Make it personal</h2><p>Test recipient at {SCHOOL}. No real candidate data is used.</p></div></div>
            <div className={styles.recipientBox}><ShieldCheck size={20}/><span><strong>{CANDIDATE}</strong><small>Gilgil Township · Fictional candidate · DEMO-001</small></span></div>
            <div className={styles.twoFields}><label>Your test sender name<input value={sender} onChange={e => setSender(e.target.value)} maxLength={80} required autoComplete="off"/></label><label>Relationship<input value={relationship} onChange={e => setRelationship(e.target.value)} maxLength={50} required autoComplete="off"/></label></div>
            <label className={styles.fieldLabel}>Your personal wish<textarea value={message} maxLength={800} onChange={e => setMessage(e.target.value)} rows={5} required/><small>{message.length}/800 characters</small></label>
            <div className={styles.formatHeader}><strong>Add a personal touch</strong><span>For testing only</span></div>
            <div className={styles.formatPicker}>
              {([{ id:'text', Icon:Heart, label:'Message' },{id:'voice',Icon:Mic,label:'Voice note'},{id:'video',Icon:Video,label:'Video'}] as const).map(({id,Icon,label})=><button key={id} type="button" aria-pressed={format===id} className={format===id?styles.formatActive:''} onClick={()=>{setFormat(id);setFile(null)}}><Icon size={18}/>{label}</button>)}
            </div>
            {format !== 'text' && <div className={styles.mediaArea}>
              <label>Select a {format === 'voice' ? 'voice recording' : 'video'}<input type="file" accept={format === 'voice' ? 'audio/*' : 'video/*'} onChange={chooseMedia}/></label>
              {format === 'voice' && <VoiceRecorder onFile={setRecording}/>}
              {format === 'video' && <label className={styles.capture}>Or record a test video on your phone<input type="file" accept="video/*" capture="user" onChange={chooseMedia}/></label>}
              {file && <div><p>{file.name} · {(file.size/1024/1024).toFixed(1)} MB</p>{format==='voice'?<audio controls src={filePreview}/>:<video className={styles.localVideo} controls playsInline src={filePreview}/>}</div>}
              <small>Audio/video is stored locally in this browser's test IndexedDB, not uploaded to VibeSchool. Limit 20 MB.</small>
            </div>}
            <div className={styles.controls}><button className={styles.outline} type="button" onClick={()=>setPreview(v=>!v)}>{preview?'Hide preview':'Preview full card'}</button><button className={styles.primary} type="submit" disabled={busy || !state.open || !message.trim() || (format!=='text'&&!file)}>{busy?'Saving…':'Send test card'} <ArrowRight size={17}/></button></div>
            {!state.open && <p className={styles.warning}>Sending is disabled by the school simulation. Reopen it in School controls.</p>}
          </div>
          <div className={styles.liveCard}><span>LIVE CARD PREVIEW</span><Card template={template} recipient={CANDIDATE} sender={sender} text={preview?message:undefined}/><p>Premium design is generated from your actual choices, not a static sample.</p></div>
        </div>
      </form>}
    </>}
    {mode === 'candidate' && <section className={styles.candidate}>
      {!candidateUnlocked ? <div className={styles.unlock}><MailOpen size={28}/><h2>Open your private test inbox</h2><p>This simulates the school-issued access step. It is <strong>not real authentication</strong>; use fictional information only.</p>
        <form onSubmit={e=>{e.preventDefault();if(candidateCode.trim().toUpperCase()===state.code){setCandidateUnlocked(true);setError('')}else setError('Incorrect test access code.')}}>
          <label>Gilgil Township test access code<input value={candidateCode} onChange={e=>setCandidateCode(e.target.value)} autoComplete="off" placeholder="Enter code" required/></label>
          <p className={styles.testCode}>Test code: <strong>{state.code}</strong></p>
          <button className={styles.primary} type="submit">Open inbox <ArrowRight size={17}/></button>
        </form>
      </div> : <div className={styles.inbox}><div className={styles.inboxHeader}><div><span>GILGIL TOWNSHIP · FICTIONAL</span><h2>Wishes for {CANDIDATE}</h2><p>Open and accept the messages you want to see.</p></div><button className={styles.outline} onClick={()=>{setCandidateUnlocked(false);setViewId('');setCandidateCode('')}}>Finish & sign out</button></div>
        {view && view.status === 'accepted' ? <div className={styles.openCard}>
          <button className={styles.textBack} onClick={()=>setViewId('')}><ArrowLeft size={17}/> All wishes</button>
          <Card template={view.template} recipient={CANDIDATE} sender={view.sender} text={view.text}/>
          {view.format === 'voice' && (mediaUrl ? <audio className={styles.playback} controls src={mediaUrl}/> : <p>Retrieving local test voice…</p>)}
          {view.format === 'video' && (mediaUrl ? <video className={styles.playback} controls playsInline src={mediaUrl}/> : <p>Retrieving local test video…</p>)}
          <div className={styles.candidateActions}><button className={styles.outline} onClick={()=>act(view.id,'hidden')}>Hide card</button><button className={styles.outline} onClick={()=>block(view)}>Block test sender</button><select aria-label="Reason to report" value={reason} onChange={e=>setReason(e.target.value)}><option>Unwanted message</option><option>Abusive language</option><option>Wrong recipient</option></select><button className={styles.outline} onClick={()=>report(view)}>Report</button></div>
        </div> : <>
          {state.wishes.filter(w=>w.status==='request'||w.status==='accepted').length===0 ? <div className={styles.empty}><MailOpen size={32}/><h3>No pending wishes</h3><p>Create a fictional card from the sender tab to test this inbox.</p></div> :
          <div className={styles.inboxGrid}>{state.wishes.filter(w=>w.status==='request'||w.status==='accepted').map(w=><div className={styles.inboxItem} key={w.id}>
            <Card template={w.template} recipient={CANDIDATE} compact/>
            <div><strong>From {w.sender}</strong><p>{w.relationship} · {new Date(w.createdAt).toLocaleDateString('en-KE')}</p><span>{w.format === 'text'?'Personal message':w.format === 'voice'?'Voice & message':'Video & message'}</span></div>
            <button className={styles.primary} onClick={()=>{if(w.status==='request')act(w.id,'accepted');setViewId(w.id)}}>{w.status==='request'?'Accept & open':'Open again'} <ArrowRight size={15}/></button>
            {w.status==='request' && <button className={styles.textBack} onClick={()=>act(w.id,'hidden')}>Decline</button>}
          </div>)}</div>}
        </>}
      </div>}
    </section>}
    {mode === 'school' && <section className={styles.school}>
      <div className={styles.sectionTitle}><div><span>SCHOOL CONTROL SIMULATION</span><h2>Gilgil Township pilot operations</h2><p>These are simulated controls. They do not enrol the real school or change VibeSchool's live school settings.</p></div></div>
      <div className={styles.schoolGrid}><div className={styles.stat}><span>Sponsored messages</span><strong>Free</strong><small>No M-Pesa charged</small></div><div className={styles.stat}><span>Test wishes created</span><strong>{state.wishes.length}</strong><small>Only in this browser</small></div><div className={styles.stat}><span>Unresolved reports</span><strong>{state.reports.filter(r=>!r.resolved).length}</strong><small>Browser-only review queue</small></div></div>
      <div className={styles.schoolSetting}><div><strong>Test school participation</strong><p>Switch this off to verify sender disabled states.</p></div><button className={state.open?styles.primary:styles.outline} onClick={()=>update({...state,open:!state.open})}>{state.open?'Close sending':'Open test sending'}</button></div>
      <div className={styles.schoolSetting}><div><strong>Candidate access code</strong><p>Fictional shared-browser demonstration, not a secure issued credential.</p><code>{state.code}</code></div><button className={styles.outline} onClick={()=>{const code='GILGIL-'+Math.random().toString(36).slice(2,8).toUpperCase(); update({...state,code});setCandidateUnlocked(false)}}>Rotate test code</button></div>
      {state.reports.length>0 && <div className={styles.reports}><h3>Reports to review</h3>{state.reports.map((r,i)=><div key={i}><span>{r.reason} · {r.wishId.slice(0,8)}</span><button className={styles.outline} disabled={r.resolved} onClick={()=>update({...state,reports:state.reports.map((x,j)=>j===i?{...x,resolved:true}:x)})}>{r.resolved?'Resolved':'Mark resolved'}</button></div>)}</div>}
      <button className={styles.danger} onClick={()=>void reset()}><Trash2 size={17}/> Clear all fictional pilot data and recordings</button>
      <p className={styles.boundary}><ShieldCheck size={17}/> Production remains gated: actual school opt-in, secure database delivery, SMS OTP, independent media verification and paid M-Pesa checkout are not enabled by this pilot.</p>
    </section>}
    <footer className={styles.footer}>VibeSchool · Gilgil Township test journey · Fictional candidate only · No live delivery</footer>
  </div>
}
