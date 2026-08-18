"use client"

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getParentAssessmentSummary } from '@/lib/assessment/integration'
import ParentTwinDrawer from '@/components/parent/TwinDrawer'

interface ChildData {
  id: string
  name: string
  admissionNumber: string | null
  classId: string | null
  className: string
  schoolId: string | null
  school: string
  attendancePct: number | null
  todayAttendance: string | null
  latestMark: number | null
  latestAssessmentTitle: string | null
  pendingApproval: boolean
  openHomework: number
  overdueHomework: number
  publishedReports: number
  recentTeacherMessages: number
  feeExpected: number | null
  feePaid: number | null
  canViewFinance: boolean
}

interface ActionItem {
  id: string
  childId: string
  childName: string
  type: 'urgent' | 'warning' | 'info' | 'success'
  title: string
  detail: string
  href: string
}

const C = {
  navy: '#0f172a',
  indigo: '#1e1b4b',
  emerald: '#059669',
  emeraldBright: '#10b981',
  surface: '#ffffff',
  border: '#e2e8f0',
  muted: '#64748b',
  bg: '#f1f5f9',
}

function kenyaDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

function greeting() {
  const hour = Number(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Nairobi', hour: '2-digit', hour12: false,
  }).format(new Date()))
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function money(value: number | null) {
  if (value === null) return 'Not published'
  return `KES ${Math.max(0, value).toLocaleString('en-KE', { maximumFractionDigits: 0 })}`
}

function Skeleton({ h = 72 }: { h?: number }) {
  return <div style={{ height: h, borderRadius: 16, background: 'linear-gradient(90deg,#e2e8f0 25%,#f8fafc 50%,#e2e8f0 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
}

function Pill({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'info' }) {
  const tones = {
    neutral: { bg: '#f1f5f9', color: '#475569' },
    good: { bg: '#dcfce7', color: '#166534' },
    warn: { bg: '#fef3c7', color: '#92400e' },
    bad: { bg: '#fee2e2', color: '#b91c1c' },
    info: { bg: '#dbeafe', color: '#1d4ed8' },
  }
  const style = tones[tone]
  return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 999, background: style.bg, color: style.color, fontSize: 10, fontWeight: 800 }}>{children}</span>
}

export default function ParentHomePage() {
  const router = useRouter()
  const [firstName, setFirstName] = useState('Parent')
  const [children, setChildren] = useState<ChildData[]>([])
  const [actions, setActions] = useState<ActionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [noChild, setNoChild] = useState(false)
  const [twinOpen, setTwinOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.replace('/'); return }

        const [{ data: profile }, { data: links, error: linkError }] = await Promise.all([
          supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
          supabase.from('parent_student_links')
            .select('student_id, is_primary, can_view_finance, receives_alerts, access_level')
            .eq('parent_id', user.id)
            .order('is_primary', { ascending: false }),
        ])
        if (linkError) throw linkError
        if (cancelled) return

        const name = profile?.full_name?.trim() ?? ''
        setFirstName(name.split(/\s+/)[0] || 'Parent')

        const validLinks = (links ?? []).filter(link => Boolean(link.student_id))
        if (validLinks.length === 0) {
          setNoChild(true)
          setChildren([])
          setActions([])
          return
        }

        const studentIds = validLinks.map(link => link.student_id)
        const { data: students, error: studentError } = await supabase
          .from('students')
          .select('id, name, admission_number, class_id')
          .in('id', studentIds)
        if (studentError) throw studentError
        if (!students || students.length === 0) {
          setNoChild(true)
          return
        }

        const classIds = Array.from(new Set(students.map(student => student.class_id).filter((value): value is string => Boolean(value))))
        const { data: classes } = classIds.length > 0
          ? await supabase.from('classes').select('id, name, stream, school_id').in('id', classIds)
          : { data: [] }
        const schoolIds = Array.from(new Set((classes ?? []).map(row => row.school_id).filter((value): value is string => Boolean(value))))
        const { data: schools } = schoolIds.length > 0
          ? await supabase.from('schools').select('id, name').in('id', schoolIds)
          : { data: [] }

        const today = kenyaDate()
        const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)
        const sevenDaysAgoIso = new Date(Date.now() - 7 * 86400000).toISOString()

        const [attendanceRes, pendingRes, homeworkRes, submissionsRes, reportsRes, messagesRes, paymentsRes, feeStructuresRes] = await Promise.all([
          supabase.from('attendance').select('student_id, status, is_late, date').in('student_id', studentIds).gte('date', ninetyDaysAgo),
          supabase.from('class_join_requests').select('student_id').in('student_id', studentIds).eq('status', 'pending'),
          classIds.length > 0
            ? supabase.from('homework').select('id, class_id, title, subject, due_date').in('class_id', classIds).gte('due_date', new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10))
            : Promise.resolve({ data: [], error: null }),
          supabase.from('homework_submissions').select('homework_id, student_id, status').in('student_id', studentIds),
          supabase.from('report_cards').select('id, student_id, published_at, status').in('student_id', studentIds).not('published_at', 'is', null),
          supabase.from('parent_messages').select('id, student_id, subject, body, sent_at, delivery_purpose').in('student_id', studentIds).not('sent_at', 'is', null).gte('sent_at', sevenDaysAgoIso),
          supabase.from('finance_fee_payments').select('student_id, amount, deleted_at').in('student_id', studentIds).is('deleted_at', null),
          classIds.length > 0
            ? supabase.from('finance_fee_structures').select('class_id, amount, deleted_at').in('class_id', classIds).is('deleted_at', null)
            : Promise.resolve({ data: [], error: null }),
        ])

        const pendingSet = new Set((pendingRes.data ?? []).map(row => row.student_id))
        const submissionSet = new Set((submissionsRes.data ?? []).filter(row => row.status !== 'draft').map(row => `${row.student_id}:${row.homework_id}`))
        const assessmentByStudent = new Map<string, { percentage: number | null; title: string | null }>()

        await Promise.all(students.map(async student => {
          try {
            const assessment = await getParentAssessmentSummary(student.id)
            const latest = [...assessment.results]
              .filter(result => Boolean(result.releasedAt))
              .sort((a, b) => new Date(b.releasedAt).getTime() - new Date(a.releasedAt).getTime())[0]
            assessmentByStudent.set(student.id, {
              percentage: latest?.percentage ?? null,
              title: latest?.assessmentTitle ?? null,
            })
          } catch {
            assessmentByStudent.set(student.id, { percentage: null, title: null })
          }
        }))

        const mappedChildren: ChildData[] = students.map(student => {
          const cls = (classes ?? []).find(row => row.id === student.class_id)
          const school = (schools ?? []).find(row => row.id === cls?.school_id)
          const link = validLinks.find(row => row.student_id === student.id)
          const attRows = (attendanceRes.data ?? []).filter(row => row.student_id === student.id)
          const presentRows = attRows.filter(row => row.status === 'present')
          const attendancePct = attRows.length > 0 ? Math.round((presentRows.length / attRows.length) * 100) : null
          const todayRow = attRows.find(row => row.date === today)
          const classHomework = (homeworkRes.data ?? []).filter(row => row.class_id === student.class_id)
          const openHomeworkRows = classHomework.filter(row => !submissionSet.has(`${student.id}:${row.id}`))
          const overdueHomework = openHomeworkRows.filter(row => row.due_date && row.due_date < today).length
          const publishedReports = (reportsRes.data ?? []).filter(row => row.student_id === student.id && row.published_at).length
          const recentTeacherMessages = (messagesRes.data ?? []).filter(row => row.student_id === student.id).length
          const feeExpectedRows = (feeStructuresRes.data ?? []).filter(row => row.class_id === student.class_id)
          const feeExpected = feeExpectedRows.length > 0 ? feeExpectedRows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0) : null
          const feePaidRows = (paymentsRes.data ?? []).filter(row => row.student_id === student.id)
          const feePaid = feeExpected !== null ? feePaidRows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0) : null
          const latest = assessmentByStudent.get(student.id) ?? { percentage: null, title: null }

          return {
            id: student.id,
            name: student.name,
            admissionNumber: student.admission_number,
            classId: student.class_id,
            className: cls ? `${cls.name}${cls.stream ? ` ${cls.stream}` : ''}` : 'Class pending',
            schoolId: cls?.school_id ?? null,
            school: school?.name ?? 'School pending',
            attendancePct,
            todayAttendance: todayRow?.is_late ? 'late' : todayRow?.status ?? null,
            latestMark: latest.percentage,
            latestAssessmentTitle: latest.title,
            pendingApproval: pendingSet.has(student.id) && !student.class_id,
            openHomework: openHomeworkRows.length,
            overdueHomework,
            publishedReports,
            recentTeacherMessages,
            feeExpected,
            feePaid,
            canViewFinance: link?.can_view_finance ?? false,
          }
        })

        const nextActions: ActionItem[] = []
        mappedChildren.forEach(child => {
          if (child.todayAttendance === 'absent') {
            nextActions.push({ id: `attendance-${child.id}`, childId: child.id, childName: child.name, type: 'urgent', title: 'Absent today', detail: 'Attendance has been marked absent. Open the child record for details or contact the school.', href: `/parent/child/${child.id}` })
          } else if (child.todayAttendance === 'late') {
            nextActions.push({ id: `late-${child.id}`, childId: child.id, childName: child.name, type: 'warning', title: 'Late arrival today', detail: 'A late arrival was recorded today.', href: `/parent/child/${child.id}` })
          }
          if (child.overdueHomework > 0) {
            nextActions.push({ id: `homework-${child.id}`, childId: child.id, childName: child.name, type: 'warning', title: `${child.overdueHomework} overdue ${child.overdueHomework === 1 ? 'task' : 'tasks'}`, detail: 'These class tasks have no non-draft submission recorded yet.', href: `/parent/child/${child.id}` })
          }
          if (child.recentTeacherMessages > 0) {
            nextActions.push({ id: `messages-${child.id}`, childId: child.id, childName: child.name, type: 'info', title: `${child.recentTeacherMessages} recent teacher ${child.recentTeacherMessages === 1 ? 'update' : 'updates'}`, detail: 'Teacher-to-parent updates were sent during the last seven days.', href: `/parent/child/${child.id}/messages` })
          }
          if (child.canViewFinance && child.feeExpected !== null && child.feePaid !== null && child.feeExpected > child.feePaid) {
            const balance = child.feeExpected - child.feePaid
            nextActions.push({ id: `fees-${child.id}`, childId: child.id, childName: child.name, type: 'warning', title: `${money(balance)} fee balance`, detail: 'Calculated only from the school fee structure and recorded payments visible to this parent.', href: `/parent/child/${child.id}/finance` })
          }
        })

        if (!cancelled) {
          setNoChild(false)
          setChildren(mappedChildren)
          setActions(nextActions.slice(0, 8))
        }
      } catch (error) {
        console.error('[ParentCommandCenter] load failed', error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [router])

  const familyPulse = useMemo(() => {
    const attendanceValues = children.map(child => child.attendancePct).filter((value): value is number => value !== null)
    const averageAttendance = attendanceValues.length > 0 ? Math.round(attendanceValues.reduce((sum, value) => sum + value, 0) / attendanceValues.length) : null
    const marks = children.map(child => child.latestMark).filter((value): value is number => value !== null)
    const averageLatestMark = marks.length > 0 ? Math.round(marks.reduce((sum, value) => sum + value, 0) / marks.length) : null
    return {
      averageAttendance,
      averageLatestMark,
      openHomework: children.reduce((sum, child) => sum + child.openHomework, 0),
      recentMessages: children.reduce((sum, child) => sum + child.recentTeacherMessages, 0),
    }
  }, [children])

  if (loading) return (
    <div style={{ display: 'grid', gap: 12 }}>
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      <Skeleton h={112} />
      <Skeleton h={86} />
      <Skeleton h={180} />
    </div>
  )

  if (noChild) return (
    <div style={{ animation: 'fadeIn 0.2s ease' }}>
      <section style={{ background: `linear-gradient(145deg,${C.navy},${C.indigo})`, color: '#fff', borderRadius: 22, padding: 20, marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#a7f3d0', textTransform: 'uppercase', letterSpacing: 1 }}>Family command center</div>
        <h1 style={{ fontSize: 22, lineHeight: 1.2, margin: '6px 0' }}>{greeting()}, {firstName}</h1>
        <p style={{ margin: 0, color: '#cbd5e1', fontSize: 13 }}>Link your child to bring school updates, learning progress and family actions into one place.</p>
      </section>
      <section style={cardStyle}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>👨‍👩‍👧</div>
        <h2 style={{ margin: '0 0 6px', fontSize: 18 }}>Connect your child</h2>
        <p style={{ color: C.muted, fontSize: 13, margin: '0 0 16px' }}>Use a verified claim code for an existing learner, or request a new class connection.</p>
        <button onClick={() => router.push('/parent/link-child')} style={primaryButton}>Link with claim code</button>
        <button onClick={() => router.push('/parent/create-child')} style={{ ...secondaryButton, marginTop: 8 }}>Add child to class</button>
      </section>
    </div>
  )

  return (
    <div style={{ animation: 'fadeIn 0.2s ease' }}>
      <section style={{ background: `linear-gradient(145deg,${C.navy} 0%,${C.indigo} 72%,#064e3b 130%)`, color: '#fff', borderRadius: 22, padding: 18, marginBottom: 14, boxShadow: '0 12px 30px rgba(15,23,42,0.16)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#a7f3d0', textTransform: 'uppercase', letterSpacing: 1.1 }}>Family command center</div>
            <h1 style={{ fontSize: 21, lineHeight: 1.2, margin: '5px 0 4px' }}>{greeting()}, {firstName}</h1>
            <p style={{ margin: 0, color: '#cbd5e1', fontSize: 12 }}>{new Date().toLocaleDateString('en-KE', { timeZone: 'Africa/Nairobi', weekday: 'long', day: 'numeric', month: 'long' })} · {children.length} {children.length === 1 ? 'child' : 'children'} connected</p>
          </div>
          <button onClick={() => router.push('/parent/inbox')} aria-label="Open family inbox" style={{ border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.09)', color: '#fff', borderRadius: 12, padding: '9px 11px', cursor: 'pointer', fontWeight: 800, fontFamily: 'inherit', fontSize: 12 }}>Inbox {familyPulse.recentMessages > 0 ? `· ${familyPulse.recentMessages}` : ''}</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8, marginTop: 16 }}>
          <HeroMetric label="Attendance" value={familyPulse.averageAttendance === null ? '—' : `${familyPulse.averageAttendance}%`} />
          <HeroMetric label="Latest marks" value={familyPulse.averageLatestMark === null ? '—' : `${familyPulse.averageLatestMark}%`} />
          <HeroMetric label="Open tasks" value={String(familyPulse.openHomework)} />
        </div>
      </section>

      <section style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '15px 16px 11px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={eyebrow}>Needs attention</div>
            <h2 style={{ margin: '3px 0 0', fontSize: 17 }}>What should I act on?</h2>
          </div>
          <Pill tone={actions.length > 0 ? 'warn' : 'good'}>{actions.length > 0 ? `${actions.length} items` : 'All clear'}</Pill>
        </div>
        {actions.length === 0 ? (
          <div style={{ padding: '6px 16px 16px', color: C.muted, fontSize: 13 }}>No urgent attendance, overdue-task, recent-teacher-update or published-fee-balance signal needs action right now.</div>
        ) : (
          <div>
            {actions.map((action, index) => <ActionRow key={action.id} item={action} last={index === actions.length - 1} onOpen={() => router.push(action.href)} />)}
          </div>
        )}
      </section>

      <div style={{ margin: '18px 2px 9px', display: 'flex', justifyContent: 'space-between', alignItems: 'end' }}>
        <div>
          <div style={eyebrow}>Children</div>
          <h2 style={{ margin: '3px 0 0', fontSize: 18 }}>School & learning pulse</h2>
        </div>
        <button onClick={() => router.push('/parent/students')} style={textButton}>See all</button>
      </div>

      {children.map(child => {
        const feeBalance = child.canViewFinance && child.feeExpected !== null && child.feePaid !== null ? Math.max(0, child.feeExpected - child.feePaid) : null
        return (
          <section key={child.id} style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 46, height: 46, borderRadius: 15, background: '#ede9fe', color: C.indigo, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900, flexShrink: 0 }}>{child.name.slice(0, 1).toUpperCase()}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: C.navy, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{child.name}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{child.className} · {child.school}</div>
                {child.pendingApproval && <div style={{ marginTop: 5 }}><Pill tone="warn">Waiting for teacher approval</Pill></div>}
              </div>
              <button onClick={() => router.push(`/parent/child/${child.id}`)} style={{ ...textButton, border: `1px solid ${C.border}`, borderRadius: 10, padding: '7px 9px' }}>Open</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8, marginTop: 14 }}>
              <MetricCard label="Attendance" value={child.attendancePct === null ? 'No data' : `${child.attendancePct}%`} detail={child.todayAttendance ? `Today: ${child.todayAttendance}` : 'Today not marked'} tone={child.todayAttendance === 'absent' ? 'bad' : child.attendancePct !== null && child.attendancePct < 80 ? 'warn' : 'good'} />
              <MetricCard label="Latest released result" value={child.latestMark === null ? 'No result' : `${Math.round(child.latestMark)}%`} detail={child.latestAssessmentTitle ?? 'Released results appear here'} tone={child.latestMark !== null && child.latestMark < 50 ? 'warn' : 'info'} />
              <MetricCard label="Homework" value={`${child.openHomework} open`} detail={child.overdueHomework > 0 ? `${child.overdueHomework} overdue` : 'No overdue class task detected'} tone={child.overdueHomework > 0 ? 'warn' : 'neutral'} />
              <MetricCard label="Fees" value={child.canViewFinance ? money(feeBalance) : 'Restricted'} detail={child.canViewFinance ? (child.feeExpected === null ? 'School fee structure not published' : 'School structure minus recorded payments') : 'Finance visibility is not granted'} tone={feeBalance !== null && feeBalance > 0 ? 'warn' : 'neutral'} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8, marginTop: 10 }}>
              <QuickButton label="Message teacher" onClick={() => router.push(`/parent/child/${child.id}/messages`)} />
              <QuickButton label="Assessments" onClick={() => router.push(`/parent/assessments?studentId=${child.id}`)} />
              <QuickButton label={`Report cards${child.publishedReports > 0 ? ` · ${child.publishedReports}` : ''}`} onClick={() => router.push(`/parent/report-cards?studentId=${child.id}`)} />
              <QuickButton label="Child details" onClick={() => router.push(`/parent/child/${child.id}`)} />
            </div>
          </section>
        )
      })}

      <section style={{ ...cardStyle, marginTop: 14 }}>
        <div style={eyebrow}>Family channels</div>
        <h2 style={{ margin: '4px 0 12px', fontSize: 17 }}>Everything important has a home</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
          <Channel title="Teacher & school messages" detail="Conversations and notices" onClick={() => router.push('/parent/messages')} />
          <Channel title="Learning progress" detail="Released assessments" onClick={() => router.push('/parent/assessments')} />
          <Channel title="Official reports" detail="Published report cards" onClick={() => router.push('/parent/report-cards')} />
          <Channel title="Children" detail="Profiles and records" onClick={() => router.push('/parent/students')} />
        </div>
      </section>

      <button onClick={() => setTwinOpen(true)} aria-label="Open parent Twin" style={{ position: 'fixed', bottom: 86, right: 20, zIndex: 750, width: 52, height: 52, borderRadius: 18, background: `linear-gradient(135deg,${C.indigo},#064e3b)`, border: '1.5px solid rgba(16,185,129,0.5)', color: C.emeraldBright, fontSize: 20, cursor: 'pointer', boxShadow: '0 8px 28px rgba(15,23,42,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✦</button>
      <ParentTwinDrawer open={twinOpen} onClose={() => setTwinOpen(false)} />
    </div>
  )
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return <div style={{ border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: '9px 8px' }}><div style={{ fontSize: 16, fontWeight: 900 }}>{value}</div><div style={{ fontSize: 9, marginTop: 2, color: '#cbd5e1', fontWeight: 700 }}>{label}</div></div>
}

function MetricCard({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: 'neutral' | 'good' | 'warn' | 'bad' | 'info' }) {
  const border = tone === 'bad' ? '#fecaca' : tone === 'warn' ? '#fde68a' : tone === 'good' ? '#bbf7d0' : tone === 'info' ? '#bfdbfe' : C.border
  const bg = tone === 'bad' ? '#fff7f7' : tone === 'warn' ? '#fffbeb' : tone === 'good' ? '#f0fdf4' : tone === 'info' ? '#f8fbff' : '#f8fafc'
  return <div style={{ border: `1px solid ${border}`, background: bg, borderRadius: 13, padding: 11, minWidth: 0 }}><div style={{ fontSize: 9, color: C.muted, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div><div style={{ fontSize: 15, color: C.navy, fontWeight: 900, marginTop: 4 }}>{value}</div><div style={{ fontSize: 10, color: C.muted, marginTop: 3, lineHeight: 1.35 }}>{detail}</div></div>
}

function ActionRow({ item, last, onOpen }: { item: ActionItem; last: boolean; onOpen: () => void }) {
  const icon = item.type === 'urgent' ? '!' : item.type === 'warning' ? '⚠' : item.type === 'success' ? '✓' : 'i'
  const bg = item.type === 'urgent' ? '#fee2e2' : item.type === 'warning' ? '#fef3c7' : item.type === 'success' ? '#dcfce7' : '#dbeafe'
  const color = item.type === 'urgent' ? '#b91c1c' : item.type === 'warning' ? '#92400e' : item.type === 'success' ? '#166534' : '#1d4ed8'
  return <button onClick={onOpen} style={{ width: '100%', border: 'none', borderTop: `1px solid ${C.border}`, borderBottom: last ? 'none' : undefined, background: '#fff', padding: '12px 16px', textAlign: 'left', display: 'flex', gap: 11, cursor: 'pointer', fontFamily: 'inherit' }}><span style={{ width: 28, height: 28, borderRadius: 9, background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, flexShrink: 0 }}>{icon}</span><span style={{ minWidth: 0, flex: 1 }}><span style={{ display: 'block', fontSize: 12, fontWeight: 900, color: C.navy }}>{item.title} · {item.childName}</span><span style={{ display: 'block', fontSize: 10, color: C.muted, marginTop: 3, lineHeight: 1.4 }}>{item.detail}</span></span><span style={{ color: '#94a3b8', fontSize: 18 }}>›</span></button>
}

function QuickButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button onClick={onClick} style={{ border: `1px solid ${C.border}`, background: '#fff', borderRadius: 11, padding: '10px 8px', color: C.navy, fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>{label}</button>
}

function Channel({ title, detail, onClick }: { title: string; detail: string; onClick: () => void }) {
  return <button onClick={onClick} style={{ border: `1px solid ${C.border}`, background: '#f8fafc', borderRadius: 13, padding: 12, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}><div style={{ fontSize: 11, fontWeight: 900, color: C.navy }}>{title}</div><div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>{detail}</div></button>
}

const cardStyle: React.CSSProperties = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 17, padding: 15, marginBottom: 12, boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }
const eyebrow: React.CSSProperties = { fontSize: 9, fontWeight: 900, color: C.emerald, textTransform: 'uppercase', letterSpacing: 1 }
const primaryButton: React.CSSProperties = { width: '100%', border: 'none', borderRadius: 12, padding: '13px 16px', background: C.emerald, color: '#fff', fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit' }
const secondaryButton: React.CSSProperties = { width: '100%', border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 16px', background: '#fff', color: C.navy, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }
const textButton: React.CSSProperties = { border: 'none', background: 'transparent', color: C.emerald, fontSize: 11, fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit' }
