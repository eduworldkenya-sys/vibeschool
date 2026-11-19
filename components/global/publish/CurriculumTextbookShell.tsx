'use client'
import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { SCHOOL_LEVELS } from '@/lib/learn/schoolCatalog'

type Props = { onOpen: (id: string) => void; onChanged: () => void }
type Result = { publication_id: string; status: string; connected: boolean; added: number; chapters: number }

/** The same idempotent RPC is available to authorized ChatGPT-led production tooling. */
export function CurriculumTextbookShell({ onOpen, onChanged }: Props) {
 const [grade,setGrade] = useState('Grade 5')
 const [subject,setSubject] = useState('')
 const [busy,setBusy] = useState(false)
 const [result,setResult] = useState<Result | null>(null)
 const [error,setError] = useState('')
 async function ensure(connect: boolean) {
  if (busy || !subject.trim()) return
  setBusy(true);setResult(null);setError('')
  try {
   const sb=createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
   const {data,error:failure}=await sb.rpc('ensure_curriculum_textbook_shell',{p_grade:grade,p_subject:subject.trim(),p_connect:connect})
   if (failure) throw new Error(failure.message)
   if (!data?.publication_id) throw new Error('Book was not returned.')
   setResult(data as Result);onChanged()
  } catch (e) { setError(e instanceof Error?e.message:'Could not save textbook shell.') }
  finally {setBusy(false)}
 }
 const field={width:'100%',padding:12,borderRadius:10,background:'#1a2235',color:'#fff',border:'1px solid #354155',fontSize:15}
 return <section aria-label="Curriculum textbook shell" style={{padding:16,border:'1px solid #354155',borderRadius:14,marginBottom:22,display:'grid',gap:10}}>
  <h2 style={{fontSize:19,margin:0}}>VibeSchool Originals</h2>
  <label>Grade<select style={field} value={grade} disabled={busy} onChange={e=>{setGrade(e.target.value);setResult(null)}}>{SCHOOL_LEVELS.flatMap(l=>l.grades).map(g=><option key={g}>{g}</option>)}</select></label>
  <label>Subject<input style={field} value={subject} disabled={busy} onChange={e=>{setSubject(e.target.value);setResult(null)}} placeholder="e.g. Christian Religious Education"/></label>
  <button type="button" disabled={busy||!subject.trim()} onClick={()=>void ensure(false)} style={field}>Create / open empty book</button>
  <button type="button" disabled={busy||!subject.trim()} onClick={()=>void ensure(true)} style={{...field,background:'#CCFF00',color:'#090D16',fontWeight:800}}>Connect curriculum</button>
  {busy&&<p role="status">Saving book…</p>}
  {error&&<p role="alert">{error}</p>}
  {result&&<><p role="status">{result.chapters} sections · {result.connected?'Curriculum linked':'Awaiting curriculum'}{result.added>0?' · '+result.added+' added':''}</p>
   <button type="button" onClick={()=>onOpen(result.publication_id)} style={field}>Open textbook</button></>}
 </section>
}
