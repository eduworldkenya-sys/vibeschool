'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { QUICK_CHECK_PATHWAYS, QUICK_CHECK_QUESTIONS, QUICK_CHECK_RULE_VERSION, QUICK_CHECK_STORAGE_KEY, calculateQuickCheck, rankQuickCheck } from '@/lib/pathways/quickCheck'

const SAVE_KEY = 'vs_pathways_save_id_v1'

type StoredCheck = { answers?: Record<string, number>; complete?: boolean }

export default function PathwaysContinuePage() {
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [ready, setReady] = useState(false)
  const [role, setRole] = useState<string | null>(null)
  const [authenticated, setAuthenticated] = useState(false)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(QUICK_CHECK_STORAGE_KEY)
      const parsed = raw ? JSON.parse(raw) as StoredCheck : null
      if (parsed?.complete && parsed.answers) setAnswers(parsed.answers)
    } catch {}

    void (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setReady(true); return }
      setAuthenticated(true)
      const { data } = await supabase.rpc('get_my_role')
      setRole(typeof data === 'string' ? data : null)
      setReady(true)
    })()
  }, [])

  const scores = useMemo(() => calculateQuickCheck(answers), [answers])
  const ranking = useMemo(() => rankQuickCheck(scores), [scores])
  const leader = ranking[0]
  const pathway = QUICK_CHECK_PATHWAYS[leader]
  const hasResult = Object.keys(answers).length === QUICK_CHECK_QUESTIONS.length

  async function save() {
    if (!hasResult || !pathway || saving) return
    setSaving(true); setMessage('')
    try {
      let idempotencyKey = localStorage.getItem(SAVE_KEY)
      if (!idempotencyKey) {
        idempotencyKey = `pathways-${crypto.randomUUID()}`
        localStorage.setItem(SAVE_KEY, idempotencyKey)
      }
      const { data, error } = await supabase.rpc('pathways_save_my_quick_check', {
        p_pathway_slug: pathway.canonicalSlug,
        p_answers: answers,
        p_scores: scores,
        p_rule_version: QUICK_CHECK_RULE_VERSION,
        p_idempotency_key: idempotencyKey,
      })
      if (error) throw error
      const saved = data && typeof data === 'object' && !Array.isArray(data) && data.ok === true
      setMessage(saved ? 'Saved. Your Pathway Passport is now attached to your learner account.' : 'The result could not be verified as saved.')
    } catch {
      setMessage('Your result is still safe on this device, but it could not be saved to your account yet.')
    } finally { setSaving(false) }
  }

  if (!ready) return <main style={S.root}><div style={S.shell}>Loading…</div></main>

  return <main style={S.root}><div style={S.shell}>
    <Link href="/pathways/check" style={S.back}>← Pathway check</Link>
    <p style={S.kicker}>CONTINUE SAFELY</p>
    <h1 style={S.h1}>{hasResult ? `Keep exploring ${pathway.name}` : 'Finish your free check first'}</h1>
    <p style={S.lead}>Your anonymous answers stay on this device until you explicitly save them. Signing in never changes your role, school membership or learner identity.</p>

    {!hasResult && <section style={S.card}><p style={S.body}>There is no completed Pathway Check on this device.</p><Link href="/pathways/check" style={S.primary}>Take the free check</Link></section>}

    {hasResult && authenticated && (role === 'student' || role === 'global_user') && <section style={S.card}>
      <h2 style={S.h2}>Save to your learner account</h2>
      <p style={S.body}>This saves the result as learner-supplied guidance. It does not become an official placement decision.</p>
      <button onClick={()=>void save()} disabled={saving} style={S.button}>{saving ? 'Saving…' : 'Save my Pathway Passport'}</button>
      {message && <p role="status" style={S.note}>{message}</p>}
    </section>}

    {hasResult && authenticated && role !== 'student' && role !== 'global_user' && <section style={S.card}>
      <h2 style={S.h2}>This account is not a learner identity</h2>
      <p style={S.body}>Your result remains on this device. Parent, teacher and admin accounts cannot silently adopt a learner's pathway.</p>
      <Link href="/pathways" style={S.secondary}>Keep exploring</Link>
    </section>}

    {hasResult && !authenticated && <>
      <section style={S.card}><h2 style={S.h2}>Already have a learner account?</h2><p style={S.body}>Sign in and return here. Your local result will still be available.</p><div style={S.grid}><Link href="/login/global?next=%2Fpathways%2Fcontinue" style={S.primary}>Independent learner sign in</Link><Link href="/login/student?next=%2Fpathways%2Fcontinue" style={S.secondary}>School-linked learner sign in</Link></div></section>
      <section style={S.card}><h2 style={S.h2}>New to VibeSchool?</h2><p style={S.body}>If you are an independent adult learner, create a free independent learner account. If you are a school learner, use the secure learner code flow. A parent or guardian can create their own account without pretending to be the learner.</p><div style={S.grid}><Link href="/global/signup?next=%2Fpathways%2Fcontinue" style={S.primary}>Create independent learner account</Link><Link href="/signup/student?next=%2Fpathways%2Fcontinue" style={S.secondary}>I have a learner code</Link><Link href="/signup/parent?next=%2Fpathways%2Fcontinue" style={S.secondary}>I am a parent or guardian</Link></div></section>
    </>}

    <section style={S.trust}><strong>Identity boundary</strong><p style={S.body}>Pathways never creates a school membership from a URL or a quiz result. School-linked learner identity continues to use VibeSchool's existing claim/guardian process.</p></section>
  </div></main>
}

const S: Record<string, React.CSSProperties> = {
  root:{minHeight:'100dvh',background:'#f7f7fb',color:'#111827',padding:'24px 16px 60px'},shell:{maxWidth:680,margin:'0 auto'},back:{color:'#4f46e5',textDecoration:'none',fontWeight:800,fontSize:13},kicker:{marginTop:28,color:'#4f46e5',fontSize:10,fontWeight:900,letterSpacing:'.16em'},h1:{fontSize:36,lineHeight:1.08,letterSpacing:'-.03em',margin:'8px 0 12px'},lead:{color:'#5b6475',lineHeight:1.65,fontSize:14},card:{background:'#fff',border:'1px solid #e5e7eb',borderRadius:18,padding:18,marginTop:14},trust:{background:'#fffbeb',border:'1px solid #fde68a',borderRadius:18,padding:18,marginTop:14},h2:{fontSize:18,margin:'0 0 8px'},body:{color:'#626b7b',fontSize:13,lineHeight:1.6},note:{fontSize:12,color:'#166534'},grid:{display:'grid',gap:8,marginTop:14},primary:{display:'block',textAlign:'center',padding:'12px 14px',borderRadius:12,background:'#4f46e5',color:'#fff',textDecoration:'none',fontWeight:800,fontSize:13},secondary:{display:'block',textAlign:'center',padding:'12px 14px',borderRadius:12,border:'1px solid #d8dae2',color:'#3730a3',textDecoration:'none',fontWeight:800,fontSize:13},button:{width:'100%',marginTop:14,padding:'12px 14px',border:0,borderRadius:12,background:'#4f46e5',color:'#fff',fontWeight:800,cursor:'pointer'}
}
