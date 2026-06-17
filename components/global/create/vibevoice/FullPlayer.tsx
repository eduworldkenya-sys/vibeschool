"use client"

import React, { useState, useEffect, useRef } from "react"
import { VVNarration, VVQuestionResponse } from "@/lib/types"

interface FullPlayerProps {
  state: {
    currentNarration: VVNarration | null
    isPlaying: boolean
    currentWordIndex: number
    wordsList: string[]
    playNarration: (narration: any) => void
    pauseNarration: () => void
    resumeNarration: () => void
    stopNarration: () => void
    translateScript: (text: string, targetLang: string) => Promise<string>
    generateQuestion: (script: string) => Promise<any>
    xp: number
  }
  onClose: () => void
}

export function FullPlayer({ state, onClose }: FullPlayerProps) {
  const { currentNarration, isPlaying, currentWordIndex, wordsList } = state

  const [translatedText, setTranslatedText] = useState<string>("")
  const [translationLang, setTranslationLang] = useState<string>("English")
  const [translating, setTranslating] = useState<boolean>(false)
  const [quiz, setQuiz] = useState<VVQuestionResponse | null>(null)
  const [generatingQuiz, setGeneratingQuiz] = useState<boolean>(false)
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [quizResult, setQuizResult] = useState<"correct" | "incorrect" | null>(null)
  const [micActive, setMicActive] = useState<boolean>(false)
  const [spokenTranscript, setSpokenTranscript] = useState<string>("")
  const [matchScore, setMatchScore] = useState<number | null>(null)
  const [toast, setToast] = useState<string>("")
  const recognitionRef = useRef<any>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(""), 3000)
  }

  useEffect(() => {
    setTranslatedText("")
    setQuiz(null)
    setSelectedOption(null)
    setQuizResult(null)
    setSpokenTranscript("")
    setMatchScore(null)
  }, [currentNarration])

  if (!currentNarration) return null

  const handleTranslate = async () => {
    setTranslating(true)
    try {
      const result = await state.translateScript(currentNarration.script, translationLang)
      setTranslatedText(result)
    } catch {
      setTranslatedText("Could not translate. Please verify network access.")
    } finally {
      setTranslating(false)
    }
  }

  const handleGenerateQuiz = async () => {
    setGeneratingQuiz(true)
    setSelectedOption(null)
    setQuizResult(null)
    try {
      const q = await state.generateQuestion(currentNarration.script)
      setQuiz(q)
    } catch {
      setQuiz({
        question: "What is the core subject of this story lesson?",
        options: ["Community effort", "Bilingual reading", "AI tools", "Exam scores"],
        correct: 0
      })
    } finally {
      setGeneratingQuiz(false)
    }
  }

  const handleSelectOption = (index: number) => {
    if (selectedOption !== null) return
    setSelectedOption(index)
    setQuizResult(quiz && index === quiz.correct ? "correct" : "incorrect")
  }

  const startSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      showToast("Speech recognition is not supported on this browser. Try Google Chrome.")
      return
    }
    const rec = new SpeechRecognition()
    rec.continuous = false
    rec.interimResults = false
    rec.lang = currentNarration.language === "swahili" ? "sw-KE" : "en-US"
    rec.onstart = () => { setMicActive(true); setSpokenTranscript(""); setMatchScore(null) }
    rec.onresult = (event: any) => {
      const resultText = event.results[0][0].transcript
      setSpokenTranscript(resultText)
      calculatePronunciationMatch(resultText)
    }
    rec.onerror = () => { setMicActive(false) }
    rec.onend = () => { setMicActive(false) }
    recognitionRef.current = rec
    rec.start()
  }

  const stopSpeechRecognition = () => {
    if (recognitionRef.current) recognitionRef.current.stop()
  }

  const calculatePronunciationMatch = (transcript: string) => {
    const originalWords = currentNarration.script.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/)
    const spokenWords = transcript.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/)
    let matched = 0
    spokenWords.forEach((word) => { if (originalWords.includes(word)) matched += 1 })
    const score = Math.min(Math.round((matched / Math.max(originalWords.length, 1)) * 100), 100)
    setMatchScore(score)
  }

  const inlineAnimations = `
    @keyframes bounce-bar {
      0%, 100% { height: 12px; }
      50% { height: 48px; }
    }
    @keyframes pulse-mic {
      0% { box-shadow: 0 0 0 0 rgba(255, 92, 53, 0.4); }
      70% { box-shadow: 0 0 0 10px rgba(255, 92, 53, 0); }
      100% { box-shadow: 0 0 0 0 rgba(255, 92, 53, 0); }
    }
  `

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: "rgba(9, 13, 22, 0.98)", zIndex: 1000,
      overflowY: "auto", padding: "24px 16px",
      display: "flex", flexDirection: "column", alignItems: "center",
      color: "#ffffff", fontFamily: "'Space Grotesk', sans-serif"
    }}>
      <style dangerouslySetInnerHTML={{ __html: inlineAnimations }} />

      {toast && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%",
          transform: "translateX(-50%)",
          backgroundColor: "#111827", border: "1px solid #1a2235",
          color: "#ffffff", padding: "12px 20px",
          borderRadius: "12px", fontSize: "13px",
          fontWeight: "bold", zIndex: 9999, whiteSpace: "nowrap"
        }}>{toast}</div>
      )}

      <div style={{
        width: "100%", maxWidth: "600px",
        display: "flex", justifyContent: "space-between",
        alignItems: "center", marginBottom: "24px"
      }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.4)", textTransform: "uppercase" }}>
            Now Listening To
          </span>
          <span style={{ fontSize: "16px", fontWeight: "bold", color: "#CCFF00" }}>
            {currentNarration.title}
          </span>
        </div>
        <button onClick={onClose} style={{
          backgroundColor: "#1a2235", color: "#ffffff", border: "none",
          borderRadius: "50%", width: "36px", height: "36px",
          cursor: "pointer", fontWeight: "bold",
          display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          ✕
        </button>
      </div>

      <div style={{
        width: "100%", maxWidth: "600px", backgroundColor: "#111827",
        borderRadius: "16px", border: "1px solid #1a2235", padding: "24px",
        display: "flex", flexDirection: "column", alignItems: "center", gap: "16px"
      }}>
        <div style={{ display: "flex", gap: "6px", alignItems: "center", height: "60px" }}>
          {[...Array(12)].map((_, i) => (
            <div key={i} style={{
              width: "4px", borderRadius: "4px",
              backgroundColor: "#CCFF00",
              height: isPlaying ? undefined : "12px",
              animation: isPlaying ? `bounce-bar ${0.6 + i * 0.1}s ease-in-out infinite alternate` : "none",
              opacity: isPlaying ? 1 : 0.3
            }} />
          ))}
        </div>

        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          <button onClick={state.stopNarration} style={{
            backgroundColor: "#1a2235", color: "#ffffff", border: "none",
            borderRadius: "50%", width: "44px", height: "44px",
            cursor: "pointer", fontSize: "16px"
          }}>⏹️</button>
          <button
            onClick={isPlaying ? state.pauseNarration : state.resumeNarration}
            style={{
              backgroundColor: "#CCFF00", color: "#090D16", border: "none",
              borderRadius: "50%", width: "60px", height: "60px",
              cursor: "pointer", fontSize: "24px",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}
          >
            {isPlaying ? "⏸️" : "▶️"}
          </button>
        </div>

        <div style={{
          width: "100%", display: "flex", flexWrap: "wrap", gap: "4px",
          maxHeight: "120px", overflowY: "auto", padding: "8px",
          backgroundColor: "#090D16", borderRadius: "8px"
        }}>
          {wordsList.map((word, idx) => (
            <span key={idx} style={{
              fontSize: "14px", lineHeight: "1.6",
              color: idx === currentWordIndex ? "#CCFF00" : "rgba(255,255,255,0.6)",
              fontWeight: idx === currentWordIndex ? "bold" : "normal",
              backgroundColor: idx === currentWordIndex ? "rgba(204,255,0,0.1)" : "transparent",
              borderRadius: "4px", padding: "0 2px",
              transition: "all 0.1s"
            }}>
              {word}
            </span>
          ))}
        </div>
      </div>

      <div style={{
        width: "100%", maxWidth: "600px", backgroundColor: "#111827",
        border: "1px solid #1a2235", borderRadius: "16px",
        padding: "20px", marginTop: "20px"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <h4 style={{ margin: 0, fontSize: "15px" }}>🌍 Translate Script</h4>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <select
              value={translationLang}
              onChange={(e) => setTranslationLang(e.target.value)}
              style={{
                backgroundColor: "#090D16", color: "#ffffff",
                border: "1px solid #1a2235", borderRadius: "8px",
                padding: "4px 8px", fontSize: "12px", outline: "none"
              }}
            >
              <option value="English">English</option>
              <option value="Swahili">Swahili</option>
              <option value="Kikuyu">Kikuyu</option>
              <option value="Sheng Nairobi">Sheng Nairobi</option>
            </select>
            <button onClick={handleTranslate} disabled={translating} style={{
              backgroundColor: "#00c8ff", color: "#090D16", border: "none",
              borderRadius: "8px", padding: "4px 12px",
              fontSize: "12px", fontWeight: "bold", cursor: "pointer"
            }}>
              {translating ? "Translating..." : "Translate"}
            </button>
          </div>
        </div>
        {translatedText && (
          <div style={{
            backgroundColor: "rgba(0, 200, 255, 0.08)",
            borderLeft: "4px solid #00c8ff",
            padding: "12px", borderRadius: "0 12px 12px 0",
            fontSize: "14px", color: "rgba(255, 255, 255, 0.8)", lineHeight: "1.5"
          }}>
            {translatedText}
          </div>
        )}
      </div>

      <div style={{
        width: "100%", maxWidth: "600px", backgroundColor: "#111827",
        border: "1px solid #1a2235", borderRadius: "16px",
        padding: "20px", marginTop: "20px"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <div>
            <h4 style={{ margin: 0, fontSize: "15px" }}>🧠 Comprehension Challenge</h4>
            <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>
              Test your understanding of the Kenyan oral lecture
            </p>
          </div>
          {!quiz && (
            <button onClick={handleGenerateQuiz} disabled={generatingQuiz} style={{
              backgroundColor: "#CCFF00", color: "#090D16", border: "none",
              borderRadius: "10px", padding: "8px 16px",
              fontSize: "12px", fontWeight: "bold", cursor: "pointer"
            }}>
              {generatingQuiz ? "Generating AI Quiz..." : "⚡ Generate Quiz"}
            </button>
          )}
        </div>
        {quiz && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ fontSize: "15px", fontWeight: "bold" }}>Q: {quiz.question}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {quiz.options.map((option, idx) => {
                const btnStyle: React.CSSProperties = {
                  backgroundColor: "#090D16", border: "1px solid #1a2235",
                  borderRadius: "8px", padding: "12px", color: "#ffffff",
                  fontSize: "13px", textAlign: "left",
                  cursor: selectedOption === null ? "pointer" : "not-allowed"
                }
                if (selectedOption !== null) {
                  if (idx === quiz.correct) {
                    btnStyle.backgroundColor = "rgba(204, 255, 0, 0.15)"
                    btnStyle.borderColor = "#CCFF00"
                    btnStyle.color = "#CCFF00"
                  } else if (idx === selectedOption) {
                    btnStyle.backgroundColor = "rgba(255, 92, 53, 0.15)"
                    btnStyle.borderColor = "#ff5c35"
                    btnStyle.color = "#ff5c35"
                  }
                }
                return (
                  <button key={idx} onClick={() => handleSelectOption(idx)}
                    disabled={selectedOption !== null} style={btnStyle}>
                    {idx + 1}. {option}
                  </button>
                )
              })}
            </div>
            {quizResult && (
              <div style={{
                textAlign: "center", padding: "8px", borderRadius: "8px",
                fontWeight: "bold", fontSize: "14px",
                backgroundColor: quizResult === "correct" ? "rgba(204, 255, 0, 0.1)" : "rgba(255, 92, 53, 0.1)",
                color: quizResult === "correct" ? "#CCFF00" : "#ff5c35"
              }}>
                {quizResult === "correct"
                  ? "🎉 Correct! You've earned +20 XP toward your oral fluency status!"
                  : "❌ Incorrect. Try reviewing the transcription audio once again."}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{
        width: "100%", maxWidth: "600px", backgroundColor: "#111827",
        border: "1px solid #1a2235", borderRadius: "16px",
        padding: "20px", marginTop: "20px"
      }}>
        <h4 style={{ margin: "0 0 4px 0", fontSize: "15px" }}>🎤 Pass the Mic Oral Pronunciation Test</h4>
        <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>
          Tap the microphone, read the lesson aloud, and check your pronunciation accuracy!
        </p>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
          <button
            onClick={micActive ? stopSpeechRecognition : startSpeechRecognition}
            style={{
              backgroundColor: micActive ? "#ff5c35" : "#1a2235",
              color: "#ffffff", border: "1px solid",
              borderColor: micActive ? "#ff5c35" : "#1a2235",
              borderRadius: "50%", width: "60px", height: "60px",
              cursor: "pointer", fontSize: "24px",
              display: "flex", alignItems: "center", justifyContent: "center",
              animation: micActive ? "pulse-mic 1.5s infinite" : "none"
            }}
          >
            {micActive ? "⏹️" : "🎙️"}
          </button>
          <div style={{ fontSize: "12px", color: micActive ? "#ff5c35" : "rgba(255,255,255,0.6)" }}>
            {micActive ? "System Listening... Read the script now." : "Click to practice reading"}
          </div>
          {spokenTranscript && (
            <div style={{
              width: "100%", backgroundColor: "#090D16",
              borderRadius: "8px", padding: "12px", border: "1px solid #1a2235"
            }}>
              <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", marginBottom: "4px" }}>
                Spoken Transcript:
              </div>
              <p style={{ margin: 0, fontSize: "13px", fontStyle: "italic", color: "#ffffff" }}>
                "{spokenTranscript}"
              </p>
            </div>
          )}
          {matchScore !== null && (
            <div style={{
              width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
              backgroundColor: "rgba(204, 255, 0, 0.05)",
              border: "1px solid rgba(204, 255, 0, 0.2)",
              padding: "8px 12px", borderRadius: "8px"
            }}>
              <span style={{ fontSize: "13px" }}>Pronunciation Accuracy Score:</span>
              <span style={{ fontSize: "18px", fontWeight: "bold", color: "#CCFF00" }}>{matchScore}%</span>
            </div>
          )}
        </div>
      </div>

      {currentNarration.tier === "ai" && (
        <div style={{
          width: "100%", maxWidth: "600px",
          backgroundColor: "rgba(26, 34, 53, 0.5)",
          borderRadius: "12px", padding: "12px",
          border: "1.5px dashed rgba(255, 255, 255, 0.15)",
          marginTop: "24px", textAlign: "center"
        }}>
          <span style={{
            fontSize: "10px", backgroundColor: "#1a2235",
            padding: "2px 8px", borderRadius: "6px",
            color: "rgba(255,255,255,0.4)", textTransform: "uppercase"
          }}>
            VibeVoice AI Free Tier Break
          </span>
          <p style={{ margin: "6px 0 0 0", fontSize: "12px", color: "rgba(255, 255, 255, 0.6)" }}>
            "This space is ad-free, sponsored by VibeSchool Kenya. Support human voice-actors and earn more local narration points!"
          </p>
        </div>
      )}
    </div>
  )
}
