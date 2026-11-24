'use client'

import { useEffect, useRef, useState } from 'react'
import { Hand, Headphones, Mic, MicOff } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { MicController } from '@/lib/live/mesh-mic.mjs'
import { audioSdp, gatherIce, validateMeshState, type MeshState } from '@/lib/live/mesh-protocol'
import styles from './LiveVoice.module.css'

type Props = {
  roomId: string
  classId: string | null
  teacher: boolean
  enabled: boolean
  status: 'active' | 'paused' | 'ended'
  learners: Array<{ studentId: string; name: string; needsHelp: boolean }>
  onFallback: () => void
}

type MicState = 'muted' | 'requesting' | 'on' | 'error'
type Action = 'join' | 'poll' | 'offer' | 'answer' | 'allow' | 'revoke' | 'leave' | 'fallback'
type Control = 'allow' | 'revoke' | 'fallback'

const POLL_MS = 2000
const SIGNAL_TIMEOUT_MS = 10000

export function MeshLiveVoice({ roomId, classId, teacher, enabled, status, learners, onFallback }: Props) {
  const [phase, setPhase] = useState('Connecting…')
  const [micState, setMicState] = useState<MicState>('muted')
  const [allowed, setAllowed] = useState(false)
  const [connected, setConnected] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [failed, setFailed] = useState(false)
  const [retry, setRetry] = useState(0)
  const [busy, setBusy] = useState(false)
  const [target, setTarget] = useState<string | null>(null)
  const [speaking, setSpeaking] = useState(false)
  const playerRef = useRef<HTMLAudioElement>(null)
  const mic = useRef<MicController | null>(null)
  const controls = useRef<((action: Control) => Promise<void>) | null>(null)
  const fallback = useRef(onFallback)
  fallback.current = onFallback

  useEffect(() => {
    setConnected(false)
    setAllowed(false)
    setMicState('muted')
    setBlocked(false)
    setFailed(false)
    setBusy(false)
    setTarget(null)
    setSpeaking(false)
    if (!enabled || status !== 'active') {
      setPhase('Audio off')
      return
    }
    if (!window.isSecureContext || !window.crypto?.randomUUID) {
      setPhase('Audio requires a secure browser')
      return
    }

    const client = crypto.randomUUID()
    const lifetime = new AbortController()
    const player = playerRef.current
    let connection = new AbortController()
    let peer: RTCPeerConnection | null = null
    let epoch = -1
    let grant = false
    let revoking = false
    let joined = false
    let userId: string | null = null
    let polling: ReturnType<typeof setTimeout> | undefined
    let leaseTimer: ReturnType<typeof setTimeout> | undefined
    let mediaTimer: ReturnType<typeof setTimeout> | undefined
    let chain = Promise.resolve()

    const request = async (action: Action, sdp: string | null = null, detached = false) => {
      const timeout = AbortSignal.timeout(SIGNAL_TIMEOUT_MS)
      const signal = detached ? timeout : AbortSignal.any([timeout, lifetime.signal])
      const { data, error } = await supabase.rpc('vibe_live_mesh', {
        p_room: roomId, p_class: classId, p_action: action,
        p_client: client, p_epoch: epoch < 0 ? null : epoch, p_sdp: sdp,
      }).abortSignal(signal)
      if (error) {
        if (action === 'join' && error.code === 'P0002') return null
        throw Error('Voice access or connection unavailable')
      }
      return validateMeshState(data, teacher)
    }

    const resetMedia = () => {
      connection.abort()
      connection = new AbortController()
      mic.current?.close()
      mic.current = null
      clearTimeout(mediaTimer)
      mediaTimer = undefined
      if (peer) {
        peer.ontrack = null
        peer.onconnectionstatechange = null
        peer.close()
        peer = null
      }
      if (player) {
        player.pause()
        player.srcObject = null
        player.muted = true
      }
      grant = false
      setSpeaking(false)
      setAllowed(false)
      setConnected(false)
      setMicState('muted')
      setBlocked(false)
    }

    const stop = (message: string, failure = false, release = true) => {
      if (lifetime.signal.aborted) return
      lifetime.abort()
      clearTimeout(polling)
      clearTimeout(leaseTimer)
      resetMedia()
      setPhase(message)
      setFailed(failure)
      if (release && joined) void request('leave', null, true).catch(() => {
        // A disconnected browser cannot release its lease. The database expires it.
      })
    }

    const renewLease = (state: MeshState) => {
      clearTimeout(leaseTimer)
      const remaining = Date.parse(state.expiresAt) - Date.now()
      leaseTimer = setTimeout(() => stop('Voice disconnected', true), Math.min(SIGNAL_TIMEOUT_MS, remaining))
    }

    const switchToDaily = () => {
      stop('Switching audio', false, false)
      fallback.current()
    }

    const startPeer = () => {
      const call = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }] })
      peer = call
      const isCurrent = () => !lifetime.signal.aborted && peer === call
      const controller = new MicController({
        allowed: false,
        capture: () => navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: false,
        }),
        attach: async stream => {
          const sender = call.getTransceivers()[0]?.sender
          if (!isCurrent() || call.connectionState !== 'connected' || !sender) throw Error('Audio disconnected')
          await sender.replaceTrack(stream.getAudioTracks()[0])
        },
        detach: () => {
          const sender = call.getTransceivers()[0]?.sender
          if (sender) void sender.replaceTrack(null).catch(() => {
            // MicController has already stopped the capture track.
          })
        },
        onState: state => { if (isCurrent()) setMicState(state) },
      })
      mic.current = controller
      call.ontrack = event => {
        if (!isCurrent() || event.track.kind !== 'audio') {
          event.track.stop()
          return
        }
        if (!player) return
        player.srcObject = new MediaStream([event.track])
        player.muted = call.connectionState !== 'connected' || (teacher && !grant)
        void player.play().then(
          () => { if (isCurrent()) setBlocked(false) },
          () => { if (isCurrent()) setBlocked(true) },
        )
      }
      call.onconnectionstatechange = () => {
        if (!isCurrent()) return
        const state = call.connectionState
        const ready = state === 'connected'
        controller.setAllowed(ready && (teacher || grant))
        setAllowed(ready && (teacher || grant))
        setConnected(ready)
        if (player) player.muted = !ready || (teacher && !grant)
        if (ready) {
          clearTimeout(mediaTimer)
          mediaTimer = undefined
          setPhase('Connected')
        } else if (state === 'failed' || state === 'closed') {
          stop('Direct connection unavailable', true)
        } else if (state === 'disconnected' && !mediaTimer) {
          setPhase('Reconnecting…')
          mediaTimer = setTimeout(() => stop('Direct connection unavailable', true), 8000)
        }
      }
      mediaTimer = setTimeout(() => stop('Direct connection unavailable', true), 22000)
      return call
    }

    const apply = async (state: MeshState) => {
      if (lifetime.signal.aborted) return
      if (state.fallback) {
        switchToDaily()
        return
      }
      renewLease(state)
      setTarget(state.learnerStudentId)
      if (state.epoch !== epoch) {
        resetMedia()
        epoch = state.epoch
      }
      if (!state.peerPresent) {
        if (peer) resetMedia()
        setPhase(teacher ? 'Waiting for learner' : 'Waiting for teacher')
        return
      }
      if (!window.RTCPeerConnection) {
        stop('Direct audio is unavailable in this browser', true)
        return
      }
      grant = state.speaking && !revoking
      setSpeaking(grant)
      const call = peer ?? startPeer()
      const ready = call.connectionState === 'connected'
      if (player) player.muted = !ready || (teacher && !grant)
      mic.current?.setAllowed(ready && (teacher || grant))
      setAllowed(ready && (teacher || grant))

      if (teacher && state.answer && !call.remoteDescription) {
        await call.setRemoteDescription({ type: 'answer', sdp: state.answer })
        if (!lifetime.signal.aborted && call.getTransceivers().length !== 1) throw Error('Invalid audio media')
        return
      }
      if (call.localDescription || (!teacher && !state.offer)) return

      if (teacher) {
        call.addTransceiver('audio', { direction: 'sendrecv' })
        await call.setLocalDescription(await call.createOffer())
      } else if (state.offer) {
        await call.setRemoteDescription({ type: 'offer', sdp: state.offer })
        const [audio] = call.getTransceivers()
        if (!audio || call.getTransceivers().length !== 1) throw Error('Invalid audio media')
        audio.direction = 'sendrecv'
        await call.setLocalDescription(await call.createAnswer())
      }

      await gatherIce(call, connection.signal)
      if (lifetime.signal.aborted || peer !== call) return
      const local = (call.pendingLocalDescription ?? call.currentLocalDescription)?.sdp
      if (!audioSdp(local)) throw Error('Invalid audio description')
      const result = await request(teacher ? 'offer' : 'answer', local)
      if (result?.fallback) switchToDaily()
      else if (result && !lifetime.signal.aborted) renewLease(result)
    }

    const enqueue = (task: () => Promise<void>) => {
      chain = chain.then(task).catch(() => stop('Direct audio unavailable', true))
      return chain
    }
    const tick = () => {
      void enqueue(async () => {
        if (lifetime.signal.aborted) return
        const state = await request(joined ? 'poll' : 'join')
        if (!state) {
          switchToDaily()
          return
        }
        joined = true
        await apply(state)
      }).finally(() => {
        if (!lifetime.signal.aborted) polling = setTimeout(tick, POLL_MS)
      })
    }

    controls.current = async action => {
      setBusy(true)
      try {
        if (action === 'fallback') {
          try {
            const state = await request(action, null, lifetime.signal.aborted)
            if (state?.fallback) switchToDaily()
          } catch {
            stop('Could not switch classroom audio', true)
            setPhase('Could not switch classroom audio')
          }
          return
        }
        if (!teacher || lifetime.signal.aborted || peer?.connectionState !== 'connected') return
        if (action === 'revoke') {
          revoking = true
          grant = false
          if (player) player.muted = true
        }
        await enqueue(async () => {
          if (lifetime.signal.aborted) return
          const state = await request(action)
          if (state) await apply(state)
        })
      } finally {
        if (action === 'revoke') revoking = false
        setBusy(false)
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || (userId && session?.user.id !== userId)) stop('Signed out', false, false)
    })
    void supabase.auth.getSession().then(({ data }) => {
      if (lifetime.signal.aborted) return
      if (!data.session) {
        stop('Sign in to join voice', false, false)
        return
      }
      userId = data.session.user.id
      tick()
    }).catch(() => stop('Direct audio unavailable', true))

    const pageHide = () => stop('Voice disconnected', true)
    window.addEventListener('pagehide', pageHide)
    return () => {
      controls.current = null
      subscription.unsubscribe()
      window.removeEventListener('pagehide', pageHide)
      stop('Audio off')
    }
  }, [roomId, classId, teacher, enabled, status, retry])

  const raised = learners.find(learner => learner.studentId === target && learner.needsHelp)
  return <section className={styles.voice} aria-label="Classroom audio">
    <div className={styles.summary}>
      <Headphones size={17} aria-hidden="true" />
      <strong>Voice</strong>
      <span className={styles.phase} role="status">{phase}</span>
      <button type="button" aria-pressed={micState === 'on'} disabled={!connected || !allowed}
        onClick={() => void mic.current?.toggle()}>
        {micState === 'on' ? <Mic size={17} /> : <MicOff size={17} />}
        {micState === 'on' ? 'Mute' : micState === 'requesting' ? 'Cancel' : micState === 'error' ? 'Retry mic' : 'Unmute'}
      </button>
      {status === 'active' && failed &&
        <button type="button" disabled={busy} onClick={() => setRetry(value => value + 1)}>Retry audio</button>}
      {status === 'active' && (failed || (teacher && (connected || phase === 'Waiting for learner'))) &&
        <button type="button" disabled={busy} onClick={() => void controls.current?.('fallback')}>Use Daily audio</button>}
    </div>
    <audio ref={playerRef} autoPlay hidden />
    {blocked && <button type="button" onClick={() => {
      void playerRef.current?.play().then(() => setBlocked(false), () => setBlocked(true))
    }}>Enable sound</button>}
    {teacher && connected && <div className={styles.requests}>
      {raised && <button type="button" disabled={busy} onClick={() => void controls.current?.('allow')}>
        <Hand size={15} aria-hidden="true" /> Allow {raised.name} to speak
      </button>}
      {speaking && <button type="button" disabled={busy} onClick={() => void controls.current?.('revoke')}>
        End speaking turn
      </button>}
    </div>}
    {!teacher && connected && !allowed && <div className={styles.detail}>Listening · Raise your hand to speak</div>}
    {micState === 'error' && <span role="alert">Microphone unavailable. Check browser permission.</span>}
  </section>
}
