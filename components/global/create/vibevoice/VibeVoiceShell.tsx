"use client"

import React, { useState } from "react"
import { useVibeVoice } from "./useVibeVoice"
import { ListenScreen } from "./ListenScreen"
import { NarrateScreen } from "./NarrateScreen"
import { CommunityScreen } from "./CommunityScreen"
import { LiveScreen } from "./LiveScreen"

interface ShellProps {
  authorId: string
}

export function VibeVoiceShell({ authorId }: ShellProps) {
  const [activeTab, setActiveTab] = useState<"listen" | "narrate" | "community" | "live">("listen")
  const state = useVibeVoice(authorId)

  const keyframeStyles = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    @keyframes pulse-glow {
      0% { opacity: 0.6; transform: scale(1); }
      50% { opacity: 1; transform: scale(1.05); }
      100% { opacity: 0.6; transform: scale(1); }
    }
  `

  if (state.loading) {
    return (
      <div style={{
        backgroundColor: "#090D16",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "'Space Grotesk', sans-serif",
        color: "#ffffff"
      }}>
        <style dangerouslySetInnerHTML={{ __html: keyframeStyles }} />
        <div style={{
          border: "4px solid rgba(255, 255, 255, 0.1)",
          borderTopColor: "#CCFF00",
          borderRadius: "50%",
          width: "48px",
          height: "48px",
          animation: "spin 1s linear infinite",
          marginBottom: "16px"
        }} />
        <div style={{ color: "rgba(255, 255, 255, 0.6)", fontSize: "14px" }}>
          Loading VibeVoice Sauti Hub...
        </div>
      </div>
    )
  }

  return (
    <div style={{
      backgroundColor: "#090D16",
      minHeight: "100vh",
      color: "#ffffff",
      fontFamily: "'Space Grotesk', sans-serif",
      paddingBottom: "80px",
    }}>
      <style dangerouslySetInnerHTML={{ __html: keyframeStyles }} />

      <header style={{
        padding: "20px",
        borderBottom: "1px solid #1a2235",
        backgroundColor: "#111827",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        position: "sticky",
        top: 0,
        zIndex: 50
      }}>
        <div>
          <h1 style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: "36px",
            letterSpacing: "1px",
            margin: 0,
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
            VIBEVOICE
            <span style={{
              fontSize: "12px",
              fontFamily: "'Space Grotesk', sans-serif",
              backgroundColor: "#CCFF00",
              color: "#090D16",
              padding: "2px 8px",
              borderRadius: "20px",
              fontWeight: "bold",
              letterSpacing: "0px",
              verticalAlign: "middle"
            }}>
              SAUTI HUB
            </span>
          </h1>
          <p style={{
            fontSize: "13px",
            color: "rgba(255, 255, 255, 0.4)",
            margin: "4px 0 0 0"
          }}>
            East African CBC oral storytelling & peer-review classroom
          </p>
        </div>

        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          backgroundColor: "#1a2235",
          padding: "8px 16px",
          borderRadius: "12px",
          border: "1px solid #1a2235"
        }}>
          <div style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            backgroundColor: "#CCFF00",
            animation: "pulse-glow 1.5s infinite"
          }} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>
              Total Progress
            </span>
            <span style={{ fontSize: "14px", fontWeight: "bold", color: "#CCFF00" }}>
              {state.xp} XP
            </span>
          </div>
        </div>
      </header>

      <div style={{
        padding: "16px 20px 0 20px",
        display: "flex",
        gap: "8px",
        overflowX: "auto"
      }}>
        {(["listen", "narrate", "community", "live"] as const).map((tab) => {
          const labels: Record<string, string> = {
            listen: "🎧 Listen",
            narrate: "🎙️ Narrate",
            community: "🏆 Community",
            live: "📡 Live Room"
          }
          const colors: Record<string, string> = {
            listen: "#CCFF00",
            narrate: "#ff5c35",
            community: "#00c8ff",
            live: "#8b5cf6"
          }
          const isActive = activeTab === tab
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                padding: "12px 16px",
                borderRadius: "12px",
                border: isActive ? `1px solid ${colors[tab]}` : "1px solid #1a2235",
                backgroundColor: isActive ? `${colors[tab]}14` : "#111827",
                color: isActive ? colors[tab] : "rgba(255, 255, 255, 0.6)",
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: "14px",
                fontWeight: "bold",
                cursor: "pointer",
                transition: "all 0.2s ease",
                whiteSpace: "nowrap"
              }}
            >
              {labels[tab]}
            </button>
          )
        })}
      </div>

      <main style={{ padding: "20px" }}>
        {activeTab === "listen"    && <ListenScreen    state={state} />}
        {activeTab === "narrate"   && <NarrateScreen   state={state} />}
        {activeTab === "community" && <CommunityScreen state={state} />}
        {activeTab === "live"      && <LiveScreen      state={state} />}
      </main>
    </div>
  )
}
