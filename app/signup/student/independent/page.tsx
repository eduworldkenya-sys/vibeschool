'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import LearnerGradePicker from '@/components/learner/LearnerGradePicker'
import { learnerDisplayName } from '@/lib/student/learner-welcome'

export default function IndependentLearnerSignup() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [verified, setVerified] = useState(false)
  const [grade, setGrade] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let active = true
    supabase.auth.getUser().then(({ data, error }) => {
      if (active) {
        setVerified(!error && !!data.user?.email_confirmed_at)
        setName(learnerDisplayName(data.user?.user_metadata?.full_name, data.user?.user_metadata?.name))
        setLoading(false)
      }
    }).catch(() => { if (active) { setLoading(false); setMessage('Could not check your sign-in.') } })
    return () => { active = false }
  }, [])

  async function saveGrade() {
    if (!grade || !name.trim() || busy) return
    setBusy(true)
    setMessage('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sign in again to continue.')
      const res = await fetch('/api/learner/independent/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
        body: JSON.stringify({ grade, name: name.trim() }),
      })
      if (!res.ok) {
        const result = await res.json()
        throw new Error(result.error || 'Could not save your grade.')
      }
      setSaved(true)
      router.replace('/student')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not finish setup.')
    } finally {
      setBusy(false)
    }
  }

  return <main style={{ minHeight:'100dvh',background:'#090915',color:'#fff',display:'grid',placeItems:'center',padding:20,fontFamily:'Arial,sans-serif' }}>
    <section style={{ maxWidth:440,width:'100%',padding:26,border:'1px solid #343448',borderRadius:16 }}>
      <a href="/signup/student" style={{color:'#c8a84b'}}>VibeSchool</a>
      <h1 style={{fontSize:28}}>Your learning space</h1>
      {loading ? <p>Checking your account…</p> : !verified ? <>
        <p>Continue with a verified Google account first.</p>
        <a href="/signup/student" style={{color:'#c8a84b'}}>Go to signup</a>
      </> : saved ? <>
        <p>Your grade is saved. You can start reading and learning.</p>
        <a href="/student" style={{color:'#c8a84b'}}>Open learner home</a>
      </> : <>
        <p>Your Google account is verified. Tell us your name and choose your grade to get started.</p>
        <label htmlFor="independent-learner-name" style={{display:'block',fontSize:14,marginBottom:6}}>Your name</label>
        <input id="independent-learner-name" value={name} onChange={event=>setName(event.target.value)}
          autoComplete="name" maxLength={80} required placeholder="First and last name"
          style={{width:'100%',padding:12,marginBottom:16,background:'#171726',border:'1px solid #55556b',borderRadius:8,color:'#fff',fontSize:16}} />
        <LearnerGradePicker value={grade} onChange={setGrade} legend="Your grade or form" />
        <button onClick={()=>void saveGrade()} disabled={!grade||!name.trim()||busy}
          style={{width:'100%',padding:14,background:'#c8a84b',color:'#090915',border:0,borderRadius:8,fontWeight:700}}>
          {busy?'Saving…':'Continue learning'}
        </button>
        <p style={{fontSize:13,color:'#aeb4c2'}}>You will enter your learner homepage. School-specific records require verified school enrollment.</p>
      </>}
      {message && <p role="alert" style={{color:'#fda4af'}}>{message}</p>}
    </section>
  </main>
}
