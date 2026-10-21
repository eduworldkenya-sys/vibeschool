'use client'

import {useEffect,useRef,useState} from 'react'
import {Mic,Square} from 'lucide-react'
import styles from './SuccessWishes.module.css'

const MAX_SECONDS=60
const MAX_BYTES=25*1024*1024

// Browser-local recording: only a user click requests microphone permission.
// Stopping never uploads anything; the sender must review and submit explicitly.
export default function VoiceRecorder({onFile,disabled=false}:{
  onFile:(file:File)=>void;disabled?:boolean
}){
  const recorder=useRef<MediaRecorder|null>(null)
  const stream=useRef<MediaStream|null>(null)
  const timeout=useRef<ReturnType<typeof setTimeout>|null>(null)
  const chunks=useRef<Blob[]>([])
  const alive=useRef(true)
  const [recording,setRecording]=useState(false)
  const [error,setError]=useState('')

  useEffect(()=>{
    alive.current=true
    return ()=>{
      alive.current=false
      if(timeout.current)clearTimeout(timeout.current)
      recorder.current?.stop && recorder.current.state!=='inactive' && recorder.current.stop()
      recorder.current=null
      stream.current?.getTracks().forEach(track=>track.stop())
      stream.current=null
    }
  },[])

  async function start(){
    if(disabled||recording)return
    setError('')
    let media:MediaStream|null=null
    try{
      if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined')
        throw Error('This browser does not support microphone recording. Choose an audio file instead.')
      const mime=['audio/webm','audio/mp4','audio/ogg'].find(type=>MediaRecorder.isTypeSupported(type))
      if(!mime)throw Error('No supported recording format on this browser. Choose an audio file instead.')
      media=await navigator.mediaDevices.getUserMedia({audio:true,video:false})
      if(!alive.current){media.getTracks().forEach(track=>track.stop());return}
      const captured=media
      const capture=new MediaRecorder(captured,{mimeType:mime,audioBitsPerSecond:128000})
      stream.current=captured
      recorder.current=capture
      chunks.current=[]
      capture.ondataavailable=event=>{if(event.data.size>0)chunks.current.push(event.data)}
      capture.onerror=()=>{
        if(alive.current)setError('Recording stopped unexpectedly. Please try again.')
        if(capture.state!=='inactive')capture.stop()
      }
      capture.onstop=()=>{
        if(timeout.current){clearTimeout(timeout.current);timeout.current=null}
        captured.getTracks().forEach(track=>track.stop())
        stream.current=null
        recorder.current=null
        if(!alive.current)return
        setRecording(false)
        const blob=new Blob(chunks.current,{type:mime})
        chunks.current=[]
        if(blob.size<1||blob.size>MAX_BYTES){
          setError('Recording is empty or larger than 25 MB. Please try again.')
          return
        }
        const extension=mime==='audio/mp4'?'m4a':mime==='audio/ogg'?'ogg':'webm'
        onFile(new File([blob],'success-wish-voice.'+extension,{type:mime,lastModified:Date.now()}))
      }
      capture.start(1000)
      setRecording(true)
      timeout.current=setTimeout(()=>{
        if(capture.state!=='inactive')capture.stop()
      },MAX_SECONDS*1000)
    }catch(reason){
      media?.getTracks().forEach(track=>track.stop())
      if(alive.current){
        setRecording(false)
        setError(reason instanceof Error?reason.message:'Microphone permission is unavailable.')
      }
    }
  }
  function stop(){
    const active=recorder.current
    if(active&&active.state!=='inactive')active.stop()
  }
  return <div>
    <button type="button" className={styles.secondary} disabled={disabled}
      onClick={()=>{if(recording)stop();else void start()}}>
      {recording?<><Square size={16} aria-hidden="true"/> Stop recording</>
        :<><Mic size={16} aria-hidden="true"/> Record a voice note</>}
    </button>
    {recording&&<p role="status" className={styles.status}>Microphone recording in progress. Stops automatically after 60 seconds. Review before uploading.</p>}
    {error&&<p role="alert" className={styles.error}>{error}</p>}
  </div>
}
