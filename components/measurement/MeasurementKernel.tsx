"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase"

type Attribution = {
  source: string | null
  medium: string | null
  campaign: string | null
  referrerHost: string | null
  landingPath: string | null
}

const STORAGE_KEY = "vibeschool.measurement.first_touch.v1"
const EXCLUDED_PREFIXES = ["/hq", "/auth"]
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function bounded(value: string | null, max: number) {
  const cleaned = value?.trim()
  return cleaned ? cleaned.slice(0, max) : null
}

function routeFamily(path: string | null) {
  if (!path) return null
  const segments = path.split("/").map((segment) => {
    if (!segment) return segment
    if (UUID_RE.test(segment) || /^\d{4,}$/.test(segment) || segment.length > 32) return ":id"
    return segment
  })
  return bounded(segments.join("/"), 180)
}

function captureFirstTouch(): Attribution {
  const params = new URLSearchParams(window.location.search)
  let referrerHost: string | null = null
  try {
    if (document.referrer) {
      const referrer = new URL(document.referrer)
      if (referrer.host && referrer.host !== window.location.host) referrerHost = bounded(referrer.host.toLowerCase(), 120)
    }
  } catch {
    referrerHost = null
  }

  return {
    source: bounded(params.get("utm_source"), 80),
    medium: bounded(params.get("utm_medium"), 80),
    campaign: bounded(params.get("utm_campaign"), 120),
    referrerHost,
    landingPath: routeFamily(window.location.pathname),
  }
}

function readOrCreateAttribution(): Attribution {
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY)
    if (existing) return JSON.parse(existing) as Attribution
    const first = captureFirstTouch()
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(first))
    return first
  } catch {
    return captureFirstTouch()
  }
}

export default function MeasurementKernel() {
  const pathname = usePathname()
  const [userId, setUserId] = useState<string | null>(null)
  const attributionRef = useRef<Attribution | null>(null)
  const lastRecordedRef = useRef<string>("")

  useEffect(() => {
    attributionRef.current = readOrCreateAttribution()
  }, [])

  useEffect(() => {
    const sb = getSupabaseClient()
    let live = true
    void sb.auth.getUser().then(({ data }) => {
      if (live) setUserId(data.user?.id ?? null)
    })
    const { data } = sb.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null)
    })
    return () => {
      live = false
      data.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!userId || !pathname || EXCLUDED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return
    const today = new Date().toISOString().slice(0, 10)
    const pathFamily = routeFamily(pathname)
    const key = `${userId}:${today}:${pathFamily}`
    if (lastRecordedRef.current === key) return
    lastRecordedRef.current = key

    const first = attributionRef.current ?? readOrCreateAttribution()
    const sb = getSupabaseClient() as ReturnType<typeof getSupabaseClient> & {
      rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ error: { message?: string } | null }>
    }
    void Promise.resolve(sb.rpc("product_record_session", {
      p_path: pathFamily,
      p_source: first.source,
      p_medium: first.medium,
      p_campaign: first.campaign,
      p_referrer_host: first.referrerHost,
      p_landing_path: first.landingPath,
    })).then(({ error }) => {
      if (error && process.env.NODE_ENV === "development") console.warn("measurement session not recorded", error.message)
    }).catch(() => undefined)
  }, [pathname, userId])

  return null
}
