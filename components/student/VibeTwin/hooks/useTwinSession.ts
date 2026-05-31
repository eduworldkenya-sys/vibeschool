// components/student/VibeTwin/hooks/useTwinSession.ts
import { useState, useEffect, useRef, useCallback } from 'react'
import type { TwinMessage, TwinState } from '../types'

export function useTwinSession(isOpen: boolean) {
  const [messages,  setMessages]  = useState<TwinMessage[]>([])
  const [twinState, setTwinState] = useState<TwinState>('idle')
  const [greeted,   setGreeted]   = useState(false)

  // Ref-based guard — avoids async state race on double-submit
  const processingRef = useRef(false)

  // Reset all state cleanly on close
  useEffect(() => {
    if (!isOpen) {
      setGreeted(false)
      setTwinState('idle')
      setMessages([])
      processingRef.current = false
    }
  }, [isOpen])

  const addMessage = useCallback((
    role: 'twin' | 'user',
    text: string,
  ): TwinMessage => {
    const msg: TwinMessage = {
      id:        `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      role,
      text,
      timestamp: Date.now(),
    }
    setMessages(prev => [...prev, msg])
    return msg
  }, [])

  // Returns true if processing lock was acquired
  // Returns false if already processing — caller must bail
  const acquireProcessing = useCallback((): boolean => {
    if (processingRef.current) return false
    processingRef.current = true
    return true
  }, [])

  const releaseProcessing = useCallback(() => {
    processingRef.current = false
  }, [])

  return {
    messages,
    twinState,
    setTwinState,
    greeted,
    setGreeted,
    addMessage,
    acquireProcessing,
    releaseProcessing,
  }
}
