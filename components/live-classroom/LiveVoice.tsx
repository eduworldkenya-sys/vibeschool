'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Headphones, Hand, Mic, MicOff, Volume2, WifiOff, X } from 'lucide-react'
import type { DailyCall } from '@daily-co/daily-js'
import { supabase } from '@/lib/supabase'
import styles from './LiveVoice.module.css'

type Learner = { studentId:string; name:string; needsHelp:boolean }
type Props = {
  roomId:string;classId:string|null;teacher:boolean;enabled:boolean;status:'active'|'paused'|'ended'
  learners:Learner[];onAcknowledge:(studentId:string)=>Promise<void>
}
// Keep provider details out of learner-facing UI. Daily's typed fatal-error
// category is enough to distinguish a transport fault from a rejected meeting.
function dailyVoiceError(type:unknown):string {
  switch(type){
    case 'meeting-full': return 'Daily audio room is full. End the previous audio connection and retry.'
    case 'exp-token': case 'exp-room': return 'Audio access expired. Rejoin the active lesson.'
    case 'nbf-token': case 'nbf-room': return 'Audio is not available before this lesson starts.'
    case 'not-allowed': case 'ejected': return 'Daily denied this audio connection. Check classroom access.'
    case 'no-room': return 'Daily could not find the audio room. Leave and rejoin the lesson.'
    case 'connection-error': return 'Daily audio connection failed. Check network connection and retry.'
    case 'end-of-life': return 'Daily ended this audio session. Rejoin the active lesson.'
    default: return 'Daily audio failed to connect. Retry, or report the error.'
  }
}
type VoiceDiagnosticStage = 'joining' | 'signaling' | 'media' | 'connected' | 'unknown'
const safeFatalCodes = new Set([
  'ejected','nbf-room','nbf-token','exp-room','exp-token','no-room',
  'meeting-full','end-of-life','not-allowed','connection-error',
])
// Only categories leave this browser. Never transmit Daily's raw errorMsg,
// localizedMsg, token, room URL, participant identifier or browser exceptions.
function voiceDiagnosticCode(value:unknown):string {
  return typeof value==='string' && safeFatalCodes.has(value)?value:'unknown'
}
function voiceDiagnosticHint(value:unknown):string {
  if(typeof value!=='string')return 'unknown'
  const msg=value.slice(0,512).toLowerCase()
  if(/\b(token|jwt|expired|expiry)\b/.test(msg))return 'token'
  if(/\b(denied|forbidden|unauthorized|permission|access)\b/.test(msg))return 'access'
  if(/\b(full|capacity|participant limit|quota)\b/.test(msg))return 'capacity'
  if(/\b(camera|microphone|device|mediadevices)\b/.test(msg))return 'device'
  if(/\b(room|meeting)\b/.test(msg))return 'room'
  if(/\b(ice|turn|stun|sfu|signaling|websocket|peer|network|disconnect|connection)\b/.test(msg))return 'transport'
  if(/\b(timed? out|timeout|deadline)\b/.test(msg))return 'timeout'
  return 'unknown'
}
function unknownJoinMessage(stage:VoiceDiagnosticStage,hint:string):string {
  return stage==='joining' && hint==='unknown'
    ? 'Daily audio could not connect. Retry; if it keeps failing, try another network.'
    : 'Daily audio failed ('+stage+' / '+hint+'). Retry joining.'
}
function canPublishAudio(value:unknown):boolean{
  if (value===true)return true
  if (Array.isArray(value))return value.includes('audio')
  if (value instanceof Set)return value.has('audio')
  return false
}
export function LiveVoice({roomId,classId,teacher,enabled,status,learners,onAcknowledge}:Props) {
  const meeting=useRef<DailyCall|null>(null)
  const media=useRef<Map<string,HTMLAudioElement>>(new Map())
  const speaker=useRef<string|null>(null)
  const connectGeneration=useRef(0)
  const connectedUser=useRef<string|null>(null)
  const renewTimer=useRef<ReturnType<typeof setTimeout>|null>(null)
  const connecting=useRef(false)
  const micPreference=useRef(false) // explicit teacher decision, persists only across authorized renewals
  const alive=useRef(false)
  const currentStatus=useRef(status)
  currentStatus.current=status
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
  const stop=useCallback(async(preserveMic=false)=>{
    if(!preserveMic)micPreference.current=false
    ++connectGeneration.current
    if(renewTimer.current){clearTimeout(renewTimer.current);renewTimer.current=null}
    const existing=meeting.current;meeting.current=null;speaker.current=null
    clearAudio();setPhase('idle');setMicOn(false);setPermission(false);setActiveSpeaker(null)
    if (existing){try{if(!existing.isDestroyed())await existing.destroy()}catch{/* already closed */}}
  },[clearAudio])
  // The voice connection is intentionally independent of classroom history,
  // whiteboard and slide state. Unmount or expired authorization stops tracks.
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;void stop()}},[stop])
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
    const all=call.participants()
    const remotes=Object.values(all).filter(p=>p.session_id && p.session_id!==all.local?.session_id)
    const nextIds:string[]=[]
    for (const p of remotes){
      if (!p.user_id)continue
      nextIds.push(p.user_id)
      const track=p.tracks.audio.track??p.tracks.audio.persistentTrack??p.audioTrack
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
    if(!enabled||!alive.current||meeting.current||connecting.current||currentStatus.current!=='active')return
    connecting.current=true
    const generation=++connectGeneration.current
    setPhase('connecting');setError('')
    let call:DailyCall|null=null
    let stage:VoiceDiagnosticStage='joining'
    let reported=false
    let reportFailure:(code:string,hint:string)=>void=()=>{}
    try{
      const {data:{session}}=await supabase.auth.getSession()
      if(!session)throw Error('Sign in to join audio.')
      connectedUser.current=session.user.id
      reportFailure=(code,hint)=>{
        if(reported)return
        reported=true
        // Enumeration-only telemetry is authorized by the same Live RPC and
        // canonical Live scope and classroom RPC as token issuance. A failure to report never blocks UI.
        void fetch('/api/live/voice/'+encodeURIComponent(roomId),{
          method:'PATCH',
          headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},
          body:JSON.stringify({classId,diagnostic:{stage,code,hint}}),
          cache:'no-store',keepalive:true,signal:AbortSignal.timeout(5000),
        }).catch(()=>{})
      }
      const res=await fetch('/api/live/voice/'+encodeURIComponent(roomId),{
        method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},
        body:JSON.stringify({classId}),cache:'no-store',signal:AbortSignal.timeout(16000),
      })
      const data=await res.json().catch(()=>({}))
      if(!res.ok)throw Error(typeof data.error==='string'?data.error:'Audio is currently unavailable.')
      if(!data.url||!data.token||data.role!==(teacher?'teacher':'learner'))throw Error('Invalid voice authorization.')
      const {default:Daily}=await import('@daily-co/daily-js')
      if (generation!==connectGeneration.current||!alive.current)return
      // Explicitly start Daily's call object muted, in addition to the room
      // and token policy. Do not request mobile mic capture merely to listen.
      call=Daily.createCallObject({videoSource:false,startVideoOff:true,startAudioOff:true})
      meeting.current=call
      call.on('participant-joined',sync)
      call.on('participant-updated',sync)
      call.on('participant-left',sync)
      call.on('track-started',sync)
      call.on('track-stopped',sync)
      call.on('joining-meeting',()=>{stage='joining'})
      call.on('joined-meeting',()=>{stage='connected'})
      call.on('network-connection',event=>{
        if(event.type==='signaling')stage='signaling'
        if(event.type==='sfu'||event.type==='peer-to-peer')stage='media'
      })
      // Daily reports browser microphone failures as camera-error, separately
      // from fatal connection errors. Keep listening if speaking is blocked.
      call.on('camera-error',event=>{
        if(meeting.current!==call || event.errorMsg?.audioOk===true)return
        if(!micPreference.current && !meeting.current?.localAudio())return
        micPreference.current=false
        setMicOn(false)
        setError('Microphone unavailable. Allow microphone access in your browser, then tap Speak again.')
        reportFailure('device-error','device')
      })
      call.on('error',event=>{
        if(meeting.current!==call)return
        const code=voiceDiagnosticCode(event?.error?.type)
        const hint=voiceDiagnosticHint(event?.errorMsg??event?.error?.localizedMsg)
        reportFailure(code,hint)
        const failure=code==='unknown'
          ? unknownJoinMessage(stage,hint)
          : dailyVoiceError(code)
        void stop().then(()=>{if(alive.current){setError(failure);setPhase('failed')}})
      })
      call.on('left-meeting',()=>{
        if(meeting.current!==call)return
        reportFailure('unexpected-leave','unknown')
        void stop().then(()=>{if(alive.current){setError('Daily ended the audio connection. Retry joining.');setPhase('failed')}})
      })
      await call.join({url:data.url,token:data.token})
      stage='connected'
      if(generation!==connectGeneration.current){if(!call.isDestroyed())await call.destroy();return}
      // Daily room start_audio_off is true; microphone permission remains user initiated.
      call.setLocalAudio(false)
      if(teacher&&micPreference.current){
        // Teacher already opted to speak in this Live session. Restore that
        // preference only after the new canonical authorization succeeds.
        call.setLocalAudio(true)
        setMicOn(true)
      }
      setPhase('listening');sync()
      // Daily enforces removal at token expiry even if the teacher goes
      // offline or this tab stops running timers. Renewal MUST obtain a fresh
      // canonical Live authorization, never reuse the previous media token.
      const ttlMs=Number(data.expiresAt)*1000-Date.now()
      if(Number.isFinite(ttlMs)&&ttlMs>45000){
        renewTimer.current=setTimeout(()=>{
          if(connectGeneration.current!==generation||meeting.current!==call||!alive.current)return
          void stop(true).then(()=>{if(alive.current&&currentStatus.current==='active')void connect()})
        },Math.max(1000,ttlMs-30000))
      }
    }catch(e){
      if(call && generation===connectGeneration.current)
        reportFailure('join-exception',voiceDiagnosticHint(e instanceof Error?e.message:null))
      if(call && !call.isDestroyed())await call.destroy().catch(()=>{})
      if(generation===connectGeneration.current){
        meeting.current=null
        setPhase('failed')
        // Never surface raw Daily join rejection details to the classroom UI.
        const hint=voiceDiagnosticHint(e instanceof Error?e.message:null)
        setError(call?unknownJoinMessage(stage,hint)
          :e instanceof Error?e.message:'Audio unavailable.')
      }
    } finally {connecting.current=false}
  }
  const toggleMic=async()=>{
    const call=meeting.current
    if(!call || (!teacher&&!permission))return
    setBusy(true);setError('')
    try {
      const next=!micPreference.current
      call.setLocalAudio(next)
      micPreference.current=next
      setMicOn(next)
    }catch{
      micPreference.current=Boolean(call.localAudio())
      setMicOn(micPreference.current)
      setError('Could not use microphone. Check device permissions.')
    }
    finally{setBusy(false)}
  }
  const allow=async(studentId:string)=>{
    const call=meeting.current
    if(!teacher||!call||busy||!learners.some(p=>p.studentId===studentId&&p.needsHelp))return
    setBusy(true);setError('')
    try{
      const list=Object.values(call.participants())
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
      const p=Object.values(call.participants())
        .find(p=>p.user_id===studentId&&p.session_id)
      if(p)await call.updateParticipant(p.session_id,{updatePermissions:{canSend:false},setAudio:false})
      speaker.current=null;setActiveSpeaker(null)
    }catch{setError('Could not revoke voice. Retry before allowing another learner.')}
    finally{setBusy(false)}
  }
  useEffect(()=>{
    const call=meeting.current,studentId=speaker.current
    if(!teacher||!call||!studentId||status!=='active')return
    if(learners.some(l=>l.studentId===studentId))return
    // Revoked learner may not retain audio publishing rights after roster loss.
    const remote=Object.values(call.participants()).find(p=>p.user_id===studentId&&!p.local)
    speaker.current=null;setActiveSpeaker(null)
    if(remote) {
      try {
        call.updateParticipant(remote.session_id,{
          updatePermissions:{canSend:false},setAudio:false,
        })
      } catch {setError('Could not revoke learner audio. End the room.')}
    }
  },[learners,teacher,status])
  // Keep Daily audio access in sync with the canonical teacher roster. A
  // removed learner is ejected from the media service, not just hidden in UI.
  // Independent server-side/offline revocation proof is still required.
  useEffect(()=>{
    const call=meeting.current
    if (!teacher||phase!=='listening'||!call)return
    const allowed=new Set(learners.map(l=>l.studentId))
    const people=Object.values(call.participants())
    for (const p of people) {
      if (!p.session_id||p.session_id===call.participants().local.session_id)continue
      const unauthorized=!p.user_id||!allowed.has(p.user_id)
      const unapprovedMic=canPublishAudio(p.permissions?.canSend)&&speaker.current!==p.user_id
      if ((!unauthorized&&!unapprovedMic)||moderating.current.has(p.session_id))continue
      moderating.current.add(p.session_id)
      try {
        // updateParticipant is synchronous in daily-js; it returns DailyCall,
        // not a Promise. Remote enforcement is confirmed by participant events.
        call.updateParticipant(p.session_id,unauthorized?{eject:true}:{
          updatePermissions:{canSend:false},setAudio:false,
        })
      } catch {
        setError('Could not enforce audio access. End this class audio and retry.')
      } finally {
        moderating.current.delete(p.session_id)
      }
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
      <span className={styles.phase} role="status">{!enabled?'Not enabled':phase==='idle'?'Off':phase==='connecting'?'Connecting…':phase==='failed'?'Disconnected':teacher?'Connected':'Listening'}</span>
      {phase==='idle'||phase==='failed'?
        <button type="button" onClick={()=>void connect()} disabled={!enabled||status!=='active'} title={!enabled?'Audio has not been activated for this classroom.':undefined}><Volume2 size={15}/> Join audio</button>:
        <button type="button" onClick={()=>void stop()} disabled={phase==='connecting'}><X size={15}/> Leave audio</button>}
      {phase==='listening'&&enabled?<button type="button" onClick={()=>void toggleMic()}
        disabled={busy||(!teacher&&!permission)} aria-pressed={micOn}
        title={!teacher&&!permission?'Raise your hand and wait for teacher approval':'Microphone'}>
        {micOn?<Mic size={15}/>:<MicOff size={15}/>} {micOn?'Mute':teacher?'Speak':permission?'Speak':'Muted'}
      </button>:<button type="button" disabled title={!enabled?'Audio has not been activated for this classroom.':'Join audio first to use the microphone.'} aria-label="Microphone off"><MicOff size={15}/> Mic off</button>}
    </div>
    {!enabled&&<div className={styles.detail} role="status">Audio is unavailable for this class. The microphone cannot be switched on yet.</div>}
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
