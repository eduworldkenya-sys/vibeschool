"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const dark   = '#1e1b4b'
const accent = '#6366f1'

interface HWItem {
  id: string
  title: string
  subject: string
  due_date: string
  type: string
  submitted: boolean
  mark: number | null
  feedback: string | null
}

interface LessonItem {
  id: string
  title: string
  subject: string
  day: number
  student_copy: string
  content_type: string
}

interface AssessmentItem {
  id: string
  subject_id: string
  subjectName: string
  sub_strand: string
  assessment_type: string
  performance: string
  term: number
  academic_year: number
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Morning'
  if (h < 17) return 'Afternoon'
  return 'Evening'
}

function daysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0,0,0,0)
  const due   = new Date(dateStr); due.setHours(0,0,0,0)
  return Math.round((due.getTime() - today.getTime()) / 86400000)
}

function dueBadge(dateStr: string, submitted: boolean) {
  if (submitted) return { label: 'Submitted', bg: '#d1fae5', text: '#065f46' }
  const d = daysUntil(dateStr)
  if (d < 0)   return { label: 'Overdue',   bg: '#fee2e2', text: '#991b1b' }
  if (d === 0) return { label: 'Due Today', bg: '#fef3c7', text: '#92400e' }
  return { label: `Due in ${d}d`, bg: '#e0f2fe', text: '#075985' }
}

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function Skeleton({ h = 56, radius = 12 }: { h?: number; radius?: number }) {
  return (
    <div style={{
      height: h, borderRadius: radius,
      background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)',
      backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite',
    }} />
  )
}

function Section({ title, emoji, children }: { title: string; emoji: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: dark, letterSpacing: 0.5, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>{emoji}</span>{title.toUpperCase()}
      </div>
      {children}
    </div>
  )
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '24px 16px', textAlign: 'center' }}>
      <div style={{ fontSize: 13, color: '#9ca3af' }}>{msg}</div>
    </div>
  )
}

export default function LearnPage() {
  const router = useRouter()
  const [loading,     setLoading]     = useState(true)
  const [firstName,   setFirstName]   = useState('')
  const [homework,    setHomework]    = useState<HWItem[]>([])
  const [lessons,     setLessons]     = useState<LessonItem[]>([])
  const [assessments, setAssessments] = useState<AssessmentItem[]>([])
  const [activeTab,   setActiveTab]   = useState<'assignments'|'lessons'|'assessments'|'papers'>('assignments')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/academy/signin?role=student'); return }

      const [profileRes, studentRes] = await Promise.all([
        supabase.from('profiles').select('full_name').eq('id', user.id).single(),
        supabase.from('students').select('id, class_id').eq('profile_id', user.id).single(),
      ])

      const name = profileRes.data?.full_name ?? ''
      setFirstName(name.split(' ')[0] || 'Student')

      const student = studentRes.data
      if (!student) { router.push('/student/claim'); return }

      const classId   = student.class_id
      const studentId = student.id

      const [hwRes, subRes, planRes, assessRes] = await Promise.all([
        supabase.from('homework').select('id,title,subject,due_date,type').eq('class_id', classId).order('due_date', { ascending: true }),
        supabase.from('homework_submissions').select('homework_id,status,mark,feedback').eq('student_id', studentId),
        supabase.from('lesson_plans').select('id,title,subject_id,day_of_week').eq('class_id', classId).order('day_of_week', { ascending: false }).limit(20),
        supabase.from('cbc_assessments').select('id,subject_id,sub_strand,assessment_type,performance,term,academic_year').eq('student_id', studentId).order('created_at', { ascending: false }),
      ])

      const subMap = new Map<string, { submitted: boolean; mark: number | null; feedback: string | null }>()
      for (const s of subRes.data ?? []) {
        subMap.set(s.homework_id, { submitted: true, mark: s.mark ?? null, feedback: s.feedback ?? null })
      }

      const hwItems: HWItem[] = (hwRes.data ?? []).map(h => ({
        id:        h.id,
        title:     h.title,
        subject:   h.subject,
        due_date:  h.due_date,
        type:      h.type,
        submitted: subMap.has(h.id),
        mark:      subMap.get(h.id)?.mark ?? null,
        feedback:  subMap.get(h.id)?.feedback ?? null,
      }))
      setHomework(hwItems)

      const planIds = (planRes.data ?? []).map(p => p.id)
      let contentData: { lesson_plan_id: string; student_copy: string; content_type: string }[] = []
      if (planIds.length > 0) {
        const { data } = await supabase
          .from('lesson_content')
          .select('lesson_plan_id,student_copy,content_type')
          .in('lesson_plan_id', planIds)
        contentData = data ?? []
      }

      const contentMap = new Map<string, { student_copy: string; content_type: string }>()
      for (const c of contentData) {
        contentMap.set(c.lesson_plan_id, { student_copy: c.student_copy, content_type: c.content_type })
      }

      const subjectIds = Array.from(new Set((planRes.data ?? []).map(p => p.subject_id).filter(Boolean))) as string[]
      let subjectMap: Record<string, string> = {}
      if (subjectIds.length > 0) {
        const { data: subjects } = await supabase.from('subjects').select('id,name').in('id', subjectIds)
        subjectMap = Object.fromEntries((subjects ?? []).map(s => [s.id, s.name]))
      }

      const lessonItems: LessonItem[] = (planRes.data ?? [])
        .filter(p => contentMap.has(p.id))
        .map(p => ({
          id:           p.id,
          title:        p.title,
          subject:      subjectMap[p.subject_id] ?? 'Lesson',
          day:          p.day_of_week,
          student_copy: contentMap.get(p.id)!.student_copy,
          content_type: contentMap.get(p.id)!.content_type,
        }))
      setLessons(lessonItems)

      const aSubjectIds = Array.from(new Set((assessRes.data ?? []).map(a => a.subject_id).filter(Boolean))) as string[]
      let aSubjectMap: Record<string, string> = {}
      if (aSubjectIds.length > 0) {
        const { data: aSubjects } = await supabase.from('subjects').select('id,name').in('id', aSubjectIds)
        aSubjectMap = Object.fromEntries((aSubjects ?? []).map(s => [s.id, s.name]))
      }

      const assessItems: AssessmentItem[] = (assessRes.data ?? []).map(a => ({
        id:              a.id,
        subject_id:      a.subject_id,
        subjectName:     aSubjectMap[a.subject_id] ?? 'Subject',
        sub_strand:      a.sub_strand,
        assessment_type: a.assessment_type,
        performance:     a.performance,
        term:            a.term,
        academic_year:   a.academic_year,
      }))
      setAssessments(assessItems)

      setLoading(false)
    }
    load()
  }, [])

  const tabs: { id: typeof activeTab; label: string; emoji: string }[] = [
    { id: 'assignments', label: 'Work',    emoji: '📝' },
    { id: 'lessons',     label: 'Lessons', emoji: '📖' },
    { id: 'assessments', label: 'Results', emoji: '📊' },
    { id: 'papers',      label: 'Papers',  emoji: '🗂' },
  ]

  return (
    <>
      <style>{`
        @keyframes shimmer { 0%{ background-position:200% 0 } 100%{ background-position:-200% 0 } }
        @keyframes fadeIn  { from{ opacity:0 } to{ opacity:1 } }
        @keyframes slideIn { from{ opacity:0;transform:translateY(8px) } to{ opacity:1;transform:translateY(0) } }
      `}</style>

      <div style={{ animation: 'fadeIn 0.2s ease' }}>

        <div style={{ background: `linear-gradient(135deg,${dark} 0%,#312e81 100%)`, borderRadius: 20, padding: '14px 16px', marginBottom: 16, color: '#fff' }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>
            {new Date().toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, marginTop: 2 }}>
            {greeting()}, {loading ? '…' : firstName} 📚
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
            Your school work, all in one place
          </div>
          {!loading && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              {[
                { label: 'Assignments', value: homework.length },
                { label: 'Pending',     value: homework.filter(h => !h.submitted).length },
                { label: 'Results',     value: assessments.length },
              ].map(s => (
                <div key={s.label} style={{ flex: 1, background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 6px', textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>{s.value}</div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', marginTop: 1 }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 2 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              style={{
                flexShrink: 0, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                padding: '8px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                background: activeTab === t.id ? accent : '#fff',
                color:      activeTab === t.id ? '#fff'  : '#6b7280',
                boxShadow:  activeTab === t.id ? `0 2px 8px ${accent}44` : '0 1px 3px rgba(0,0,0,0.06)',
              }}>
              {t.emoji} {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1,2,3].map(i => <Skeleton key={i} h={80} />)}
          </div>
        ) : (
          <div style={{ animation: 'slideIn 0.2s ease' }}>

            {activeTab === 'assignments' && (
              <Section title="Assignments" emoji="📝">
                {homework.length === 0 ? (
                  <EmptyState msg="No assignments yet. Check back after class." />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {homework.map(h => {
                      const badge = dueBadge(h.due_date, h.submitted)
                      return (
                        <div key={h.id} style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                            <div style={{ fontSize: 13, fontWeight: 800, color: dark, flex: 1, marginRight: 8 }}>{h.title}</div>
                            <div style={{ fontSize: 10, fontWeight: 700, color: badge.text, background: badge.bg, borderRadius: 8, padding: '3px 8px', flexShrink: 0 }}>
                              {badge.label}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <div style={{ fontSize: 11, color: '#6b7280' }}>{h.subject}</div>
                            <div style={{ width: 3, height: 3, borderRadius: '50%', background: '#d1d5db' }} />
                            <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'capitalize' }}>{h.type}</div>
                          </div>
                          {h.submitted && h.mark !== null && (
                            <div style={{ marginTop: 8, padding: '6px 10px', background: '#d1fae5', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#065f46' }}>
                              Mark: {h.mark}
                              {h.feedback && <span style={{ fontWeight: 500, marginLeft: 8 }}>— {h.feedback}</span>}
                            </div>
                          )}
                          {!h.submitted && (
                            <button onClick={() => router.push(`/student/homework/${h.id}`)}
                              style={{ marginTop: 10, width: '100%', padding: '9px 0', background: accent, color: '#fff', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                              Start Assignment
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </Section>
            )}

            {activeTab === 'lessons' && (
              <Section title="Lesson Replay" emoji="📖">
                {lessons.length === 0 ? (
                  <EmptyState msg="No lesson content posted yet. Your teacher will add lessons here." />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {lessons.map(l => (
                      <div key={l.id} style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: dark }}>{l.title}</div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: accent, background: '#ede9fe', borderRadius: 8, padding: '3px 8px' }}>
                            {DAYS[l.day] ?? ''}
                          </div>
                        </div>
                        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8 }}>{l.subject}</div>
                        <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.6, maxHeight: 80, overflow: 'hidden', position: 'relative' }}>
                          {l.student_copy}
                          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 28, background: 'linear-gradient(transparent,#fff)' }} />
                        </div>
                        <button onClick={() => router.push(`/student/lesson/${l.id}`)}
                          style={{ marginTop: 10, width: '100%', padding: '9px 0', background: '#f5f3ff', color: accent, border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Read Full Lesson
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            )}

            {activeTab === 'assessments' && (
              <Section title="My Results" emoji="📊">
                {assessments.length === 0 ? (
                  <EmptyState msg="No assessment results yet. Results will appear here after your teacher marks work." />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {assessments.map(a => {
                      const perfColor = a.performance === 'exceeds_expectation'    ? { bg: '#d1fae5', text: '#065f46' }
                        : a.performance === 'meets_expectation'                    ? { bg: '#dbeafe', text: '#1e40af' }
                        : a.performance === 'approaching_expectation'              ? { bg: '#fef3c7', text: '#92400e' }
                        : { bg: '#fee2e2', text: '#991b1b' }
                      return (
                        <div key={a.id} style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 800, color: dark }}>{a.subjectName}</div>
                              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{a.sub_strand}</div>
                              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>Term {a.term} · {a.academic_year}</div>
                            </div>
                            <div style={{ fontSize: 10, fontWeight: 700, color: perfColor.text, background: perfColor.bg, borderRadius: 8, padding: '4px 8px', textAlign: 'center', maxWidth: 110 }}>
                              {(a.performance ?? '').replace(/_/g, ' ')}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Section>
            )}

            {activeTab === 'papers' && (
              <Section title="Past Papers" emoji="🗂">
                <div style={{ background: '#fff', borderRadius: 14, border: '1px dashed #d1d5db', padding: '32px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>🗂</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: dark, marginBottom: 6 }}>Past Papers Coming Soon</div>
                  <div style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.6 }}>
                    KCPE, KCSE, school-based and personal practice papers will live here. Timed. Marked. Tracked.
                  </div>
                </div>
              </Section>
            )}

          </div>
        )}
      </div>
    </>
  )
}
