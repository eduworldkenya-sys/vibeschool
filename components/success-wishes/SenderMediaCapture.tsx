'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, FileAudio, FileVideo, Mic, Square, Trash2 } from 'lucide-react'
import styles from './SenderMediaCapture.module.css'

type Kind = 'voice' | 'video'
const MAX_SECONDS = 60
const MAX_BYTES = 25 * 1024 * 1024

function supportedMime(kind: Kind): string {
  if (typeof MediaRecorder === 'undefined') return ''
  const choices = kind === 'voice'
    ? ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm']
    : ['video/webm;codecs=vp8,opus', 'video/mp4', 'video/webm']
  return choices.find(type => MediaRecorder.isTypeSupported(type)) || ''
}

function allowedFile(file: File, kind: Kind): boolean {
  if (file.type) return file.type.startsWith(kind === 'voice' ? 'audio/' : 'video/')
  return kind === 'voice'
    ? /\.(mp3|wav|m4a|aac|ogg|webm|mp4)$/i.test(file.name)
    : /\.(mp4|webm|mov|m4v|3gp)$/i.test(file.name)
}

export default function SenderMediaCapture({ kind, file, onChange }: {
  kind: Kind
  file: File | null
  onChange: (file: File | null) => void
}) {
  const recorder = useRef<MediaRecorder | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const camera = useRef<HTMLVideoElement>(null)
  const chooser = useRef<HTMLInputElement>(null)
  const chunks = useRef<Blob[]>([])
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null)
  const session = useRef(0)
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState('')
  const [requesting, setRequesting] = useState(false)

  function releaseDevices() {
    if (ticker.current !== null) { clearInterval(ticker.current); ticker.current = null }
    stream.current?.getTracks().forEach(track => track.stop())
    stream.current = null
    if (camera.current) camera.current.srcObject = null
  }

  function stopRecording() {
    const current = recorder.current
    if (current?.state === 'recording') {
      try { current.stop() } catch { releaseDevices() }
    }
    setRecording(false)
  }

  useEffect(() => () => {
    session.current += 1
    if (ticker.current !== null) clearInterval(ticker.current)
    if (recorder.current?.state === 'recording') {
      recorder.current.onstop = null
      recorder.current.ondataavailable = null
      recorder.current.stop()
    }
    stream.current?.getTracks().forEach(track => track.stop())
  }, [])

  async function startRecording() {
    if (requesting || recording) return
    setError('')
    onChange(null)
    setSeconds(0)
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Recording is not supported in this browser. Choose a file instead.')
      return
    }
    const currentSession = ++session.current
    setRequesting(true)
    let media: MediaStream | null = null
    try {
      media = await navigator.mediaDevices.getUserMedia(kind === 'voice'
        ? { audio: true }
        : { audio: true, video: { facingMode: 'user' } })
      if (currentSession !== session.current) { media.getTracks().forEach(track => track.stop()); return }
      stream.current = media
      chunks.current = []
      const mimeType = supportedMime(kind)
      const options = mimeType ? { mimeType } : undefined
      const item = new MediaRecorder(media, options)
      recorder.current = item
      item.ondataavailable = event => { if (event.data.size) chunks.current.push(event.data) }
      item.onerror = () => { setError('Recording stopped unexpectedly. Please try again.'); releaseDevices(); setRecording(false) }
      item.onstop = () => {
        releaseDevices()
        setRecording(false)
        if (session.current !== currentSession) return
        const type = item.mimeType || (kind === 'voice' ? 'audio/webm' : 'video/webm')
        const blob = new Blob(chunks.current, { type })
        chunks.current = []
        if (!blob.size) { setError('No recording was captured. Try again.'); return }
        if (blob.size > MAX_BYTES) { setError('Recording is over 25 MB. Record a shorter message.'); return }
        const ext = type.includes('mp4') ? 'mp4' : 'webm'
        onChange(new File([blob], `success-wish-${kind}.${ext}`, { type }))
      }
      item.start(250)
      setRecording(true)
      const started = Date.now()
      ticker.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - started) / 1000)
        setSeconds(Math.min(elapsed, MAX_SECONDS))
        if (elapsed >= MAX_SECONDS && item.state === 'recording') item.stop()
      }, 250)
      if (kind === 'video' && camera.current) {
        camera.current.srcObject = media
        void camera.current.play().catch(() => {})
      }
    } catch (reason) {
      media?.getTracks().forEach(track => track.stop())
      setError(reason instanceof DOMException && ['NotAllowedError', 'PermissionDeniedError'].includes(reason.name)
        ? 'Allow microphone and camera access to record, or choose a file.'
        : 'Could not start recording. Choose a file or try again.')
    } finally {
      if (currentSession === session.current) setRequesting(false)
    }
  }

  function chooseFile(file: File | null) {
    if (!file) return
    setError('')
    if (!allowedFile(file, kind)) { setError(`Choose a valid ${kind === 'voice' ? 'audio' : 'video'} file.`); return }
    if (file.size > MAX_BYTES) { setError('File is over 25 MB. Choose a smaller file.'); return }
    if (!file.size) { setError('That file is empty. Choose another file.'); return }
    onChange(file)
  }

  const mediaLabel = kind === 'voice' ? 'voice' : 'video'
  return <div className={styles.capture} aria-label={`Add a ${mediaLabel} wish`}>
    <span className={styles.heading}>Add your {mediaLabel} message</span>
    <div className={styles.controls}>
      <button type="button" className={styles.record} disabled={requesting} onClick={() => recording ? stopRecording() : void startRecording()}>
        {recording ? <Square size={17}/> : kind === 'voice' ? <Mic size={17}/> : <Camera size={17}/>}
        {recording ? `Stop recording · ${seconds}s` : requesting ? 'Connecting…' : `Record ${mediaLabel}`}
      </button>
      <button type="button" className={styles.choose} disabled={recording || requesting} onClick={() => chooser.current?.click()}>
        {kind === 'voice' ? <FileAudio size={17}/> : <FileVideo size={17}/>}
        Choose {kind === 'voice' ? 'audio' : 'video'} file
      </button>
      <input ref={chooser} type="file" className={styles.fileInput} aria-label={`Upload ${kind === 'voice' ? 'audio' : 'video'} file from device`}
        accept={kind === 'voice' ? 'audio/*,.m4a' : 'video/*'} onChange={event => {
          chooseFile(event.currentTarget.files?.[0] || null)
          event.currentTarget.value = ''
        }}/>
    </div>
    {kind === 'video' && <video ref={camera} className={styles.camera} muted playsInline autoPlay hidden={!recording}/>}
    {recording && <p className={styles.recording} role="status">Recording on this device · {seconds}s / {MAX_SECONDS}s</p>}
    {file && <div className={styles.selected}><span title={file.name}>{file.name}</span>
      <button type="button" onClick={() => { onChange(null); setError('') }} aria-label="Remove selected recording"><Trash2 size={16}/> Remove</button>
    </div>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <small className={styles.note}>Maximum 60 seconds when recording · 25 MB per file. Preview stays on this device.</small>
  </div>
}
