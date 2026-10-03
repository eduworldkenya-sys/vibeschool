"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import type { TwinRole } from '@/lib/twin/core'
import { confirmPersonalTwinMark, executePersonalTwin, observePersonalTwin, type PersonalTwinReply, type MarkProposal } from '@/lib/twin/service'
import { safeTwinRoute, type TwinLink } from '@/lib/twin/personal'

/** One integration for every role; the HQ service keeps its isolated session. */
export function usePersonalTwin(role: TwinRole, active = true) {
  const path = usePathname()
  const search = useSearchParams().toString()
  const pendingRef = useRef<MarkProposal|null>(null)
  const [reply, setReply] = useState<PersonalTwinReply | null>(null)
  const [memoryError,setMemoryError] = useState('')
  const [saving,setSaving] = useState(false)
  const recentLinks=useRef<TwinLink[]>([])
  const generation=useRef(0)
  const inFlight=useRef(false)
  const currentPath=()=>`${window.location.pathname}${window.location.search}`

  useEffect(()=>{
    generation.current++
    pendingRef.current=null
    setReply(null)
    recentLinks.current=[]
    const client = role==='hq' ? import('@/lib/hq/supabase').then(m=>m.hqSupabase) : import('@/lib/supabase').then(m=>m.supabase)
    let cancelled=false
    let unsubscribe:(()=>void)|undefined
    void client.then(c=>{
      if(cancelled)return
      const {data}=c.auth.onAuthStateChange(event=>{
        if(event==='SIGNED_OUT'||event==='SIGNED_IN'){
          generation.current++
          pendingRef.current=null
          recentLinks.current=[]
          setReply(null)
        }
      })
      unsubscribe=()=>data.subscription.unsubscribe()
    })
    return()=>{cancelled=true;unsubscribe?.();generation.current++}
  },[role,path,search])

  // Event-driven awareness: route changes, focus and successful domain mutations.
  // No polling, keyboard capture, background microphone or full-page scraping.
  useEffect(()=>{
    if(!active)return
    let cancelled=false
    const observe=(action?:string)=>{
      if(document.visibilityState==='hidden'||!navigator.onLine)return
      void observePersonalTwin(role,currentPath(),action).then(()=>{if(!cancelled)setMemoryError('')}).catch(e=>{if(!cancelled)setMemoryError(e instanceof Error?e.message:'Activity memory is unavailable.')})
    }
    observe()
    const saved=()=>observe('mark_saved')
    window.addEventListener('vibeschool:record-saved',saved)
    return()=>{cancelled=true;window.removeEventListener('vibeschool:record-saved',saved)}
  },[role,path,search,active])

  const execute=useCallback(async(input:string):Promise<PersonalTwinReply|null>=>{
    const ticket=++generation.current
    pendingRef.current=null
    setReply(null)
    const result=await executePersonalTwin(input,role,currentPath(),recentLinks.current)
    if(ticket!==generation.current)throw new Error('Your working context changed. Repeat the request on the current screen.')
    if(result){pendingRef.current=result.proposal??null;setReply(result);if(result.links?.length)recentLinks.current=result.links}
    return result
  },[role])

  const confirm=useCallback(async(proposal:MarkProposal)=>{
    if(inFlight.current || pendingRef.current!==proposal)return
    pendingRef.current=null
    inFlight.current=true;setSaving(true)
    const ticket=generation.current
    try{
      const result=await confirmPersonalTwinMark(proposal)
      if(ticket===generation.current){setReply(result);recentLinks.current=result.links??[]}
    }catch(e){if(ticket===generation.current)setReply({text:e instanceof Error?e.message:'The score could not be saved. Check the marks sheet before retrying.'})}
    finally{inFlight.current=false;setSaving(false)}
  },[])
  const dismiss=useCallback(()=>{generation.current++;pendingRef.current=null;setReply(null)},[])
  return {reply,execute,confirm,saving,memoryError,dismiss,role}
}

export function PersonalTwinActions({twin,onNavigate}:{twin:ReturnType<typeof usePersonalTwin>;onNavigate?:()=>void}) {
  const router=useRouter()
  const {reply}=twin
  if(!reply && !twin.memoryError)return <p style={{fontSize:12}}>Try “find Sifuna”, “open my timetable”, “what next” or “my memory”. Say “pause learning” to stop remembering activity.</p>
  return <div style={{display:'grid',gap:8,color:'inherit',fontSize:13}}>
    {twin.memoryError && <details><summary>Activity memory unavailable</summary><p role="status">{twin.memoryError}. School records still use their normal permissions.</p></details>}
    {reply?.proposal && <div style={{padding:12,border:'1px solid #cbd5e1',borderRadius:12}}>
      <p>{reply.text}</p>
      <button type="button" disabled={twin.saving} onClick={()=>void twin.confirm(reply.proposal!)} style={{minHeight:44,padding:'8px 12px'}}> {twin.saving?'Saving…':'Save this score'} </button>{' '}
      <button type="button" disabled={twin.saving} onClick={twin.dismiss} style={{minHeight:44}}>Cancel</button>
    </div>}
    {reply && !reply.proposal && <p role="status" style={{margin:0,whiteSpace:'pre-wrap'}}>{reply.text}</p>}
    {reply?.evidence?.length ? <details><summary>Why Twin suggests this</summary><ul>{reply.evidence.map((e,i)=><li key={i}>{e}</li>)}</ul></details>:null}
    {reply?.links?.filter(l=>safeTwinRoute(l.route,twin.role)).map(link=><button type="button" key={`${link.kind}:${link.id}`} onClick={()=>{onNavigate?.();router.push(link.route)}} style={{textAlign:'left',minHeight:44,padding:10,border:'1px solid #cbd5e1',borderRadius:10,background:'#fff',color:'#0f172a'}}><strong>{link.title}</strong>{link.detail && <div style={{fontSize:11,color:'#475569'}}>{link.detail}</div>}</button>)}
  </div>
}
