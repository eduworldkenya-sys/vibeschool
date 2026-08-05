'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  getBuilderItem,
  updateBuilderItem,
  type BuilderItemDetail,
} from '@/lib/assessment/authoring'

export default function AssessmentQuestionEditorPage() {
  const params = useParams<{ itemId: string }>()
  const router = useRouter()
  const [item, setItem] = useState<BuilderItemDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [optionsText, setOptionsText] = useState('[]')
  const [acceptedText, setAcceptedText] = useState('[]')
  const [correctText, setCorrectText] = useState('null')
  const [guideText, setGuideText] = useState('{}')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const loaded = await getBuilderItem(params.itemId)
        if (cancelled) return
        setItem(loaded)
        setOptionsText(JSON.stringify(loaded.options, null, 2))
        setAcceptedText(JSON.stringify(loaded.acceptedAnswers, null, 2))
        setCorrectText(JSON.stringify(loaded.correctAnswer, null, 2))
        setGuideText(JSON.stringify(loaded.markingGuide, null, 2))
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not load question.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [params.itemId])

  async function save() {
    if (!item || saving) return
    setSaving(true)
    setError('')
    try {
      await updateBuilderItem({
        itemId: item.id,
        questionType: item.questionType,
        prompt: item.prompt,
        marks: item.marks,
        options: JSON.parse(optionsText),
        acceptedAnswers: JSON.parse(acceptedText),
        correctAnswer: JSON.parse(correctText),
        markingGuide: JSON.parse(guideText),
        autoMarkingMode: item.autoMarkingMode,
        difficulty: item.difficulty,
        bloomLevel: item.bloomLevel,
        explanation: item.explanation,
        hint: item.hint,
        workedSolution: item.workedSolution,
        teacherNotes: item.teacherNotes,
      })
      router.push(`/teacher/assessment/builder/${item.assessmentId}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Question could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <main style={shell}>Loading question…</main>
  if (!item) return <main style={shell}><section style={{ ...card, color: '#b91c1c' }}>{error || 'Question unavailable.'}</section></main>

  return (
    <main style={shell}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <section style={card}>
          <div style={eyebrow}>Assessment Builder</div>
          <h1 style={{ margin: '6px 0' }}>Edit Question {item.orderNum}</h1>
          <p style={{ margin: 0, color: '#6b7280' }}>Author the learner prompt, marking rules, metadata, and feedback support.</p>
        </section>

        {error && <section style={{ ...card, color: '#b91c1c' }}>{error}</section>}

        <section style={card}>
          <label style={label}>Question type</label>
          <select value={item.questionType} onChange={event => setItem({ ...item, questionType: event.target.value })} style={input}>
            {['multiple_choice','multiple_response','true_false','fill_blank','numeric','short_answer','structured','essay','practical','file_upload'].map(type => (
              <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>
            ))}
          </select>

          <label style={label}>Prompt</label>
          <textarea value={item.prompt} onChange={event => setItem({ ...item, prompt: event.target.value })} rows={5} style={{ ...input, resize: 'vertical' }} />

          <div style={grid}>
            <div>
              <label style={label}>Marks</label>
              <input type="number" min={0.5} step={0.5} value={item.marks} onChange={event => setItem({ ...item, marks: Number(event.target.value) })} style={input} />
            </div>
            <div>
              <label style={label}>Difficulty</label>
              <select value={item.difficulty ?? ''} onChange={event => setItem({ ...item, difficulty: event.target.value || null })} style={input}>
                <option value="">Not set</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
              </select>
            </div>
            <div>
              <label style={label}>Bloom level</label>
              <select value={item.bloomLevel ?? ''} onChange={event => setItem({ ...item, bloomLevel: event.target.value || null })} style={input}>
                <option value="">Not set</option>{['remember','understand','apply','analyze','evaluate','create'].map(level => <option key={level} value={level}>{level}</option>)}
              </select>
            </div>
            <div>
              <label style={label}>Auto marking</label>
              <select value={item.autoMarkingMode} onChange={event => setItem({ ...item, autoMarkingMode: event.target.value })} style={input}>
                {['none','exact','case_insensitive','numeric_tolerance','option_match','set_match','ordered_match'].map(mode => <option key={mode} value={mode}>{mode.replaceAll('_',' ')}</option>)}
              </select>
            </div>
          </div>
        </section>

        <section style={card}>
          <h2 style={{ marginTop: 0, fontSize: 17 }}>Answer and marking configuration</h2>
          <JsonField label="Options" value={optionsText} onChange={setOptionsText} />
          <JsonField label="Accepted answers" value={acceptedText} onChange={setAcceptedText} />
          <JsonField label="Correct answer" value={correctText} onChange={setCorrectText} />
          <JsonField label="Marking guide" value={guideText} onChange={setGuideText} />
        </section>

        <section style={card}>
          <TextArea label="Hint" value={item.hint ?? ''} onChange={value => setItem({ ...item, hint: value || null })} />
          <TextArea label="Explanation" value={item.explanation ?? ''} onChange={value => setItem({ ...item, explanation: value || null })} />
          <TextArea label="Worked solution" value={item.workedSolution ?? ''} onChange={value => setItem({ ...item, workedSolution: value || null })} />
          <TextArea label="Teacher notes" value={item.teacherNotes ?? ''} onChange={value => setItem({ ...item, teacherNotes: value || null })} />
        </section>

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={() => router.back()} style={{ ...secondaryButton, flex: 1 }}>Cancel</button>
          <button type="button" disabled={saving} onClick={() => void save()} style={{ ...primaryButton, flex: 1 }}>{saving ? 'Saving…' : 'Save Question'}</button>
        </div>
      </div>
    </main>
  )
}

function JsonField({ label: fieldLabel, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <div style={{ marginBottom: 12 }}><label style={label}>{fieldLabel} (JSON)</label><textarea value={value} onChange={event => onChange(event.target.value)} rows={4} style={{ ...input, resize: 'vertical', fontFamily: 'monospace' }} /></div>
}

function TextArea({ label: fieldLabel, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <div style={{ marginBottom: 12 }}><label style={label}>{fieldLabel}</label><textarea value={value} onChange={event => onChange(event.target.value)} rows={3} style={{ ...input, resize: 'vertical' }} /></div>
}

const shell: React.CSSProperties = { minHeight: '100vh', background: '#f8fafc', padding: '18px 14px 80px', fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#111827' }
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 16, marginBottom: 12 }
const eyebrow: React.CSSProperties = { fontSize: 10, fontWeight: 800, color: '#4338ca', textTransform: 'uppercase', letterSpacing: 1 }
const label: React.CSSProperties = { display: 'block', fontSize: 10, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8, margin: '12px 0 6px' }
const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: 10, padding: '10px 12px', font: 'inherit' }
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 12 }
const primaryButton: React.CSSProperties = { border: 'none', borderRadius: 12, padding: '12px 16px', background: '#4338ca', color: '#fff', fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer' }
const secondaryButton: React.CSSProperties = { border: '1px solid #d1d5db', borderRadius: 12, padding: '12px 16px', background: '#fff', color: '#374151', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }
