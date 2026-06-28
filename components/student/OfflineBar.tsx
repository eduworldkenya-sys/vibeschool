"use client"

import { useEffect, useState } from "react"

export default function OfflineBar() {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null

    async function probe() {
      if (!navigator.onLine) { setOffline(true); return }
      try {
        await fetch("/api/ping", {
          method: "HEAD",
          signal: AbortSignal.timeout(4000),
          cache:  "no-store",
        })
        setOffline(false)
      } catch {
        setOffline(true)
      }
    }

    probe()
    timer = setInterval(probe, 30000)

    const goOn  = () => probe()
    const goOff = () => setOffline(true)
    window.addEventListener("online",  goOn)
    window.addEventListener("offline", goOff)

    return () => {
      if (timer) clearInterval(timer)
      window.removeEventListener("online",  goOn)
      window.removeEventListener("offline", goOff)
    }
  }, [])

  if (!offline) return null

  return (
    <div className="sticky top-0 z-50 bg-red-500 text-white text-center text-xs font-bold py-2 px-4">
      No connection — showing saved data
    </div>
  )
}
