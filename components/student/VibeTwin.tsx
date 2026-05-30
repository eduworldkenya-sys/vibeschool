'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

const BG     = '#090D16'
const CARD   = '#1a2235'
const ACCENT = '#CCFF00'
const MUTED  = 'rgba(255,255,255,0.4)'
const TEXT   = '#ffffff'

type TwinMode   = 'text' | 'audio'
type TwinState  = 'idle' | 'listening' | 'processing' | 'speaking'
type VibeIntent = 'NEWS' | 'QUESTION' | 'READ' | 'LESSON' | 'GENERAL'

interface Message {
  role:    'twin' | 'user'
  text:    string
  time:    Date
}

function classifyIntent(text: string): VibeIntent {
  const t = text.toLowerCase()
  if (/(news|today|happened|latest|headline|breaking)/i.test(t)) return 'NEWS'
  if (/(what is|explain|who is|how does|define|tell me about)/i.test(t)) return 'QUESTION'
  if (/(read me|listen|play|open|read it)/i.test(t)) return 'READ'
  if (/(lesson|notes|form|kcse|kcpe|subject|topic|study)/i.test(t)) return 'LESSON'
  return 'GENERAL'
}

function vibeSpeak(text: string, onEnd?: () => void) {
  if (typeof window === 'undefined') return
  window.speechSynthesis?.cancel()
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]
  let idx = 0
  function speakNext() {
    if (idx >= sentences.length) { onEnd?.(); return }
    const u = new SpeechSynthesisUtterance(sentences[idx++])
    u.rate   = 0.9
    u.pitch  = 1.05
    u.onend  = speakNext
    const voices = window.speechSynthesis.getVoices()
    const voice  = voices.find(v =>
      v.name.includes('Google UK English Female') ||
      v.name.includes('Microsoft Zira') ||
      v.lang === 'en-GB'
    )
    if (voice) u.voice = voice
    window.speechSynthesis?.speak(u)
  }
  speakNext()
}

async function saveToMemory(userId: string, type: string, content: string, subject = '') {
  try {
    await supabase.from('twin_memory').insert({
      user_id: userId, type, content, subject,
    })
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
    if (!existing.includes(subject)) {
      const updated = [subject, ...existing].slice(0, 5)
      await supabase.from('twin_profile').upsert({
        user_id:      userId,
        top_subjects: updated,
        last_topic:   subject,
        updated_at:   new Date().toISOString(),
      })
    } else {
      await supabase.from('twin_profile').upsert({
        user_id:    userId,
        last_topic: subject,
        updated_at: new Date().toISOString(),
      })
    }
  } catch { /* silent */ }
}

interface VibeTwinProps {
  isOpen:   boolean
  onClose:  () => void
  userName: string
  userId:   string
}

export default function VibeTwin({ isOpen, onClose, userName, userId }: VibeTwinProps) {
  const [mode,       setMode]       = useState<TwinMode>('text')
  const [twinState,  setTwinState]  = useState<TwinState>('idle')
  const [messages,   setMessages]   = useState<Message[]>([])
  const [input,      setInput]      = useState('')
  const [greeted,    setGreeted]    = useState(false)
  const scrollRef                   = useRef<HTMLDivElement>(null)
  const recognitionRef              = useRef<unknown>(null)

  // Greeting on open
  useEffect(() => {
    if (!isOpen) return
    if (greeted) return
    setGreeted(true)
    const greeting = `Vibe, ${userName}. What are we learning today?`
    addMessage('twin', greeting)
    setTimeout(() => vibeSpeak(greeting), 400)
  }, [isOpen, userName, greeted])

  // Auto scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  function addMessage(role: 'twin' | 'user', text: string) {
    setMessages(prev => [...prev, { role, text, time: new Date() }])
  }

  async function handleQuery(query: string) {
    if (!query.trim()) return
    addMessage('user', query)
    setInput('')
    setTwinState('processing')

    const intent  = classifyIntent(query)
    let response  = ''

    // Save to memory silently
    if (userId) {
      saveToMemory(userId, intent.toLowerCase(), query, query.split(' ').slice(0, 3).join(' '))
      updateProfile(userId, query.split(' ').slice(0, 2).join(' '))
    }

    try {
      if (intent === 'NEWS' || intent === 'QUESTION' || intent === 'GENERAL') {
        // Search DuckDuckGo
        const res  = await fetch(`/api/vibe-search?q=${encodeURIComponent(query)}`)
        const data = await res.json()

        if (data.results && data.results.length > 0) {
          const top = data.results[0]
          if (top.snippet && top.snippet.length > 20) {
            response = `${top.title}. ${top.snippet}`
            if (data.results.length > 1) {
              response += ` I also found ${data.results.length - 1} more results. Want me to go deeper?`
            }
          } else {
            response = `I found something on "${query}" but the details are thin. Try asking differently.`
          }
        } else {
          response = `I searched for "${query}" but found nothing strong. Try different words.`
        }

      } else if (intent === 'LESSON') {
        // Search VibeLearn content
        const { data } = await supabase
          .from('vibelearn_content')
          .select('title, description, url, source')
          .textSearch('search_vector', query, { type: 'websearch', config: 'english' })
          .eq('status', 'live')
          .limit(3)

        if (data && data.length > 0) {
          const top = data[0]
          response  = `I found a vibe on "${top.title}" by ${top.source || 'a teacher'}. `
          response += top.description ? top.description.slice(0, 120) + '.' : ''
          response += ` Want me to open it?`
        } else {
          response = `No lessons found for "${query}" on VibeLearn yet. Try searching the Vibe Check tab.`
        }

      } else {
        response = `Vibe. I heard you say "${query}". Try asking me about news, lessons, or any topic you want to explore.`
      }

    } catch {
      response = `Something went wrong searching for "${query}". Check your connection and try again.`
    }

    addMessage('twin', response)
    setTwinState('speaking')

    if (mode === 'audio') {
      vibeSpeak(response, () => setTwinState('idle'))
    } else {
      setTwinState('idle')
    }
  }

  function startListening() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      addMessage('twin', 'Voice input is not supported on this browser. Type your vibe instead.')
      return
    }
    const recognition = new SpeechRecognition()
    recognition.lang            = 'en-KE'
    recognition.continuous      = false
    recognition.interimResults  = false
    recognition.onstart         = () => setTwinState('listening')
    recognition.onresult        = (e: any) => {
      const transcript = e.results[0][0].transcript
      setTwinState('processing')
      handleQuery(transcript)
    }
    recognition.onerror         = () => {
      setTwinState('idle')
      addMessage('twin', 'Could not hear you clearly. Try again.')
    }
    recognition.onend           = () => {
      if (twinState === 'listening') setTwinState('idle')
    }
    recognitionRef.current = recognition
    recognition.start()
  }

  function stopListening() {
    (recognitionRef.current as any)?.stop()
    setTwinState('idle')
  }

  function stopSpeaking() {
    window.speechSynthesis?.cancel()
    setTwinState('idle')
  }

  if (!isOpen) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: BG,
      display: 'flex', flexDirection: 'column',
      animation: 'vl-slide-up 300ms cubic-bezier(0.34,1.56,0.64,1)',
    }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0, height: 60,
      }}>
        <button onClick={onClose} style={{
          background: 'rgba(255,255,255,0.05)', border: 'none',
          color: TEXT, padding: '8px 14px', borderRadius: 10,
          cursor: 'pointer', fontSize: 13, fontWeight: 600,
        }}>
          ← Back
        </button>
        <span style={{ color: ACCENT, fontWeight: 800, fontSize: 13, letterSpacing: '0.1em' }}>
          ✦ VIBE TWIN
        </span>
        {/* Mode toggle */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 3 }}>
          {(['text','audio'] as TwinMode[]).map(m => (
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
                background: 'rgba(204,255,0,0.1)',
                border: '1px solid rgba(204,255,0,0.3)',
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
              padding: '10px 14px',
              fontSize: 13, color: TEXT, lineHeight: 1.6,
            }}>
              {msg.text}
            </div>
          </div>
        ))}

        {/* State indicators */}
        {twinState === 'listening' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(204,255,0,0.1)', border: '1px solid rgba(204,255,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>✦</div>
            <div style={{ background: CARD, borderRadius: '4px 16px 16px 16px', padding: '10px 14px', display: 'flex', gap: 4, alignItems: 'center' }}>
              {[0,0.2,0.4].map(d => (
                <div key={d} style={{ width: 6, height: 6, borderRadius: '50%', background: ACCENT, animation: `twinDot 1.2s ${d}s ease-in-out infinite` }} />
              ))}
              <span style={{ fontSize: 11, color: MUTED, marginLeft: 6 }}>Listening...</span>
            </div>
          </div>
        )}
        {twinState === 'processing' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(204,255,0,0.1)', border: '1px solid rgba(204,255,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>✦</div>
            <div style={{ background: CARD, borderRadius: '4px 16px 16px 16px', padding: '10px 14px', fontSize: 11, color: MUTED }}>Finding your vibe...</div>
          </div>
        )}
      </div>

      {/* Input area */}
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
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleQuery(input) } }}
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
                background: input.trim() ? ACCENT : 'rgba(255,255,255,0.05)',
                border: 'none', borderRadius: 14,
                padding: '12px 18px', color: input.trim() ? '#000' : MUTED,
                fontSize: 13, fontWeight: 800, cursor: input.trim() ? 'pointer' : 'default',
              }}
            >
              ✦
            </button>
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
              >
                🎙
              </button>
            )}
            <span style={{ fontSize: 11, color: MUTED }}>
              {twinState === 'listening' ? 'Release to send'
                : twinState === 'processing' ? 'Finding your vibe...'
                : twinState === 'speaking' ? 'Twin is speaking...'
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
