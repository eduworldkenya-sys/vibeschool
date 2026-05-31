// components/student/VibeTwin/index.tsx
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { VibeTwinProps, TwinMode, TwinState } from './types'
import { classifyIntent, extractTopic, conversationalReply } from './lib/intent'
import { vibeSearch } from './lib/search'
import { useTwinMemory } from './hooks/useTwinMemory'
import { useTwinSession } from './hooks/useTwinSession'
import { useTwinSpeech } from './hooks/useTwinSpeech'
import { useTwinRecognition } from './hooks/useTwinRecognition'
import TwinHeader from './ui/TwinHeader'
import TwinMessages from './ui/TwinMessages'
import TwinInput from './ui/TwinInput'
import { T } from './ui/TwinHeader'

export default function VibeTwin({ isOpen, onClose, userName }: VibeTwinProps) {
  const [input, setInput] = useState('')
  const [mode,  setMode]  = useState<TwinMode>('text')

  const { saveToMemory }                                = useTwinMemory()
  const {
    messages, twinState, setTwinState,
    greeted, setGreeted,
    addMessage, acquireProcessing, releaseProcessing,
  }                                                     = useTwinSession(isOpen)
  const { speak, cancel: cancelSpeech }                 = useTwinSpeech()

  // Reset mode on close
  useEffect(() => {
    if (!isOpen) {
      setMode('text')
      setInput('')
      cancelSpeech()
    }
  }, [isOpen, cancelSpeech])

  // Greeting on open
  useEffect(() => {
    if (!isOpen || greeted) return
    setGreeted(true)
    const greeting = `Vibe, ${userName}. What are we learning today?`
    addMessage('twin', greeting)
    const t = setTimeout(() => speak(greeting), 400)
    return () => clearTimeout(t)
  }, [isOpen, userName, greeted, setGreeted, addMessage, speak])

  function finish(response: string, shouldSpeak = false) {
    addMessage('twin', response)
    releaseProcessing()
    if (shouldSpeak || mode === 'audio') {
      setTwinState('speaking')
      speak(response, () => setTwinState('idle'))
    } else {
      setTwinState('idle')
    }
  }

  async function handleQuery(query: string) {
    const q = query.trim()
    if (!q) return

    // Block double-submit
    if (!acquireProcessing()) return

    addMessage('user', q)
    setInput('')
    setTwinState('processing')

    const intent = classifyIntent(q)
    const topic  = extractTopic(q)

    saveToMemory(intent.toLowerCase(), q, topic)

    // CONVERSATIONAL — instant, zero cost
    if (intent === 'CONVERSATIONAL') {
      finish(conversationalReply(q, userName))
      return
    }

    try {
      // NEWS / QUESTION / GENERAL — chained search
      if (intent === 'NEWS' || intent === 'QUESTION' || intent === 'GENERAL') {
        const data = await vibeSearch(q)

        if (data.results && data.results.length > 0) {
          const top = data.results[0]
          if (top.snippet && top.snippet.length > 20) {
            let response = `${top.title}. ${top.snippet}`
            if (data.results.length > 1) {
              response += ` I also found ${data.results.length - 1} more result${data.results.length > 2 ? 's' : ''}. Want me to go deeper?`
            }
            finish(response, true)
          } else {
            finish(`I found something on "${q}" but details are thin. Try rephrasing — like "explain ${topic}".`)
          }
        } else {
          finish(`I searched for "${q}" but got no results. Try different keywords.`)
        }
        return
      }

      // LESSON — search VibeGlobal content library
      if (intent === 'LESSON') {
        const { data, error } = await supabase
          .from('vibelearn_content')
          .select('title, description, source')
          .eq('status', 'live')
          .or(`title.ilike.%${topic}%,description.ilike.%${topic}%`)
          .limit(3)

        if (error && process.env.NODE_ENV === 'development') {
          console.warn('[VibeTwin] vibelearn_content query failed:', error.message)
        }

        if (data && data.length > 0) {
          const top = data[0]
          let response = `I found a lesson on "${top.title}" by ${top.source || 'a teacher'}. `
          response += top.description ? top.description.slice(0, 120) + '. ' : ''
          response += `Want me to open it?`
          finish(response, true)
        } else {
          finish(`No lessons found for "${topic}" on VibeGlobal yet. Try searching the Vibe Feed tab.`)
        }
        return
      }

      // READ — navigate prompt
      if (intent === 'READ') {
        finish(`Go to Vibe Feed and tap "Vibe In" on any content to open the reader. Tell me a topic and I will search it for you.`)
        return
      }

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.'
      finish(`${message} Check your connection and try again.`)
    }
  }

  const recognition = useTwinRecognition({
    onTranscript:  (text) => handleQuery(text),
    onStateChange: (state) => setTwinState(state),
    onError:       (msg) => {
      addMessage('twin', msg)
      releaseProcessing()
      setTwinState('idle')
    },
  })

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Vibe Twin"
      style={{
        position:         'fixed',
        inset:            0,
        zIndex:           10000,
        background:       T.bg,
        display:          'flex',
        flexDirection:    'column',
        animation:        'vl-slide-up 300ms cubic-bezier(0.34,1.56,0.64,1)',
        WebkitUserSelect: 'none',
        userSelect:       'none',
      }}
    >
      <TwinHeader
        mode={mode}
        onMode={(m: TwinMode) => {
          cancelSpeech()
          recognition.abort()
          setTwinState('idle')
          setMode(m)
        }}
        onClose={() => {
          cancelSpeech()
          recognition.abort()
          onClose()
        }}
      />

      <TwinMessages
        messages={messages}
        twinState={twinState}
      />

      <TwinInput
        mode={mode}
        twinState={twinState}
        input={input}
        onInput={setInput}
        onSubmit={handleQuery}
        onStartListen={recognition.start}
        onStopListen={recognition.stop}
        onCancelListen={recognition.cancel}
        onStopSpeak={() => {
          cancelSpeech()
          setTwinState('idle')
        }}
      />

      <style>{`
        @keyframes vl-slide-up {
          from { transform: translateY(100vh); }
          to   { transform: translateY(0);     }
        }
      `}</style>
    </div>
  )
}
