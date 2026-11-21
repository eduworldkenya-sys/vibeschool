'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Headphones, Hand, Mic, MicOff, Volume2, WifiOff, X } from 'lucide-react'
import type { DailyCall } from '@daily-co/daily-js'
import { supabase } from '@/lib/supabase'
import styles from './LiveVoice.module.css'

type Learner = { studentId:string; name:string; needsHelp:boolean }
type VoiceParticipant = {
  session_id:string; user_id?:string
  audioTrack?:MediaStreamTrack | null
  tracks?:{audio?:{persistentTrack?:MediaStreamTrack|null;track?:MediaStreamTrack|null}}
  permissions?:{canSend?:unknown}
}
type Props = {
  roomId:string;classId:string|null;teacher:boolean;status:'active'|'paused'|'ended'
  learners:Learner[];onAcknowledge:(studentId:string)=>Promise<void>
}
function canPublishAudio(value:unknown):boolean{
  if (value===true)return true
  if (Array.isArray(value))return value.includes('audio')
  if (value instanceof Set)return value.has('audio')
  return false
}
export function LiveVoice({roomId,classId,teacher,status,learners,onAcknowledge}:Props) {
  const meeting=useRef<DailyCall|null>(null)
  const media=useRef<Map<string,HTMLAudioElement>>(new Map())
  const speaker=useRef<string|null>(null)
  const connectGeneration=useRef(0)
  const connectedUser=useRef<string|null>(null)
  const moderating=useRef<Set<string>>(new Set())
  const [phase,setPhase]=useState<'idle'|'connecting'|'listening'|'failed'>('idle')
  const [error,setError]=useState('')
  const [micOn,setMicOn]=useState(false)
  const [permission,setPermission]=useState(false)
  const [activeSpeaker,setActiveSpeaker]=useState<string|null>(null)
  const [soundBlocked,setSoundBlocked]=useState(false)
  const [connectedIds,setConnectedIds]=useState<string[]>([])
  const [busy,setBusy]=useState(false)
  const clearAudio=useCallback(()=>{
    for (const audio of media.current.values()){audio.pause();audio.srcObject=null;audio.remove()}
    media.current.clear();setConnectedIds([]);setSoundBlocked(false)
  },[])
  const stop=useCallback(async()=>{
    ++connectGeneration.current
    const existing=meeting.current;meeting.current=null;speaker.current=null
    clearAudio();setPhase('idle');setMicOn(false);setPermission(false);setActiveSpeaker(null)
    if (existing){try{if(!existing.isDestroyed())await existing.destroy()}catch{/* already closed */}}
  },[clearAudio])
  // The voice connection is intentionally independent of classroom history,
  // whiteboard and slide state. Unmount or expired authorization stops tracks.
  useEffect(()=>{return()=>{void stop()}},[stop])
  useEffect(()=>{if(status!=='active')void stop()},[status,stop])
  useEffect(()=>{
    const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{
      if (event==='SIGNED_OUT' || (connectedUser.current && session?.user.id!==connectedUser.current))void stop()
    })
    return()=>subscription.unsubscribe()
  },[stop])
  const sync=useCallback(()=>{
    const call=meeting.current
    if (!call)return
    const all=call.participants() as unknown as Record<string,VoiceParticipant>
    const remotes=Object.values(all).filter(p=>p.session_id && p.session_id!==all.local?.session_id)
    const nextIds:string[]=[]
    for (const p of remotes){
      if (!p.user_id)continue
      nextIds.push(p.user_id)
      const track=p.tracks?.audio?.persistentTrack??p.tracks?.audio?.track??p.audioTrack
      const existing=media.current.get(p.session_id)
      if (!track || track.readyState==='ended'){
        if(existing){existing.pause();existing.srcObject=null;existing.remove();media.current.delete(p.session_id)}
        continue
      }
      const oldTrack=(existing?.srcObject as MediaStream|null)?.getAudioTracks()?.[0]
      if(oldTrack===track)continue
      const audio=existing??document.createElement('audio')
      audio.autoplay=true;audio.setAttribute('playsinline','');audio.muted=false
      audio.setAttribute('aria-hidden','true')
      if(!existing){audio.style.display='none';document.body.appendChild(audio);media.current.set(p.session_id,audio)}
      audio.srcObject=new MediaStream([track])
      void audio.play().then(()=>setSoundBlocked(false)).catch(()=>setSoundBlocked(true))
    }
    for (const [sid,audio] of media.current)if (!remotes.some(p=>p.session_id===sid)){
      audio.pause();audio.srcObject=null;audio.remove();media.current.delete(sid)
    }
    setConnectedIds(nextIds)
    if (!teacher) {
      const me=all.local
      const approved=canPublishAudio(me?.permissions?.canSend)
      setPermission(approved)
      if (!approved){setMicOn(false);if(call.localAudio())void call.setLocalAudio(false)}
    }
  },[teacher])
  const connect=async()=>{
    if(meeting.current || phase==='connecting' || status!=='active')return
    const generation=++connectGeneration.current
    setPhase('connecting');setError('')
    let call:DailyCall|null=null
    try{
      const {data:{session}}=await supabase.auth.getSession()
      if(!session)throw Error('Sign in to join audio.')
      connectedUser.current=session.user.id
      const res=await fetch('/api/live/voice/'+encodeURIComponent(roomId),{
        method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},
        body:JSON.stringify({classId}),cache:'no-store',signal:AbortSignal.timeout(16000),
      })
      const data=await res.json().catch(()=>({}))
      if(!res.ok)throw Error(typeof data.error==='string'?data.error:'Audio is currently unavailable.')
      if(!data.url||!data.token||data.role!==(teacher?'teacher':'learner'))throw Error('Invalid voice authorization.')
      const {default:Daily}=await import('@daily-co/daily-js')
      if (generation!==connectGeneration.current)return
      call=Daily.createCallObject({videoSource:false})
      meeting.current=call
      call.on('participant-joined',sync)
      call.on('participant-updated',sync)
      call.on('participant-left',sync)
      call.on('track-started',sync)
      call.on('track-stopped',sync)
      call.on('error',()=>{if(meeting.current===call)void stop().then(()=>{setError('Audio connection lost. Retry joining.');setPhase('failed')})})
      call.on('left-meeting',()=>{void stop()})
      await call.join({url:data.url,token:data.token})
      if(generation!==connectGeneration.current){if(!call.isDestroyed())await call.destroy();return}
      // Daily room start_audio_off is true; microphone permission remains user initiated.
      await call.setLocalAudio(false)
      setPhase('listening');sync()
    }catch(e){
      if(call && !call.isDestroyed())await call.destroy().catch(()=>{})
      if(generation===connectGeneration.current){
        meeting.current=null;setPhase('failed');setError(e instanceof Error?e.message:'Audio unavailable.')
      }
    }
  }
  const toggleMic=async()=>{
    const call=meeting.current
    if(!call || (!teacher&&!permission))return
    setBusy(true);setError('')
    try {
      await call.setLocalAudio(!micOn)
      setMicOn(Boolean(call.localAudio()))
    }catch{setError('Could not use microphone. Check device permissions.')}
    finally{setBusy(false)}
  }
  const allow=async(studentId:string)=>{
    const call=meeting.current
    if(!teacher||!call||busy||!learners.some(p=>p.studentId===studentId&&p.needsHelp))return
    setBusy(true);setError('')
    try{
      const list=Object.values(call.participants() as unknown as Record<string,VoiceParticipant>)
      const target=list.find(p=>p.user_id===studentId&&p.session_id)
      if(!target)throw Error('Learner must join audio before speaking.')
      // Revocation goes to the media server, not a cosmetic mute button.
      if(speaker.current && speaker.current!==studentId) {
        const previous=list.find(p=>p.user_id===speaker.current&&p.session_id)
        if(previous)await call.updateParticipant(previous.session_id,{
          updatePermissions:{canSend:false},setAudio:false,
        })
      }
      speaker.current=null;setActiveSpeaker(null)
      // Canonical Live ACK re-checks that the learner really raised a hand,
      // belongs to this session and remains eligible for teaching.
      await onAcknowledge(studentId)
      speaker.current=studentId
      try {
        await call.updateParticipant(target.session_id,{
          updatePermissions:{canSend:['audio']},setAudio:false,
        })
      } catch (error) {
        speaker.current=null
        throw error
      }
      setActiveSpeaker(studentId)
    }catch(e){setError(e instanceof Error?e.message:'Could not allow voice.')}
    finally{setBusy(false)}
  }
  const endTurn=async()=>{
    const call=meeting.current,studentId=speaker.current
    if(!teacher||!call||!studentId)return
    setBusy(true);setError('')
    try{
      const p=Object.values(call.participants() as unknown as Record<string,VoiceParticipant>)
        .find(p=>p.user_id===studentId&&p.session_id)
      if(p)await call.updateParticipant(p.session_id,{updatePermissions:{canSend:false},setAudio:false})
      speaker.current=null;setActiveSpeaker(null)
    }catch{setError('Could not revoke voice. Retry before allowing another learner.')}
    finally{setBusy(false)}
  }
  useEffect(()=>{
    if (!teacher||!speaker.current||status!=='active')return
    if(!learners.some(l=>l.studentId===speaker.current)){
      // Learner no longer belongs to teacher's authorized roster.
      void endTurn()
    }
  // React to revocation and membership changes; avoid resetting for content.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[learners,teacher,status])
  // Keep Daily audio access in sync with the canonical teacher roster. A
  // removed learner is ejected from the media service, not just hidden in UI.
  // Independent server-side/offline revocation proof is still required.
  useEffect(()=>{
    const call=meeting.current
    if (!teacher||phase!=='listening'||!call)return
    const allowed=new Set(learners.map(l=>l.studentId))
    const people=Object.values(call.participants() as unknown as Record<string,VoiceParticipant>)
    for (const p of people) {
      if (!p.session_id||p.session_id===call.participants().local.session_id)continue
      const unauthorized=!p.user_id||!allowed.has(p.user_id)
      const unapprovedMic=canPublishAudio(p.permissions?.canSend)&&speaker.current!==p.user_id
      if ((!unauthorized&&!unapprovedMic)||moderating.current.has(p.session_id))continue
      moderating.current.add(p.session_id)
      void call.updateParticipant(p.session_id,unauthorized?{eject:true}:{
        updatePermissions:{canSend:false},setAudio:false,
      }).catch(()=>{
        setError('Could not enforce audio access. End this class audio and retry.')
      }).finally(()=>moderating.current.delete(p.session_id))
    }
  },[teacher,phase,learners,connectedIds])
  const enableSound=async()=>{
    const tracks=[...media.current.values()]
    const results=await Promise.allSettled(tracks.map(a=>a.play()))
    setSoundBlocked(results.some(x=>x.status==='rejected'))
  }
  const speakingName=learners.find(l=>l.studentId===activeSpeaker)?.name
  return <section className={styles.voice} aria-label="Classroom audio">
    <div className={styles.summary}>
      <Headphones size={17} aria-hidden="true"/>
      <strong>Voice</strong>
      <span className={styles.phase} role="status">{phase==='idle'?'Off':phase==='connecting'?'Connecting…':phase==='failed'?'Disconnected':teacher?'Connected':'Listening'}</span>
      {phase==='idle'||phase==='failed'?
        <button type="button" onClick={()=>void connect()} disabled={status!=='active'}><Volume2 size={15}/> Join audio</button>:
        <button type="button" onClick={()=>void stop()} disabled={phase==='connecting'}><X size={15}/> Leave audio</button>}
      {phase==='listening'&&<button type="button" onClick={()=>void toggleMic()}
        disabled={busy||(!teacher&&!permission)} aria-pressed={micOn}
        title={!teacher&&!permission?'Raise your hand and wait for teacher approval':'Microphone'}>
        {micOn?<Mic size={15}/>:<MicOff size={15}/>} {micOn?'Mute':teacher?'Speak':permission?'Speak':'Muted'}
      </button>}
    </div>
    {phase==='listening'&&<div className={styles.detail}>
      {teacher?<>Learners on audio: {connectedIds.length}{speakingName?' · Speaking: '+speakingName:''}</>
        :permission?'Teacher allowed you to speak. Tap Speak to turn on your microphone.':'Listening only · Raise your hand to request speaking.'}
    </div>}
    {teacher&&phase==='listening'&&<div className={styles.requests}>
      {learners.filter(l=>l.needsHelp).map(l=><button key={l.studentId} disabled={busy||!connectedIds.includes(l.studentId)}
        type="button" onClick={()=>void allow(l.studentId)}>
        <Hand size={15} aria-hidden="true"/> Allow {l.name} to speak
      </button>)}
      {activeSpeaker&&<button type="button" disabled={busy} onClick={()=>void endTurn()}>End speaking turn</button>}
    </div>}
    {soundBlocked&&<button type="button" onClick={()=>void enableSound()}>Tap to enable sound</button>}
    {error&&<span className={styles.error} role="alert"><WifiOff size={14} aria-hidden="true"/> {error}</span>}
  </section>
}
