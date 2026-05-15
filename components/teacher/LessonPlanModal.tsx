'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Modal, Btn, C } from '@/components/teacher/ui'
import type { TimetableSlot } from '@/lib/types'

interface PlanSections {
  objectives:      string
  introduction:    string
  development:     string
  consolidation:   string
  assessmentHook:  string
  homework:        string
  differentiation: string
}

interface Props {
  slot:    TimetableSlot
  onClose: () => void
}

const SECTION_LABELS: { key: keyof PlanSections; label: string }[] = [
  { key: 'objectives',     label: 'Learning Objectives'     },
  { key: 'introduction',   label: 'Introduction (5–7 min)'  },
  { key: 'development',    label: 'Development (20–25 min)' },
  { key: 'consolidation',  label: 'Consolidation (10 min)'  },
  { key: 'assessmentHook', label: 'Assessment Hook'         },
  { key: 'homework',       label: 'Homework'                },
  { key: 'differentiation',label: 'Differentiation'         },
]

const EMPTY: PlanSections = {
  objectives:      '',
  introduction:    '',
  development:     '',
  consolidation:   '',
  assessmentHook:  '',
  homework:        '',
  differentiation: '',
}

function parsePlan(raw: string): PlanSections {
  const get = (tag: string) => {
    const m = raw.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`))
    return m ? m[1].trim() : ''
  }
  return {
    objectives:      get('objectives'),
    introduction:    get('introduction'),
    development:     get('development'),
    consolidation:   get('consolidation'),
    assessmentHook:  get('assessmentHook'),
    homework:        get('homework'),
    differentiation: get('differentiation'),
  }
}

export default function LessonPlanModal({ slot, onClose }: Props) {
  const [phase,    setPhase]    = useState<'loading' | 'empty' | 'generating' | 'view' | 'edit'>('loading')
  const [sections, setSections] = useState<PlanSections>(EMPTY)
  const [draft,    setDraft]    = useState<PlanSections>(EMPTY)
  const [planId,   setPlanId]   = useState<string | null>(null)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [genText,  setGenText]  = useState('')

  // ── Load existing plan ────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const dow       = new Date().getDay()
      const d         = new Date()
      const diff      = d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1)
      const weekStart = new Date(d.setDate(diff)).toISOString().split('T')[0]

      const { data } = await supabase
        .from('lesson_plans')
        .select('id, title, body')
        .eq('teacher_id', user.id)
        .eq('class_id',   slot.id)
        .eq('day_of_week', dow)
        .eq('week_start',  weekStart)
        .maybeSingle()

      if (data?.body) {
        const parsed = parsePlan(data.body)
        // If body is structured XML use parsed, else put whole body in development
        const hasSections = data.body.includes('<objectives>')
        setSections(hasSections ? parsed : { ...EMPTY, development: data.body, objectives: data.title ?? '' })
        setPlanId(data.id)
        setPhase('view')
      } else {
        setPhase('empty')
      }
    }
    load()
  }, [slot.id])

  // ── Generate ──────────────────────────────────────────────────────────
  async function generate() {
    setPhase('generating')
    setGenText('')
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [profileRes, schoolRes] = await Promise.all([
        supabase.from('profiles').select('full_name, school_id').eq('id', user.id).single(),
        supabase.from('profiles').select('school_id').eq('id', user.id).single(),
      ])

      const schoolId = profileRes.data?.school_id
      const schoolName = schoolId
        ? (await supabase.from('schools').select('name').eq('id', schoolId).single()).data?.name ?? 'the school'
        : 'the school'

      const today = new Date().toLocaleDateString('en-KE', { weekday: 'long', month: 'long', day: 'numeric' })

      const prompt = `You are an expert Kenyan CBC curriculum lesson planner. Generate a complete, practical lesson plan for the following:

Subject: ${slot.subject}
Class: ${slot.class}
Duration: ${slot.start} – ${slot.end}
Room: ${slot.room || 'Standard classroom'}
School: ${schoolName}
Date: ${today}

Return the plan ONLY in this exact XML format with no other text:

<objectives>
List 2-3 clear, measurable learning objectives aligned to CBC competency-based outcomes.
</objectives>

<introduction>
A specific, engaging 5-7 minute hook activity relevant to Kenyan learners and this subject. Include exact teacher talk and student activity.
</introduction>

<development>
A detailed 20-25 minute main teaching sequence. Include specific activities, examples, and teacher moves. Reference CBC strands where relevant.
</development>

<consolidation>
A focused 10-minute consolidation activity that checks understanding. Be specific.
</consolidation>

<assessmentHook>
One specific formative assessment moment — what the teacher will look for and how to record it.
</assessmentHook>

<homework>
A specific, achievable homework task aligned to today's lesson.
</homework>

<differentiation>
Higher: specific extension task
On Track: core task description
Support: scaffolding strategy with specific accommodations
</differentiation>`

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model:      'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages:   [{ role: 'user', content: prompt }],
        }),
      })

      const data  = await response.json()
      const raw   = data.content?.[0]?.text ?? ''

      if (!raw) { setError('Generation failed. Try again.'); setPhase('empty'); return }

      setGenText(raw)
      const parsed = parsePlan(raw)
      setSections(parsed)

      // Save to Supabase
      const dow       = new Date().getDay()
      const d         = new Date()
      const diff      = d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1)
      const weekStart = new Date(d.setDate(diff)).toISOString().split('T')[0]

      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u) return

      const profileData = (await supabase.from('profiles').select('school_id').eq('id', u.id).single()).data

      const upsertPayload = {
        teacher_id:   u.id,
        school_id:    profileData?.school_id ?? null,
        class_id:     slot.id,
        subject_id:   null,
        week_start:   weekStart,
        day_of_week:  dow,
        title:        `${slot.subject} — ${slot.class}`,
        body:         raw,
        generated_by: 'twin',
      }

      if (planId) {
        await supabase.from('lesson_plans').update(upsertPayload).eq('id', planId)
      } else {
        const { data: inserted } = await supabase.from('lesson_plans').insert(upsertPayload).select('id').single()
        if (inserted?.id) setPlanId(inserted.id)
      }

      setPhase('view')
    } catch {
      setError('Something went wrong. Check your connection.')
      setPhase('empty')
    }
  }

  // ── Save edits ────────────────────────────────────────────────────────
  async function saveEdit() {
    setSaving(true)
    const newBody = SECTION_LABELS.map(s => `<${s.key}>\n${draft[s.key]}\n</${s.key}>`).join('\n\n')

    if (planId) {
      await supabase.from('lesson_plans').update({ body: newBody, title: `${slot.subject} — ${slot.class}` }).eq('id', planId)
    }

    setSections(draft)
    setSaving(false)
    setPhase('view')
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <Modal open onClose={onClose} title={`${slot.subject} · ${slot.class}`}>

      {/* Loading */}
      {phase === 'loading' && (
        <div style={{ padding: '32px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: `3px solid ${C.accent}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
          <p style={{ fontSize: 13, color: C.textMuted }}>Checking for saved plan…</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      )}

      {/* No plan yet */}
      {phase === 'empty' && (
        <div style={{ padding: '16px 0' }}>
          <div style={{ textAlign: 'center', padding: '20px 0 24px' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
            <p style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary, marginBottom: 6 }}>No plan yet for this slot</p>
            <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 20 }}>
              Generate a full CBC-aligned lesson plan in seconds using your Twin.
            </p>
            {error && <p style={{ fontSize: 12, color: C.error, marginBottom: 12 }}>{error}</p>}
            <Btn onClick={generate}>✦ Generate with Twin</Btn>
          </div>
        </div>
      )}

      {/* Generating */}
      {phase === 'generating' && (
        <div style={{ padding: '32px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(16,185,129,0.12)', border: '1.5px solid rgba(16,185,129,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: C.accent }}>✦</div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary, textAlign: 'center' }}>Your Twin is generating…</p>
            <p style={{ fontSize: 12, color: C.textMuted, textAlign: 'center', marginTop: 4 }}>
              Building a CBC-aligned plan for {slot.subject} · {slot.class}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[0, 0.2, 0.4].map(d => (
              <span key={d} style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: C.accent, animation: `twinPulse 1.4s ease-in-out ${d}s infinite` }} />
            ))}
          </div>
          <style>{`@keyframes twinPulse { 0%,80%,100%{ transform:scale(0.7); opacity:0.5 } 40%{ transform:scale(1); opacity:1 } }`}</style>
        </div>
      )}

      {/* View plan */}
      {phase === 'view' && (
        <div>
          <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: C.accent }}>✦</span> Generated by Twin · CBC aligned
          </div>

          {SECTION_LABELS.map(s => (
            sections[s.key] ? (
              <div key={s.key} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: C.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 }}>
                  {s.label}
                </div>
                <div style={{ fontSize: 13, color: C.textPrimary, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                  {sections[s.key]}
                </div>
              </div>
            ) : null
          ))}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
            <Btn variant="ghost" onClick={() => { setDraft({ ...sections }); setPhase('edit') }}>Edit</Btn>
            <Btn variant="ghost" onClick={generate}>Regenerate</Btn>
            <Btn variant="ghost" onClick={onClose}>Close</Btn>
          </div>
        </div>
      )}

      {/* Edit plan */}
      {phase === 'edit' && (
        <div>
          <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 14 }}>
            Edit any section then save.
          </div>

          {SECTION_LABELS.map(s => (
            <div key={s.key} style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 10, fontWeight: 800, color: C.textMuted, letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
                {s.label}
              </label>
              <textarea
                value={draft[s.key]}
                onChange={e => setDraft(d => ({ ...d, [s.key]: e.target.value }))}
                rows={4}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 13, color: C.textPrimary, fontFamily: 'inherit', lineHeight: 1.6, resize: 'vertical', outline: 'none', background: '#f9fafb', boxSizing: 'border-box' }}
              />
            </div>
          ))}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
            <Btn variant="ghost" onClick={() => setPhase('view')}>Cancel</Btn>
            <Btn onClick={saveEdit} disabled={saving}>{saving ? 'Saving…' : 'Save Plan'}</Btn>
          </div>
        </div>
      )}

    </Modal>
  )
}
