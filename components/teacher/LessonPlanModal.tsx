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
  { key: 'objectives',      label: 'Learning Objectives'     },
  { key: 'introduction',    label: 'Introduction (5–7 min)'  },
  { key: 'development',     label: 'Development (20–25 min)' },
  { key: 'consolidation',   label: 'Consolidation (10 min)'  },
  { key: 'assessmentHook',  label: 'Assessment Hook'         },
  { key: 'homework',        label: 'Homework'                },
  { key: 'differentiation', label: 'Differentiation'         },
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

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const d         = new Date()
      const dow       = d.getDay()
      const diff      = d.getDate() - dow + (dow === 0 ? -6 : 1)
      const weekStart = new Date(new Date(d).setDate(diff)).toISOString().split('T')[0]

      const { data } = await supabase
        .from('lesson_plans')
        .select('id, title, body')
        .eq('teacher_id', user.id)
        .eq('day_of_week', dow)
        .eq('week_start',  weekStart)
        .maybeSingle()

      if (data?.body) {
        const hasSections = data.body.includes('<objectives>')
        setSections(hasSections ? parsePlan(data.body) : { ...EMPTY, development: data.body, objectives: data.title ?? '' })
        setPlanId(data.id)
        setPhase('view')
      } else {
        setPhase('empty')
      }
    }
    load()
  }, [slot.id])

  async function generate() {
    setPhase('generating')
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const profileData = (await supabase.from('profiles').select('full_name, school_id').eq('id', user.id).single()).data
      const schoolName  = profileData?.school_id
        ? ((await supabase.from('schools').select('name').eq('id', profileData.school_id).single()).data?.name ?? 'the school')
        : 'the school'

      const today = new Date().toLocaleDateString('en-KE', { weekday: 'long', month: 'long', day: 'numeric' })

      const prompt = `You are an expert Kenyan CBC curriculum lesson planner. Generate a complete, practical lesson plan.

Subject: ${slot.subject}
Class: ${slot.class}
Duration: ${slot.start} to ${slot.end}
Room: ${slot.room || 'Standard classroom'}
School: ${schoolName}
Date: ${today}

Return ONLY this exact XML with no other text before or after:

<objectives>
2-3 clear measurable learning objectives aligned to CBC competency-based outcomes.
</objectives>

<introduction>
Specific engaging 5-7 minute hook relevant to Kenyan learners. Include exact teacher talk and student activity.
</introduction>

<development>
Detailed 20-25 minute main teaching sequence. Specific activities, examples, teacher moves. Reference CBC strands.
</development>

<consolidation>
Focused 10-minute consolidation that checks understanding. Be specific.
</consolidation>

<assessmentHook>
One specific formative assessment moment and how to record it.
</assessmentHook>

<homework>
Specific achievable homework task aligned to today's lesson.
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

      const json = await response.json()
      const raw  = json.content?.[0]?.text ?? ''
      if (!raw) { setError('Generation failed. Try again.'); setPhase('empty'); return }

      const parsed = parsePlan(raw)
      setSections(parsed)

      const d         = new Date()
      const dow       = d.getDay()
      const diff      = d.getDate() - dow + (dow === 0 ? -6 : 1)
      const weekStart = new Date(new Date(d).setDate(diff)).toISOString().split('T')[0]

      const payload = {
        teacher_id:   user.id,
        school_id:    profileData?.school_id ?? null,
        class_id:     slot.id,
        subject_id:   null as string | null,
        week_start:   weekStart,
        day_of_week:  dow,
        title:        `${slot.subject} — ${slot.class}`,
        body:         raw,
        generated_by: 'twin',
      }

      if (planId) {
        await supabase.from('lesson_plans').update(payload).eq('id', planId)
      } else {
        const { data: ins } = await supabase.from('lesson_plans').insert(payload).select('id').single()
        if (ins?.id) setPlanId(ins.id)
      }

      setPhase('view')
    } catch {
      setError('Something went wrong. Check your connection.')
      setPhase('empty')
    }
  }

  async function saveEdit() {
    setSaving(true)
    const newBody = SECTION_LABELS
      .map(s => `<${s.key}>\n${draft[s.key]}\n</${s.key}>`)
      .join('\n\n')
    if (planId) {
      await supabase.from('lesson_plans')
        .update({ body: newBody, title: `${slot.subject} — ${slot.class}` })
        .eq('id', planId)
    }
    setSections(draft)
    setSaving(false)
    setPhase('view')
  }

  return (
    <Modal open onClose={onClose} title={`${slot.subject} · ${slot.class}`}>

      {phase === 'loading' && (
        <div style={{ padding: '32px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: `3px solid ${C.accent}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
          <p style={{ fontSize: 13, color: C.textMuted }}>Checking for saved plan…</p>
        </div>
      )}

      {phase === 'empty' && (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
          <p style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary, marginBottom: 6 }}>No plan yet for this slot</p>
          <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 20 }}>
            Generate a full CBC-aligned lesson plan in seconds.
          </p>
          {error && <p style={{ fontSize: 12, color: C.error, marginBottom: 12 }}>{error}</p>}
          <Btn onClick={generate}>✦ Generate with Twin</Btn>
        </div>
      )}

      {phase === 'generating' && (
        <div style={{ padding: '32px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <style>{`@keyframes twinPulse { 0%,80%,100%{ transform:scale(0.7); opacity:0.5 } 40%{ transform:scale(1); opacity:1 } }`}</style>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(16,185,129,0.12)', border: '1.5px solid rgba(16,185,129,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: C.accent }}>✦</div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>Your Twin is generating…</p>
            <p style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>Building a CBC-aligned plan for {slot.subject} · {slot.class}</p>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[0, 0.2, 0.4].map(d => (
              <span key={d} style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: C.accent, animation: `twinPulse 1.4s ease-in-out ${d}s infinite` }} />
            ))}
          </div>
        </div>
      )}

      {phase === 'view' && (
        <div>
          <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: C.accent }}>✦</span> Generated by Twin · CBC aligned
          </div>
          {SECTION_LABELS.map(s => sections[s.key] ? (
            <div key={s.key} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: C.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 }}>{s.label}</div>
              <div style={{ fontSize: 13, color: C.textPrimary, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{sections[s.key]}</div>
            </div>
          ) : null)}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
            <Btn variant="ghost" onClick={() => { setDraft({ ...sections }); setPhase('edit') }}>Edit</Btn>
            <Btn variant="ghost" onClick={generate}>Regenerate</Btn>
            <Btn variant="ghost" onClick={onClose}>Close</Btn>
          </div>
        </div>
      )}

      {phase === 'edit' && (
        <div>
          <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 14 }}>Edit any section then save.</div>
          {SECTION_LABELS.map(s => (
            <div key={s.key} style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 10, fontWeight: 800, color: C.textMuted, letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>{s.label}</label>
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
