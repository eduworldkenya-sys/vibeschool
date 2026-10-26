'use client'
import { useEffect } from 'react'
const CHANNEL = 'vibeschool-receiver-logout'
/** Only a non-sensitive logout signal crosses tabs; never identities or credentials. */
export function broadcastReceiverLogout() {
  try { const channel = new BroadcastChannel(CHANNEL); channel.postMessage('clear'); channel.close() } catch { /* storage fallback */ }
  try { localStorage.setItem(CHANNEL, String(Date.now())) } catch { /* restricted storage */ }
}
export function useReceiverSessionSafety(verifyOnReturn = true) {
  useEffect(() => {
    const clear = () => window.location.replace('/success-wishes/open?notice=device-cleared')
    let channel: BroadcastChannel | undefined
    try { channel = new BroadcastChannel(CHANNEL); channel.onmessage = event => { if (event.data === 'clear') clear() } } catch { /* storage fallback */ }
    const storage = (event: StorageEvent) => { if (event.key === CHANNEL) clear() }
    const visibility = () => {
      if (!verifyOnReturn || document.visibilityState !== 'visible') return
      // Revalidate without reloading an in-progress OTP form after visiting the SMS app.
      void fetch('/api/success-wishes/receiver/inbox', { cache: 'no-store' })
        .then(response => { if (!response.ok) clear() }).catch(clear)
    }
    window.addEventListener('storage', storage)
    document.addEventListener('visibilitychange', visibility)
    return () => { channel?.close(); window.removeEventListener('storage', storage); document.removeEventListener('visibilitychange', visibility) }
  }, [verifyOnReturn])
}
