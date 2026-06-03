"use client"

import React, { useState } from "react"
import { VVNarration, VVLang } from "@/lib/types"
import { FullPlayer } from "./FullPlayer"

interface ListenScreenProps {
  state: {
    narrations: VVNarration[]
    currentNarration: VVNarration | null
    isPlaying: boolean
    playNarration: (narration: VVNarration) => void
    pauseNarration: () => void
    resumeNarration: () => void
    stopNarration: () => void
    currentWordIndex: number
    wordsList: string[]
    translateScript: (text: string, targetLang: string) => Promise<string>
    generateQuestion: (script: string) => Promise<any>
    xp: number
  }
}

export function ListenScreen({ state }: ListenScreenProps) {
  const [selectedLanguage, setSelectedLanguage] = useState<string>("All")
  const [selectedSubject, setSelectedSubject] = useState<string>("All")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [playerOpen, setPlayerOpen] = useState<boolean>(false)

  const languages: string[] = ["All", "swahili", "english", "sheng", "kikuyu", "dholuo"]
  const subjects: string[] = ["All", "Science", "Community", "Art", "General", "Maths"]

  const filteredNarrations = state.narrations.filter((narration) => {
    const matchesLanguage = selectedLanguage === "All" || narration.language === selectedLanguage
    const matchesSubject = selectedSubject === "All" || narration.subject.toLowerCase() === selectedSubject.toLowerCase()
    const matchesSearch =
      narration.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      narration.script.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesLanguage && matchesSubject && matchesSearch
  })

  const featuredNarration: VVNarration | undefined =
    state.narrations.find(n => n.play_count > 3) || state.narrations[0]

  const handlePlayCard = (narration: VVNarration) => {
    state.playNarration(narration)
    setPlayerOpen(true)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

      <div style={{
        backgroundColor: "rgba(204, 255, 0, 0.08)",
        border: "1px dashed #CCFF00",
        borderRadius: "16px",
        padding: "16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "28px" }}>🔥</span>
          <div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: "bold", fontSize: "15px", color: "#CCFF00" }}>
              5-DAY SPEAKING & LISTENING STREAK!
            </div>
            <div style={{ fontSize: "13px", color: "rgba(255, 255, 255, 0.6)", marginTop: "2px" }}>
              "You are building consistent bilingual oral fluency. Complete today's quiz to protect it!"
            </div>
          </div>
        </div>
        <div style={{
          fontSize: "13px", fontWeight: "bold",
          backgroundColor: "#CCFF00", color: "#090D16",
          padding: "6px 12px", borderRadius: "8px"
        }}>
          +50 XP
        </div>
      </div>

      {featuredNarration && (
        <div style={{
          backgroundColor: "#111827", borderRadius: "16px",
          border: "1.5px solid #1a2235", padding: "24px",
          position: "relative", overflow: "hidden",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)"
        }}>
          <div style={{
            position: "absolute", top: "-10px", right: "-10px",
            width: "120px", height: "120px",
            background: "radial-gradient(circle, rgba(0, 200, 255, 0.15) 0%, transparent 70%)",
            pointerEvents: "none"
          }} />
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", zIndex: 2, position: "relative" }}>
            <span style={{
              fontSize: "11px", color: "#00c8ff", fontWeight: "bold",
              textTransform: "uppercase", letterSpacing: "1px",
              backgroundColor: "rgba(0, 200, 255, 0.08)",
              padding: "4px 8px", borderRadius: "6px", alignSelf: "flex-start"
            }}>
              "Editor's Choice CBC Lesson"
            </span>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "32px", margin: 0, lineHeight: "1.1" }}>
              {featuredNarration.title}
            </h2>
            <p style={{ fontSize: "14px", color: "rgba(255, 255, 255, 0.6)", margin: 0, lineHeight: "1.5" }}>
              {featuredNarration.excerpt || featuredNarration.script.substring(0, 110) + "..."}
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "8px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.4)" }}>
                🗣️ Language: <strong style={{ color: "#ffffff" }}>{featuredNarration.language}</strong>
              </span>
              <span style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.4)" }}>
                📚 Subject: <strong style={{ color: "#ffffff" }}>{featuredNarration.subject}</strong>
              </span>
              <span style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.4)" }}>
                🔥 Plays: <strong style={{ color: "#ffffff" }}>{featuredNarration.play_count}</strong>
              </span>
            </div>
            <button
              onClick={() => handlePlayCard(featuredNarration)}
              style={{
                alignSelf: "flex-start", backgroundColor: "#CCFF00", color: "#090D16",
                border: "none", borderRadius: "12px", padding: "12px 24px",
                fontSize: "14px", fontWeight: "bold", cursor: "pointer", marginTop: "8px",
                display: "flex", alignItems: "center", gap: "8px",
                boxShadow: "0 4px 14px rgba(204, 255, 0, 0.3)"
              }}
            >
              <span>▶️</span> Listen & Take Quiz
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
        <input
          type="text"
          placeholder="Search lessons, stories or local dialects..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: 1, backgroundColor: "#111827", border: "1px solid #1a2235",
            borderRadius: "12px", padding: "12px 16px", color: "#ffffff",
            fontFamily: "'Space Grotesk', sans-serif", fontSize: "14px", outline: "none"
          }}
        />
      </div>

      <div>
        <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", marginBottom: "8px", fontWeight: "bold" }}>
          FILTER BY LANGUAGE DIALECT
        </div>
        <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "8px" }}>
          {languages.map((lang) => (
            <button key={lang} onClick={() => setSelectedLanguage(lang)} style={{
              padding: "8px 16px", borderRadius: "20px", fontSize: "12px",
              fontWeight: "bold", cursor: "pointer",
              border: selectedLanguage === lang ? "1px solid #CCFF00" : "1px solid #1a2235",
              backgroundColor: selectedLanguage === lang ? "rgba(204, 255, 0, 0.1)" : "#111827",
              color: selectedLanguage === lang ? "#CCFF00" : "rgba(255,255,255,0.6)",
              whiteSpace: "nowrap"
            }}>
              {lang === "All" ? "🌍 All Dialects" : lang.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", marginBottom: "8px", fontWeight: "bold" }}>
          FILTER BY CBC SUBJECT
        </div>
        <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "8px" }}>
          {subjects.map((sub) => (
            <button key={sub} onClick={() => setSelectedSubject(sub)} style={{
              padding: "8px 16px", borderRadius: "20px", fontSize: "12px",
              fontWeight: "bold", cursor: "pointer",
              border: selectedSubject === sub ? "1px solid #00c8ff" : "1px solid #1a2235",
              backgroundColor: selectedSubject === sub ? "rgba(0, 200, 255, 0.1)" : "#111827",
              color: selectedSubject === sub ? "#00c8ff" : "rgba(255,255,255,0.6)",
              whiteSpace: "nowrap"
            }}>
              {sub === "All" ? "📚 All Subjects" : sub}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: "8px" }}>
        <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "24px", margin: "0 0 12px 0" }}>
          Oral Narrations Library ({filteredNarrations.length})
        </h3>
        {filteredNarrations.length === 0 ? (
          <div style={{
            padding: "40px", textAlign: "center", backgroundColor: "#111827",
            borderRadius: "16px", border: "1px solid #1a2235",
            color: "rgba(255, 255, 255, 0.4)", fontSize: "14px"
          }}>
            No audio lessons found. Try creating one in the Narrate tab!
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
            {filteredNarrations.map((narration) => {
              const isAI = narration.tier === "ai"
              return (
                <div
                  key={narration.id}
                  onClick={() => handlePlayCard(narration)}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = isAI ? "#8b5cf6" : "#ff5c35" }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#1a2235" }}
                  style={{
                    backgroundColor: "#111827", borderRadius: "16px",
                    border: "1px solid #1a2235", padding: "16px",
                    cursor: "pointer", transition: "all 0.2s ease",
                    display: "flex", flexDirection: "column",
                    justifyContent: "space-between", gap: "12px", position: "relative"
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                      <span style={{
                        fontSize: "10px", fontWeight: "bold", textTransform: "uppercase",
                        backgroundColor: isAI ? "rgba(139, 92, 246, 0.15)" : "rgba(255, 92, 53, 0.15)",
                        color: isAI ? "#8b5cf6" : "#ff5c35",
                        padding: "3px 6px", borderRadius: "4px"
                      }}>
                        {isAI ? "🤖 AI Generated" : "🧑‍🏫 Human Narrator"}
                      </span>
                      <span style={{ fontSize: "11px", color: "rgba(255, 255, 255, 0.4)" }}>
                        ⏱️ {narration.duration_sec}s
                      </span>
                    </div>
                    <h4 style={{ fontSize: "16px", fontWeight: "bold", margin: "8px 0 4px 0", color: "#ffffff" }}>
                      {narration.title}
                    </h4>
                    <p style={{
                      fontSize: "13px", color: "rgba(255, 255, 255, 0.5)", margin: 0, lineHeight: "1.4",
                      display: "-webkit-box", WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical", overflow: "hidden"
                    }}>
                      {narration.excerpt || narration.script}
                    </p>
                  </div>
                  <div style={{
                    borderTop: "1px solid #1a2235", paddingTop: "12px",
                    display: "flex", justifyContent: "space-between", alignItems: "center"
                  }}>
                    <span style={{
                      fontSize: "11px", backgroundColor: "#1a2235",
                      color: "rgba(255,255,255,0.6)", padding: "2px 8px", borderRadius: "12px"
                    }}>
                      {narration.subject}
                    </span>
                    <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>
                      ▶️ <strong>{narration.play_count}</strong> plays
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {playerOpen && state.currentNarration && (
        <FullPlayer
          state={state}
          onClose={() => { state.stopNarration(); setPlayerOpen(false) }}
        />
      )}
    </div>
  )
}
