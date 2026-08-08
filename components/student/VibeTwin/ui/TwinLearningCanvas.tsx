'use client'

import type { AdaptivePracticeQuestion, AdaptiveTeachingTurn, LearnerTwinState } from '@/lib/student/twin'
import type { TwinMessage, TwinState } from '../types'
import { T } from './TwinHeader'

type Stage = 'understand' | 'try' | 'reflect' | 'revisit'

interface TwinLearningCanvasProps {
  userName: string
  learnerState: LearnerTwinState | null
  practiceQuestion: AdaptivePracticeQuestion | null
  coachTurn: AdaptiveTeachingTurn | null
  practiceFeedback: string | null
  practiceLoading: boolean
  hintIndex: number
  messages: TwinMessage[]
  twinState: TwinState
  onStartPractice: () => void
  onAnswer: (index: number) => void
  onCoach: () => void
  onHint: () => void
  onExplainAnotherWay: () => void
  onEasier: () => void
  onHarder: () => void
  onEndPractice: () => void
  onResumeCompanion: () => void
}

function stageFor(question: AdaptivePracticeQuestion | null, feedback: string | null, coach: AdaptiveTeachingTurn | null): Stage {
  if (!question) return 'understand'
  if (feedback) return 'reflect'
  if (coach) return 'try'
  return 'try'
}

export default function TwinLearningCanvas({
  userName,
  learnerState,
  practiceQuestion,
  coachTurn,
  practiceFeedback,
  practiceLoading,
  hintIndex,
  messages,
  twinState,
  onStartPractice,
  onAnswer,
  onCoach,
  onHint,
  onExplainAnotherWay,
  onEasier,
  onHarder,
  onEndPractice,
  onResumeCompanion,
}: TwinLearningCanvasProps) {
  const now = learnerState?.decision.now
  const weakest = learnerState?.mastery.outcomes[0] ?? null
  const stage = stageFor(practiceQuestion, practiceFeedback, coachTurn)
  const stages: Array<{ id: Stage; label: string }> = [
    { id: 'understand', label: 'Understand' },
    { id: 'try', label: 'Try' },
    { id: 'reflect', label: 'Reflect' },
    { id: 'revisit', label: 'Revisit' },
  ]

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 14px 18px', display: 'grid', gap: 12, alignContent: 'start', WebkitOverflowScrolling: 'touch' }}>
      <section style={{ border: `1px solid ${T.border}`, background: T.card, borderRadius: 16, padding: 14, display: 'grid', gap: 8 }}>
        <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: .9, textTransform: 'uppercase', color: T.muted }}>What matters now</div>
        <div style={{ fontSize: 18, lineHeight: 1.25, fontWeight: 900, color: T.text }}>{now?.title || weakest?.outcomeText || 'Build your next verified learning signal'}</div>
        <div style={{ fontSize: 11.5, lineHeight: 1.55, color: T.muted }}>{now?.reason || (weakest ? `Twin can strengthen ${weakest.outcomeText} next.` : 'Twin is waiting for enough verified evidence to choose a stronger next step.')}</div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          <button onClick={onStartPractice} disabled={practiceLoading} style={primaryButton}>{practiceLoading ? 'Preparing…' : practiceQuestion ? 'New question' : 'Practice weakest skill'}</button>
          <button onClick={onResumeCompanion} style={secondaryButton}>What Twin remembers</button>
        </div>
      </section>

      <section style={{ border: `1px solid ${T.border}`, background: T.card, borderRadius: 16, padding: 12, display: 'grid', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
          {stages.map(item => {
            const active = item.id === stage
            return <div key={item.id} style={{ textAlign: 'center', padding: '7px 4px', borderRadius: 10, border: `1px solid ${active ? T.accentBdr : T.border}`, background: active ? T.accentBg : 'transparent' }}>
              <div style={{ fontSize: 9, fontWeight: 900, color: active ? T.text : T.muted }}>{item.label}</div>
            </div>
          })}
        </div>

        {!practiceQuestion ? (
          <div style={{ padding: '8px 2px 2px', display: 'grid', gap: 8 }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: T.text }}>Ready when you are, {userName}.</div>
            <div style={{ fontSize: 11.5, lineHeight: 1.55, color: T.muted }}>You do not need to know what prompt to type. Start the recommended task, practice your weakest verified skill, or ask Twin anything about what you are learning.</div>
          </div>
        ) : (
          <>
            <div>
              <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: .9, fontWeight: 900, color: T.muted }}>Adaptive practice · {practiceQuestion.difficulty}</div>
              <div style={{ marginTop: 4, fontSize: 11, color: T.muted }}>{practiceQuestion.outcomeCode ?? 'Curriculum outcome'} · {practiceQuestion.outcomeText}</div>
            </div>
            <div style={{ fontSize: 16, lineHeight: 1.5, color: T.text, fontWeight: 850 }}>{practiceQuestion.prompt}</div>

            {coachTurn && <div style={{ padding: 11, borderRadius: 12, background: T.accentBg, border: `1px solid ${T.accentBdr}` }}>
              <div style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', color: T.muted }}>{coachTurn.mode.replaceAll('_', ' ')}</div>
              <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.55, color: T.text }}>{coachTurn.prompt}</div>
            </div>}

            <div style={{ display: 'grid', gap: 7 }}>
              {practiceQuestion.options.map((option, index) => <button key={`${practiceQuestion.id}-${index}`} onClick={() => onAnswer(index)} disabled={practiceLoading} style={optionButton}><strong>{String.fromCharCode(65 + index)}.</strong> {option}</button>)}
            </div>

            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              <button onClick={onCoach} disabled={practiceLoading} style={secondaryButton}>Coach me</button>
              {practiceQuestion.hints.length > hintIndex && <button onClick={onHint} style={secondaryButton}>Hint</button>}
              <button onClick={onExplainAnotherWay} style={secondaryButton}>Show another way</button>
              <button onClick={onEasier} style={secondaryButton}>Easier</button>
              <button onClick={onHarder} style={secondaryButton}>Harder</button>
              <button onClick={onEndPractice} style={quietButton}>Finish</button>
            </div>

            {hintIndex > 0 && <div style={{ fontSize: 11.5, lineHeight: 1.55, color: T.muted }}>{practiceQuestion.hints.slice(0, hintIndex).join(' ')}</div>}
            {practiceFeedback && <div role="status" style={{ padding: 10, borderRadius: 12, background: T.bg, border: `1px solid ${T.border}`, fontSize: 11.5, lineHeight: 1.55, color: T.text }}>{practiceFeedback}</div>}
          </>
        )}
      </section>

      <section style={{ border: `1px solid ${T.border}`, background: T.card, borderRadius: 16, padding: 12, display: 'grid', gap: 8 }}>
        <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: .9, fontWeight: 900, color: T.muted }}>Conversation</div>
        {messages.length === 0 ? <div style={{ fontSize: 11.5, lineHeight: 1.55, color: T.muted }}>Ask a question whenever you need to. Conversation supports the learning session; it does not replace it.</div> : messages.slice(-6).map(message => <div key={message.id} style={{ justifySelf: message.role === 'user' ? 'end' : 'start', maxWidth: '88%', padding: '9px 11px', borderRadius: 12, background: message.role === 'user' ? T.accentMsg : T.bg, border: `1px solid ${message.role === 'user' ? T.accentMsgBdr : T.border}`, fontSize: 11.5, lineHeight: 1.5, color: T.text }}>{message.text}</div>)}
        {twinState === 'processing' && <div style={{ fontSize: 10.5, color: T.muted }}>Twin is deciding the next useful teaching move…</div>}
      </section>
    </div>
  )
}

const primaryButton: React.CSSProperties = { border: 0, borderRadius: 10, padding: '9px 11px', background: T.accent, color: '#000', fontWeight: 900, cursor: 'pointer', fontSize: 11 }
const secondaryButton: React.CSSProperties = { border: `1px solid ${T.border}`, borderRadius: 10, padding: '8px 10px', background: 'transparent', color: T.text, fontWeight: 750, cursor: 'pointer', fontSize: 10.5 }
const quietButton: React.CSSProperties = { border: 0, borderRadius: 10, padding: '8px 10px', background: 'transparent', color: T.muted, cursor: 'pointer', fontSize: 10.5 }
const optionButton: React.CSSProperties = { textAlign: 'left', border: `1px solid ${T.border}`, background: T.bg, color: T.text, borderRadius: 11, padding: '10px 11px', cursor: 'pointer', fontSize: 11.5, lineHeight: 1.45 }
