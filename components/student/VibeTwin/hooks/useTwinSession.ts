import { useCallback, useEffect, useRef, useState } from 'react'
import type { TwinMessage, TwinState } from '../types'

const STORAGE_KEY = 'vibeschool:twin:conversation:v1'
const MAX_MESSAGES = 24

function loadStoredMessages(): TwinMessage[] {
  if (typeof window === 'undefined') return []
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is TwinMessage =>
      Boolean(item) &&
      typeof item.id === 'string' &&
      (item.role === 'twin' || item.role === 'user') &&
      typeof item.text === 'string' &&
      typeof item.timestamp === 'number'
    ).slice(-MAX_MESSAGES)
  } catch {
    return []
  }
}

export function useTwinSession(isOpen: boolean) {
  const [messages, setMessages] = useState<TwinMessage[]>([])
  const [twinState, setTwinState] = useState<TwinState>('idle')
  const [greeted, setGreeted] = useState(false)
  const hydratedRef = useRef(false)
  const processingRef = useRef(false)

  useEffect(() => {
    if (hydratedRef.current || typeof window === 'undefined') return
    hydratedRef.current = true
    setMessages(loadStoredMessages())
  }, [])

  useEffect(() => {
    if (!hydratedRef.current || typeof window === 'undefined') return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_MESSAGES)))
    } catch {
      // Local persistence is a convenience only; Twin remains usable without it.
    }
  }, [messages])

  useEffect(() => {
    if (!isOpen) {
      setTwinState('idle')
      processingRef.current = false
    }
  }, [isOpen])

  const addMessage = useCallback((role: 'twin' | 'user', text: string): TwinMessage => {
    const msg: TwinMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      role,
      text,
      timestamp: Date.now(),
    }
    setMessages(prev => [...prev, msg].slice(-MAX_MESSAGES))
    return msg
  }, [])

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
