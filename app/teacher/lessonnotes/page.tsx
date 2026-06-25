"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { C } from '@/components/teacher/ui'

interface PlanOption {
  id: string
  title: string
  topic: string
  taught_date_hint: string
  class_id: string | null
  subject_id: string | null
  term: number | null
}

interface NoteRow {
  id: string
  lesson_plan_id: string | null
  taught_date: string
  what_was_taught: string
  participation_score: number | null
  challenges: string | null
  homework_set: string | null
  plan_title: string | null
  plan_topic: string | null
}

type ViewState = 'list' | 'new' | 'view'

function Skeleton({ h = 56, w = '100%' }: { h?: number; w?: string }) {
  return (
    <div style={{
      height: h, width: w, borderRadius: 12, flexShrink: 0,
      background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
    }} />
  )
}

function participationLabel(score: number | null): string {
  if (!score) return '—'
  const map: Record<number, string> = { 1:'Very Low', 2:'Low', 3:'Average', 4:'Good', 5:'Excellent' }
  return map[score] ?? '—'
}

function participationColor(score: number | null): string {
  if (!score) return C.textMuted
  if (score >= 4) return '#065f46'
  if (score === 3) return '#92400e'
  return '#991b1b'
}

function formatDate(d: string): string {
  const dt = new Date(d + 'T12:00:00')
  return dt.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function LessonNotesPage() {
  const router = useRouter()

  const [view,          setView]          = useState<ViewState>('list')
  const [loading,       setLoading]       = useState(true)
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState<string | null>(null)
  const [teacherId,     setTeacherId]     = useState<string | null>(null)
  const [notes,         setNotes]         = useState<NoteRow[]>([])
  const [activeNote,    setActiveNote]    = useState<NoteRow | null>(null)
  const [plans,         setPlans]         = useState<PlanOption[]>([])
  const [plansLoading,  setPlansLoading]  = useState(false)
  const [selectedPlan,  setSelectedPlan]  = useState<string>('')
  const [taughtDate,    setTaughtDate]    = useState<string>(new Date().toISOString().slice(0, 10))
  const [whatTaught,    setWhatTaught]    = useState<string>('')
  const [participation, setParticipation] = useState<number>(3)
  const [challenges,    setChallenges]    = useState<string>('')
  const [homework,      setHomework]      = useState<string>('')
  const [strandOptions, setStrandOptions] = useState<string[]>([])
  const [selectedStrand, setSelectedStrand] = useState<string>('')

  useEffect(() => { init() }, [])

  async function init() {
    setLoading(true)
    setError(null)
    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser()
      if (authErr || !user) { router.push('/?role=teacher'); return }
      setTeacherId(user.id)

      const { data: noteRows, error: noteErr } = await supabase
        .from('lesson_notes')
        .select('id, lesson_plan_id, taught_date, what_was_taught, participation_score, challenges, homework_set')
        .eq('teacher_id', user.id)
        .order('taught_date', { ascending: false })
        .limit(50)

      if (noteErr) { setError(noteErr.message); setLoading(false); return }

      const noteList = noteRows ?? []

      const planIds = Array.from(new Set(
        noteList.filter(n => n.lesson_plan_id).map(n => n.lesson_plan_id as string)
      ))

      const planMap: Record<string, { title: string; topic: string }> = {}
      if (planIds.length > 0) {
        const { data: planRows } = await supabase
          .from('lesson_plans')
          .select('id, title, topic')
          .in('id', planIds)
        for (const p of (planRows ?? [])) {
          planMap[p.id] = { title: p.title, topic: p.topic }
        }
      }

      const enriched: NoteRow[] = noteList.map(n => ({
        ...n,
        plan_title: n.lesson_plan_id ? (planMap[n.lesson_plan_id]?.title ?? null) : null,
        plan_topic: n.lesson_plan_id ? (planMap[n.lesson_plan_id]?.topic ?? null) : null,
      }))

      setNotes(enriched)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load notes')
    } finally {
      setLoading(false)
    }
  }

  async function openNew() {
    setView('new')
    setSelectedPlan('')
    setTaughtDate(new Date().toISOString().slice(0, 10))
    setWhatTaught('')
    setParticipation(3)
    setChallenges('')
    setHomework('')
    setSelectedStrand('')
    setStrandOptions([])
    setError(null)
    if (!teacherId) return
    setPlansLoading(true)
    const { data: planRows } = await supabase
      .from('lesson_plans')
      .select('id, title, topic, week_start, class_id, subject_id, term')
      .eq('teacher_id', teacherId)
      .order('week_start', { ascending: false })
      .limit(30)
    setPlans((planRows ?? []).map(p => ({
      id: p.id,
      title: p.title ?? 'Untitled Plan',
      topic: p.topic ?? '',
      taught_date_hint: p.week_start ?? '',
      class_id: p.class_id,
      subject_id: p.subject_id,
      term: p.term,
    })))
    setPlansLoading(false)
  }

  async function loadStrandsForSubject(subjectId: string) {
    if (!subjectId) { setStrandOptions([]); return }
    const { data } = await supabase
      .from('learner_outcomes')
      .select('strand')
      .eq('subject_id', subjectId)
    if (data && data.length > 0) {
      const unique = Array.from(new Set(data.map((r: { strand: string }) => r.strand).filter(Boolean)))
      setStrandOptions(unique as string[])
    } else {
      setStrandOptions([])
    }
  }

  async function saveNote() {
    if (!whatTaught.trim()) { setError('Please describe what was taught.'); return }
    if (!teacherId) return
    setSaving(true)
    setError(null)
    const linkedPlan = plans.find(p => p.id === selectedPlan)
    const payload = {
      teacher_id:          teacherId,
      lesson_plan_id:      selectedPlan || null,
      class_id:            linkedPlan?.class_id ?? null,
      subject_id:          linkedPlan?.subject_id ?? null,
      taught_date:         taughtDate,
      what_was_taught:     whatTaught.trim(),
      participation_score: participation,
      challenges:          challenges.trim() || null,
      homework_set:        homework.trim() || null,
    }
    const { error: insertErr } = await supabase.from('lesson_notes').insert(payload)
    setSaving(false)
    if (insertErr) { setError(insertErr.message); return }

    // Session 6 — mark outcomes as covered for this strand
    const subjectId = linkedPlan?.subject_id ?? null
    if (subjectId && selectedStrand) {
      await supabase
        .from('learner_outcomes')
        .update({ status: 'assessed' })
        .eq('subject_id', subjectId)
        .eq('strand', selectedStrand)
        .eq('status', 'not_started')
    }

    setView('list')
    init()
  }

  function openNote(note: NoteRow) { setActiveNote(note); setView('view') }

  if (view === 'list') {
    return (
      <div style={{ paddingBottom: 100 }}>
        <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
        <div style={{ background:'linear-gradient(135deg,#065f46 0%,#10b981 100%)', padding:'20px 16px 24px' }}>
          <div style={{ fontSize:22, fontWeight:900, color:'#fff', marginBottom:4 }}>Lesson Notes</div>
          <div style={{ fontSize:13, color:'rgba(255,255,255,0.75)', fontWeight:500 }}>Record what was actually delivered in class</div>
        </div>
        {error && <div style={{ margin:'12px 16px', padding:'10px 14px', borderRadius:10, background:'#fef2f2', color:'#991b1b', fontSize:13 }}>{error}</div>}
        {loading && <div style={{ padding:'16px', display:'flex', flexDirection:'column', gap:10 }}>{[1,2,3].map(i=><Skeleton key={i} h={80}/>)}</div>}
        {!loading && notes.length === 0 && (
          <div style={{ padding:'60px 24px', textAlign:'center' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>📝</div>
            <div style={{ fontSize:16, fontWeight:800, color:'#111827', marginBottom:6 }}>No lesson notes yet</div>
            <div style={{ fontSize:13, color:'#6b7280', marginBottom:24, lineHeight:1.6 }}>Record what you actually taught so your delivery matches your plans.</div>
            <button onClick={openNew} style={{ padding:'14px 32px', borderRadius:14, border:'none', background:'linear-gradient(135deg,#065f46 0%,#10b981 100%)', color:'#fff', fontSize:15, fontWeight:800, cursor:'pointer', fontFamily:'inherit' }}>+ Add First Note</button>
          </div>
        )}
        {!loading && notes.length > 0 && (
          <div style={{ padding:'14px 16px 0', display:'flex', flexDirection:'column', gap:10 }}>
            {notes.map(note => (
              <div key={note.id} onClick={()=>openNote(note)} style={{ background:'#fff', borderRadius:16, padding:'14px 16px', boxShadow:'0 1px 4px rgba(0,0,0,0.06)', cursor:'pointer', border:'1px solid #e5e7eb' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                  <div style={{ fontSize:13, fontWeight:800, color:'#111827', flex:1, marginRight:8 }}>{note.plan_topic || note.plan_title || 'Standalone Note'}</div>
                  <div style={{ fontSize:11, color:'#6b7280', whiteSpace:'nowrap', flexShrink:0 }}>{formatDate(note.taught_date)}</div>
                </div>
                <div style={{ fontSize:12, color:'#6b7280', lineHeight:1.5, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{note.what_was_taught}</div>
                <div style={{ display:'flex', gap:8, marginTop:8, alignItems:'center' }}>
                  {note.participation_score && <span style={{ fontSize:11, fontWeight:700, padding:'3px 8px', borderRadius:20, background:'#f3f4f6', color:participationColor(note.participation_score) }}>{participationLabel(note.participation_score)} participation</span>}
                  {note.homework_set && <span style={{ fontSize:11, color:'#1d4ed8', fontWeight:600 }}>📚 HW set</span>}
                  {note.challenges && <span style={{ fontSize:11, color:'#92400e', fontWeight:600 }}>⚠️ Noted</span>}
                </div>
              </div>
            ))}
          </div>
        )}
        {!loading && (
          <button onClick={openNew} style={{ position:'fixed', bottom:90, right:20, width:56, height:56, borderRadius:'50%', background:'linear-gradient(135deg,#065f46 0%,#10b981 100%)', color:'#fff', border:'none', fontSize:26, cursor:'pointer', boxShadow:'0 4px 16px rgba(16,185,129,0.45)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'inherit', zIndex:50 }}>+</button>
        )}
      </div>
    )
  }

  if (view === 'new') {
    return (
      <div style={{ paddingBottom:120 }}>
        <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'16px 16px 12px', borderBottom:'1px solid #e5e7eb', background:'#fff' }}>
          <button onClick={()=>{setView('list');setError(null)}} style={{ width:36, height:36, borderRadius:10, border:'1px solid #e5e7eb', background:'#f9fafb', cursor:'pointer', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'inherit', flexShrink:0 }}>←</button>
          <div style={{ fontSize:17, fontWeight:800, color:'#111827' }}>New Lesson Note</div>
        </div>
        <div style={{ padding:'16px' }}>
          {error && <div style={{ marginBottom:12, padding:'10px 14px', borderRadius:10, background:'#fef2f2', color:'#991b1b', fontSize:13 }}>{error}</div>}
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:11, fontWeight:800, color:'#6b7280', letterSpacing:1.2, textTransform:'uppercase', marginBottom:6 }}>Link to Lesson Plan <span style={{ fontWeight:400 }}>(optional)</span></div>
            {plansLoading ? <Skeleton h={44}/> : (
              <select value={selectedPlan} onChange={e=>{ setSelectedPlan(e.target.value); const p = plans.find(x=>x.id===e.target.value); if(p?.subject_id) loadStrandsForSubject(p.subject_id); else setStrandOptions([]) }} style={{ width:'100%', boxSizing:'border-box', padding:'11px 14px', borderRadius:10, border:'1px solid #e5e7eb', fontSize:14, fontFamily:'inherit', background:'#fff', color:'#111827' }}>
                <option value="">— No linked plan —</option>
                {plans.map(p=><option key={p.id} value={p.id}>{p.topic?`${p.topic} — `:''}{p.title}{p.taught_date_hint?` (${p.taught_date_hint})`:''}</option>)}
              </select>
            )}
          </div>
          {strandOptions.length > 0 && (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:11, fontWeight:800, color:'#6b7280', letterSpacing:1.2, textTransform:'uppercase', marginBottom:6 }}>Strand Covered <span style={{ fontWeight:400 }}>(optional)</span></div>
              <select value={selectedStrand} onChange={e => setSelectedStrand(e.target.value)} style={{ width:'100%', boxSizing:'border-box', padding:'11px 14px', borderRadius:10, border:'1px solid #e5e7eb', fontSize:14, fontFamily:'inherit', background:'#fff', color:'#111827' }}>
                <option value="">— Select strand covered —</option>
                {strandOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}

          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:11, fontWeight:800, color:'#6b7280', letterSpacing:1.2, textTransform:'uppercase', marginBottom:6 }}>Date Taught</div>
            <input type="date" value={taughtDate} onChange={e=>setTaughtDate(e.target.value)} style={{ width:'100%', boxSizing:'border-box', padding:'11px 14px', borderRadius:10, border:'1px solid #e5e7eb', fontSize:14, fontFamily:'inherit', background:'#fff', color:'#111827' }}/>
          </div>
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:11, fontWeight:800, color:'#6b7280', letterSpacing:1.2, textTransform:'uppercase', marginBottom:6 }}>What Was Taught <span style={{ color:'#991b1b' }}>*</span></div>
            <textarea value={whatTaught} onChange={e=>setWhatTaught(e.target.value)} placeholder="Describe what was actually covered in the lesson..." rows={4} style={{ width:'100%', boxSizing:'border-box', padding:'11px 14px', borderRadius:10, border:'1px solid #e5e7eb', fontSize:14, fontFamily:'inherit', background:'#fff', color:'#111827', resize:'vertical', lineHeight:1.6, outline:'none' }}/>
          </div>
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:11, fontWeight:800, color:'#6b7280', letterSpacing:1.2, textTransform:'uppercase', marginBottom:6 }}>Learner Participation</div>
            <div style={{ display:'flex', gap:8 }}>
              {[1,2,3,4,5].map(score=>(
                <button key={score} onClick={()=>setParticipation(score)} style={{ flex:1, padding:'10px 4px', borderRadius:10, border:'none', cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:800, background:participation===score?(score>=4?'#d1fae5':score===3?'#fef3c7':'#fee2e2'):'#f3f4f6', color:participation===score?participationColor(score):'#6b7280', outline:participation===score?`2px solid ${participationColor(score)}`:'none' }}>{score}</button>
              ))}
            </div>
            <div style={{ fontSize:12, color:participationColor(participation), fontWeight:700, marginTop:6, textAlign:'center' }}>{participationLabel(participation)}</div>
          </div>
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:11, fontWeight:800, color:'#6b7280', letterSpacing:1.2, textTransform:'uppercase', marginBottom:6 }}>Challenges Observed <span style={{ fontWeight:400 }}>(optional)</span></div>
            <textarea value={challenges} onChange={e=>setChallenges(e.target.value)} placeholder="Any difficulties learners faced, misconceptions noticed..." rows={3} style={{ width:'100%', boxSizing:'border-box', padding:'11px 14px', borderRadius:10, border:'1px solid #e5e7eb', fontSize:14, fontFamily:'inherit', background:'#fff', color:'#111827', resize:'vertical', lineHeight:1.6, outline:'none' }}/>
          </div>
          <div style={{ marginBottom:24 }}>
            <div style={{ fontSize:11, fontWeight:800, color:'#6b7280', letterSpacing:1.2, textTransform:'uppercase', marginBottom:6 }}>Homework Set <span style={{ fontWeight:400 }}>(optional)</span></div>
            <textarea value={homework} onChange={e=>setHomework(e.target.value)} placeholder="What homework or follow-up was assigned..." rows={2} style={{ width:'100%', boxSizing:'border-box', padding:'11px 14px', borderRadius:10, border:'1px solid #e5e7eb', fontSize:14, fontFamily:'inherit', background:'#fff', color:'#111827', resize:'vertical', lineHeight:1.6, outline:'none' }}/>
          </div>
        </div>
        <div style={{ position:'fixed', bottom:0, left:0, right:0, padding:'12px 16px', paddingBottom:'max(16px,env(safe-area-inset-bottom,16px))', background:'#fff', borderTop:'1px solid #e5e7eb', zIndex:50 }}>
          <button onClick={saveNote} disabled={saving||!whatTaught.trim()} style={{ width:'100%', padding:'14px', borderRadius:12, border:'none', background:saving||!whatTaught.trim()?'#9ca3af':'linear-gradient(135deg,#065f46 0%,#10b981 100%)', color:'#fff', fontSize:15, fontWeight:800, cursor:saving||!whatTaught.trim()?'not-allowed':'pointer', fontFamily:'inherit' }}>{saving?'Saving…':'Save Note'}</button>
        </div>
      </div>
    )
  }

  if (view === 'view' && activeNote) {
    return (
      <div style={{ paddingBottom:100 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'16px 16px 12px', borderBottom:'1px solid #e5e7eb', background:'#fff' }}>
          <button onClick={()=>{setView('list');setActiveNote(null)}} style={{ width:36, height:36, borderRadius:10, border:'1px solid #e5e7eb', background:'#f9fafb', cursor:'pointer', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'inherit', flexShrink:0 }}>←</button>
          <div>
            <div style={{ fontSize:16, fontWeight:800, color:'#111827' }}>{activeNote.plan_topic||activeNote.plan_title||'Lesson Note'}</div>
            <div style={{ fontSize:12, color:'#6b7280' }}>{formatDate(activeNote.taught_date)}</div>
          </div>
        </div>
        <div style={{ padding:'16px', display:'flex', flexDirection:'column', gap:12 }}>
          {activeNote.plan_title && (
            <div style={{ background:'#ede9fe', borderRadius:12, padding:'12px 14px' }}>
              <div style={{ fontSize:10, fontWeight:800, color:'#6d28d9', letterSpacing:1.2, textTransform:'uppercase', marginBottom:4 }}>Linked Plan</div>
              <div style={{ fontSize:13, fontWeight:700, color:'#4c1d95' }}>{activeNote.plan_topic?`${activeNote.plan_topic} — `:''}{activeNote.plan_title}</div>
            </div>
          )}
          <div style={{ background:'#fff', borderRadius:16, padding:'14px 16px', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize:10, fontWeight:800, color:'#6b7280', letterSpacing:1.2, textTransform:'uppercase', marginBottom:8 }}>What Was Taught</div>
            <div style={{ fontSize:14, color:'#111827', lineHeight:1.7 }}>{activeNote.what_was_taught}</div>
          </div>
          <div style={{ background:'#fff', borderRadius:16, padding:'14px 16px', boxShadow:'0 1px 4px rgba(0,0,0,0.06)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#111827' }}>Learner Participation</div>
            <div style={{ fontSize:13, fontWeight:800, padding:'5px 12px', borderRadius:20, color:participationColor(activeNote.participation_score), background:activeNote.participation_score&&activeNote.participation_score>=4?'#d1fae5':activeNote.participation_score===3?'#fef3c7':'#fee2e2' }}>{participationLabel(activeNote.participation_score)}</div>
          </div>
          {activeNote.challenges && (
            <div style={{ background:'#fffbeb', borderRadius:16, padding:'14px 16px', boxShadow:'0 1px 4px rgba(0,0,0,0.06)', borderLeft:'4px solid #f59e0b' }}>
              <div style={{ fontSize:10, fontWeight:800, color:'#92400e', letterSpacing:1.2, textTransform:'uppercase', marginBottom:8 }}>⚠️ Challenges Observed</div>
              <div style={{ fontSize:14, color:'#78350f', lineHeight:1.7 }}>{activeNote.challenges}</div>
            </div>
          )}
          {activeNote.homework_set && (
            <div style={{ background:'#eff6ff', borderRadius:16, padding:'14px 16px', boxShadow:'0 1px 4px rgba(0,0,0,0.06)', borderLeft:'4px solid #3b82f6' }}>
              <div style={{ fontSize:10, fontWeight:800, color:'#1d4ed8', letterSpacing:1.2, textTransform:'uppercase', marginBottom:8 }}>📚 Homework Set</div>
              <div style={{ fontSize:14, color:'#1e3a8a', lineHeight:1.7 }}>{activeNote.homework_set}</div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return null
}
