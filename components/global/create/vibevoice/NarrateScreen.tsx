"use client"

import React, { useState, useEffect, useRef } from "react"
import { VVQueueItem, VVLang } from "@/lib/types"

interface NarrateScreenProps {
  state: {
    queue: VVQueueItem[]
    isRecording: boolean
    setIsRecording: (rec: boolean) => void
    generateScript: (dialect: string) => Promise<any>
    claimQueueItem: (queueId: string) => Promise<boolean>
    unclaimQueueItem: (queueId: string) => Promise<boolean>
    submitNarration: (
      title: string,
      script: string,
      language: VVLang,
      subject: string,
      tier: "human" | "ai",
      durationSec: number,
      queueId?: string
    ) => Promise<boolean>
    userId: string | null
  }
}

export function NarrateScreen({ state }: NarrateScreenProps) {
  const [selectedDialect, setSelectedDialect] = useState<string>("Sheng Nairobi")
  const [generating, setGenerating] = useState<boolean>(false)
  const [aiScriptResult, setAiScriptResult] = useState<string>("")
  const [formTitle, setFormTitle] = useState<string>("")
  const [formScript, setFormScript] = useState<string>("")
  const [formLanguage, setFormLanguage] = useState<VVLang>("swahili")
  const [formSubject, setFormSubject] = useState<string>("General")
  const [activeQueueId, setActiveQueueId] = useState<string | undefined>(undefined)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [audioUrl, setAudioUrl] = useState<string>("")
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0)
  const [isPlaybackPlaying, setIsPlaybackPlaying] = useState<boolean>(false)
  const [toast, setToast] = useState<string>("")
  const timerRef = useRef<any>(null)
  const audioPlaybackRef = useRef<HTMLAudioElement | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(""), 3000)
  }

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  const handleGenerateScript = async () => {
    setGenerating(true)
    try {
      const data = await state.generateScript(selectedDialect)
      setAiScriptResult(data.script)
      setFormTitle(`AI Generated Script: ${selectedDialect}`)
      setFormScript(data.script)
      if (selectedDialect.toLowerCase().includes("sheng")) setFormLanguage("sheng")
      else if (selectedDialect.toLowerCase().includes("english")) setFormLanguage("english")
      else setFormLanguage("swahili")
    } catch {
      showToast("Failed to reach script writer. Please try again.")
    } finally {
      setGenerating(false)
    }
  }

  const handleClaim = async (id: string) => {
    const success = await state.claimQueueItem(id)
    if (success) {
      showToast("Script successfully claimed! Read it using the recorder below.")
    } else {
      showToast("Could not claim script. It may have been claimed by another peer.")
    }
  }

  const handleUnclaim = async (id: string) => {
    await state.unclaimQueueItem(id)
  }

  const handleLoadQueueIntoForm = (item: VVQueueItem) => {
    setFormTitle(`Reading Request: ${item.title}`)
    setFormScript(item.paragraphs.join("\n\n"))
    setFormLanguage(item.language)
    setFormSubject(item.subject)
    setActiveQueueId(item.id)
    const element = document.getElementById("narrator-form-recorder")
    if (element) element.scrollIntoView({ behavior: "smooth" })
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      const chunks: Blob[] = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
      recorder.onstop = () => {
        const audioBlob = new Blob(chunks, { type: "audio/mp3" })
        setAudioUrl(URL.createObjectURL(audioBlob))
        state.setIsRecording(false)
      }
      setAudioUrl("")
      setRecordingSeconds(0)
      state.setIsRecording(true)
      recorder.start()
      setMediaRecorder(recorder)
      timerRef.current = setInterval(() => setRecordingSeconds((prev) => prev + 1), 1000)
    } catch {
      showToast("Microphone permission was denied. Please allow audio access to record oral narrations.")
    }
  }

  const stopRecording = () => {
    if (mediaRecorder && state.isRecording) {
      mediaRecorder.stop()
      if (timerRef.current) clearInterval(timerRef.current)
      mediaRecorder.stream.getTracks().forEach(track => track.stop())
    }
  }

  const handlePlaybackPreview = () => {
    if (!audioUrl) return
    if (isPlaybackPlaying) {
      audioPlaybackRef.current?.pause()
      setIsPlaybackPlaying(false)
    } else {
      const audio = new Audio(audioUrl)
      audio.onended = () => setIsPlaybackPlaying(false)
      audioPlaybackRef.current = audio
      audio.play()
      setIsPlaybackPlaying(true)
    }
  }

  const handleSubmitNarration = async () => {
    if (!formTitle.trim() || !formScript.trim()) {
      showToast("Please fill in both the Title and the script before uploading.")
      return
    }
    const duration = recordingSeconds > 0 ? recordingSeconds : 30
    const success = await state.submitNarration(
      formTitle, formScript, formLanguage, formSubject, "human", duration, activeQueueId
    )
    if (success) {
      showToast("Voice lesson posted! Sent to Community Moderation for peer review.")
      setFormTitle("")
      setFormScript("")
      setAudioUrl("")
      setRecordingSeconds(0)
      setActiveQueueId(undefined)
    } else {
      showToast("An error occurred while uploading. Please check connection.")
    }
  }

  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60)
    const secs = sec % 60
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`
  }

  const activeClaims = state.queue.filter(q => q.status === "claimed" && q.claimed_by === state.userId)
  const openQueue = state.queue.filter(q => q.status === "open")

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

      <div style={{ backgroundColor: "#111827", border: "1px solid #1a2235", borderRadius: "16px", padding: "20px" }}>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "4px" }}>
          <span style={{ fontSize: "20px" }}>✨</span>
          <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "24px", margin: 0 }}>
            AI Oral Script Writer
          </h3>
        </div>
        <p style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.4)", margin: "0 0 16px 0" }}>
          Generate classroom-ready educational scripts tailored to Kenyan local dialects.
        </p>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <select
            value={selectedDialect}
            onChange={(e) => setSelectedDialect(e.target.value)}
            style={{
              flex: 1, backgroundColor: "#090D16", color: "#ffffff",
              border: "1px solid #1a2235", borderRadius: "10px",
              padding: "12px", fontFamily: "'Space Grotesk', sans-serif",
              fontSize: "14px", outline: "none"
            }}
          >
            <option value="Sheng Nairobi">Sheng Nairobi</option>
            <option value="Kiswahili Standard">Kiswahili Standard</option>
            <option value="Kikuyu">Kikuyu</option>
            <option value="Dholuo">Dholuo</option>
            <option value="English Kenya">English Kenya</option>
          </select>
          <button
            onClick={handleGenerateScript}
            disabled={generating}
            style={{
              backgroundColor: "#CCFF00", color: "#090D16", border: "none",
              borderRadius: "10px", padding: "12px 20px",
              fontWeight: "bold", fontSize: "14px", cursor: "pointer"
            }}
          >
            {generating ? "Generating..." : "✨ Generate Script"}
          </button>
        </div>
        {aiScriptResult && (
          <div style={{
            marginTop: "16px", backgroundColor: "#090D16",
            borderRadius: "10px", padding: "16px",
            border: "1px solid #1a2235", fontSize: "14px",
            color: "rgba(255,255,255,0.8)", lineHeight: "1.6",
            whiteSpace: "pre-wrap"
          }}>
            {aiScriptResult}
          </div>
        )}
      </div>

      {openQueue.length > 0 && (
        <div style={{ backgroundColor: "#111827", border: "1px solid #1a2235", borderRadius: "16px", padding: "20px" }}>
          <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "24px", margin: "0 0 4px 0" }}>
            Open Narration Queue
          </h3>
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", margin: "0 0 16px 0" }}>
            Claim a script and read it aloud to earn XP.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {openQueue.map((item) => (
              <div key={item.id} style={{
                backgroundColor: "#090D16", borderRadius: "12px",
                border: "1px solid #1a2235", padding: "16px",
                display: "flex", justifyContent: "space-between",
                alignItems: "center", flexWrap: "wrap", gap: "12px"
              }}>
                <div>
                  <div style={{ fontWeight: "bold", fontSize: "15px" }}>{item.title}</div>
                  <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginTop: "4px" }}>
                    {item.language.toUpperCase()} · {item.subject}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => handleClaim(item.id)}
                    style={{
                      backgroundColor: "rgba(204,255,0,0.1)", color: "#CCFF00",
                      border: "1px solid #CCFF00", borderRadius: "8px",
                      padding: "8px 14px", fontSize: "12px",
                      fontWeight: "bold", cursor: "pointer"
                    }}
                  >
                    Claim
                  </button>
                  <button
                    onClick={() => handleLoadQueueIntoForm(item)}
                    style={{
                      backgroundColor: "rgba(0,200,255,0.1)", color: "#00c8ff",
                      border: "1px solid #00c8ff", borderRadius: "8px",
                      padding: "8px 14px", fontSize: "12px",
                      fontWeight: "bold", cursor: "pointer"
                    }}
                  >
                    Load
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        id="narrator-form-recorder"
        style={{ backgroundColor: "#111827", border: "1px solid #1a2235", borderRadius: "16px", padding: "20px" }}
      >
        <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "24px", margin: "0 0 4px 0" }}>
          Oral Recording Studio
        </h3>
        <p style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.4)", margin: "0 0 16px 0" }}>
          Record your voice to help East African learners master regional speech and accents.
        </p>

        <div style={{
          backgroundColor: "#090D16", borderRadius: "12px", padding: "20px",
          display: "flex", flexDirection: "column", alignItems: "center", gap: "12px",
          border: "1.5px solid", borderColor: state.isRecording ? "#ff5c35" : "#1a2235",
          marginBottom: "20px"
        }}>
          <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
            {state.isRecording ? (
              <button onClick={stopRecording} style={{
                backgroundColor: "#ff5c35", border: "none", borderRadius: "50%",
                width: "60px", height: "60px", fontSize: "24px", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>⏹️</button>
            ) : (
              <button onClick={startRecording} style={{
                backgroundColor: "#CCFF00", border: "none", borderRadius: "50%",
                width: "60px", height: "60px", fontSize: "24px", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>🎙️</button>
            )}
            {audioUrl && (
              <button onClick={handlePlaybackPreview} style={{
                backgroundColor: isPlaybackPlaying ? "#ff5c35" : "#00c8ff",
                border: "none", borderRadius: "12px", padding: "12px 18px",
                color: "#090D16", fontWeight: "bold", fontSize: "13px", cursor: "pointer"
              }}>
                {isPlaybackPlaying ? "⏸️ Pause Preview" : "🔊 Play Preview"}
              </button>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
            <span style={{ fontSize: "14px", fontWeight: "bold", color: state.isRecording ? "#ff5c35" : "#ffffff" }}>
              {state.isRecording ? "🔴 RECORDING LIVE" : "Ready to speak..."}
            </span>
            <span style={{ fontSize: "16px", fontFamily: "monospace", color: "rgba(255,255,255,0.6)" }}>
              Duration: {formatTime(recordingSeconds)}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)", display: "block", marginBottom: "6px" }}>
              Narration Title
            </label>
            <input
              type="text"
              placeholder="e.g., Grade 4 Science — Kiswahili Terms"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              style={{
                width: "100%", backgroundColor: "#090D16", color: "#ffffff",
                border: "1px solid #1a2235", borderRadius: "10px", padding: "12px",
                fontFamily: "'Space Grotesk', sans-serif", fontSize: "14px", outline: "none"
              }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)", display: "block", marginBottom: "6px" }}>
                Dialect Language
              </label>
              <select
                value={formLanguage}
                onChange={(e) => setFormLanguage(e.target.value as VVLang)}
                style={{
                  width: "100%", backgroundColor: "#090D16", color: "#ffffff",
                  border: "1px solid #1a2235", borderRadius: "10px", padding: "12px",
                  fontFamily: "'Space Grotesk', sans-serif", fontSize: "14px", outline: "none"
                }}
              >
                <option value="swahili">Kiswahili</option>
                <option value="english">English (Kenya)</option>
                <option value="sheng">Sheng</option>
                <option value="kikuyu">Kikuyu</option>
                <option value="dholuo">Dholuo</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)", display: "block", marginBottom: "6px" }}>
                Subject Tag
              </label>
              <select
                value={formSubject}
                onChange={(e) => setFormSubject(e.target.value)}
                style={{
                  width: "100%", backgroundColor: "#090D16", color: "#ffffff",
                  border: "1px solid #1a2235", borderRadius: "10px", padding: "12px",
                  fontFamily: "'Space Grotesk', sans-serif", fontSize: "14px", outline: "none"
                }}
              >
                <option value="General">General</option>
                <option value="Science">Science</option>
                <option value="Community">Community & Ethics</option>
                <option value="Art">Creative Arts</option>
                <option value="Maths">Maths</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)", display: "block", marginBottom: "6px" }}>
              Script Text Transcript
            </label>
            <textarea
              rows={4}
              placeholder="Paste or write the transcription script word-for-word..."
              value={formScript}
              onChange={(e) => setFormScript(e.target.value)}
              style={{
                width: "100%", backgroundColor: "#090D16", color: "#ffffff",
                border: "1px solid #1a2235", borderRadius: "10px", padding: "12px",
                fontFamily: "'Space Grotesk', sans-serif", fontSize: "14px",
                lineHeight: "1.5", outline: "none", resize: "vertical"
              }}
            />
          </div>

          <button
            onClick={handleSubmitNarration}
            style={{
              backgroundColor: "#ff5c35", color: "#ffffff", border: "none",
              borderRadius: "12px", padding: "14px", fontWeight: "bold",
              fontSize: "14px", cursor: "pointer", marginTop: "8px"
            }}
          >
            🚀 Submit Narration for Peer Verification
          </button>
        </div>
      </div>
    </div>
  )
}
