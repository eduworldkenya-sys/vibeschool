'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { StoryPage } from '@/lib/storyTypes'

type ReadAloudStatus = 'idle' | 'playing' | 'paused' | 'unsupported'

interface UseReadAloudReturn {
  status:  ReadAloudStatus
  play:    () => void
  pause:   () => void
  stop:    () => void
  toggle:  () => void
}

export function useReadAloud(page: StoryPage | null): UseReadAloudReturn {
  const [status, setStatus] = useState<ReadAloudStatus>('idle')
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const supportedRef = useRef<boolean>(false)
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      supportedRef.current = true
    } else {
      setStatus('unsupported')
    }
  }, [])

  useEffect(() => {
    if (supportedRef.current) {
      window.speechSynthesis.cancel()
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current)
      setStatus('idle')
    }
  }, [page?.id])

  const buildText = useCallback((): string => {
    if (!page) return ''
    const parts: string[] = []
    if (page.textBlocks && page.textBlocks.length > 0) {
      page.textBlocks.forEach((block) => {
        if (block.text && block.text.trim()) parts.push(block.text.trim())
      })
    }
    if (page.speechBubbles && page.speechBubbles.length > 0) {
      page.speechBubbles.forEach((bubble) => {
        if (bubble.text && bubble.text.trim()) parts.push(bubble.text.trim())
      })
    }
    return parts.join('. ')
  }, [page])

  const selectEnglishVoice = useCallback((synth: SpeechSynthesis): SpeechSynthesisVoice | null => {
    const voices = synth.getVoices()
    if (!voices || voices.length === 0) return null
    return voices.find((v) => v.lang.toLowerCase().startsWith('en'))
      || voices.find((v) => v.default)
      || voices[0]
      || null
  }, [])

  const play = useCallback(() => {
    if (!supportedRef.current || !page) return
    const text = buildText()
    if (!text) return

    const synth = window.speechSynthesis
    synth.cancel()
    if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current)

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate   = 0.85
    utterance.pitch  = 1.05
    utterance.volume = 1.0
    utterance.lang   = 'en'

    const voice = selectEnglishVoice(synth)
    if (voice) utterance.voice = voice

    utterance.onstart = () => {
      setStatus('playing')
      heartbeatIntervalRef.current = setInterval(() => {
        if (synth.speaking) { synth.pause(); synth.resume() }
      }, 14000)
    }

    const cleanup = () => {
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current)
      setStatus('idle')
    }

    utterance.onend   = cleanup
    utterance.onerror = cleanup
    utterance.onpause = () => setStatus('paused')

    utteranceRef.current = utterance
    synth.speak(utterance)
  }, [buildText, selectEnglishVoice, page])

  const pause = useCallback(() => {
    if (!supportedRef.current) return
    window.speechSynthesis.pause()
    setStatus('paused')
  }, [])

  const stop = useCallback(() => {
    if (!supportedRef.current) return
    window.speechSynthesis.cancel()
    if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current)
    setStatus('idle')
  }, [])

  const toggle = useCallback(() => {
    if (!supportedRef.current) return
    if (status === 'playing') {
      pause()
    } else if (status === 'paused') {
      window.speechSynthesis.resume()
      setStatus('playing')
    } else {
      play()
    }
  }, [status, play, pause])

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current)
    }
  }, [])

  return { status, play, pause, stop, toggle }
}
