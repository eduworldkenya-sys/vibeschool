'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { createDraftAssessment, addDraftItem } from '@/lib/assessment/engine'
import paper from '@/content/assessments/grade4-mathematics-pilot-01.draft.json'

type Context = { classes?: Array<{ class_id: string; class_name: string; subject_id: string; subject_name: string }> }

export default function GradeFourMathDraftPage() {
  const router = useRouter()
  const [contexts, setContexts] = useState<NonNullable<Context['classes']>>([])
  const [selected, setSelected] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [createdId, setCreatedId] = useState('')

  useEffect(() => {
    let mounted = true
    supabase.rpc('teacher_get_operating_context').then(({ data, error: failure }) => {
      if (!mounted) return
      if (failure) { setError(failure.message); return }
      const classes = ((data as Context | null)?.classes ?? []).filter(row =>
        /^(grade|class)\\s*4$/i.test(row.class_name.trim()) && /math/i.test(row.subject_name))
      setContexts(classes)
      if (classes.length === 1) setSelected(`${classes[0].class_id}:${classes[0].subject_id}`)
    })
    return () => { mounted = false }
  }, [])

  async function createDraft() {
    const context = contexts.find(row => `${row.class_id}:${row.subject_id}` === selected)
    if (!context || busy) return
    setBusy(true)
    setError('')
    try {
      // Only an assigned teacher can call these RPCs. A partial draft remains
      // private for completion/review; never auto-approve or auto-assign.
      const assessmentId = await createDraftAssessment({
        classId: context.class_id, subjectId: context.subject_id, assessmentType: 'exam',
        title: paper.title, instructions: paper.instructions,
        description: 'Pilot Mathematics paper — teacher review required before approval and assignment.',
        generationSource: 'teacher_reviewed_import',
        generationMetadata: { pilot: 'grade4-mathematics-01', sourceStatus: paper.status },
      })
      setCreatedId(assessmentId)
      for (const item of paper.items) {
        await addDraftItem({ assessmentId, questionType: 'multiple_choice', prompt: item.prompt,
          marks: item.marks, orderNum: item.number, options: item.options,
          correctAnswer: item.correctAnswer, autoMarkingMode: 'option_match',
          explanation: item.explanation, workedSolution: item.explanation,
          generatedBy: 'teacher', sourceExerciseRef: { competency: item.competency, pilot: 'grade4-mathematics-01' } })
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Draft creation failed.')
    } finally { setBusy(false) }
  }

  return <main style={{ maxWidth: 680, margin: '0 auto', padding: 24 }}>
    <button onClick={() => router.back()} type="button">← Back</button>
    <h1>Grade 4 Mathematics pilot</h1>
    <p>10 questions · 10 marks · Draft for teacher review</p>
    <p>This imports the questions into the existing Assessment Engine. It does not publish or assign an exam.</p>
    <label htmlFor="class-context">Your assigned Grade 4 Mathematics class</label>
    <select id="class-context" value={selected} onChange={event => setSelected(event.target.value)} style={{ display: 'block', width: '100%', minHeight: 48, margin: '12px 0' }}>
      <option value="">Select class</option>
      {contexts.map(row => <option key={`${row.class_id}:${row.subject_id}`} value={`${row.class_id}:${row.subject_id}`}>{row.class_name} — {row.subject_name}</option>)}
    </select>
    {contexts.length === 0 && <p>No authorised Grade 4 Mathematics teaching assignment found for this account.</p>}
    <button type="button" disabled={!selected || busy || Boolean(createdId)} onClick={() => void createDraft()} style={{ minHeight: 48, padding: '0 20px' }}>{busy ? 'Importing questions…' : 'Create assessment draft'}</button>
    {createdId && <p role="status">Draft created: {createdId}. Review the questions in your assessment authoring workflow before approval and assignment.</p>}
    {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}{createdId ? ` Draft ID: ${createdId}. Do not import again before reviewing this draft.` : ''}</p>}
  </main>
}
