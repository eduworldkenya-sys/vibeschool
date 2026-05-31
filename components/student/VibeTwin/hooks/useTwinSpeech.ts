// components/student/VibeTwin/hooks/useTwinSpeech.ts
import { useRef, useCallback, useEffect } from 'react'
import { tokenizeSentences } from '../lib/tts-tokenizer'

export function useTwinSpeech() {
  const speakingRef    = useRef(false)
  const cancelledRef   = useRef(false)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelledRef.current = true
      if (typeof window !== 'undefined') {
        window.speechSynthesis?.cancel()
      }
    }
  }, [])

  const getVoice = useCallback((): SpeechSynthesisVoice | null => {
    const voices = window.speechSynthesis.getVoices()
    return (
      voices.find(v => v.name.includes('Google UK English Female')) ??
      voices.find(v => v.name.includes('Microsoft Zira'))           ??
      voices.find(v => v.lang === 'en-GB')                          ??
      voices.find(v => v.lang.startsWith('en-'))                    ??
      voices[0]                                                      ??
      null
    )
  }, [])

  const speak = useCallback((text: string, onEnd?: () => void) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      onEnd?.()
      return
    }

    // Cancel any active speech
    window.speechSynthesis.cancel()
    cancelledRef.current = false
    speakingRef.current  = true

    const sentences = tokenizeSentences(text)
    let idx = 0

    function speakNext() {
      // Bail if cancelled or component unmounted
      if (cancelledRef.current) {
        speakingRef.current = false
        onEnd?.()
        return
      }

      if (idx >= sentences.length) {
        speakingRef.current = false
        onEnd?.()
        return
      }

      const raw = sentences[idx++].trim()
      if (!raw) { speakNext(); return }

      const utterance   = new SpeechSynthesisUtterance(raw)
      utterance.rate    = 1.05
      utterance.pitch   = 1.05
      utterance.onend   = speakNext
      utterance.onerror = () => {
        speakingRef.current = false
        onEnd?.()
      }

      const voice = getVoice()
      if (voice) utterance.voice = voice

      window.speechSynthesis.speak(utterance)
    }

    // Handle lazy-loaded voice buffers on first call
    if (window.speechSynthesis.getVoices().length === 0) {
      const handleVoicesChanged = () => {
        // Clean up immediately — assign null not remove since onvoiceschanged
        // is not a standard EventTarget in all browsers
        window.speechSynthesis.onvoiceschanged = null
        speakNext()
      }
      window.speechSynthesis.onvoiceschanged = handleVoicesChanged
    } else {
      speakNext()
    }
  }, [getVoice])

  const cancel = useCallback(() => {
    cancelledRef.current = true
    speakingRef.current  = false
    if (typeof window !== 'undefined') {
      window.speechSynthesis?.cancel()
    }
  }, [])

  return { speak, cancel, speakingRef }
}
