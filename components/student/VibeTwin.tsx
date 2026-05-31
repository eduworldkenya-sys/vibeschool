'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const BG     = '#090D16'
const CARD   = '#1a2235'
const ACCENT = '#CCFF00'
const MUTED  = 'rgba(255,255,255,0.4)'
const TEXT   = '#ffffff'

type TwinMode   = 'text' | 'audio'
type TwinState  = 'idle' | 'listening' | 'processing' | 'speaking'
type VibeIntent = 'NEWS' | 'QUESTION' | 'READ' | 'LESSON' | 'CONVERSATIONAL' | 'GENERAL'

interface Message {
  role: 'twin' | 'user'
  text: string
  time: Date
}

// ── Intent classifier ──────────────────────────────────────────────────────────
function classifyIntent(text: string): VibeIntent {
  const t = text.toLowerCase().trim()
  if (/(^hi$|^hey$|^hello$|^sup$|^hola$|how are you|you okay|you good|are you fine|who are you|what are you|what can you do|thank|thanks|asante|bye|goodbye|later|see you)/i.test(t)) return 'CONVERSATIONAL'
  if (/(news|today|happened|latest|headline|breaking)/i.test(t)) return 'NEWS'
  if (/(what is|explain|who is|how does|define|tell me about)/i.test(t)) return 'QUESTION'
  if (/(read me|listen|play|open|read it)/i.test(t)) return 'READ'
  if (/(lesson|notes|form|kcse|kcpe|subject|topic|study)/i.test(t)) return 'LESSON'
  return 'GENERAL'
}

// ── Strip filler before saving topic ──────────────────────────────────────────
function extractTopic(text: string): string {
  return text
    .toLowerCase()
    .replace(/^(what is|explain|who is|how does|define|tell me about|lesson on|notes on|study for)\s+/i, '')
    .trim()
    .split(' ')
    .slice(0, 3)
    .join(' ') || 'general'
}

// ── Conversational responses — zero API cost ───────────────────────────────────
function conversationalReply(query: string, userName: string): string {
  const t = query.toLowerCase()
  if (/(how are you|you okay|you good|are you fine)/.test(t))
    return `Vibing and ready to learn! What topic are we exploring today, ${userName}?`
  if (/(^hi$|^hey$|^hello$|^sup$|^hola$)/.test(t))
    return `Hey ${userName}! Ask me about news, lessons, science, history — anything. What are we learning?`
  if (/(who are you|what are you|what can you do)/.test(t))
    return `I am Vibe Twin — your learning companion. Ask me news, questions, or say "open biology notes" and I will find it for you.`
  if (/(thank|thanks|asante)/.test(t))
    return `Anytime, ${userName}! Keep vibing. What else do you want to know?`
  if (/(bye|goodbye|later|see you)/.test(t))
    return `Stay curious, ${userName}. Come back when you are ready to learn more. ✦`
  return `Vibe, ${userName}. Try asking me a question like "what is climate change" or "Kenya news today".`
}

// ── Free TTS — sentence by sentence ───────────────────────────────────────────
function vibeSpeak(text: string, onEnd?: () => void) {
  if (typeof window === 'undefined' || !window.speechSynthesis) { onEnd?.(); return }
  window.speechSynthesis.cancel()

  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text]
  let idx = 0

  function speakNext() {
    if (idx >= sentences.length) { onEnd?.(); return }
    const raw = sentences[idx++].trim()
    if (!raw) { speakNext(); return }

    const u = new SpeechSynthesisUtterance(raw)
    u.rate  = 1.0
    u.pitch = 1.05
    u.onend   = speakNext
    u.onerror = () => onEnd?.()

    const voices = window.speechSynthesis.getVoices()
    const voice  = voices.find(v =>
      v.name.includes('Google UK English Female') ||
      v.name.includes('Microsoft Zira') ||
      v.lang === 'en-GB'
    ) ?? voices.find(v => v.lang.startsWith('en-')) ?? null
    if (voice) u.voice = voice

    window.speechSynthesis.speak(u)
  }

  // Voices may not be loaded yet on first call
  if (window.speechSynthesis.getVoices().length === 0) {
    window.speechSynthesis.onvoiceschanged = () => { speakNext() }
  } else {
    speakNext()
  }
}

// ── Supabase memory (silent) ───────────────────────────────────────────────────
async function saveToMemory(userId: string, type: string, content: string, subject: string) {
  try {
    await supabase.from('twin_memory').insert({ user_id: userId, type, content, subject })
  } catch { /* silent */ }
}

async function updateProfile(userId: string, subject: string) {
  try {
    const { data } = await supabase
      .from('twin_profile')
      .select('top_subjects')
      .eq('user_id', userId)
      .maybeSingle()
    const existing: string[] = data?.top_subjects ?? []
    const updated = existing.includes(subject)
      ? existing
      : [subject, ...existing].slice(0, 5)
    await supabase.from('twin_profile').upsert({
      user_id: userId, top_subjects: updated,
      last_topic: subject, updated_at: new Date().toISOString(),
    })
  } catch { /* silent */ }
}

// ── Props ──────────────────────────────────────────────────────────────────────
interface VibeTwinProps {
  isOpen:   boolean
  onClose:  () => void
  userName: string
  userId:   string
}

export default function VibeTwin({ isOpen, onClose, userName, userId }: VibeTwinProps) {
  const [mode,      setMode]      = useState<TwinMode>('text')
  const [twinState, setTwinState] = useState<TwinState>('idle')
  const [messages,  setMessages]  = useState<Message[]>([])
  const [input,     setInput]     = useState('')
  const [greeted,   setGreeted]   = useState(false)

  const scrollRef      = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const stateRef       = useRef<TwinState>('idle')
  const modeRef        = useRef<TwinMode>('text')

  // Keep refs in sync — avoids stale closures in recognition callbacks
  useEffect(() => { stateRef.current = twinState }, [twinState])
  useEffect(() => { modeRef.current  = mode       }, [mode])

  // Cleanup on close
  useEffect(() => {
    if (!isOpen) {
      window.speechSynthesis?.cancel()
      recognitionRef.current?.abort()
    }
    return () => { window.speechSynthesis?.cancel() }
  }, [isOpen])

  // Greeting on open
  useEffect(() => {
    if (!isOpen || greeted) return
    setGreeted(true)
    const greeting = `Vibe, ${userName}. What are we learning today?`
    addMessage('twin', greeting)
    const t = setTimeout(() => vibeSpeak(greeting), 400)
    return () => clearTimeout(t)
  }, [isOpen, userName, greeted])

  // Auto scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, twinState])

  function addMessage(role: 'twin' | 'user', text: string) {
    setMessages(prev => [...prev, { role, text, time: new Date() }])
  }

  function finish(response: string) {
    addMessage('twin', response)
    if (modeRef.current === 'audio') {
      setTwinState('speaking')
      vibeSpeak(response, () => setTwinState('idle'))
    } else {
      setTwinState('idle')
    }
  }

  async function handleQuery(query: string) {
    const q = query.trim()
    if (!q) return

    addMessage('user', q)
    setInput('')
    setTwinState('processing')

    const intent = classifyIntent(q)
    const topic  = extractTopic(q)

    if (userId) {
      saveToMemory(userId, intent.toLowerCase(), q, topic)
      updateProfile(userId, topic)
    }

    // ── CONVERSATIONAL — zero cost, instant ──
    if (intent === 'CONVERSATIONAL') {
      finish(conversationalReply(q, userName))
      return
    }

    try {
      // ── NEWS / QUESTION / GENERAL — free Google search via proxy ──
      if (intent === 'NEWS' || intent === 'QUESTION' || intent === 'GENERAL') {
        const res  = await fetch(`/api/vibe-search?q=${encodeURIComponent(q)}`)
        const data = await res.json()

        if (data.results && data.results.length > 0) {
          const top = data.results[0]
          if (top.snippet && top.snippet.length > 20) {
            let response = `${top.title}. ${top.snippet}`
            if (data.results.length > 1) {
              response += ` I also found ${data.results.length - 1} more result${data.results.length > 2 ? 's' : ''}. Want me to go deeper?`
            }
            finish(response)
          } else {
            finish(`I found something on "${q}" but details are thin. Try rephrasing — like "explain ${topic}" or "${topic} Kenya news".`)
          }
        } else {
          finish(`I searched for "${q}" but got no results. Try different keywords — be specific.`)
        }
        return
      }

      // ── LESSON — search VibeGlobal content library ──
      if (intent === 'LESSON') {
        const { data } = await supabase
          .from('vibelearn_content')
          .select('title, description, source')
          .textSearch('search_vector', q, { type: 'websearch', config: 'english' })
          .eq('status', 'live')
          .limit(3)

        if (data && data.length > 0) {
          const top = data[0]
          let response = `I found a lesson on "${top.title}" by ${top.source || 'a teacher'}. `
          response += top.description ? top.description.slice(0, 120) + '. ' : ''
          response += `Want me to open it?`
          finish(response)
        } else {
          finish(`No lessons found for "${q}" on VibeGlobal yet. Try searching the Vibe Feed tab.`)
        }
        return
      }

      // ── READ — prompt user to navigate ──
      if (intent === 'READ') {
        finish(`Go to Vibe Feed and tap "Vibe In" on any content to open the reader. I can search for a specific topic if you name it.`)
        return
      }

    } catch {
      finish(`Something went wrong. Check your connection and try again.`)
    }
  }

  // ── Voice input ───────────────────────────────────────────────────────────────
  function startListening() {
    const SR = (window as Window & { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition
             ?? (window as Window & { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition

    if (!SR) {
      addMessage('twin', 'Voice input is not supported on this browser. Type your vibe instead.')
      return
    }

    window.speechSynthesis?.cancel()

    const recognition = new SR()
    recognition.lang           = 'en-KE'
    recognition.continuous     = false
    recognition.interimResults = false

    recognition.onstart  = () => setTwinState('listening')

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = e.results[0][0].transcript
      setTwinState('processing')
      handleQuery(transcript)
    }

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error !== 'aborted') {
        setTwinState('idle')
        addMessage('twin', 'Could not hear you clearly. Try again.')
      }
    }

    recognition.onend = () => {
      if (stateRef.current === 'listening') setTwinState('idle')
    }

    recognitionRef.current = recognition
    recognition.start()
  }

  function stopListening() {
    recognitionRef.current?.stop()
  }

  function stopSpeaking() {
    window.speechSynthesis?.cancel()
    setTwinState('idle')
  }

  if (!isOpen) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: BG, display: 'flex', flexDirection: 'column',
      animation: 'vl-slide-up 300ms cubic-bezier(0.34,1.56,0.64,1)',
    }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0, height: 60,
      }}>
        <button onClick={onClose} style={{
          background: 'rgba(255,255,255,0.05)', border: 'none',
          color: TEXT, padding: '8px 14px', borderRadius: 10,
          cursor: 'pointer', fontSize: 13, fontWeight: 600,
        }}>← Back</button>

        <span style={{ color: ACCENT, fontWeight: 800, fontSize: 13, letterSpacing: '0.1em' }}>
          ✦ VIBE TWIN
        </span>

        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 3 }}>
          {(['text', 'audio'] as TwinMode[]).map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              padding: '5px 10px', borderRadius: 8, border: 'none',
              background: mode === m ? ACCENT : 'transparent',
              color: mode === m ? '#000' : MUTED,
              fontSize: 10, fontWeight: 800, cursor: 'pointer',
              textTransform: 'uppercase', letterSpacing: 0.5,
            }}>
              {m === 'text' ? '💬' : '🎙'} {m}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{
        flex: 1, overflowY: 'auto', padding: '20px 16px',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        {messages.map((msg, i) => (
          <div key={i} style={{
            display: 'flex',
            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
          }}>
            {msg.role === 'twin' && (
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: 'rgba(204,255,0,0.1)', border: '1px solid rgba(204,255,0,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, marginRight: 8, marginTop: 2,
              }}>✦</div>
            )}
            <div style={{
              maxWidth: '78%',
              background: msg.role === 'twin' ? CARD : 'rgba(204,255,0,0.12)',
              border: msg.role === 'twin'
                ? '1px solid rgba(255,255,255,0.06)'
                : '1px solid rgba(204,255,0,0.25)',
              borderRadius: msg.role === 'twin' ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
              padding: '10px 14px', fontSize: 13, color: TEXT, lineHeight: 1.6,
            }}>
              {msg.text}
            </div>
          </div>
        ))}

        {twinState === 'listening' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'rgba(204,255,0,0.1)', border: '1px solid rgba(204,255,0,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
            }}>✦</div>
            <div style={{
              background: CARD, borderRadius: '4px 16px 16px 16px',
              padding: '10px 14px', display: 'flex', gap: 4, alignItems: 'center',
            }}>
              {[0, 0.2, 0.4].map(d => (
                <div key={d} style={{
                  width: 6, height: 6, borderRadius: '50%', background: ACCENT,
                  animation: `twinDot 1.2s ${d}s ease-in-out infinite`,
                }} />
              ))}
              <span style={{ fontSize: 11, color: MUTED, marginLeft: 6 }}>Listening...</span>
            </div>
          </div>
        )}

        {twinState === 'processing' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'rgba(204,255,0,0.1)', border: '1px solid rgba(204,255,0,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
            }}>✦</div>
            <div style={{
              background: CARD, borderRadius: '4px 16px 16px 16px',
              padding: '10px 14px', fontSize: 11, color: MUTED,
            }}>Finding your vibe...</div>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{
        padding: '12px 16px 24px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        background: '#0d1117', flexShrink: 0,
      }}>
        {mode === 'text' ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleQuery(input)
                }
              }}
              placeholder="Type your vibe..."
              disabled={twinState === 'processing'}
              style={{
                flex: 1, background: CARD,
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 14, padding: '12px 16px',
                fontSize: 13, color: TEXT, outline: 'none',
              }}
            />
            <button
              onClick={() => handleQuery(input)}
              disabled={!input.trim() || twinState === 'processing'}
              style={{
                background: input.trim() && twinState !== 'processing' ? ACCENT : 'rgba(255,255,255,0.05)',
                border: 'none', borderRadius: 14, padding: '12px 18px',
                color: input.trim() && twinState !== 'processing' ? '#000' : MUTED,
                fontSize: 13, fontWeight: 800,
                cursor: input.trim() && twinState !== 'processing' ? 'pointer' : 'default',
              }}
            >✦</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            {twinState === 'speaking' ? (
              <button onClick={stopSpeaking} style={{
                width: 72, height: 72, borderRadius: '50%', border: 'none',
                background: 'rgba(255,77,77,0.2)', color: '#ff4d4d',
                fontSize: 24, cursor: 'pointer',
              }}>⏹</button>
            ) : (
              <button
                onPointerDown={startListening}
                onPointerUp={stopListening}
                style={{
                  width: 72, height: 72, borderRadius: '50%', border: 'none',
                  background: twinState === 'listening'
                    ? 'rgba(204,255,0,0.2)'
                    : 'rgba(204,255,0,0.08)',
                  color: ACCENT, fontSize: 28, cursor: 'pointer',
                  boxShadow: twinState === 'listening'
                    ? '0 0 0 8px rgba(204,255,0,0.1)'
                    : 'none',
                  transition: 'all 0.2s',
                }}
              >🎙</button>
            )}
            <span style={{ fontSize: 11, color: MUTED }}>
              {twinState === 'listening'   ? 'Release to send'
               : twinState === 'processing' ? 'Finding your vibe...'
               : twinState === 'speaking'   ? 'Twin is speaking...'
               : 'Hold to speak'}
            </span>
          </div>
        )}
      </div>

      <style>{`
        @keyframes vl-slide-up { from{transform:translateY(100vh)} to{transform:translateY(0)} }
        @keyframes twinDot { 0%,80%,100%{transform:scale(0.7);opacity:0.4} 40%{transform:scale(1);opacity:1} }
      `}</style>
    </div>
  )
}
