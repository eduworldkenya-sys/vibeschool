"use client"

import React, { useState } from "react"
import { VVNarration } from "@/lib/types"

interface CommunityScreenProps {
  state: {
    activeReviews: VVNarration[]
    submitReview: (narrationId: string, approved: boolean) => Promise<boolean>
    reviewsCount: number
    accuracy: number
    xp: number
    leaderboard: Array<{ name: string; xp: number; role: string }>
    playNarration: (narration: VVNarration) => void
    isPlaying: boolean
    stopNarration: () => void
    currentNarration: VVNarration | null
  }
}

export function CommunityScreen({ state }: CommunityScreenProps) {
  const [reviewingIndex, setReviewingIndex] = useState<number>(0)
  const [submittingVote, setSubmittingVote] = useState<boolean>(false)
  const [toast, setToast] = useState<string>("")

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(""), 3000)
  }

  const currentReviewItem: VVNarration | undefined = state.activeReviews[reviewingIndex]

  const handleVote = async (approved: boolean) => {
    if (!currentReviewItem) return
    setSubmittingVote(true)
    state.stopNarration()
    try {
      const success = await state.submitReview(currentReviewItem.id, approved)
      if (success) {
        if (reviewingIndex >= state.activeReviews.length - 1) setReviewingIndex(0)
      } else {
        showToast("Failed to record your vote. Please try again.")
      }
    } catch {
      showToast("Error contacting the community verification server.")
    } finally {
      setSubmittingVote(false)
    }
  }

  const handleListenToReview = () => {
    if (!currentReviewItem) return
    if (state.isPlaying && state.currentNarration?.id === currentReviewItem.id) {
      state.stopNarration()
    } else {
      state.playNarration(currentReviewItem)
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      {toast && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          backgroundColor: "#111827", border: "1px solid #1a2235",
          color: "#ffffff", padding: "12px 20px", borderRadius: "12px",
          fontSize: "13px", fontWeight: "bold", zIndex: 9999, whiteSpace: "nowrap"
        }}>{toast}</div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px" }}>
        {[
          { icon: "🔎", label: "Audits Completed", value: state.reviewsCount, color: "#ffffff" },
          { icon: "🎯", label: "Audit Accuracy",   value: `${state.accuracy}%`, color: "#CCFF00" },
          { icon: "⭐", label: "Auditor Rank",     value: "Expert Peer", color: "#00c8ff" }
        ].map((stat) => (
          <div key={stat.label} style={{
            backgroundColor: "#111827", border: "1px solid #1a2235",
            borderRadius: "16px", padding: "16px", textAlign: "center"
          }}>
            <div style={{ fontSize: "24px", marginBottom: "4px" }}>{stat.icon}</div>
            <div style={{ fontSize: "11px", color: "rgba(255, 255, 255, 0.4)", textTransform: "uppercase" }}>
              {stat.label}
            </div>
            <div style={{ fontSize: "20px", fontWeight: "bold", color: stat.color, marginTop: "4px" }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      <div style={{ backgroundColor: "#111827", border: "1.5px solid #1a2235", borderRadius: "16px", padding: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
          <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "24px", margin: 0 }}>
            Community Peer Verification
          </h3>
          <span style={{
            fontSize: "12px", backgroundColor: "#CCFF00", color: "#090D16",
            padding: "2px 8px", borderRadius: "10px", fontWeight: "bold"
          }}>
            +15 XP Per Review
          </span>
        </div>
        <p style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.4)", margin: "0 0 16px 0" }}>
          Verify spelling, clarity, and dialect authenticity. Approve high-quality readings.
        </p>

        {!currentReviewItem ? (
          <div style={{
            padding: "40px 20px", textAlign: "center",
            backgroundColor: "#090D16", borderRadius: "12px",
            border: "1px dashed rgba(255, 255, 255, 0.1)"
          }}>
            <span style={{ fontSize: "36px", display: "block", marginBottom: "12px" }}>🎉</span>
            <div style={{ fontSize: "15px", fontWeight: "bold", color: "#CCFF00" }}>
              Moderation Queue Cleared!
            </div>
            <p style={{ fontSize: "13px", color: "rgba(255, 255, 255, 0.4)", margin: "4px 0 0 0" }}>
              You have reviewed all pending narrations. Good job!
            </p>
          </div>
        ) : (
          <div style={{
            backgroundColor: "#090D16", borderRadius: "12px",
            border: "1px solid #1a2235", padding: "16px",
            display: "flex", flexDirection: "column", gap: "14px"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
              <div>
                <span style={{
                  fontSize: "11px", fontWeight: "bold",
                  backgroundColor: "rgba(255, 92, 53, 0.1)", color: "#ff5c35",
                  padding: "3px 8px", borderRadius: "6px"
                }}>
                  PENDING PEER AUDIT
                </span>
                <h4 style={{ margin: "8px 0 2px 0", fontSize: "16px", fontWeight: "bold" }}>
                  {currentReviewItem.title}
                </h4>
              </div>
              <button onClick={handleListenToReview} style={{
                backgroundColor: state.isPlaying && state.currentNarration?.id === currentReviewItem.id ? "#ff5c35" : "#CCFF00",
                color: state.isPlaying && state.currentNarration?.id === currentReviewItem.id ? "#ffffff" : "#090D16",
                border: "none", borderRadius: "10px", padding: "8px 16px",
                fontSize: "12px", fontWeight: "bold", cursor: "pointer",
                display: "flex", alignItems: "center", gap: "6px"
              }}>
                {state.isPlaying && state.currentNarration?.id === currentReviewItem.id ? "⏸️ Pause" : "🔊 Listen to Voice"}
              </button>
            </div>

            <div style={{ display: "flex", gap: "12px", fontSize: "12px", color: "rgba(255, 255, 255, 0.4)" }}>
              <span>🗣️ Dialect: <strong style={{ color: "#ffffff" }}>{currentReviewItem.language}</strong></span>
              <span>📚 Tag: <strong style={{ color: "#ffffff" }}>{currentReviewItem.subject}</strong></span>
            </div>

            <div style={{
              backgroundColor: "#111827", borderRadius: "8px", padding: "12px",
              border: "1px solid #1a2235", fontSize: "14px",
              lineHeight: "1.6", fontStyle: "italic", color: "rgba(255, 255, 255, 0.8)"
            }}>
              "{currentReviewItem.script}"
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
              <button onClick={() => handleVote(true)} disabled={submittingVote} style={{
                flex: 1, backgroundColor: "rgba(204, 255, 0, 0.1)",
                border: "1px solid #CCFF00", color: "#CCFF00",
                borderRadius: "12px", padding: "12px", fontSize: "13px",
                fontWeight: "bold", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "6px"
              }}>
                ✔️ Approve Voice & Script
              </button>
              <button onClick={() => handleVote(false)} disabled={submittingVote} style={{
                flex: 1, backgroundColor: "rgba(255, 92, 53, 0.1)",
                border: "1px solid #ff5c35", color: "#ff5c35",
                borderRadius: "12px", padding: "12px", fontSize: "13px",
                fontWeight: "bold", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "6px"
              }}>
                ❌ Reject / Flawed Recording
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
              <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>
                Item {reviewingIndex + 1} of {state.activeReviews.length} pending
              </span>
              {state.activeReviews.length > 1 && (
                <button
                  onClick={() => setReviewingIndex((prev) => (prev + 1) % state.activeReviews.length)}
                  style={{ backgroundColor: "transparent", color: "#00c8ff", border: "none", fontSize: "11px", cursor: "pointer" }}
                >
                  Skip to Next ➡️
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div style={{ backgroundColor: "#111827", border: "1px solid #1a2235", borderRadius: "16px", padding: "20px" }}>
        <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "24px", margin: "0 0 4px 0" }}>
          Weekly Leaderboard
        </h3>
        <p style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.4)", margin: "0 0 16px 0" }}>
          Top educators and learners contributing to the VibeVoice local audio ecosystem.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {state.leaderboard.map((user, index) => {
            const isMe = user.name === "You"
            return (
              <div key={index} style={{
                backgroundColor: isMe ? "rgba(204, 255, 0, 0.05)" : "#090D16",
                border: isMe ? "1px solid #CCFF00" : "1px solid #1a2235",
                borderRadius: "12px", padding: "12px 16px",
                display: "flex", justifyContent: "space-between", alignItems: "center"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{
                    fontSize: "14px", fontWeight: "bold", width: "24px",
                    color: index === 0 ? "#CCFF00" : index === 1 ? "#00c8ff" : "rgba(255,255,255,0.4)"
                  }}>
                    #{index + 1}
                  </span>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: "bold", color: isMe ? "#CCFF00" : "#ffffff" }}>
                      {user.name} {isMe && "👈"}
                    </div>
                    <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>{user.role}</div>
                  </div>
                </div>
                <div style={{ fontSize: "14px", fontWeight: "bold", color: isMe ? "#CCFF00" : "#ffffff" }}>
                  {user.xp} XP
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
