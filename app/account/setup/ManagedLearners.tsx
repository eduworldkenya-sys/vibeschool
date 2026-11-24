'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'

type Child = {
  id: string
  username: string
  display_name: string
  grade_label?: string | null
  status?: 'managed' | 'linked' | 'link_pending'
  linked_student_id?: string | null
}
type Identities = { self: { id: string; username: string } | null; managed_learners: Child[] }
type Credentials = { loginId: string; password: string }
const GRADES = ['PP1','PP2',...Array.from({ length: 12 },(_,i)=>`Grade ${i+1}`),
  'Form 1','Form 2','Form 3','Form 4']

export default function ManagedLearners() {
  const [data, setData] = useState<Identities | null>(null)
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [grade, setGrade] = useState('')
  const [gradeOverrides, setGradeOverrides] = useState<Record<string,string>>({})
  const [guardianConfirmed, setGuardianConfirmed] = useState(false)
  const [credentials, setCredentials] = useState<Credentials | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [activating, setActivating] = useState<string | null>(null)

  async function load() {
    const response = await fetch('/api/identity/me',{ cache:'no-store', credentials:'same-origin' })
    if (!response.ok) throw new Error('Could not load learner profiles')
    setData(await response.json() as Identities)
  }
  useEffect(()=>{void load().catch(()=>setError('Could not load profiles.'))},[])

  async function create(event:FormEvent) {
    event.preventDefault()
    if (!guardianConfirmed) {setError('Confirm you are authorized to create this learner account.');return}
    if (!GRADES.includes(grade)) {setError('Select the learning level.');return}
    setBusy(true);setError('');setCredentials(null)
    try {
      const response=await fetch('/api/identity/children',{
        method:'POST',credentials:'same-origin',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({name,username,grade,guardianConfirmed}),
      })
      const result=await response.json()
      if (!response.ok) {setError(result.error||'Could not create learner profile');return}
      setName('');setUsername('');setGrade('');setGuardianConfirmed(false)
      await load()
    } catch {setError('Could not connect. Try again.')}
    finally {setBusy(false)}
  }

  async function activate(child:Child) {
    const selected=gradeOverrides[child.id] || child.grade_label || ''
    if (!GRADES.includes(selected)) {setError('Select a learning level for this child.');return}
    setError('');setCredentials(null);setActivating(child.id)
    try {
      const response=await fetch('/api/identity/children/activate',{
        method:'POST',credentials:'same-origin',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({identityId:child.id,grade:selected,confirmGuardian:true}),
      })
      const result=await response.json()
      if (!response.ok || !result.activated) {
        setError(result.error||'Could not activate the learner account');return
      }
      setCredentials({loginId:result.loginId,password:result.password})
      await load()
    } catch {setError('Connection lost. If the account was created, ask support before trying again.')}
    finally {setActivating(null)}
  }

  return <main style={{background:'#f8fafc',minHeight:'100dvh',padding:'clamp(16px,4vw,40px)'}}>
    <section style={{maxWidth:600,margin:'0 auto',background:'#fff',padding:24,
      border:'1px solid #e5e7eb',boxShadow:'0 8px 32px #0f172a0a'}}>
      <h1 style={{fontSize:26,margin:'0 0 8px'}}>My learners</h1>
      <p style={{color:'#475569',margin:'0 0 24px'}}>Create a learner account without a school. Each child has their own learning history.</p>
      {error && <p role="alert" style={{color:'#b91c1c'}}>{error}</p>}
      {credentials && <section aria-label="New learner sign-in" style={{border:'1px solid #059669',padding:16,marginBottom:24,background:'#f0fdf4'}}>
        <h2 style={{margin:'0 0 8px',fontSize:18}}>Learner ready</h2>
        <p style={{margin:'0 0 12px'}}>Keep these details securely. The password is shown only once.</p>
        <p style={{margin:'6px 0'}}>Sign-in ID: <strong>{credentials.loginId}</strong></p>
        <p style={{margin:'6px 0'}}>Password: <strong style={{overflowWrap:'anywhere'}}>{credentials.password}</strong></p>
        <button type="button" onClick={()=>void navigator.clipboard?.writeText(
          `VibeSchool learner sign-in\nID: ${credentials.loginId}\nPassword: ${credentials.password}\nhttps://vibeschool.co.ke/login/student`
        )} style={{padding:12,marginTop:10}}>Copy login details</button>
        <p><Link href="/login/student">Open learner sign-in</Link></p>
      </section>}
      <h2 style={{fontSize:18,marginBottom:10}}>Children</h2>
      {(data?.managed_learners?.length ?? 0) === 0 && <p style={{color:'#64748b'}}>No learners yet.</p>}
      <div style={{display:'grid',gap:12,marginBottom:28}}>
      {(data?.managed_learners||[]).map(child=><div key={child.id} style={{padding:16,border:'1px solid #e2e8f0'}}>
        <strong>{child.display_name}</strong> <span style={{color:'#64748b'}}>@{child.username}</span>
        {child.status === 'linked' ? <p style={{color:'#166534',marginBottom:0}}>Learning account active · {child.grade_label || 'Learner'}</p> : <>
          <p style={{color:'#475569',fontSize:13}}>Choose a level, then create this child's private login.</p>
          <label style={{display:'block',marginBottom:10}}>Learning level
            <select aria-label={`Learning level for ${child.display_name}`}
              value={gradeOverrides[child.id] ?? child.grade_label ?? ''}
              onChange={e=>setGradeOverrides(v=>({...v,[child.id]:e.target.value}))}
              style={{display:'block',width:'100%',padding:10,marginTop:5}}>
              <option value="">Choose level</option>
              {GRADES.map(g=><option key={g} value={g}>{g}</option>)}
            </select>
          </label>
          <button type="button" disabled={!!activating || busy}
            onClick={()=>void activate(child)} style={{padding:'10px 16px'}}>
            {activating===child.id?'Preparing…':'Activate learning account'}
          </button>
        </>}
      </div>)}
      </div>
      <form onSubmit={create} style={{display:'grid',gap:12}}>
        <h2 style={{fontSize:18,margin:'0 0 2px'}}>Add a learner</h2>
        <label>Name<input required maxLength={80} value={name} onChange={e=>setName(e.target.value)}
          style={{display:'block',width:'100%',padding:12,marginTop:5,boxSizing:'border-box'}} /></label>
        <label>Unique username<input required minLength={3} maxLength={24} autoCapitalize="none"
          value={username} onChange={e=>setUsername(e.target.value)} placeholder="brian254"
          style={{display:'block',width:'100%',padding:12,marginTop:5,boxSizing:'border-box'}} /></label>
        <label>Learning level
          <select required value={grade} onChange={e=>setGrade(e.target.value)}
            style={{display:'block',width:'100%',padding:12,marginTop:5}}>
            <option value="">Choose level</option>{GRADES.map(g=><option key={g} value={g}>{g}</option>)}
          </select>
        </label>
        <label style={{display:'flex',gap:8,alignItems:'flex-start'}}>
          <input type="checkbox" checked={guardianConfirmed} onChange={e=>setGuardianConfirmed(e.target.checked)} />
          I am this learner's parent or authorized guardian.
        </label>
        <button disabled={busy || !!activating || !guardianConfirmed} type="submit"
          style={{padding:14,fontWeight:700,background:'#111827',color:'white',border:0}}>
          {busy?'Saving…':'Add learner'}
        </button>
        <p style={{color:'#64748b',fontSize:13,margin:0}}>No school code or extra account approval. School linking is optional later.</p>
      </form>
    </section>
  </main>
}
