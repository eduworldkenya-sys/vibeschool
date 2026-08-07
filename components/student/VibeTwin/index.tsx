'use client'

import { useState, useEffect } from 'react'
import type { VibeTwinProps, TwinMode } from './types'
import { useTwinSession } from './hooks/useTwinSession'
import { useTwinSpeech } from './hooks/useTwinSpeech'
import { useTwinRecognition } from './hooks/useTwinRecognition'
import TwinHeader from './ui/TwinHeader'
import TwinMessages from './ui/TwinMessages'
import TwinInput from './ui/TwinInput'
import { T } from './ui/TwinHeader'
import { askLearnerTwin, getLearnerTwinState, type LearnerTwinChatMessage } from '@/lib/student/twin'

export default function VibeTwin({ isOpen, onClose, userName }: VibeTwinProps) {
  const [input, setInput] = useState('')
  const [mode, setMode] = useState<TwinMode>('text')

  const {
    messages, twinState, setTwinState,
    greeted, setGreeted,
    addMessage, acquireProcessing, releaseProcessing,
  } = useTwinSession(isOpen)
  const { speak, cancel: cancelSpeech } = useTwinSpeech()

  useEffect(() => {
    if (!isOpen) {
      setMode('text')
      setInput('')
      cancelSpeech()
    }
  }, [isOpen, cancelSpeech])

  useEffect(() => {
    if (!isOpen || greeted) return
    setGreeted(true)
    let cancelled = false

    async function greetFromState() {
      let greeting: string
      try {
        const state = await getLearnerTwinState()
        if (cancelled) return
        const now = state.decision.now
        if (now) {
          greeting = `${userName}, ${now.title} is your best next step.${now.reason ? ` ${now.reason}` : ''}`
        } else if (state.mastery.outcomes[0]) {
          greeting = `${userName}, you are caught up on assigned work. We can strengthen ${state.mastery.outcomes[0].outcomeText} next.`
        } else {
          greeting = `${userName}, you are caught up. As you complete verified work, I will use that evidence to guide what comes next.`
        }
      } catch {
        if (cancelled) return
        greeting = `${userName}, I am ready to help with your current schoolwork.`
      }
      addMessage('twin', greeting)
      const timer = setTimeout(() => speak(greeting), 300)
      if (cancelled) clearTimeout(timer)
    }

    void greetFromState()
    return () => { cancelled = true }
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
    if (!acquireProcessing()) return

    const history: LearnerTwinChatMessage[] = messages.slice(-8).map(message => ({
      role: message.role === 'user' ? 'user' : 'assistant',
      content: message.text,
    }))

    addMessage('user', q)
    setInput('')
    setTwinState('processing')

    try {
      const response = await askLearnerTwin({
        firstName: userName,
        messages: [...history, { role: 'user', content: q }],
      })
      finish(response, true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Your Twin could not respond.'
      finish(`${message} Your learning state is still safe; try again when the connection is available.`)
    }
  }

  const recognition = useTwinRecognition({
    onTranscript: (text) => handleQuery(text),
    onStateChange: (state) => setTwinState(state),
    onError: (msg) => {
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
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: T.bg,
        display: 'flex',
        flexDirection: 'column',
        animation: 'vl-slide-up 300ms cubic-bezier(0.34,1.56,0.64,1)',
        WebkitUserSelect: 'none',
        userSelect: 'none',
      }}
    >
      <TwinHeader
        mode={mode}
        onMode={(nextMode: TwinMode) => {
          cancelSpeech()
          recognition.abort()
          setTwinState('idle')
          setMode(nextMode)
        }}
        onClose={() => {
          cancelSpeech()
          recognition.abort()
          onClose()
        }}
      />

      <TwinMessages messages={messages} twinState={twinState} />

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
          to   { transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
