"use client"

import React, { useState, useEffect, useRef } from "react"
import { VVLiveRoom, VVLang } from "@/lib/types"

interface LiveScreenProps {
  state: {
    liveRoom: VVLiveRoom | null
    liveParticipants: string[]
    liveReactions: string[]
    raisedHands: string[]
    liveTranscription: string
    createLiveRoom: (topic: string, language: VVLang) => Promise<VVLiveRoom>
    joinLiveRoom: (roomCode: string) => Promise<VVLiveRoom>
    addLiveReaction: (emoji: string) => void
    toggleHandRaise: (studentName: string) => void
    sendLiveTranscription: (text: string) => void
    endLiveRoom: (roomId: string, finalScript?: string) => Promise<void>
    userId: string | null
  }
}

export function LiveScreen({ state }: LiveScreenProps) {
  const [role, setRole] = useState<"teacher" | "learner" | "parent">("learner")
  const [roomTopic, setRoomTopic] = useState<string>("")
  const [roomLanguage, setRoomLanguage] = useState<VVLang>("swahili")
  const [joinCode, setJoinCode] = useState<string>("")
  const [connecting, setConnecting] = useState<boolean>(false)
  const [accumulatedScript, setAccumulatedScript] = useState<string>("")
  const [toast, setToast] = useState<string>("")
  const [confirmEnd, setConfirmEnd] = useState<boolean>(false)
  const recognitionRef = useRef<any>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(""), 3000)
  }

  useEffect(() => {
    if (state.liveRoom && role === "teacher") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (SpeechRecognition) {
        const rec = new SpeechRecognition()
        rec.continuous = true
        rec.interimResults = true
        rec.lang = roomLanguage === "swahili" ? "sw-KE" : "en-US"
        rec.onresult = (event: any) => {
          let finalSpoken = ""
          let currentInterim = ""
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) finalSpoken += event.results[i][0].transcript + " "
            else currentInterim += event.results[i][0].transcript
          }
          if (finalSpoken) { setAccumulatedScript(prev => prev + finalSpoken); state.sendLiveTranscription(finalSpoken) }
          else if (currentInterim) state.sendLiveTranscription(currentInterim)
        }
        rec.onerror = () => {}
        rec.onend = () => { if (state.liveRoom) { try { rec.start() } catch {} } }
        recognitionRef.current = rec
        try { rec.start() } catch {}
      }
    }
    return () => { if (recognitionRef.current) recognitionRef.current.stop() }
  }, [state.liveRoom, role])

  const handleCreateRoom = async () => {
    if (!roomTopic.trim()) { showToast("Please specify a classroom lecture topic."); return }
    setConnecting(true)
    try {
      setAccumulatedScript("")
      await state.createLiveRoom(roomTopic, roomLanguage)
    } catch (err: any) {
      showToast(err?.message || "Could not launch classroom session.")
    } finally {
      setConnecting(false)
    }
  }

  const handleJoinRoom = async () => {
    if (joinCode.length !== 6) { showToast("Please enter the 6-digit classroom code."); return }
    setConnecting(true)
    try {
      await state.joinLiveRoom(joinCode)
    } catch (err: any) {
      showToast(err?.message || "Failed to join live session. Please check invitation code.")
    } finally {
      setConnecting(false)
    }
  }

  const handleEndRoom = async () => {
    if (!state.liveRoom) return
    if (!confirmEnd) { setConfirmEnd(true); return }
    if (recognitionRef.current) recognitionRef.current.stop()
    await state.endLiveRoom(state.liveRoom.id, accumulatedScript || "Class discussion on " + state.liveRoom.topic)
    showToast("Class ended. Lecture saved to Community Library!")
    setConfirmEnd(false)
  }

  const handleLeaveRoom = () => { window.location.reload() }

  const blinkAnimation = `
    @keyframes blink {
      0%, 100% { opacity: 0.2; }
      50% { opacity: 1; }
    }
    @keyframes wave-bounce {
      0%, 100% { transform: scaleY(0.3); }
      50% { transform: scaleY(1); }
    }
  `

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <style dangerouslySetInnerHTML={{ __html: blinkAnimation }} />

      {toast && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          backgroundColor: "#111827", border: "1px solid #1a2235",
          color: "#ffffff", padding: "12px 20px", borderRadius: "12px",
          fontSize: "13px", fontWeight: "bold", zIndex: 9999, whiteSpace: "nowrap"
        }}>{toast}</div>
      )}

      {state.liveRoom ? (
        <div style={{
          backgroundColor: "#111827", border: "2px solid #8b5cf6",
          borderRadius: "16px", padding: "24px",
          display: "flex", flexDirection: "column", gap: "20px"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{
                width: "12px", height: "12px", borderRadius: "50%",
                backgroundColor: "#ff5c35", animation: "blink 1.2s ease-in-out infinite"
              }} />
              <span style={{ fontSize: "12px", fontWeight: "bold", color: "#ff5c35", textTransform: "uppercase", letterSpacing: "1px" }}>
                Live Classroom Session
              </span>
            </div>
            <span style={{
              fontFamily: "monospace", fontSize: "16px",
              backgroundColor: "#090D16", padding: "6px 16px",
              borderRadius: "10px", border: "1px solid #1a2235",
              color: "#8b5cf6", fontWeight: "bold"
            }}>
              CODE: {state.liveRoom.room_code}
            </span>
          </div>

          <div>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "32px", margin: 0, lineHeight: "1.1" }}>
              {state.liveRoom.topic}
            </h2>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "rgba(255,255,255,0.4)" }}>
              Language: <strong style={{ color: "#00c8ff" }}>{state.liveRoom.language.toUpperCase()}</strong>
            </p>
          </div>

          <div style={{
            backgroundColor: "#090D16", borderRadius: "12px",
            border: "1px solid #1a2235", padding: "24px 16px",
            display: "flex", justifyContent: "center", alignItems: "center", gap: "4px"
          }}>
            {[...Array(20)].map((_, i) => (
              <div key={i} style={{
                width: "4px", borderRadius: "4px", backgroundColor: "#8b5cf6",
                animation: `wave-bounce ${0.5 + (i % 5) * 0.15}s ease-in-out infinite alternate`
              }} />
            ))}
          </div>

          {state.liveTranscription && (
            <div style={{
              backgroundColor: "#090D16", borderRadius: "10px", padding: "12px",
              border: "1px solid #1a2235", fontSize: "13px",
              color: "rgba(255,255,255,0.7)", lineHeight: "1.5", fontStyle: "italic"
            }}>
              📝 {state.liveTranscription}
            </div>
          )}

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {["👏", "❤️", "🔥", "😮", "✋"].map((emoji) => (
              <button key={emoji} onClick={() => state.addLiveReaction(emoji)} style={{
                backgroundColor: "#1a2235", border: "1px solid #1a2235",
                borderRadius: "10px", padding: "8px 14px",
                fontSize: "18px", cursor: "pointer"
              }}>
                {emoji}
              </button>
            ))}
          </div>

          {state.liveReactions.length > 0 && (
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {state.liveReactions.slice(-8).map((r, i) => (
                <span key={i} style={{ fontSize: "20px" }}>{r}</span>
              ))}
            </div>
          )}

          <div style={{
            backgroundColor: "#090D16", borderRadius: "10px", padding: "12px",
            border: "1px solid #1a2235"
          }}>
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", marginBottom: "8px", textTransform: "uppercase" }}>
              Participants ({state.liveParticipants.length})
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {state.liveParticipants.map((p, i) => (
                <span key={i} style={{
                  backgroundColor: "#1a2235", color: "#ffffff",
                  padding: "4px 10px", borderRadius: "20px", fontSize: "12px"
                }}>
                  {state.raisedHands.includes(p) ? "✋ " : ""}{p}
                </span>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            {role !== "teacher" && (
              <button onClick={() => state.toggleHandRaise("You")} style={{
                flex: 1, backgroundColor: "rgba(0,200,255,0.1)",
                border: "1px solid #00c8ff", color: "#00c8ff",
                borderRadius: "10px", padding: "10px 20px",
                fontSize: "13px", fontWeight: "bold", cursor: "pointer"
              }}>
                ✋ Raise Hand
              </button>
            )}
            {role === "teacher" && (
              <button onClick={handleEndRoom} style={{
                backgroundColor: confirmEnd ? "#ff5c35" : "rgba(255,92,53,0.1)",
                color: confirmEnd ? "#ffffff" : "#ff5c35",
                border: "1px solid #ff5c35", borderRadius: "10px",
                padding: "10px 20px", fontSize: "13px",
                fontWeight: "bold", cursor: "pointer"
              }}>
                {confirmEnd ? "Tap again to confirm end" : "🚫 End Session & Archive"}
              </button>
            )}
            {role !== "teacher" && (
              <button onClick={handleLeaveRoom} style={{
                backgroundColor: "transparent", color: "rgba(255,255,255,0.4)",
                border: "1px solid #1a2235", borderRadius: "10px",
                padding: "10px 20px", fontSize: "13px", cursor: "pointer"
              }}>
                Leave Room
              </button>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{
            backgroundColor: "#111827", border: "1px solid #1a2235",
            borderRadius: "16px", padding: "16px",
            display: "flex", justifyContent: "center", gap: "10px"
          }}>
            {(["learner", "teacher"] as const).map((r) => (
              <button key={r} onClick={() => setRole(r)} style={{
                flex: 1, padding: "10px", borderRadius: "10px", border: "none",
                backgroundColor: role === r ? (r === "teacher" ? "#8b5cf6" : "#00c8ff") : "transparent",
                color: role === r ? (r === "teacher" ? "#ffffff" : "#090D16") : "rgba(255,255,255,0.6)",
                fontWeight: "bold", fontSize: "13px", cursor: "pointer"
              }}>
                {r === "teacher" ? "🧑‍🏫 Broadcast Teacher" : "🧑‍🎓 Join Learner"}
              </button>
            ))}
          </div>

          {role === "teacher" ? (
            <div style={{ backgroundColor: "#111827", border: "1.5px solid #1a2235", borderRadius: "16px", padding: "24px" }}>
              <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "28px", margin: "0 0 6px 0", color: "#8b5cf6" }}>
                Host Interactive Class Live
              </h3>
              <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", margin: "0 0 20px 0" }}>
                Start a real-time lecture with live transcripts. Students connect via a 6-digit code.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)", display: "block", marginBottom: "6px" }}>
                    Broadcast Lesson Topic
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Kiswahili Fasihi — Sauti na Vitendawili"
                    value={roomTopic}
                    onChange={(e) => setRoomTopic(e.target.value)}
                    style={{
                      width: "100%", backgroundColor: "#090D16", color: "#ffffff",
                      border: "1px solid #1a2235", borderRadius: "12px", padding: "12px",
                      fontFamily: "'Space Grotesk', sans-serif", fontSize: "14px", outline: "none"
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)", display: "block", marginBottom: "6px" }}>
                    Bilingual Speech Language
                  </label>
                  <select
                    value={roomLanguage}
                    onChange={(e) => setRoomLanguage(e.target.value as VVLang)}
                    style={{
                      width: "100%", backgroundColor: "#090D16", color: "#ffffff",
                      border: "1px solid #1a2235", borderRadius: "12px", padding: "12px",
                      fontFamily: "'Space Grotesk', sans-serif", fontSize: "14px", outline: "none"
                    }}
                  >
                    <option value="swahili">Swahili</option>
                    <option value="english">English (Kenya)</option>
                    <option value="sheng">Sheng</option>
                  </select>
                </div>
                <button onClick={handleCreateRoom} disabled={connecting} style={{
                  backgroundColor: "#8b5cf6", color: "#ffffff", border: "none",
                  borderRadius: "12px", padding: "14px", fontWeight: "bold",
                  fontSize: "14px", cursor: "pointer", marginTop: "8px"
                }}>
                  {connecting ? "Launching Broadcaster..." : "🚀 Launch Live Classroom"}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ backgroundColor: "#111827", border: "1.5px solid #1a2235", borderRadius: "16px", padding: "24px" }}>
              <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "28px", margin: "0 0 6px 0", color: "#00c8ff" }}>
                Join Classroom Broadcast
              </h3>
              <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", margin: "0 0 20px 0" }}>
                Listen to your teacher, send live reactions, and raise your hand to participate!
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)", display: "block", marginBottom: "6px" }}>
                    6-Digit Classroom Invitation Code
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="e.g., 482910"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, ""))}
                    style={{
                      width: "100%", backgroundColor: "#090D16", color: "#ffffff",
                      border: "1px solid #1a2235", borderRadius: "12px", padding: "12px",
                      fontFamily: "monospace", letterSpacing: "4px",
                      fontSize: "18px", textAlign: "center", outline: "none"
                    }}
                  />
                </div>
                <button onClick={handleJoinRoom} disabled={connecting} style={{
                  backgroundColor: "#00c8ff", color: "#090D16", border: "none",
                  borderRadius: "12px", padding: "14px", fontWeight: "bold",
                  fontSize: "14px", cursor: "pointer", marginTop: "8px"
                }}>
                  {connecting ? "Connecting to host..." : "🔗 Join Classroom Broadcast"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
