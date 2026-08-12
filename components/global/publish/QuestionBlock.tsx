"use client"

import React, { useMemo, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import type { ContentBlock } from '@/lib/publishTypes'

type QuestionType = 'multiple_choice' | 'true_false' | 'short_answer'
type Feedback = 'idle' | 'correct' | 'incorrect' | 'error'

type Props = {
  block: ContentBlock
  readOnly: boolean
  onUpdate: (block: ContentBlock) => void
}

const ACCENT = '#45B7D1'
const TEXT = '#fff'
const MUTED = 'rgba(255,255,255,.58)'
const SURFACE = '#111827'
const BORDER = 'rgba(255,255,255,.10)'

function stringMeta(block: ContentBlock, key: string, fallback = ''): string {
  const value = block.meta?.[key]
  return typeof value === 'string' ? value : fallback
}

function optionsMeta(block: ContentBlock): string[] {
  const value = block.meta?.options
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function updateMeta(block: ContentBlock, key: string, value: string | string[]): ContentBlock {
  return { ...block, meta: { ...block.meta, [key]: value } }
}

function promptWithoutAnswer(content: string): string {
  const marker = content.indexOf('Answer:')
  return marker >= 0 ? content.slice(0, marker).trim() : content.trim()
}

function contentWithAnswer(content: string, answer: string): string {
  return `${promptWithoutAnswer(content)}\n\nAnswer: ${answer.trim()}`.trim()
}

export function QuestionBlock({ block, readOnly, onUpdate }: Props) {
  const questionType = stringMeta(block, 'questionType', 'multiple_choice') as QuestionType
  const options = useMemo(() => optionsMeta(block), [block])
  const correctAnswer = stringMeta(block, 'correctAnswer')
  const [selected, setSelected] = useState('')
  const [feedback, setFeedback] = useState<Feedback>('idle')
  const [message, setMessage] = useState('')
  const [checking, setChecking] = useState(false)
  const [startedAt] = useState(() => Date.now())

  if (!readOnly) {
    const normalizedOptions = options.length ? options : ['', '', '', '']
    return (
      <div style={{ background: `${ACCENT}0D`, border: `1px solid ${ACCENT}33`, borderRadius: 12, padding: 14 }}>
        <div style={{ color: ACCENT, fontSize: 10, fontWeight: 850, letterSpacing: '.09em', marginBottom: 10 }}>❓ QUESTION</div>
        <textarea
          value={promptWithoutAnswer(block.content)}
          rows={3}
          onChange={e => onUpdate({ ...block, content: contentWithAnswer(e.target.value, correctAnswer) })}
          placeholder="Write the question learners should answer…"
          style={{ width: '100%', boxSizing: 'border-box', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 9, color: TEXT, padding: 10, resize: 'vertical', lineHeight: 1.6 }}
        />
        <select
          value={questionType}
          onChange={e => {
            const next = e.target.value as QuestionType
            const nextOptions = next === 'true_false' ? ['True', 'False'] : normalizedOptions
            onUpdate(updateMeta({ ...block, meta: { ...block.meta, options: nextOptions } }, 'questionType', next))
          }}
          style={{ width: '100%', marginTop: 9, background: SURFACE, color: TEXT, border: `1px solid ${BORDER}`, borderRadius: 9, padding: 9 }}
        >
          <option value="multiple_choice">Multiple choice</option>
          <option value="true_false">True / False</option>
          <option value="short_answer">Short answer</option>
        </select>
        {questionType !== 'short_answer' && (
          <div style={{ marginTop: 10, display: 'grid', gap: 7 }}>
            {normalizedOptions.map((option, index) => (
              <input
                key={index}
                value={option}
                onChange={e => {
                  const next = [...normalizedOptions]
                  next[index] = e.target.value
                  onUpdate(updateMeta(block, 'options', next))
                }}
                placeholder={`Option ${String.fromCharCode(65 + index)}`}
                style={{ width: '100%', boxSizing: 'border-box', background: SURFACE, color: TEXT, border: `1px solid ${BORDER}`, borderRadius: 9, padding: 9 }}
              />
            ))}
          </div>
        )}
        <input
          value={correctAnswer}
          onChange={e => {
            const value = e.target.value
            onUpdate({ ...updateMeta(block, 'correctAnswer', value), content: contentWithAnswer(block.content, value) })
          }}
          placeholder={questionType === 'short_answer' ? 'Correct answer' : 'Correct option text'}
          style={{ width: '100%', boxSizing: 'border-box', marginTop: 9, background: SURFACE, color: TEXT, border: `1px solid ${BORDER}`, borderRadius: 9, padding: 9 }}
        />
        <input
          value={stringMeta(block, 'hint')}
          onChange={e => onUpdate(updateMeta(block, 'hint', e.target.value))}
          placeholder="Optional hint"
          style={{ width: '100%', boxSizing: 'border-box', marginTop: 7, background: 'transparent', color: MUTED, border: 0, padding: 6 }}
        />
        <textarea
          value={stringMeta(block, 'explanation')}
          onChange={e => onUpdate(updateMeta(block, 'explanation', e.target.value))}
          placeholder="Explanation shown after the answer"
          rows={2}
          style={{ width: '100%', boxSizing: 'border-box', marginTop: 4, background: 'transparent', color: TEXT, border: `1px solid ${BORDER}`, borderRadius: 9, padding: 9, resize: 'vertical' }}
        />
      </div>
    )
  }

  const hasAnswerKey = correctAnswer.trim().length > 0 || block.content.includes('Answer:')
  const canSubmit = selected.trim().length > 0 && hasAnswerKey && !checking

  async function check() {
    if (!canSubmit) return
    setChecking(true)
    setFeedback('idle')
    setMessage('')
    const responseMs = Math.max(0, Date.now() - startedAt)
    const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const { data, error } = await sb.rpc('student_record_grounded_practice_answer', {
      p_content_block_id: block.id,
      p_response_text: selected,
      p_response_ms: responseMs,
      p_session_id: null,
    })
    const result = data as { ok?: boolean; correct?: boolean } | null
    if (error || !result?.ok) {
      setFeedback('error')
      setMessage(error?.message || 'Your answer could not be recorded. Please try again.')
      setChecking(false)
      return
    }
    setFeedback(result.correct ? 'correct' : 'incorrect')
    setChecking(false)
  }

  return (
    <section aria-label="Learning question" style={{ background: `${ACCENT}0D`, border: `1px solid ${ACCENT}33`, borderRadius: 14, padding: 16 }}>
      <div style={{ color: ACCENT, fontSize: 10, fontWeight: 850, letterSpacing: '.09em', marginBottom: 8 }}>❓ CHECK YOUR UNDERSTANDING</div>
      <div style={{ color: TEXT, fontSize: 16, fontWeight: 750, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{promptWithoutAnswer(block.content)}</div>
      {!hasAnswerKey ? (
        <div style={{ marginTop: 12, color: MUTED, fontSize: 12 }}>This question is for reflection. No automatic marking is configured.</div>
      ) : questionType === 'short_answer' ? (
        <input
          value={selected}
          onChange={e => { setSelected(e.target.value); setFeedback('idle') }}
          onKeyDown={e => { if (e.key === 'Enter' && canSubmit) void check() }}
          aria-label="Your answer"
          placeholder="Type your answer…"
          disabled={checking}
          style={{ width: '100%', boxSizing: 'border-box', marginTop: 14, background: SURFACE, color: TEXT, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 12 }}
        />
      ) : (
        <div role="radiogroup" aria-label="Answer choices" style={{ display: 'grid', gap: 8, marginTop: 14 }}>
          {options.filter(Boolean).map((option, index) => (
            <label key={`${option}-${index}`} style={{ display: 'flex', alignItems: 'center', gap: 10, border: `1px solid ${selected === option ? ACCENT : BORDER}`, background: selected === option ? `${ACCENT}12` : SURFACE, borderRadius: 10, padding: 11, cursor: checking ? 'default' : 'pointer', color: TEXT }}>
              <input type="radio" name={`question-${block.id}`} checked={selected === option} disabled={checking} onChange={() => { setSelected(option); setFeedback('idle') }} />
              <span><strong>{String.fromCharCode(65 + index)}.</strong> {option}</span>
            </label>
          ))}
        </div>
      )}
      {canSubmit && <button type="button" onClick={() => void check()} style={{ marginTop: 12, width: '100%', border: 0, borderRadius: 10, background: ACCENT, color: '#07100a', padding: '11px 14px', fontWeight: 850, cursor: 'pointer' }}>Check answer</button>}
      {checking && <div role="status" aria-live="polite" style={{ marginTop: 12, color: MUTED, fontSize: 12 }}>Checking your answer…</div>}
      {feedback === 'error' && <div role="alert" style={{ marginTop: 12, borderRadius: 10, padding: 12, background: 'rgba(245,158,11,.12)', color: TEXT }}>{message}</div>}
      {(feedback === 'correct' || feedback === 'incorrect') && (
        <div role="status" aria-live="polite" style={{ marginTop: 12, borderRadius: 10, padding: 12, background: feedback === 'correct' ? 'rgba(52,211,153,.12)' : 'rgba(245,158,11,.12)', color: TEXT }}>
          <strong>{feedback === 'correct' ? 'Excellent — correct.' : 'Not quite. Try again.'}</strong>
          {stringMeta(block, 'explanation') && <div style={{ marginTop: 5, color: MUTED, lineHeight: 1.6 }}>{stringMeta(block, 'explanation')}</div>}
          {feedback === 'incorrect' && stringMeta(block, 'hint') && <div style={{ marginTop: 5, color: MUTED, lineHeight: 1.6 }}>Hint: {stringMeta(block, 'hint')}</div>}
        </div>
      )}
    </section>
  )
}
