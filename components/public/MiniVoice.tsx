'use client'

import { useEffect,useRef,useState } from 'react'
import { MINI_VOICE_SECONDS,prepareMiniVoice } from '@/lib/minis/voice'
import { supabase } from '@/lib/supabase'
import styles from './MiniVoice.module.css'

let playing:HTMLAudioElement|null=null
function onePlayer(event:React.SyntheticEvent<HTMLAudioElement>){
  if(playing&&playing!==event.currentTarget)playing.pause()
  playing=event.currentTarget
}

export function MiniVoicePlayer({src}:{src:string}){
  return <div className={styles.player}><audio controls preload="none" src={src} aria-label="Voice explanation" onPlay={onePlayer}/></div>
}

export function MiniVoicePreview({file}:{file:File}){
  const [url,setUrl]=useState('')
  useEffect(()=>{const next=URL.createObjectURL(file);setUrl(next);return()=>URL.revokeObjectURL(next)},[file])
  return url?<MiniVoicePlayer src={url}/>:null
}

export function MiniPublishedVoice({path}:{path?:string|null}){
  const [url,setUrl]=useState('')
  const [error,setError]=useState(false)
  const [loading,setLoading]=useState(false)
  useEffect(()=>{setUrl('');setError(false);setLoading(false)},[path])
  if(!path)return null
  async function load(){
    if(!path||loading)return
    setLoading(true);setError(false)
    try{
      const {data,error}=await supabase.storage.from('mini-voice').createSignedUrl(path,900)
      if(error||!data?.signedUrl)throw Error()
      setUrl(data.signedUrl)
    }catch{setError(true)}finally{setLoading(false)}
  }
  return <div className={styles.panel}>{url?<MiniVoicePlayer src={url}/>:<button type="button" className={styles.action} disabled={loading} onClick={()=>void load()}>{loading?'Loading…':'Listen to explanation'}</button>}{error&&<p role="alert" className={styles.error}>Audio unavailable. Try again.</p>}</div>
}

export function MiniVoiceComposer({file,onChange,onBusy,disabled=false}:{file:File|null;onChange:(value:File|null)=>void;onBusy:(value:boolean)=>void;disabled?:boolean}){
  const [mode,setMode]=useState<'idle'|'request'|'recording'|'processing'>('idle')
  const [elapsed,setElapsed]=useState(0)
  const [error,setError]=useState('')
  const [consent,setConsent]=useState(false)
  const recorder=useRef<MediaRecorder|null>(null)
  const stream=useRef<MediaStream|null>(null)
  const input=useRef<HTMLInputElement|null>(null)
  const alive=useRef(false)
  const generation=useRef(0)
  const busyCallback=useRef(onBusy)
  busyCallback.current=onBusy
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;++generation.current;if(recorder.current&&recorder.current.state!=='inactive'){recorder.current.onstop=null;recorder.current.stop()}stream.current?.getTracks().forEach(t=>t.stop());busyCallback.current(false)}},[])
  useEffect(()=>{if(mode!=='recording')return;const started=Date.now();const timer=window.setInterval(()=>{const seconds=Math.floor((Date.now()-started)/1000);setElapsed(seconds);if(seconds>=MINI_VOICE_SECONDS-1&&recorder.current?.state==='recording')recorder.current.stop()},250);return()=>window.clearInterval(timer)},[mode])
  function finish(){if(alive.current){setMode('idle');busyCallback.current(false)}}
  async function convert(blob:Blob,token:number){
    setMode('processing')
    try{const next=await prepareMiniVoice(blob);if(alive.current&&token===generation.current)onChange(next)}
    catch(e){if(alive.current&&token===generation.current)setError(e instanceof Error?e.message:'Unable to read audio.')}
    finally{if(token===generation.current)finish()}
  }
  async function start(){
    if(!consent||mode!=='idle'||disabled)return
    setError('');setMode('request');busyCallback.current(true)
    const token=++generation.current
    try{
      if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined')throw Error('Recording is unavailable. Import audio instead.')
      const media=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1},video:false})
      if(!alive.current||token!==generation.current){media.getTracks().forEach(t=>t.stop());return}
      stream.current=media
      const mime=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(t=>MediaRecorder.isTypeSupported(t))
      const rec=new MediaRecorder(media,mime?{mimeType:mime}:undefined)
      recorder.current=rec
      const chunks:Blob[]=[]
      rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)}
      rec.onerror=()=>{++generation.current;rec.onstop=null;if(rec.state!=='inactive')rec.stop();media.getTracks().forEach(t=>t.stop());setError('Recording failed. Try again.');finish()}
      rec.onstop=()=>{media.getTracks().forEach(t=>t.stop());stream.current=null;recorder.current=null;if(alive.current&&token===generation.current)void convert(new Blob(chunks,{type:rec.mimeType}),token)}
      rec.start(250);setElapsed(0);setMode('recording')
    }catch(e){stream.current?.getTracks().forEach(t=>t.stop());if(alive.current&&token===generation.current){setError(e instanceof Error?e.message:'Microphone unavailable.');finish()}}
  }
  function cancel(){
    ++generation.current
    if(recorder.current&&recorder.current.state!=='inactive'){recorder.current.onstop=null;recorder.current.stop()}
    stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;recorder.current=null;finish()
  }
  const locked=disabled||mode!=='idle'
  return <section className={styles.panel} aria-label="Add voice">
    <div className={styles.heading}><span>Voice explanation</span><span className={styles.optional}>Optional</span></div>
    <label className={styles.consent}><input type="checkbox" checked={consent} disabled={locked} onChange={e=>{setConsent(e.target.checked);if(!e.target.checked)onChange(null)}}/>I have permission to share this recording.</label>
    {mode==='recording'?<><div role="status" className={styles.recording}><span className={styles.dot}/>Recording · {Math.floor(elapsed/60)}:{String(elapsed%60).padStart(2,'0')}</div><div className={styles.buttons}><button type="button" className={styles.action+' '+styles.stop} onClick={()=>recorder.current?.state==='recording'&&recorder.current.stop()}>Stop recording</button><button type="button" className={styles.action} onClick={cancel}>Cancel</button></div></>:mode!=='idle'?<div className={styles.meta}><span role="status">{mode==='request'?'Waiting for microphone…':'Preparing audio…'}</span><button type="button" className={styles.remove} onClick={cancel}>Cancel</button></div>:<div className={styles.buttons}>
      <button type="button" className={styles.action+' '+styles.record} disabled={locked||!consent} onClick={()=>void start()}><svg viewBox="0 0 24 24" className={styles.icon} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0014 0v-2M12 19v3m-4 0h8"/></svg>{file?'Record again':'Record voice'}</button>
      <button type="button" className={styles.action} disabled={locked||!consent} onClick={()=>input.current?.click()}><svg viewBox="0 0 24 24" className={styles.icon} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/></svg>Import audio</button>
    </div>}
    <input hidden ref={input} type="file" accept="audio/*,.m4a,.mp3,.wav,.ogg,.webm" onChange={e=>{const chosen=e.target.files?.[0];e.target.value='';if(chosen&&consent&&mode==='idle'){setError('');busyCallback.current(true);void convert(chosen,++generation.current)}}}/>
    {file&&<><MiniVoicePreview file={file}/><div className={styles.meta}><span>Voice added</span><button type="button" className={styles.remove} disabled={locked} onClick={()=>onChange(null)}>Remove</button></div></>}
    {error&&<p className={styles.error} role="alert">{error}</p>}
    <p className={styles.note}>Up to 1 minute · Record or import from your device</p>
  </section>
}
