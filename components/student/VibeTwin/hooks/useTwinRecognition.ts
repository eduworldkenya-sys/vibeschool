// components/student/VibeTwin/hooks/useTwinRecognition.ts
import { useRef, useCallback, useEffect } from 'react'
import type {
  SpeechRecognitionInstance,
  SpeechRecognitionResultEvent,
  SpeechRecognitionErrorEvent,
} from '../types'

interface UseTwinRecognitionProps {
  onTranscript:  (text: string) => void
  onStateChange: (state: 'listening' | 'idle') => void
  onError:       (message: string) => void
}

export function useTwinRecognition({
  onTranscript,
  onStateChange,
  onError,
}: UseTwinRecognitionProps) {
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  // Guard against double-fire from simultaneous pointer + touch events
  const activeRef      = useRef(false)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort()
      activeRef.current = false
    }
  }, [])

  const getSR = useCallback((): (new () => SpeechRecognitionInstance) | null => {
    if (typeof window === 'undefined') return null
    return (
      (window as Window & {
        SpeechRecognition?:       new () => SpeechRecognitionInstance
        webkitSpeechRecognition?: new () => SpeechRecognitionInstance
      }).SpeechRecognition ??
      (window as Window & {
        SpeechRecognition?:       new () => SpeechRecognitionInstance
        webkitSpeechRecognition?: new () => SpeechRecognitionInstance
      }).webkitSpeechRecognition ??
      null
    )
  }, [])

  const start = useCallback((e: React.PointerEvent) => {
    e.preventDefault()

    // Block double-fire — pointer and touch both firing on mobile
    if (activeRef.current) return

    const SR = getSR()
    if (!SR) {
      onError('Voice input is not supported on this browser. Type your vibe instead.')
      return
    }

    // Stop any active TTS before listening
    if (typeof window !== 'undefined') {
      window.speechSynthesis?.cancel()
    }

    const recognition = new SR()
    // 'en' gives widest STT coverage — Kenyan accent handled well by
    // Google STT on generic 'en'. 'en-KE' has near-zero browser support.
    recognition.lang           = 'en'
    recognition.continuous     = false
    recognition.interimResults = false

    recognition.onstart = () => {
      activeRef.current = true
      onStateChange('listening')
    }

    recognition.onresult = (event: SpeechRecognitionResultEvent) => {
      const transcript = event.results[0]?.[0]?.transcript ?? ''
      if (transcript.trim()) {
        onTranscript(transcript.trim())
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== 'aborted') {
        activeRef.current = false
        onStateChange('idle')
        onError('Could not hear you clearly. Try again.')
      }
    }

    recognition.onend = () => {
      activeRef.current = false
      onStateChange('idle')
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [getSR, onTranscript, onStateChange, onError])

  const stop = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    recognitionRef.current?.stop()
  }, [])

  // Cancel also covers pointer cancel — scroll interrupt on mobile
  const cancel = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    recognitionRef.current?.stop()
    activeRef.current = false
  }, [])

  const abort = useCallback(() => {
    recognitionRef.current?.abort()
    activeRef.current = false
  }, [])

  return { start, stop, cancel, abort }
}
