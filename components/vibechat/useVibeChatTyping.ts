'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { getSupabaseClient } from '@/lib/supabase'

// Transient signal only. Never transmit message contents or store keystrokes.
// Realtime authorization is enforced in the database for both VC and tuition rooms.
export function useVibeChatTyping(chatKey: string | null) {
  const [otherTyping, setOtherTyping] = useState(false)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const connectedRef = useRef(false)
  const lastActiveRef = useRef(0)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const remoteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const remoteKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!chatKey || !/^(vc|tuition):[0-9a-f-]{36}$/i.test(chatKey)) return
    const db = getSupabaseClient()
    let alive = true
    connectedRef.current = false
    setOtherTyping(false)
    const channel = db.channel('vibechat:' + chatKey, { config: { private: true } })
    channelRef.current = channel

    channel.on('broadcast', { event: 'typing' }, ({ payload }) => {
      if (!alive || !payload || payload.active !== true) {
        if (alive && payload?.active === false) {
          setOtherTyping(false)
          if (remoteTimerRef.current) clearTimeout(remoteTimerRef.current)
        }
        return
      }
      // Multiple participants and devices may share a room. Never trust
      // advertised sender identity and do not disclose it in the UI.
      setOtherTyping(true)
      if (remoteTimerRef.current) clearTimeout(remoteTimerRef.current)
      remoteTimerRef.current = setTimeout(() => { if (alive) setOtherTyping(false) }, 3800)
    }).subscribe(status => {
      if (!alive) return
      connectedRef.current = status === 'SUBSCRIBED'
      if (!connectedRef.current) setOtherTyping(false)
    })

    return () => {
      alive = false
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      if (remoteTimerRef.current) clearTimeout(remoteTimerRef.current)
      channelRef.current = null
      connectedRef.current = false
      remoteKeyRef.current = null
      lastActiveRef.current = 0
      void db.removeChannel(channel)
    }
  }, [chatKey])

  const publish = useCallback((active: boolean) => {
    const channel = channelRef.current
    if (!channel || !connectedRef.current) return
    void channel.send({ type: 'broadcast', event: 'typing', payload: { active } })
      .then(result => {
        if (result !== 'ok') connectedRef.current = false
      }, () => { connectedRef.current = false })
  }, [])

  const sendTyping = useCallback((active: boolean) => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    if (!active) {
      lastActiveRef.current = 0
      publish(false)
      return
    }
    const now = Date.now()
    // First input is immediate; subsequent signals are throttled.
    if (!lastActiveRef.current || now - lastActiveRef.current >= 1800) {
      lastActiveRef.current = now
      publish(true)
    }
    idleTimerRef.current = setTimeout(() => {
      lastActiveRef.current = 0
      publish(false)
    }, 2600)
  }, [publish])

  return { otherTyping, sendTyping }
}
