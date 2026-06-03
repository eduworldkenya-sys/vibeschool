"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@supabase/ssr"
import { VibeVoiceShell } from "@/components/global/create/vibevoice/VibeVoiceShell"

interface UserSessionState {
  loading: boolean
  userId: string | null
}

function LoadingSpinner() {
  const keyframeStyles = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `
  return (
    <div style={{
      backgroundColor: "#090D16", minHeight: "100vh",
      display: "flex", flexDirection: "column",
      justifyContent: "center", alignItems: "center",
      fontFamily: "'Space Grotesk', sans-serif", color: "#ffffff"
    }}>
      <style dangerouslySetInnerHTML={{ __html: keyframeStyles }} />
      <div style={{
        border: "4px solid rgba(255, 255, 255, 0.1)",
        borderTopColor: "#CCFF00", borderRadius: "50%",
        width: "48px", height: "48px",
        animation: "spin 1s linear infinite", marginBottom: "16px"
      }} />
      <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px" }}>
        Checking student credentials...
      </div>
    </div>
  )
}

export default function VibeVoiceEntryPage() {
  const router = useRouter()
  const [session, setSession] = useState<UserSessionState>({ loading: true, userId: null })

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    async function resolveUserSession() {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) router.replace("/global/signin")
        else setSession({ loading: false, userId: user.id })
      } catch {
        router.replace("/global/signin")
      }
    }
    resolveUserSession()
  }, [router])

  if (session.loading || !session.userId) return <LoadingSpinner />
  return <VibeVoiceShell authorId={session.userId} />
}
