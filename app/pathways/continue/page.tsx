'use client'

import type { CSSProperties } from 'react'
import Link from 'next/link'
import { useEffect,useMemo,useState } from 'react'
import { supabase } from '@/lib/supabase'
import { QUICK_CHECK_PATHWAYS,QUICK_CHECK_RULE_VERSION,QUICK_CHECK_STORAGE_KEY,calculateQuickCheck,rankQuickCheck } from '@/lib/pathways/quickCheck'

type StoredCheck={answers?:Record<string,number>;complete?:boolean;ruleVersion?:string}
type Role='student'|'parent'|'teacher'|'admin'|'global_user'|string

function createIdempotencyKey(prefix:string){
  try { return `${prefix}:${crypto.randomUUID()}` } catch { return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2)}` }
}

export default function PathwaysContinuePage(){
  const [hydrated,setHydrated]=useState(false)
  const [stored,setStored]=useState<StoredCheck|null>(null)
  const [userRole,setUserRole]=useState<Role|null>(null)
  const [signedIn,setSignedIn]=useState(false)
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')

  useEffect(()=>{
    try { const raw=localStorage.getItem(QUICK_CHECK_STORAGE_KEY); if(raw) setStored(JSON.parse(raw) as StoredCheck) } catch {}
    void (async()=>{
      const {data:{user}}=await supabase.auth.getUser()
      if(!user){setHydrated(true);return}
      setSignedIn(true)
      const {data}=await supabase.from('profiles').select('role').eq('id',user.id).maybeSingle()
      if(data?.role) setUserRole(data.role as Role)
      setHydrated(true)
    })()
  },[])

  const scores=useMemo(()=>calculateQuickCheck(stored?.answers??{}),[stored])
  const leader=useMemo(()=>rankQuickCheck(scores)[0],[scores])
  const result=QUICK_CHECK_PATHWAYS[leader]
  const validDraft=Boolean(stored?.complete&&stored.ruleVersion===QUICK_CHECK_RULE_VERSION&&stored.answers)

  async function save(){
    if(!validDraft||!stored?.answers) return
    setBusy(true);setMessage('')
    try{
      const key=createIdempotencyKey(`pathways-${userRole??'account'}`)
      if(userRole==='student'){
        const {error}=await supabase.rpc('student_adopt_pathway_quick_check',{p_pathway_slug:result.canonicalSlug,p_answers:stored.answers,p_scores:scores,p_rule_version:QUICK_CHECK_RULE_VERSION,p_idempotency_key:key})
        if(error) throw error
        setMessage('Saved to your learner Pathway Passport. You can review or change this direction later.')
        return
      }
      if(userRole==='parent'){
        const {error}=await supabase.rpc('parent_save_pathway_draft',{p_pathway_slug:result.canonicalSlug,p_answers:stored.answers,p_scores:scores,p_rule_version:QUICK_CHECK_RULE_VERSION,p_idempotency_key:key})
        if(error) throw error
        setMessage('Saved as your parent-owned family Pathways draft. It has not changed any learner account or learner Pathway Passport.')
        return
      }
      setMessage('This result can only be saved as a learner-owned Passport or a parent-owned family draft.')
    }catch{setMessage('This Pathways result could not be saved safely on the current release. Your browser copy is still intact.')}
    finally{setBusy(false)}
  }

  if(!hydrated)return<main style={S.root}><div style={S.shell}>Checking your continuation options…</div></main>

  return<main style={S.root}><div style={S.shell}>
    <Link href="/pathways/check" style={S.back}>← Pathway Check</Link><p style={S.kicker}>SAFE CONTINUATION</p><h1 style={S.h1}>Keep the value. Add an account only when it helps.</h1>
    {!validDraft?<section style={S.card}><strong>No completed Pathway Check found on this device.</strong><p style={S.body}>Run the free check first. Pathways does not create an account just to show an answer.</p><Link href="/pathways/check" style={S.primary}>Start free check</Link></section>:<>
      <section style={S.result}><span style={S.resultLabel}>LOCAL RESULT</span><h2 style={S.resultTitle}>{result.name}</h2><p style={S.resultBody}>{result.summary}</p></section>
      {!signedIn?<section style={S.card}><h2 style={S.cardTitle}>Choose the safe account lane</h2><p style={S.body}>For a completely new family, the durable account starts with the adult parent. A learner account still requires the existing guardian/school connection and learner code; Pathways does not bypass that safeguard.</p><div style={S.actions}><Link href="/signup/parent" style={S.primary}>Create parent account</Link><Link href="/login/parent" style={S.secondary}>Parent sign in</Link><Link href="/login/student" style={S.secondary}>Existing learner sign in</Link></div><p style={S.small}>Your completed result remains in this browser while you sign in. Parent saving creates only an adult-owned planning draft, never a learner identity.</p></section>:<section style={S.card}><h2 style={S.cardTitle}>{userRole==='student'?'Save to my learner Passport':userRole==='parent'?'Save as a family planning draft':'This account cannot own a Pathways result'}</h2><p style={S.body}>{userRole==='student'?'Saving records your current direction and the rule version that produced it. You remain able to review or change it later.':userRole==='parent'?'Saving preserves the result under your adult account so your family can continue later. It does not silently adopt the direction for a child.':'Teacher/admin accounts may support learners but do not own the learner decision.'}</p>{(userRole==='student'||userRole==='parent')&&<button type="button" disabled={busy} onClick={()=>void save()} style={S.primaryButton}>{busy?'Saving safely…':'Save and continue'}</button>}{message&&<div role="status" style={S.message}>{message}</div>}</section>}
    </>}
  </div></main>
}

const S:Record<string,CSSProperties>={root:{minHeight:'100dvh',background:'#f7f7fb',color:'#111827',padding:'24px 16px 60px'},shell:{maxWidth:680,margin:'0 auto'},back:{display:'inline-block',marginBottom:28,color:'#4f46e5',fontWeight:800,fontSize:13,textDecoration:'none'},kicker:{fontSize:10,fontWeight:900,letterSpacing:'.16em',color:'#4f46e5'},h1:{fontSize:'clamp(32px,6vw,48px)',lineHeight:1.07,letterSpacing:'-.04em',margin:'8px 0 18px'},card:{background:'#fff',border:'1px solid #e3e5eb',borderRadius:18,padding:18,marginTop:12},cardTitle:{fontSize:18,margin:'0 0 8px'},body:{color:'#626b7b',fontSize:13,lineHeight:1.6},small:{display:'block',color:'#7c8494',fontSize:10,lineHeight:1.5,marginTop:12},result:{padding:20,borderRadius:20,background:'#171642',color:'#fff',marginBottom:12},resultLabel:{fontSize:9,fontWeight:900,letterSpacing:'.16em',opacity:.65},resultTitle:{fontSize:28,margin:'5px 0'},resultBody:{color:'#d8d8e6',fontSize:13,lineHeight:1.55},actions:{display:'grid',gap:9,marginTop:14},primary:{display:'block',textAlign:'center',padding:'13px 14px',borderRadius:12,background:'#4f46e5',color:'#fff',fontWeight:850,fontSize:13,textDecoration:'none'},secondary:{display:'block',textAlign:'center',padding:'12px 14px',borderRadius:12,border:'1px solid #d9dce5',color:'#3730a3',fontWeight:850,fontSize:13,textDecoration:'none'},primaryButton:{width:'100%',border:0,borderRadius:12,padding:'13px 14px',background:'#4f46e5',color:'#fff',fontWeight:850,cursor:'pointer',marginTop:12},message:{marginTop:12,borderRadius:12,padding:12,background:'#eef2ff',color:'#3730a3',fontSize:12,lineHeight:1.5}}
