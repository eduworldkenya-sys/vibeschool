'use client'

import { useEffect, useRef, useState } from 'react'
import { Hand, Headphones, Mic, MicOff } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { MicController } from '@/lib/live/mesh-mic.mjs'
import { audioSdp, gatherIce, validateMeshState, meshRequestSignal, meshFailureMessage, type MeshPeer, type MeshState } from '@/lib/live/mesh-protocol'
import styles from './LiveVoice.module.css'

type Props = {
  roomId: string
  classId: string | null
  teacher: boolean
  enabled: boolean
  status: 'active' | 'paused' | 'ended'
  learners: Array<{ studentId: string; name: string; needsHelp: boolean }>
  onFallback?: () => void
}

type MicState = 'muted' | 'requesting' | 'on' | 'error'
type Action = 'join' | 'poll' | 'offer' | 'answer' | 'allow' | 'revoke' | 'leave' | 'fallback'
type Control = 'allow' | 'revoke' | 'fallback'
type Peer = {
  studentId: string
  epoch: number
  call: RTCPeerConnection
  controller: AbortController
  deadline: ReturnType<typeof setTimeout>
  stream?: MediaStream
  negotiating: boolean
  output?: MediaStreamTrack | null
}

const POLL_MS = 2000
const SIGNAL_TIMEOUT_MS = 10000
class MeshRequestError extends Error {}

// The host broadcasts one mix to all listeners and a host-only track back to
// the current speaker. No learner connects to or receives ICE data from peers.
class HostMixer {
  readonly context = new AudioContext()
  private readonly hostOnly = this.context.createMediaStreamDestination()
  private readonly broadcast = this.context.createMediaStreamDestination()
  private mic?: MediaStreamAudioSourceNode
  private speaker?: MediaStreamAudioSourceNode
  private speakerStream?: MediaStream

  setMic(stream?: MediaStream) {
    this.mic?.disconnect()
    this.mic = stream && this.context.createMediaStreamSource(stream)
    this.mic?.connect(this.hostOnly)
    this.mic?.connect(this.broadcast)
  }

  setSpeaker(stream?: MediaStream) {
    if (stream === this.speakerStream) return
    this.speaker?.disconnect()
    this.speakerStream = stream
    this.speaker = stream && this.context.createMediaStreamSource(stream)
    this.speaker?.connect(this.broadcast)
  }

  track(forSpeaker: boolean) {
    return (forSpeaker ? this.hostOnly : this.broadcast).stream.getAudioTracks()[0]
  }

  close() {
    this.setSpeaker()
    this.setMic()
    for (const destination of [this.hostOnly, this.broadcast]) {
      destination.stream.getTracks().forEach(track => track.stop())
    }
    return this.context.close()
  }
}

export function MeshLiveVoice({ roomId, classId, teacher, enabled, status, learners, onFallback }: Props) {
  const [phase, setPhase] = useState('Connecting…')
  const [micState, setMicState] = useState<MicState>('muted')
  const [allowed, setAllowed] = useState(false)
  const [connectedIds, setConnectedIds] = useState<string[]>([])
  const [speaker, setSpeaker] = useState<string | null>(null)
  const [soundBlocked, setSoundBlocked] = useState(false)
  const [admitted, setAdmitted] = useState(false)
  const [failure, setFailure] = useState('')
  const [retry, setRetry] = useState(0)
  const [busy, setBusy] = useState(false)
  const [listenVolume,setListenVolume]=useState(100)
  const playerRef = useRef<HTMLAudioElement>(null)
  useEffect(()=>{if(playerRef.current)playerRef.current.volume=listenVolume/100},[listenVolume])
  const micClick = useRef<(() => Promise<void>) | null>(null)
  const controls = useRef<((action: Control, studentId?: string) => Promise<void>) | null>(null)
  const fallback = useRef(onFallback)
  fallback.current = onFallback

  useEffect(() => {
    setAllowed(false)
    setAdmitted(false)
    setBusy(false)
    setConnectedIds([])
    setFailure('')
    setMicState('muted')
    setSoundBlocked(false)
    setSpeaker(null)
    if (!enabled || status !== 'active') {
      setPhase('Audio off')
      return
    }
    if (!window.isSecureContext || !window.crypto?.randomUUID) {
      setPhase('Audio requires a secure browser')
      return
    }

    setPhase('Connecting…')
    const client = crypto.randomUUID()
    const lifetime = new AbortController()
    const player = playerRef.current
    const peers = new Map<string, Peer>()
    const failedEdges = new Map<string, number>()
    let group: MeshState | undefined
    let mixer: HostMixer | undefined
    let speakerStream: MediaStream | undefined
    let admitted = false
    let userId: string | null = null
    let suppressedSpeaker: string | null = null
    let moderationVersion = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined
    let networkInterrupted = !navigator.onLine
    let lease: ReturnType<typeof setTimeout> | undefined
    let learnerSender: RTCRtpSender | undefined

    const request = async (action: Action, edge?: Peer, sdp?: string, detached = false) => {
      const bounded=meshRequestSignal(detached?[]:[lifetime.signal,...(edge?[edge.controller.signal]:[])],SIGNAL_TIMEOUT_MS)
      try {
      const { data, error } = await supabase.rpc('vibe_live_mesh', {
        p_room: roomId, p_class: classId, p_action: action, p_client: client,
        p_epoch: edge?.epoch ?? null, p_sdp: sdp ?? null, p_target: teacher ? edge?.studentId ?? null : null,
      }).abortSignal(bounded.signal)
      if (error) {
        // During a rolling deploy the app can reach PostgREST before the
        // migration is visible in its schema cache.
        if (action === 'join' && ['P0002', 'PGRST202'].includes(error.code)) return null
        throw new MeshRequestError(meshFailureMessage(error))
      }
      return validateMeshState(data, teacher)
      } finally {bounded.dispose()}
    }

    const closePeer = (edge: Peer) => {
      peers.delete(edge.studentId)
      edge.controller.abort()
      clearTimeout(edge.deadline)
      edge.call.onconnectionstatechange = null
      edge.call.ontrack = null
      edge.call.close()
      edge.stream?.getTracks().forEach(track => track.stop())
    }

    const stop = (message: string, failed = false, release = true) => {
      if (lifetime.signal.aborted) return
      lifetime.abort()
      clearTimeout(timer)
      clearTimeout(lease)
      mic.close()
      for (const edge of peers.values()) closePeer(edge)
      if (mixer) void mixer.close().catch(() => { /* AudioContext already closed */ })
      if (player) {
        player.pause()
        player.srcObject = null
        player.muted = true
      }
      setConnectedIds([])
      setAllowed(false)
      setAdmitted(false)
      setMicState('muted')
      setSoundBlocked(false)
      setSpeaker(null)
      setPhase(failed ? 'Disconnected' : message)
      setFailure(failed ? message : '')
      if (release && admitted) void request('leave', undefined, undefined, true).catch(() => {
        // The database expires clients unable to release their lease.
      })
    }

    const handoff = () => {
      if (!fallback.current) return stop('VibeMesh audio unavailable.', true, false)
      stop('Switching audio', false, false)
      fallback.current()
    }

    const play = () => {
      if (!player || player.muted || !player.srcObject) return
      void player.play().then(
        () => { if (!lifetime.signal.aborted) setSoundBlocked(false) },
        () => { if (!lifetime.signal.aborted) setSoundBlocked(true) },
      )
    }

    const sync = () => {
      if (lifetime.signal.aborted) return
      const ready = Array.from(peers.values()).filter(edge => edge.call.connectionState === 'connected')
      const turn = group?.peers.find(edge => edge.speaking && edge.studentId !== suppressedSpeaker)
      const speakerEdge = turn && ready.find(edge => edge.studentId === turn.studentId)
      const audibleStream = teacher ? speakerEdge?.stream : ready[0]?.stream
      if (speakerStream !== audibleStream) {
        speakerStream = audibleStream
        if (teacher) mixer?.setSpeaker(audibleStream)
        if (player) {
          player.srcObject = audibleStream ?? null
          player.muted = !audibleStream
          if (audibleStream) play()
          else setSoundBlocked(false)
        }
      }

      const speakingId = speakerEdge?.studentId ?? null
      if (teacher && mixer) {
        for (const edge of peers.values()) {
          const sender = edge.call.getTransceivers()[0]?.sender
          const track = mixer.track(edge.studentId === speakingId)
          if (!sender || edge.output === track) continue
          edge.output = track
          void sender.replaceTrack(track).catch(() => {
            if (!edge.controller.signal.aborted) failPeer(edge)
          })
        }
      }

      const canSpeak = teacher ? admitted : Boolean(speakerEdge)
      mic.setAllowed(canSpeak)
      setAllowed(canSpeak)
      setSpeaker(speakingId)
      setConnectedIds(ready.map(edge => edge.studentId))
      const waiting = teacher ? 'Waiting for learners' : 'Waiting for teacher'
      setPhase(ready.length ? 'Connected' : peers.size ? 'Connecting…' : waiting)
      setFailure(failedEdges.size ? 'Direct audio could not connect to every device.' : '')
    }

    const failPeer = (edge: Peer) => {
      if (edge.controller.signal.aborted) return
      failedEdges.set(edge.studentId, edge.epoch)
      closePeer(edge)
      sync()
    }

    const mic = new MicController({
      capture: () => navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      }),
      attach: async stream => {
        if (teacher) {
          if (!mixer) throw Error('Audio mixer unavailable')
          mixer.setMic(stream)
          sync()
          return
        }
        const [edge] = peers.values()
        const sender = edge?.call.getTransceivers()[0]?.sender
        if (!sender || edge.call.connectionState !== 'connected') throw Error('Audio disconnected')
        learnerSender = sender
        await sender.replaceTrack(stream.getAudioTracks()[0])
      },
      detach: () => {
        mixer?.setMic()
        const sender = learnerSender
        learnerSender = undefined
        if (sender) void sender.replaceTrack(null).catch(() => { /* Capture has already stopped. */ })
      },
      onState: state => { if (!lifetime.signal.aborted) setMicState(state) },
    })

    const unlockMixer = async () => {
      if (!teacher) return
      mixer ??= new HostMixer()
      await mixer.context.resume()
      mixer.setSpeaker(speakerStream)
      sync()
    }

    micClick.current = async () => {
      try {
        await unlockMixer()
        if (!lifetime.signal.aborted) await mic.toggle()
      } catch {
        if (!lifetime.signal.aborted) setMicState('error')
      }
    }

    const openPeer = (state: MeshPeer) => {
      const call = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }] })
      const edge: Peer = {
        studentId: state.studentId, epoch: state.epoch, call,
        controller: new AbortController(), negotiating: false,
        deadline: setTimeout(() => failPeer(edge), 24000),
      }
      peers.set(state.studentId, edge)
      call.ontrack = event => {
        if (edge.controller.signal.aborted || event.track.kind !== 'audio') {
          event.track.stop()
          return
        }
        edge.stream = new MediaStream([event.track])
        sync()
      }
      call.onconnectionstatechange = () => {
        if (edge.controller.signal.aborted) return
        switch (call.connectionState) {
          case 'connected':
            clearTimeout(edge.deadline)
            break
          case 'disconnected':
            clearTimeout(edge.deadline)
            edge.deadline = setTimeout(() => failPeer(edge), 8000)
            break
          case 'failed':
          case 'closed':
            failPeer(edge)
            return
        }
        sync()
      }
      return edge
    }

    const negotiate = async (edge: Peer, state: MeshPeer) => {
      const { call, controller } = edge
      if (edge.negotiating) return
      edge.negotiating = true
      try {
        if (teacher && state.answer && !call.remoteDescription) {
          await call.setRemoteDescription({ type: 'answer', sdp: state.answer })
          if (call.getTransceivers().length !== 1) throw Error('Invalid audio media')
          return
        }
        if (call.localDescription || (!teacher && !state.offer)) return
        if (teacher) {
          call.addTransceiver('audio', { direction: 'sendrecv' })
          sync()
          await call.setLocalDescription(await call.createOffer())
        } else if (state.offer) {
          await call.setRemoteDescription({ type: 'offer', sdp: state.offer })
          const [audio] = call.getTransceivers()
          if (!audio || call.getTransceivers().length !== 1) throw Error('Invalid audio media')
          audio.direction = 'sendrecv'
          await call.setLocalDescription(await call.createAnswer())
        }
        await gatherIce(call, controller.signal)
        if (controller.signal.aborted) return
        const sdp = (call.pendingLocalDescription ?? call.currentLocalDescription)?.sdp
        if (!audioSdp(sdp)) throw Error('Invalid audio description')
        if ((await request(teacher ? 'offer' : 'answer', edge, sdp))?.fallback) handoff()
      } catch {
        failPeer(edge)
      } finally {
        edge.negotiating = false
      }
    }

    const apply = (state: MeshState) => {
      if (lifetime.signal.aborted) return
      if (state.fallback) return handoff()
      clearTimeout(lease)
      lease = setTimeout(() => stop('Voice connection expired.', true),
        Math.min(SIGNAL_TIMEOUT_MS, Date.parse(state.expiresAt) - Date.now()))
      group = state
      const wanted = new Map(state.peers.map(edge => [edge.studentId, edge.epoch]))
      for (const edge of peers.values()) {
        if (wanted.get(edge.studentId) !== edge.epoch) closePeer(edge)
      }
      for (const [id, epoch] of failedEdges) {
        if (wanted.get(id) !== epoch) failedEdges.delete(id)
      }
      for (const edge of state.peers) {
        if (failedEdges.has(edge.studentId)) continue
        void negotiate(peers.get(edge.studentId) ?? openPeer(edge), edge)
      }
      sync()
    }

    const tick = async () => {
      if (lifetime.signal.aborted) return
      const version = moderationVersion
      try {
        const state = await request(admitted ? 'poll' : 'join')
        if (lifetime.signal.aborted) return
        if (!state) return handoff()
        admitted = true
        setAdmitted(true)
        if (version === moderationVersion || state.fallback) apply(state)
      } catch (error) {
        stop(error instanceof MeshRequestError ? error.message : 'Direct audio connection failed. Check your internet connection and retry.', true)
      }
      if (!lifetime.signal.aborted) timer = setTimeout(() => void tick(), POLL_MS)
    }

    controls.current = async (action, studentId) => {
      const edge = studentId ? peers.get(studentId) : undefined
      if (!teacher || (action !== 'fallback' && (lifetime.signal.aborted || !edge))) return
      setBusy(true)
      moderationVersion++
      suppressedSpeaker = group?.peers.find(peer => peer.speaking)?.studentId ?? null
      sync()
      try {
        if (action === 'allow') await unlockMixer()
        const state = await request(action, edge, undefined, lifetime.signal.aborted)
        moderationVersion++
        suppressedSpeaker = null
        if (state?.fallback) handoff()
        else if (state) apply(state)
      } catch {
        moderationVersion++
        if (action === 'revoke') {
          stop('Could not confirm speaking was ended. Audio disconnected.', true)
          return
        }
        suppressedSpeaker = null
        setFailure('Could not change classroom audio.')
      } finally {
        setBusy(false)
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || (userId && session?.user.id !== userId)) stop('Signed out', false, false)
    })
    const onOffline=()=>{
      networkInterrupted=true
      clearTimeout(reconnectTimer)
      // Stop capture immediately. Rejoining must create a fresh client and
      // fresh speaking grant; never resume the previously captured track.
      stop('Network lost. Audio muted. Reconnecting when online.',true)
    }
    const onOnline=()=>{
      if(!networkInterrupted)return
      clearTimeout(reconnectTimer)
      setPhase('Reconnecting…')
      // A failed offline leave may retain the old server lease for 16s.
      // Wait beyond that window instead of competing with the prior client.
      reconnectTimer=setTimeout(()=>{if(navigator.onLine)setRetry(value=>value+1)},17000)
    }
    window.addEventListener('offline',onOffline)
    window.addEventListener('online',onOnline)
    if(networkInterrupted)onOffline()
    void supabase.auth.getSession().then(({ data }) => {
      if (lifetime.signal.aborted) return
      if (!data.session) return stop('Sign in to join voice', false, false)
      if (!window.RTCPeerConnection || (teacher && !window.AudioContext)) return stop('Direct audio unsupported.', true)
      userId = data.session.user.id
      void tick()
    }).catch(() => stop('Direct audio unavailable.', true))

    const pageHide = () => stop('Voice disconnected.', true)
    window.addEventListener('pagehide', pageHide)
    return () => {
      controls.current = null
      micClick.current = null
      subscription.unsubscribe()
      window.removeEventListener('pagehide', pageHide)
      window.removeEventListener('offline',onOffline)
      window.removeEventListener('online',onOnline)
      clearTimeout(reconnectTimer)
      stop('Audio off')
    }
  }, [roomId, classId, teacher, enabled, status, retry])

  return <section className={styles.voice} aria-label="Classroom audio">
    <div className={styles.summary}>
      <Headphones size={17} aria-hidden="true" />
      <strong>Voice</strong>
      <span className={styles.phase} role="status">{phase}</span>
      <button type="button" aria-pressed={micState === 'on'} disabled={!allowed}
        onClick={() => void micClick.current?.()}>
        {micState === 'on' ? <Mic size={17} /> : <MicOff size={17} />}
        {micState === 'on' ? 'Mute' : micState === 'requesting' ? 'Cancel' : micState === 'error' ? 'Retry mic' : 'Unmute'}
      </button>
      {status === 'active' && failure &&
        <button type="button" disabled={busy} onClick={() => setRetry(value => value + 1)}>Retry audio</button>}
      {status === 'active' && teacher && onFallback && (admitted || failure) &&
        <button type="button" disabled={busy} onClick={() => void controls.current?.('fallback')}>Use Daily audio</button>}
    </div>
    <audio ref={playerRef} autoPlay hidden />
    {teacher&&enabled&&status==='active'&&<label className={styles.listenVolume}>Listening volume <input type="range" min={0} max={100} step={5} value={listenVolume} onChange={e=>setListenVolume(Number(e.target.value))} aria-label="Local listening volume"/><output>{listenVolume}%</output></label>}
    {soundBlocked && <button type="button" onClick={() => void playerRef.current?.play().then(
      () => setSoundBlocked(false), () => setSoundBlocked(true),
    )}>Enable sound</button>}
    {teacher && admitted && <div className={styles.requests}>
      <span>Learners on audio: {connectedIds.length}</span>
      {learners.filter(learner => learner.needsHelp && connectedIds.includes(learner.studentId)).map(learner =>
        <button key={learner.studentId} type="button" disabled={busy} onClick={() => void controls.current?.('allow', learner.studentId)}>
          <Hand size={15} aria-hidden="true" /> Allow {learner.name} to speak
        </button>)}
      {speaker && <button type="button" disabled={busy} onClick={() => void controls.current?.('revoke', speaker)}>
        End speaking turn
      </button>}
    </div>}
    {!teacher && connectedIds.length > 0 && !allowed && <div className={styles.detail}>Listening · Raise your hand to speak</div>}
    {failure && <span role="alert">{failure}</span>}
    {micState === 'error' && <span role="alert">Microphone unavailable. Check browser permission.</span>}
  </section>
}
