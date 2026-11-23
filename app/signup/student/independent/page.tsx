'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { learnerDisplayName } from '@/lib/student/learner-welcome'
import { resolveRegistrationLearningSelection } from '@/lib/learner/learning-levels'
import LearningLevelSelect from '@/components/learner/LearningLevelSelect'
import { useAuthAppearance } from '@/app/auth/useAuthAppearance'
import { unifiedIdentityEnabled } from '@/lib/identity/features'
import { roleCanVisit, safeInternalPath } from '@/lib/auth-routing'
import styles from './signup.module.css'

export default function IndependentLearnerSignup() {
  const router = useRouter()
  const appearance = useAuthAppearance()
  const [loading,setLoading] = useState(true)
  const [verified,setVerified] = useState(false)
  const [level,setLevel] = useState('')
  const [choice,setChoice] = useState('')
  const [name,setName] = useState('')
  const [editing,setEditing] = useState(false)
  const [busy,setBusy] = useState(false)
  const [message,setMessage] = useState('')

  useEffect(() => {
    let active = true
    supabase.auth.getUser().then(({data,error})=>{
      if (!active) return
      setVerified(!error && !!data.user?.email_confirmed_at)
      const suggested = learnerDisplayName(data.user?.user_metadata?.full_name,data.user?.user_metadata?.name)
      setName(suggested)
      setEditing(!suggested)
      setLoading(false)
    }).catch(()=>{if(active){setLoading(false);setMessage('Could not check your sign-in.')}})
    return ()=>{active=false}
  },[])

  async function continueLearning() {
    if (!resolveRegistrationLearningSelection(level,choice)||!name.trim()||busy) return
    setBusy(true)
    setMessage('')
    try {
      const {data:{session}} = await supabase.auth.getSession()
      if (!session) throw new Error('Sign in again to continue.')
      const response = await fetch('/api/learner/independent/grade',{
        method:'POST',
        headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},
        body:JSON.stringify({level,choice,name:name.trim()}),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error||'Could not save your learning level.')
      // The destination is determined by the server, not a free-form user URL.
      const destination = result.destination === '/student/college' ? '/student/college' : '/student'
      const requested = safeInternalPath(new URLSearchParams(window.location.search).get('next'))
      const next = requested && roleCanVisit('student', requested) ? requested : destination
      router.replace(unifiedIdentityEnabled ? `/account/setup?next=${encodeURIComponent(next)}` : next)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not finish setup.')
    } finally { setBusy(false) }
  }

  return <main className={`${styles.shell} vs-auth`} data-auth-theme={appearance}>
    <section className={styles.card} aria-labelledby="learner-setup-heading">
      <a href="/signup/student" className={styles.brand}>VibeSchool</a>
      <h1 id="learner-setup-heading" className={styles.heading}>Start learning</h1>
      {loading ? <p className={styles.status} role="status">Checking account…</p>
        : !verified ? <a className={styles.link} href="/signup/student">Continue with Google</a>
        : <>
          {editing ? <label className={styles.label} htmlFor="learner-name">Your name
            <input id="learner-name" className={styles.input} autoComplete="name" maxLength={80}
              value={name} onChange={event=>setName(event.target.value)} placeholder="Your name"/>
          </label> : <div className={styles.name}><span className={styles.nameText}>{name}</span>
            <button type="button" className={styles.edit} onClick={()=>setEditing(true)}>Edit name</button>
          </div>}
          <LearningLevelSelect level={level} choice={choice} onLevelChange={setLevel}
            onChoiceChange={setChoice} disabled={busy}/>
          <button className={styles.primary} disabled={!resolveRegistrationLearningSelection(level,choice)||!name.trim()||busy}
            type="button" onClick={()=>void continueLearning()}>{busy?'Saving…':'Continue'}</button>
        </>}
      {message && <p className={styles.message} role="alert">{message}</p>}
    </section>
  </main>
}
