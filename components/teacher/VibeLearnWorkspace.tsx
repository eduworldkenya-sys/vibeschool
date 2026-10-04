"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  loadTeacherVibeLearnWorkspace,
  useVibeLearnResource,
  type VibeLearnUseIntent,
  type VibeLearnWorkspace,
} from '@/lib/vibelearn/teacherWorkspace'
import { C } from '@/components/teacher/ui'

const INTENTS: Array<{ value: VibeLearnUseIntent; label: string; help: string }> = [
  { value: 'teacher_reference', label: 'Keep for teaching', help: 'Teacher reference for this class.' },
  { value: 'learner_reading', label: 'Give learners to read', help: 'Learner reading material.' },
  { value: 'teach_now', label: 'Use in the lesson', help: 'Add to the class and prepared lesson.' },
  { value: 'practice', label: 'Use for practice', help: 'Class practice or follow-up work.' },
  { value: 'homework', label: 'Use for homework', help: 'Keep it ready as a homework source.' },
  { value: 'assessment', label: 'Use for assessment', help: 'Assessment source material.' },
  { value: 'remedial', label: 'Use for support', help: 'Remedial material for learners who need help.' },
  { value: 'enrichment', label: 'Use for extension', help: 'Extension material for learners ready to go further.' },
]

function classLabel(workspace: VibeLearnWorkspace | null): string {
  const selected = workspace?.selected
  if (!selected) return 'No teaching context'
  return [selected.className, selected.classStream, selected.subjectName].filter(Boolean).join(' · ')
}

function focusTitle(workspace: VibeLearnWorkspace | null): string {
  const focus = workspace?.focus
  return focus?.topic || focus?.subStrand || focus?.strand || 'No current Scheme focus'
}

function resourceTypeLabel(assetKind: string | null, sourceType: string): string {
  if (assetKind) return assetKind.replaceAll('_', ' ')
  return sourceType.replaceAll('_', ' ')
}

export default function VibeLearnWorkspace() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialClassId = searchParams.get('classId')
  const initialSubjectId = searchParams.get('subjectId')
  const [workspace, setWorkspace] = useState<VibeLearnWorkspace | null>(null)
  const [selectedClassId, setSelectedClassId] = useState(initialClassId ?? '')
  const [selectedSubjectId, setSelectedSubjectId] = useState(initialSubjectId ?? '')
  const [query, setQuery] = useState('')
  const [appliedQuery, setAppliedQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [usingId, setUsingId] = useState<string | null>(null)
  const [intentFor, setIntentFor] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState('')
  const [actionError, setActionError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const result = await loadTeacherVibeLearnWorkspace({
        classId: selectedClassId || initialClassId,
        subjectId: selectedSubjectId || initialSubjectId,
        query: appliedQuery,
      })
      setWorkspace(result)
      if (result.selected) {
        setSelectedClassId(result.selected.classId)
        setSelectedSubjectId(result.selected.subjectId)
      }
    } catch (reason) {
      console.error('[VibeLearn] teacher workspace load failed', reason)
      setLoadError('The learning library could not be prepared. Try again.')
    } finally {
      setLoading(false)
    }
  }, [appliedQuery, initialClassId, initialSubjectId, selectedClassId, selectedSubjectId])

  useEffect(() => {
    void load()
  }, [load])

  const subjectOptions = useMemo(() => {
    if (!workspace) return []
    const rows = workspace.assignments.filter(row => !selectedClassId || row.classId === selectedClassId)
    const seen = new Set<string>()
    return rows.filter(row => {
      if (seen.has(row.subjectId)) return false
      seen.add(row.subjectId)
      return true
    })
  }, [selectedClassId, workspace])

  const classOptions = useMemo(() => {
    if (!workspace) return []
    const seen = new Set<string>()
    return workspace.assignments.filter(row => {
      if (seen.has(row.classId)) return false
      seen.add(row.classId)
      return true
    })
  }, [workspace])

  function changeClass(classId: string) {
    setSelectedClassId(classId)
    const next = workspace?.assignments.find(row => row.classId === classId)
    setSelectedSubjectId(next?.subjectId ?? '')
    setAppliedQuery('')
    setQuery('')
  }

  function changeSubject(subjectId: string) {
    setSelectedSubjectId(subjectId)
    setAppliedQuery('')
    setQuery('')
  }

  async function useResource(resourceId: string, intent: VibeLearnUseIntent) {
    if (!workspace?.selected) return
    setUsingId(resourceId)
    setActionError('')
    setActionMessage('')
    try {
      const result = await useVibeLearnResource({
        resourceId,
        classId: workspace.selected.classId,
        subjectId: workspace.selected.subjectId,
        intent,
        lessonPlanId: workspace.focus?.lessonPlanId,
      })
      setActionMessage(result.warning ?? (
        result.lessonLinked
          ? 'Added to the class library and linked to the prepared lesson.'
          : 'Added to the class learning library.'
      ))
      setIntentFor(null)
      await load()
    } catch (reason) {
      console.error('[VibeLearn] resource use failed', reason)
      setActionError('That resource could not be added. Nothing was changed.')
    } finally {
      setUsingId(null)
    }
  }

  if (loading && !workspace) {
    return <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 16, padding: 22, color: C.textMuted }}>Preparing the learning library for your class…</div>
  }

  if (loadError && !workspace) {
    return <div style={{ background: '#fff', border: '1px solid #fecaca', borderRadius: 16, padding: 20 }}>
      <strong style={{ color: '#991b1b' }}>Learning library unavailable</strong>
      <p style={{ color: C.textMuted, fontSize: 13, lineHeight: 1.6 }}>{loadError}</p>
      <button type="button" onClick={() => void load()} style={{ border: 0, borderRadius: 10, padding: '9px 13px', background: C.accent, color: '#fff', fontWeight: 800 }}>Try again</button>
    </div>
  }

  if (!workspace?.selected) {
    return <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, textAlign: 'center' }}>
      <h2 style={{ margin: 0, fontSize: 18 }}>Set up a class and subject first</h2>
      <p style={{ color: C.textMuted, fontSize: 13, lineHeight: 1.6 }}>VibeLearn needs a real teaching context so it can recommend material without guessing.</p>
      <button type="button" onClick={() => router.push('/teacher/onboarding/class')} style={{ border: 0, borderRadius: 10, padding: '10px 14px', background: C.accent, color: '#fff', fontWeight: 850 }}>Set up class & subject</button>
    </div>
  }

  return <div>
    <section style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 18, padding: 16, marginBottom: 12 }}>
      <div style={{ fontSize: 10, color: '#047857', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase' }}>Working context</div>
      <h2 style={{ margin: '4px 0 4px', fontSize: 18, color: C.textPrimary }}>{classLabel(workspace)}</h2>
      <p style={{ margin: 0, color: C.textMuted, fontSize: 12, lineHeight: 1.55 }}>VibeLearn keeps this class and subject while it finds, ranks and reuses learning material.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
        <label style={{ fontSize: 10, fontWeight: 850, color: C.textMuted }}>CLASS
          <select value={selectedClassId} onChange={event => changeClass(event.target.value)} style={{ width: '100%', minHeight: 42, marginTop: 5, border: `1px solid ${C.border}`, borderRadius: 10, background: '#f8fafc', padding: '0 10px', fontWeight: 800 }}>
            {classOptions.map(row => <option key={row.classId} value={row.classId}>{row.className}{row.classStream ? ` · ${row.classStream}` : ''}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 10, fontWeight: 850, color: C.textMuted }}>SUBJECT
          <select value={selectedSubjectId} onChange={event => changeSubject(event.target.value)} style={{ width: '100%', minHeight: 42, marginTop: 5, border: `1px solid ${C.border}`, borderRadius: 10, background: '#f8fafc', padding: '0 10px', fontWeight: 800 }}>
            {subjectOptions.map(row => <option key={row.subjectId} value={row.subjectId}>{row.subjectName}</option>)}
          </select>
        </label>
      </div>
    </section>

    <section style={{ background: 'linear-gradient(135deg,#0f766e,#1e1b4b)', color: '#fff', borderRadius: 18, padding: 17, marginBottom: 12 }}>
      <div style={{ fontSize: 10, opacity: .65, fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase' }}>Current teaching focus</div>
      <h2 style={{ margin: '5px 0 4px', fontSize: 19 }}>{focusTitle(workspace)}</h2>
      {workspace.focus?.objective && <p style={{ margin: '6px 0 0', fontSize: 12, lineHeight: 1.6, opacity: .82 }}>{workspace.focus.objective}</p>}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 11 }}>
        {workspace.focus?.grade && <span style={focusPill}>{workspace.focus.grade}</span>}
        {workspace.focus?.strand && <span style={focusPill}>{workspace.focus.strand}</span>}
        {workspace.focus?.subStrand && <span style={focusPill}>{workspace.focus.subStrand}</span>}
      </div>
      {workspace.focus?.lessonPlanId && <button type="button" onClick={() => router.push(`/teacher/lessonplan?classId=${workspace.selected?.classId}&subjectId=${workspace.selected?.subjectId}`)} style={{ marginTop: 12, border: '1px solid rgba(255,255,255,.22)', background: 'rgba(255,255,255,.1)', color: '#fff', borderRadius: 10, padding: '8px 11px', fontWeight: 800, fontSize: 11 }}>Open prepared lesson →</button>}
    </section>

    {(workspace.outcomes.length > 0 || workspace.attention.openInterventions > 0) && <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 10, marginBottom: 12 }}>
      {workspace.outcomes.length > 0 && <div style={card}>
        <div style={eyebrow}>What learners should master</div>
        {workspace.outcomes.slice(0, 3).map(outcome => <div key={outcome.id} style={{ padding: '9px 0', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 12, color: C.textPrimary, fontWeight: 800, lineHeight: 1.5 }}>{outcome.text}</div>
          {outcome.prerequisites.length > 0 && <div style={{ marginTop: 4, color: C.textMuted, fontSize: 10, lineHeight: 1.45 }}>Builds on: {outcome.prerequisites.map(item => item.text).join(' · ')}</div>}
        </div>)}
      </div>}
      {workspace.attention.openInterventions > 0 && <div style={card}>
        <div style={eyebrow}>Learning needing attention</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 7, marginTop: 10 }}>
          <Metric value={workspace.attention.learnersNeedingSupport} label="Learners" />
          <Metric value={workspace.attention.openInterventions} label="Open support" />
          <Metric value={workspace.attention.highPriority} label="High priority" />
        </div>
        <button type="button" onClick={() => router.push(`/teacher/classhub/${workspace.selected?.classId}/progress?subjectId=${workspace.selected?.subjectId}`)} style={{ marginTop: 12, border: 0, background: '#eef2ff', color: '#3730a3', borderRadius: 9, padding: '8px 10px', fontSize: 11, fontWeight: 850 }}>Open learner progress →</button>
      </div>}
    </section>}

    <section style={{ ...card, marginBottom: 12 }}>
      <div style={eyebrow}>Find learning material</div>
      <form onSubmit={event => { event.preventDefault(); setAppliedQuery(query.trim()) }} style={{ display: 'flex', gap: 8, marginTop: 9 }}>
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search topic, outcome, strand, resource type…" style={{ flex: 1, minWidth: 0, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 11px', fontSize: 13 }} />
        <button type="submit" style={{ border: 0, borderRadius: 10, background: C.accent, color: '#fff', fontWeight: 850, padding: '0 13px' }}>Find</button>
      </form>
      <div style={{ color: C.textMuted, fontSize: 10, marginTop: 7 }}>Results are ranked by curriculum, subject, grade, certification and your current teaching context—not popularity.</div>
    </section>

    {actionMessage && <div role="status" style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857', borderRadius: 11, padding: 10, marginBottom: 10, fontSize: 12, fontWeight: 750 }}>{actionMessage}</div>}
    {actionError && <div role="alert" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: 11, padding: 10, marginBottom: 10, fontSize: 12 }}>{actionError}</div>}

    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 17 }}>Recommended for this class</h2>
        <div style={{ color: C.textMuted, fontSize: 11, marginTop: 2 }}>{workspace.resources.length} relevant resources</div>
      </div>
      {loading && <span style={{ fontSize: 10, color: C.textMuted }}>Refreshing…</span>}
    </div>

    {workspace.resources.length === 0 ? <div style={{ ...card, textAlign: 'center', padding: 28 }}>
      <strong>No authoritative match yet.</strong>
      <p style={{ color: C.textMuted, fontSize: 12, lineHeight: 1.6 }}>VibeLearn will not invent a resource. Try another search or create a resource in Content Studio.</p>
      <button type="button" onClick={() => router.push('/teacher/studio')} style={{ border: 0, borderRadius: 10, background: '#111827', color: '#fff', padding: '9px 12px', fontWeight: 800 }}>Open Content Studio</button>
    </div> : workspace.resources.map(resource => <article key={resource.id} style={{ ...card, marginBottom: 9 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 5 }}>
            <span style={tag}>{resourceTypeLabel(resource.assetKind, resource.sourceType)}</span>
            {resource.certified && <span style={{ ...tag, background: '#ecfdf5', color: '#047857' }}>VibeSchool certified</span>}
            {resource.adopted && <span style={{ ...tag, background: '#eef2ff', color: '#4338ca' }}>In this class</span>}
          </div>
          <h3 style={{ margin: 0, fontSize: 14, color: C.textPrimary }}>{resource.title}</h3>
          {resource.description && <p style={{ margin: '5px 0 0', color: C.textMuted, fontSize: 11, lineHeight: 1.55 }}>{resource.description}</p>}
          {resource.reasons.length > 0 && <div style={{ marginTop: 8, fontSize: 10, color: '#047857', lineHeight: 1.5 }}>{resource.reasons.slice(0, 3).join(' · ')}</div>}
        </div>
        {resource.href && <button type="button" onClick={() => router.push(resource.href!)} style={{ flexShrink: 0, border: `1px solid ${C.border}`, background: '#fff', borderRadius: 9, padding: '7px 9px', fontSize: 10, fontWeight: 850 }}>Preview</button>}
      </div>

      <div style={{ marginTop: 11, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
        {intentFor === resource.id ? <div>
          <div style={{ fontSize: 11, fontWeight: 850, marginBottom: 7 }}>How do you want to use this?</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 6 }}>
            {INTENTS.map(intent => <button key={intent.value} disabled={usingId === resource.id} type="button" onClick={() => void useResource(resource.id, intent.value)} style={{ border: `1px solid ${C.border}`, background: '#f8fafc', borderRadius: 10, padding: 9, textAlign: 'left' }}>
              <div style={{ fontSize: 11, fontWeight: 850, color: C.textPrimary }}>{intent.label}</div>
              <div style={{ fontSize: 9, color: C.textMuted, marginTop: 2, lineHeight: 1.4 }}>{intent.help}</div>
            </button>)}
          </div>
          <button type="button" onClick={() => setIntentFor(null)} style={{ border: 0, background: 'transparent', color: C.textMuted, marginTop: 8, fontSize: 10 }}>Cancel</button>
        </div> : <button type="button" onClick={() => setIntentFor(resource.id)} style={{ width: '100%', border: 0, background: resource.adopted ? '#f1f5f9' : '#047857', color: resource.adopted ? C.textPrimary : '#fff', borderRadius: 10, padding: 10, fontWeight: 850, fontSize: 11 }}>
          {resource.adopted ? 'Use this another way' : 'Use with this class'}
        </button>}
      </div>
    </article>)}
  </div>
}

function Metric({ value, label }: { value: number; label: string }) {
  return <div style={{ background: '#f8fafc', borderRadius: 10, padding: 9, textAlign: 'center' }}>
    <div style={{ fontSize: 18, fontWeight: 900, color: C.textPrimary }}>{value}</div>
    <div style={{ fontSize: 9, color: C.textMuted, marginTop: 2 }}>{label}</div>
  </div>
}

const card: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 16,
  padding: 14,
}

const eyebrow: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '.08em',
}

const tag: React.CSSProperties = {
  background: '#f1f5f9',
  color: '#475569',
  borderRadius: 999,
  padding: '3px 7px',
  fontSize: 9,
  fontWeight: 800,
  textTransform: 'capitalize',
}

const focusPill: React.CSSProperties = {
  display: 'inline-block',
  background: 'rgba(255,255,255,.11)',
  border: '1px solid rgba(255,255,255,.16)',
  borderRadius: 999,
  padding: '4px 8px',
  fontSize: 10,
  fontWeight: 750,
}
