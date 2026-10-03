"use client";
import { rosterRows } from '@/lib/classroom/model'
import { nairobiDateStr } from '@/lib/time'
export const dynamic = "force-dynamic";
import { C } from '@/components/teacher/ui'
import React, { useEffect, useState, Suspense, CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams, useSearchParams } from 'next/navigation'

interface Student {
  id:               string
  name:             string
  admission_number: string
  created_at:       string
  profile_id:       string | null
}

interface ClassInfo {
  name:    string
  stream:  string | null
  subject: string
}

interface FormState {
  name:             string
  admission_number: string
}

interface TeacherContextClass {
  class_id: string
  class_name: string
  stream: string | null
  subject_id: string
  subject_name: string
  is_class_teacher?: boolean
}

interface TeacherContext {
  teacher_id: string
  school_id: string | null
  classes?: TeacherContextClass[]
}

interface BulkRow {
  name: string
  admission_number: string
  request_id: string
  status: 'ready' | 'saving' | 'added' | 'error'
  error?: string
  invalid?: boolean
  student_id?: string
}

interface AttentionItem {
  student_id: string
  reason: string
  kind: 'attendance' | 'work' | 'followup'
}

function Skeleton({ h = 16, w = '100%' }: { h?: number; w?: string }) {
  return (
    <div style={{
      height: h, width: w, borderRadius: 8,
      background: 'linear-gradient(90deg,rgba(255,255,255,0.15) 25%,rgba(255,255,255,0.3) 50%,rgba(255,255,255,0.15) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
    }} />
  )
}

const CLASS_ACTIONS = [
  { id: 'workspace', label: 'Class workspace', icon: '🔎', bg: '#244c37', route: '' },
  { id: 'workbook', label: 'Class sheets', icon: '▦', bg: '#244c37', route: '' },
  { id: 'students',   label: 'Students',     icon: '👥', bg: C.dark,    route: '' },
  { id: 'attendance', label: 'Attendance',   icon: '✅', bg: '#065f46', route: '/teacher/attendance' },
  { id: 'history',    label: 'History',      icon: '📈', bg: '#047857', route: '' },
  { id: 'lessonplan', label: 'Lesson Plans', icon: '📖', bg: '#6d28d9', route: '/teacher/lessonplan' },
  { id: 'assessment', label: 'Assessment',   icon: '📊', bg: '#92400e', route: '/teacher/assessment' },
  { id: 'timetable',  label: 'Timetable',    icon: '🗓️', bg: '#075985', route: '/teacher/timetable' },
  { id: 'groups',     label: 'Groups',       icon: '🫂', bg: '#b45309', route: '' },
  { id: 'homework',   label: 'Homework',     icon: '📝', bg: '#0f766e', route: '' },
  { id: 'projects',   label: 'Projects',     icon: '🛠️', bg: '#92400e', route: '' },
  { id: 'exercises',  label: 'Exercises',    icon: '📐', bg: '#0369a1', route: '' },
]

const SUBJECT_ACTIONS = [
  { id: 'workspace', label: 'Class workspace', icon: '🔎', bg: '#244c37', route: '' },
  { id: 'workbook', label: 'Class sheets', icon: '▦', bg: '#244c37', route: '' },
  { id: 'attendance', label: 'Attendance',   icon: '✅', bg: '#065f46', route: '/teacher/attendance' },
  { id: 'history',    label: 'History',      icon: '📈', bg: '#047857', route: '' },
  { id: 'lessonplan', label: 'Lesson Plans', icon: '📖', bg: '#6d28d9', route: '/teacher/lessonplan' },
  { id: 'assessment', label: 'Assessment',   icon: '📊', bg: '#92400e', route: '/teacher/assessment' },
  { id: 'scheme',     label: 'Scheme',       icon: '📋', bg: '#0f4c75', route: '/teacher/scheme' },
  { id: 'timetable',  label: 'Timetable',    icon: '🗓️', bg: '#075985', route: '/teacher/timetable' },
  { id: 'groups',     label: 'Groups',       icon: '🫂', bg: '#b45309', route: '' },
  { id: 'projects',   label: 'Projects',     icon: '🛠️', bg: '#92400e', route: '' },
  { id: 'exercises',  label: 'Exercises',    icon: '📐', bg: '#0369a1', route: '' },
]

function ClassPageInner() {
  const router       = useRouter()
  const params       = useParams()
  const searchParams = useSearchParams()
  const classId      = params.id as string
  const mode         = searchParams.get('mode') ?? 'class'
  const subjectId    = searchParams.get('subjectId') ?? ''
  const isSubject    = mode === 'subject'

  const [classInfo,      setClassInfo]      = useState<ClassInfo | null>(null)
  const [students,       setStudents]       = useState<Student[]>([])
  const [loading,        setLoading]        = useState(true)
  const [showRoster,     setShowRoster]     = useState(false)
  const [showForm,       setShowForm]       = useState(false)
  const [saving,         setSaving]         = useState(false)
  const [error,          setError]          = useState('')
  const [form,           setForm]           = useState<FormState>({ name: '', admission_number: '' })
  const [claimCodes,     setClaimCodes]     = useState<Record<string, string>>({})
  const [generating,     setGenerating]     = useState<string | null>(null)
  const [copiedId,       setCopiedId]       = useState<string | null>(null)
  const [joinRequests,   setJoinRequests]   = useState<number>(0)
  const [attendanceRate, setAttendanceRate] = useState<string>('—')
  const [avgScore,       setAvgScore]       = useState<string>('—')
  const [studentGroups,  setStudentGroups]  = useState<Record<string, { name: string; color: string }>>({})
  const [schoolId,        setSchoolId]        = useState('')
  const [addRequestId,    setAddRequestId]    = useState('')
  const [showBulk,        setShowBulk]        = useState(false)
  const [bulkText,        setBulkText]        = useState('')
  const [bulkRows,        setBulkRows]        = useState<BulkRow[]>([])
  const [selectedIds,     setSelectedIds]     = useState<Set<string>>(new Set())
  const [attentionItems,   setAttentionItems]   = useState<AttentionItem[]>([])

  async function loadData(): Promise<Student[]> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return [] }

    const contextRes = await supabase.rpc('teacher_get_operating_context')
    if (contextRes.error) {
      setError('Your teaching context could not be loaded.')
      setLoading(false)
      return []
    }
    const context = contextRes.data as TeacherContext
    const activeSchoolId = context.school_id ?? ''
    const assignments = (context.classes ?? []).filter(item => item.class_id === classId)
    const activeAssignment = isSubject && subjectId
      ? assignments.find(item => item.subject_id === subjectId)
      : assignments.find(item => item.is_class_teacher)

    if (!activeSchoolId || !activeAssignment) {
      router.push(isSubject ? '/teacher/subjecthub' : '/teacher/classhub')
      return []
    }
    setSchoolId(activeSchoolId)
    setClassInfo({
      name: activeAssignment.class_name,
      stream: activeAssignment.stream,
      subject: isSubject ? activeAssignment.subject_name : 'Class overview',
    })

    let assessmentQuery = supabase
      .from('cbc_assessments')
      .select('performance')
      .eq('school_id', activeSchoolId)
      .eq('class_id', classId)
    if (isSubject && subjectId) assessmentQuery = assessmentQuery.eq('subject_id', subjectId)

    const [enrollmentRes, requestsRes, attRes, assessRes, grpRes] = await Promise.all([
      supabase.from('student_classes').select('student_id').eq('school_id', activeSchoolId).eq('class_id', classId).eq('is_current', true),
      supabase.from('class_join_requests').select('id').eq('class_id', classId).eq('status', 'pending'),
      supabase.from('attendance').select('student_id,status').eq('school_id', activeSchoolId).eq('class_id', classId).eq('date', nairobiDateStr()).is('timetable_slot_id', null),
      assessmentQuery,
      supabase.from('class_groups').select('id,name,color').eq('class_id', classId).eq('type', 'learning').is('archived_at', null),
    ])

    if (enrollmentRes.error) {
      setError('Class roster could not be loaded. Retry instead of adding duplicate learners.')
      setLoading(false)
      return []
    }

    const studentIds = Array.from(new Set((enrollmentRes.data ?? []).map((row: { student_id: string }) => row.student_id)))
    let loadedStudents: Student[] = []
    if (studentIds.length > 0) {
      const { data: studentRows, error: studentError } = await supabase
        .from('students')
        .select('id,name,admission_number,profile_id,created_at')
        .in('id', studentIds)
        .is('deleted_at', null)
        .order('name')
      if (studentError) {
        setError('Learner identities could not be loaded. Retry instead of adding duplicate learners.')
        setLoading(false)
        return []
      }
      loadedStudents = (studentRows ?? []) as Student[]
    }

    setStudents(loadedStudents)
    setSelectedIds(prev => new Set([...prev].filter(id => loadedStudents.some(student => student.id === id))))
    setJoinRequests(requestsRes.data?.length ?? 0)

    const ids = loadedStudents.map(student => student.id)
    const codesRes = loadedStudents.length > 0
      ? await supabase.from('student_claim_codes').select('student_id,code').eq('claimed', false).eq('role', 'shared').is('revoked_at', null).gt('expires_at', new Date().toISOString()).in('student_id', ids)
      : { data: [] }

    const codes: Record<string, string> = {}
    for (const codeRow of (codesRes.data ?? [])) {
      const code = codeRow as { student_id: string; code: string }
      codes[code.student_id] = code.code
    }
    setClaimCodes(codes)

    const attRows = attRes.data ?? []
    if (loadedStudents.length > 0 && attRows.length > 0) {
      const present = new Set(attRows.filter((row: { status: string }) => row.status === 'present' || row.status === 'late').map(row => row.student_id)).size
      setAttendanceRate(Math.round((present / loadedStudents.length) * 100) + '%')
    } else {
      setAttendanceRate('—')
    }

    const absentToday = (attRows as Array<{ student_id: string; status: string }>)
      .filter(row => row.status === 'absent')
      .map(row => ({ student_id: row.student_id, reason: 'Absent today', kind: 'attendance' as const }))

    const overdueHomeworkRes = await supabase
      .from('homework')
      .select('id,title,target_group_id')
      .eq('school_id', activeSchoolId)
      .eq('class_id', classId)
      .eq('teacher_id', user.id)
      .lt('due_date', nairobiDateStr())
    const overdueIds = (overdueHomeworkRes.data ?? []).map((row: { id: string }) => row.id)
    const overdueSubmissionsRes = overdueIds.length
      ? await supabase.from('homework_submissions').select('homework_id,student_id').in('homework_id', overdueIds).in('status', ['submitted', 'received', 'marked', 'returned', 'resubmitted'])
      : { data: [] }
    const submittedPairs = new Set((overdueSubmissionsRes.data ?? []).flatMap(row => row.homework_id && row.student_id ? [row.homework_id + ':' + row.student_id] : []))
    const targetIds = [...new Set((overdueHomeworkRes.data ?? []).flatMap(h => h.target_group_id ? [h.target_group_id] : []))]
    const targetMembers = targetIds.length ? await supabase.from('class_group_members').select('group_id,student_id').in('group_id', targetIds) : { data: [], error: null }
    const missingWork = overdueHomeworkRes.error || ('error' in overdueSubmissionsRes && overdueSubmissionsRes.error) || targetMembers.error ? [] : loadedStudents.flatMap(student => {
      const count = (overdueHomeworkRes.data ?? []).filter(h => (!h.target_group_id || (targetMembers.data ?? []).some(m => m.group_id === h.target_group_id && m.student_id === student.id)) && !submittedPairs.has(h.id + ':' + student.id)).length
      return count > 0 ? [{ student_id: student.id, reason: `${count} overdue task${count === 1 ? '' : 's'} without a submission`, kind: 'work' as const }] : []
    })

    const followupRes = await supabase
      .from('teacher_learner_events')
      .select('student_id,due_at')
      .eq('school_id', activeSchoolId)
      .eq('class_id', classId)
      .eq('event_kind', 'followup')
      .is('resolved_at', null)
      .is('archived_at', null)
      .lte('due_at', new Date().toISOString())
    const followups = (followupRes.data ?? []).map((row: { student_id: string }) => ({ student_id: row.student_id, reason: 'Follow-up is due', kind: 'followup' as const }))

    const attentionMap = new Map<string, AttentionItem>()
    for (const item of [...absentToday, ...missingWork, ...followups]) {
      const key = item.student_id + ':' + item.kind
      if (!attentionMap.has(key)) attentionMap.set(key, item)
    }
    setAttentionItems([...attentionMap.values()].filter(item => ids.includes(item.student_id)).slice(0, 12))
    if (attRes.error || assessRes.error || overdueHomeworkRes.error || targetMembers.error || followupRes.error) setError('Some class evidence could not be loaded. Refresh before using these summaries.')

    const PERF_MAP: Record<string, number> = { BE: 1, AE: 2, ME: 3, EE: 4 }
    const scored = (assessRes.data ?? []).map((row: { performance: string }) => PERF_MAP[row.performance]).filter((value): value is number => value !== undefined)
    setAvgScore(scored.length > 0 ? (scored.reduce((a,b) => a+b,0) / scored.length).toFixed(1) + '/4' : '—')

    if (loadedStudents.length > 0) {
      const grpData = grpRes.data ?? []
      const { data: mbrData } = grpData.length
        ? await supabase.from('class_group_members').select('student_id,group_id').in('group_id', grpData.map((group: { id: string }) => group.id))
        : { data: [] }
      const nextGroups: Record<string, { name: string; color: string }> = {}
      for (const member of mbrData ?? []) {
        const group = grpData.find((candidate: { id: string }) => candidate.id === member.group_id) as { id: string; name: string; color: string } | undefined
        if (group) nextGroups[member.student_id] = { name: group.name, color: group.color }
      }
      setStudentGroups(nextGroups)
    } else {
      setStudentGroups({})
    }

    setLoading(false)
    return loadedStudents
  }

  useEffect(() => { loadData() }, [classId, mode, subjectId])

  async function handleAdd() {
    setError('')
    if (!form.name.trim()) { setError('Student name is required.'); return }
    if (!schoolId) { setError('School context is missing.'); return }
    setSaving(true)

    const requestId = addRequestId || crypto.randomUUID()
    if (!addRequestId) setAddRequestId(requestId)

    const { data: studentId, error: err } = await supabase.rpc('teacher_add_student_v2', {
      p_name: form.name.trim(),
      p_admission_number: form.admission_number.trim() || null,
      p_class_id: classId,
      p_school_id: schoolId,
      p_request_id: requestId,
    })

    if (err || !studentId) {
      setSaving(false)
      setError(err?.message?.includes('admission_identifier_conflict')
        ? 'That admission number is already in use at this school.'
        : err?.message ?? 'Student could not be added.')
      return
    }

    const refreshedStudents = await loadData()
    if (!refreshedStudents.some(student => student.id === studentId)) {
      setSaving(false)
      setShowRoster(true)
      setError('Student was saved, but the roster has not confirmed the learner yet. Retry the roster — do not add the student again.')
      return
    }

    setSaving(false)
    setForm({ name: '', admission_number: '' })
    setAddRequestId('')
    setShowForm(false)
    setShowRoster(true)
  }

  function prepareBulkRows() {
    setError('')
    const lines = bulkText.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
    const rows: BulkRow[] = rosterRows(lines.map(line => line.split(line.includes('\t') ? '\t' : ','))).map(row => ({ ...row, invalid: Boolean(row.error), request_id: crypto.randomUUID(), status: row.error ? 'error' : 'ready' }))
    setBulkRows(rows)
    if (!rows.length) setError('Paste at least one learner name.')
  }

  async function importRoster(file: File) {
    setError('')
    if (file.size > 2 * 1024 * 1024) { setError('Choose a file smaller than 2 MB.'); return }
    setSaving(true)
    try {
      const XLSX = await import('xlsx')
      const book = XLSX.read(await file.arrayBuffer(), { type: 'array', cellFormula: false })
      if (!book.SheetNames.length) throw new Error('This file has no roster sheet.')
      const values = XLSX.utils.sheet_to_json<string[]>(book.Sheets[book.SheetNames[0]], { header: 1, raw: false, defval: '' })
      setBulkRows(rosterRows(values.map(row => row.map(String))).map(row => ({ ...row, invalid: Boolean(row.error), request_id: crypto.randomUUID(), status: row.error ? 'error' : 'ready' })))
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The roster could not be read.') }
    finally { setSaving(false) }
  }

  async function saveBulkRows() {
    if (!schoolId || !bulkRows.length) return
    setSaving(true)
    setError('')
    const next = [...bulkRows]

    for (let index = 0; index < next.length; index += 1) {
      const row = next[index]
      if (row.status === 'added' || row.invalid) continue
      next[index] = { ...row, status: 'saving', error: undefined }
      setBulkRows([...next])
      const { data: studentId, error: addError } = await supabase.rpc('teacher_add_student_v2', {
        p_name: row.name,
        p_admission_number: row.admission_number || null,
        p_class_id: classId,
        p_school_id: schoolId,
        p_request_id: row.request_id,
      })
      if (addError || !studentId) {
        next[index] = {
          ...row,
          status: 'error',
          error: addError?.message?.includes('admission_identifier_conflict')
            ? 'Admission number already exists at this school.'
            : addError?.message ?? 'Could not add learner.',
        }
      } else {
        next[index] = { ...row, status: 'added', student_id: studentId }
      }
      setBulkRows([...next])
    }

    const refreshed = await loadData()
    const visible = new Set(refreshed.map(student => student.id))
    let unconfirmed = 0
    for (let index = 0; index < next.length; index += 1) {
      const row = next[index]
      if (row.status === 'added' && row.student_id && !visible.has(row.student_id)) {
        next[index] = { ...row, status: 'error', error: 'Saved but not yet confirmed in the roster. Retry; do not create again.' }
        unconfirmed += 1
      }
    }
    setBulkRows([...next])
    setSaving(false)
    if (!next.some(row => row.status === 'error')) {
      setBulkText('')
      setBulkRows([])
      setShowBulk(false)
      setShowRoster(true)
    } else if (unconfirmed) {
      setError('Some saved learners are not yet confirmed in the roster. Retry the roster instead of adding them again.')
    }
  }

  async function handleGenerateCode(studentId: string) {
    setGenerating(studentId)
    setError('')
    const { data, error: rpcError } = await supabase.rpc('teacher_generate_shared_claim_code', { p_student_id: studentId })
    const nextCode = data && typeof data === 'object' && !Array.isArray(data) && typeof data.code === 'string' ? data.code : null
    if (rpcError || !nextCode) {
      setError(rpcError?.message ?? 'Could not generate a learner code.')
    } else {
      setClaimCodes(prev => ({ ...prev, [studentId]: nextCode }))
    }
    setGenerating(null)
  }

  async function handleCopyCode(studentId: string, code: string) {
    await navigator.clipboard.writeText(code)
    setCopiedId(studentId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  function buildRoute(baseRoute: string) {
    if (!baseRoute) return ''
    let r = baseRoute + '?classId=' + classId
    if (isSubject && subjectId) r += '&subjectId=' + subjectId
    return r
  }

  function handleAction(a: { id: string; route: string }) {
    if (a.id === 'students') { setShowRoster(v => !v); return }
    let route = a.route
    if (a.id === 'workbook') route = `/teacher/classhub/${classId}/workbook`
    if (a.id === 'workspace') route = `/teacher/classhub/${classId}/workspace`
    if (a.id === 'groups')   route = `/teacher/classhub/${classId}/groups`
    if (a.id === 'homework') route = `/teacher/classhub/${classId}/homework`
    if (a.id === 'projects') route = `/teacher/classhub/${classId}/projects`
    if (a.id === 'exercises') route = `/teacher/classhub/${classId}/exercises`
    if (a.id === 'history') route = `/teacher/classhub/${classId}/attendance-history`
    const r = buildRoute(route)
    if (r) router.push(r)
  }

  function toggleSelected(studentId: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(studentId)) next.delete(studentId)
      else next.add(studentId)
      return next
    })
  }

  function openGroupsForSelection() {
    const query = new URLSearchParams()
    if (isSubject && subjectId) query.set('subjectId', subjectId)
    if (selectedIds.size) query.set('selected', [...selectedIds].join(','))
    const suffix = query.toString()
    router.push(`/teacher/classhub/${classId}/groups${suffix ? '?' + suffix : ''}`)
  }

  const actions      = isSubject ? SUBJECT_ACTIONS : CLASS_ACTIONS
  const heroGradient = isSubject
    ? 'linear-gradient(135deg, #075985 0%, #0369a1 60%, #0ea5e9 150%)'
    : 'linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #10b981 150%)'
  const backRoute    = isSubject ? '/teacher/subjecthub' : '/teacher/classhub'
  const gridCols     = isSubject ? 'repeat(3, 1fr)' : 'repeat(4, 1fr)'

  const inputStyle: CSSProperties = {
    width: '100%', padding: '11px 14px', borderRadius: 10,
    border: '1px solid #e5e7eb', fontSize: 14, color: C.textPrimary,
    outline: 'none', fontFamily: 'inherit', background: '#f9fafb',
    boxSizing: 'border-box',
  }

  const labelStyle: CSSProperties = {
    fontSize: 11, fontWeight: 700, color: C.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: 6, display: 'block',
  }

  return (
    <div id="classhub-page" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: C.textMuted, paddingBottom: 60, background: C.surface, minHeight: '100%' }}>
      <style>{`
        @keyframes shimmer   { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes slideDown { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      <div style={{ background: heroGradient, padding: '20px 16px 28px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
        <div style={{ position: 'absolute', bottom: -20, left: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <button onClick={() => router.push(backRoute)} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontSize: 18 }}>←</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {!isSubject && joinRequests > 0 && (
              <button onClick={() => router.push('/teacher/classhub/' + classId + '/requests')} style={{ position: 'relative', background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16 }}>
                🔔
                <span style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: '50%', background: C.error, color: '#fff', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{joinRequests}</span>
              </button>
            )}
            {isSubject && <div style={{ padding: '5px 12px', borderRadius: 20, background: 'rgba(255,255,255,0.18)', fontSize: 11, fontWeight: 800, color: '#fff', letterSpacing: 0.5 }}>Subject View</div>}
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}><Skeleton h={28} w="60%" /><Skeleton h={14} w="40%" /><div style={{ display: 'flex', gap: 8, marginTop: 8 }}><Skeleton h={36} w="30%" /><Skeleton h={36} w="30%" /><Skeleton h={36} w="30%" /></div></div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}><div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{isSubject ? '📚' : '🏫'}</div><div><h1 style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: 0, lineHeight: 1.2 }}>{isSubject ? classInfo?.subject : (classInfo?.name + (classInfo?.stream ? ' · ' + classInfo.stream : ''))}</h1><p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: '3px 0 0' }}>{isSubject ? (classInfo?.name + (classInfo?.stream ? ' · ' + classInfo.stream : '')) : classInfo?.subject}</p></div></div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>{[{ label: 'Students', value: students.length },{ label: 'Claimed', value: students.filter(s => s.profile_id).length },{ label: 'Avg Score', value: avgScore }].map(s => <div key={s.label} style={{ flex: 1, background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 8px', textAlign: 'center' }}><div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{s.value}</div><div style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', fontWeight: 600, marginTop: 2 }}>{s.label}</div></div>)}</div>
          </>
        )}
      </div>

      <div style={{ margin: '16px 16px 0', background: '#fff', borderRadius: 20, padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}><p style={{ fontSize: 10, fontWeight: 800, color: C.textMuted, letterSpacing: 1.4, textTransform: 'uppercase', margin: '0 0 12px' }}>{isSubject ? 'Subject Tools' : 'Class Tools'}</p><div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 10 }}>{actions.map(a => <button key={a.id} onClick={() => handleAction(a)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 4px', borderRadius: 14, border: 'none', cursor: 'pointer', background: a.bg, fontFamily: 'inherit' }}><span style={{ fontSize: 22 }}>{a.icon}</span><span style={{ fontSize: 9, fontWeight: 800, color: '#fff', textAlign: 'center', lineHeight: 1.3 }}>{a.label}</span></button>)}</div></div>

      {(isSubject || showRoster) && (
        <div style={{ margin: '14px 16px 0', background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', animation: 'slideDown 0.2s ease' }}>
          <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderBottom: '1px solid #f3f4f6' }}>
            <div><p style={{ fontSize: 14, fontWeight: 800, color: C.textPrimary, margin: 0 }}>{isSubject ? 'Class Students' : 'Student Roster'}</p><p style={{ fontSize: 11, color: C.textMuted, margin: '2px 0 0' }}>{students.length} enrolled</p></div>
            {!isSubject && <div style={{ display: 'flex', gap: 6 }}>
              <button disabled={saving} onClick={() => { setShowBulk(false); setShowForm(v => !v) }} style={{ padding: '8px 12px', borderRadius: 10, background: showForm ? '#f3f4f6' : C.dark, color: showForm ? C.textPrimary : '#fff', fontWeight: 700, fontSize: 11, border: 'none' }}>{showForm ? 'Cancel' : '+ Add'}</button>
              <button disabled={saving} onClick={() => { setShowForm(false); setShowBulk(v => !v) }} style={{ padding: '8px 12px', borderRadius: 10, background: showBulk ? '#f3f4f6' : '#312e81', color: showBulk ? C.textPrimary : '#fff', fontWeight: 700, fontSize: 11, border: 'none' }}>{showBulk ? 'Cancel' : 'Bulk add'}</button>
            </div>}
          </div>

          {!isSubject && showForm && <div style={{ padding: 16, borderBottom: '1px solid #f3f4f6' }}>
            <div style={{ display: 'grid', gap: 12 }}>
              <div><label style={labelStyle}>Full Name *</label><input style={inputStyle} placeholder="e.g. Amara Osei" value={form.name} onChange={e => setForm(current => ({ ...current, name: e.target.value }))} /></div>
              <div><label style={labelStyle}>Admission Number (optional)</label><input style={inputStyle} placeholder="e.g. ADM/2024/001" value={form.admission_number} onChange={e => setForm(current => ({ ...current, admission_number: e.target.value }))} /></div>
            </div>
            <button onClick={handleAdd} disabled={saving} style={{ marginTop: 14, width: '100%', minHeight: 44, borderRadius: 10, background: saving ? C.accentLight : C.accent, color: '#fff', fontWeight: 800, border: 'none' }}>{saving ? 'Saving…' : 'Add Student'}</button>
          </div>}

          {!isSubject && showBulk && <div style={{ padding: 16, borderBottom: '1px solid #f3f4f6' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: C.textPrimary }}>Paste learners</div>
            <div style={{ fontSize: 10, color: C.textMuted, marginTop: 3 }}>One learner per line. Use “Name, Admission No” or just the name.</div>
            <label>Import CSV or Excel: Name and optional Admission number <input type="file" accept=".csv,.xlsx,.xls" disabled={saving} onChange={event => { if (event.target.files?.[0]) void importRoster(event.target.files[0]); event.target.value = '' }} /></label>
            <textarea disabled={saving} value={bulkText} onChange={event => { setBulkText(event.target.value); setBulkRows([]) }} rows={7} placeholder={"Jane Wanjiku, ADM001\nPeter Otieno\nAmina Noor, ADM003"} style={{ ...inputStyle, marginTop: 10, resize: 'vertical', minHeight: 130 }} />
            {!bulkRows.length ? <button onClick={prepareBulkRows} disabled={saving} style={{ marginTop: 10, width: '100%', minHeight: 44, border: 0, borderRadius: 10, background: '#312e81', color: '#fff', fontWeight: 900 }}>Preview learners</button> :
              <div style={{ marginTop: 10 }}>
                <div style={{ display: 'grid', gap: 6, maxHeight: 240, overflowY: 'auto' }}>{bulkRows.map((row,index) => <div key={row.request_id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: 9, borderRadius: 10, background: row.status === 'error' ? '#fef2f2' : row.status === 'added' ? '#ecfdf5' : '#f8fafc' }}><div><strong style={{ fontSize: 11 }}>{index + 1}. {row.name || 'Missing name'}</strong><div style={{ fontSize: 9, color: C.textMuted }}>{row.admission_number || 'No admission number'}</div>{row.error && <div style={{ fontSize: 9, color: C.error, marginTop: 2 }}>{row.error}</div>}</div><span style={{ fontSize: 10, fontWeight: 800 }}>{row.status}</span></div>)}</div>
                <button onClick={saveBulkRows} disabled={saving || bulkRows.every(row => row.invalid || row.status === 'added')} style={{ marginTop: 10, width: '100%', minHeight: 44, border: 0, borderRadius: 10, background: C.accent, color: '#fff', fontWeight: 900 }}>{saving ? 'Adding learners…' : 'Add valid learners'}</button>
              </div>}
          </div>}

          {error && <div role="alert" style={{ margin: '10px 16px 0', padding: 10, borderRadius: 10, background: '#fef2f2', color: C.error, fontSize: 11, fontWeight: 700 }}>{error}</div>}

          {!loading && students.length > 0 && <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderBottom: '1px solid #f3f4f6', background: selectedIds.size ? '#eef2ff' : '#fafafa' }}>
            <button onClick={() => setSelectedIds(selectedIds.size === students.length ? new Set() : new Set(students.map(student => student.id)))} style={{ minHeight: 36, border: '1px solid #d1d5db', borderRadius: 9, background: '#fff', padding: '0 10px', fontWeight: 800, fontSize: 10 }}>{selectedIds.size === students.length ? 'Clear selection' : 'Select all'}</button>
            <div style={{ fontSize: 10, fontWeight: 800 }}>{selectedIds.size ? `${selectedIds.size} selected` : 'Select learners for an action'}</div>
            <button onClick={openGroupsForSelection} disabled={!selectedIds.size} style={{ minHeight: 36, border: 0, borderRadius: 9, background: selectedIds.size ? '#312e81' : '#e5e7eb', color: selectedIds.size ? '#fff' : '#9ca3af', padding: '0 10px', fontWeight: 900, fontSize: 10 }}>Group · Note · More</button>
          </div>}

          {loading ? <div style={{ padding: '12px 16px', display: 'grid', gap: 8 }}>{[1,2,3].map(i => <div key={i} style={{ height: 44, borderRadius: 8, background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />)}</div> :
            students.length === 0 ? <div style={{ padding: 28, textAlign: 'center', color: C.textMuted }}>No students yet. Add one learner or paste the class list.</div> :
            <div>{students.map((student,index) => {
              const code = claimCodes[student.id]
              const claimed = Boolean(student.profile_id)
              const profileQuery = isSubject && subjectId ? '?subjectId=' + encodeURIComponent(subjectId) : ''
              return <div key={student.id} style={{ padding: '12px 16px', borderTop: index === 0 ? 'none' : '1px solid #f3f4f6' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input aria-label={`Select ${student.name}`} type="checkbox" checked={selectedIds.has(student.id)} onChange={() => toggleSelected(student.id)} style={{ width: 18, height: 18, flexShrink: 0 }} />
                  <button onClick={() => router.push('/teacher/classhub/' + classId + '/student/' + student.id + profileQuery)} style={{ flex: 1, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: claimed ? C.accentLight : '#ede9fe', display: 'grid', placeItems: 'center', fontWeight: 800, color: claimed ? '#065f46' : C.dark }}>{student.name.charAt(0).toUpperCase()}</div>
                        <div><div style={{ fontSize: 14, fontWeight: 800, color: C.textPrimary }}>{student.name}</div><div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 3 }}>{student.admission_number && <span style={{ fontSize: 10, color: C.textMuted }}>{student.admission_number}</span>}{studentGroups[student.id] && <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 20, background: studentGroups[student.id].color + '22', color: studentGroups[student.id].color }}>{studentGroups[student.id].name}</span>}<span style={{ fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 20, background: claimed ? C.accentLight : '#fef3c7', color: claimed ? '#065f46' : '#92400e' }}>{claimed ? 'Claimed' : 'Unclaimed'}</span></div></div>
                      </div><span>›</span>
                    </div>
                  </button>
                </div>
                {!isSubject && !claimed && <div style={{ marginTop: 9, marginLeft: 28, padding: 9, background: C.surface, borderRadius: 10, border: '1px solid #e5e7eb' }}>{code ?
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}><div><div style={{ fontSize: 9, color: C.textMuted, fontWeight: 800 }}>LEARNER CODE</div><div style={{ fontFamily: 'monospace', fontSize: 17, fontWeight: 900, letterSpacing: 2 }}>{code}</div></div><div style={{ display: 'flex', gap: 5 }}><button onClick={() => handleCopyCode(student.id,code)} style={{ minHeight: 34, border: '1px solid #10b981', borderRadius: 8, background: '#fff', color: C.accent, fontWeight: 800 }}>{copiedId === student.id ? 'Copied' : 'Copy'}</button><button onClick={() => handleGenerateCode(student.id)} disabled={generating === student.id} style={{ minHeight: 34, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', fontWeight: 800 }}>New</button></div></div> :
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: 10 }}>No active learner code</span><button onClick={() => handleGenerateCode(student.id)} disabled={generating === student.id} style={{ minHeight: 34, border: 0, borderRadius: 8, background: C.dark, color: '#fff', fontWeight: 800, padding: '0 10px' }}>Generate code</button></div>}
                </div>}
              </div>
            })}</div>}
        </div>
      )}

      <div style={{margin:'14px 16px'}}><button type="button" onClick={() => router.push(`/teacher/classhub/${classId}/workbook${subjectId ? `?subjectId=${encodeURIComponent(subjectId)}` : ''}`)} style={{width:'100%',padding:14,borderRadius:14,border:0,background:'#244c37',color:'white',fontWeight:800,fontSize:14}}>Open Class Workbook — lists, marks & trackers</button></div>

      {!isSubject && !showRoster && <div style={{ margin:'14px 16px 0' }}><button onClick={() => setShowRoster(true)} style={{ width:'100%',padding:'13px',borderRadius:14,border:'1.5px dashed #d1d5db',background:'transparent',color:C.textMuted,fontWeight:700,fontSize:13,cursor:'pointer',fontFamily:'inherit' }}>👥 View Student Roster ({students.length})</button></div>}

      <div style={{ margin:'14px 16px 0', background:'#fff', borderRadius:20, padding:16, boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <div><p style={{ fontSize:10, fontWeight:800, color:C.textMuted, letterSpacing:1.4, textTransform:'uppercase', margin:0 }}>Needs attention</p><p style={{ fontSize:11, color:C.textMuted, margin:'3px 0 0' }}>Evidence-backed items from attendance, work and follow-ups</p></div>
          {attentionItems.length > 0 && <span style={{ minWidth:28, height:28, borderRadius:20, background:'#fef3c7', color:'#92400e', display:'grid', placeItems:'center', fontWeight:900 }}>{attentionItems.length}</span>}
        </div>
        {students.length === 0 ? <div style={{ padding:'14px 0', color:C.textMuted, textAlign:'center' }}>Add learners to start building the class picture.</div> :
          attentionItems.length === 0 ? <div style={{ padding:'12px 0', color:C.textMuted }}>No current attention item is supported by the recorded evidence.</div> :
          <div style={{ display:'grid', gap:7 }}>{attentionItems.map((item,index) => {
            const learner = students.find(student => student.id === item.student_id)
            return <button key={item.student_id + '-' + item.kind + '-' + index} onClick={() => router.push('/teacher/classhub/' + classId + '/student/' + item.student_id + (isSubject && subjectId ? '?subjectId=' + encodeURIComponent(subjectId) : ''))} style={{ minHeight:46, display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, width:'100%', border:'1px solid #e5e7eb', borderRadius:11, background:'#fff', padding:'8px 10px', textAlign:'left' }}><div><strong style={{ fontSize:12 }}>{learner?.name ?? 'Learner'}</strong><div style={{ fontSize:10, color:C.textMuted, marginTop:2 }}>{item.reason}</div></div><span style={{ fontSize:10, fontWeight:900, color:item.kind === 'attendance' ? '#991b1b' : item.kind === 'work' ? '#92400e' : '#3730a3' }}>{item.kind === 'attendance' ? 'Attendance' : item.kind === 'work' ? 'Work' : 'Follow up'} ›</span></button>
          })}</div>}
      </div>

      <div style={{ margin:'14px 16px 0',background:isSubject?'linear-gradient(135deg, #075985 0%, #0ea5e9 100%)':'linear-gradient(135deg, #065f46 0%, #10b981 100%)',borderRadius:20,padding:'20px',boxShadow:'0 1px 4px rgba(0,0,0,0.08)' }}><p style={{fontSize:10,fontWeight:800,color:'rgba(255,255,255,0.7)',letterSpacing:1.4,textTransform:'uppercase',margin:'0 0 14px'}}>{isSubject?'Subject Performance':'Performance'}</p><div style={{display:'flex',gap:10}}>{[{label:'Attendance Rate',value:attendanceRate,icon:'📊'},{label:isSubject?'Subject Avg':'Avg Score',value:avgScore,icon:'🏆'},{label:'Homework Done',value:'—',icon:'📝'}].map(s => <div key={s.label} style={{flex:1,background:'rgba(255,255,255,0.15)',borderRadius:14,padding:'12px 8px',textAlign:'center'}}><div style={{fontSize:16}}>{s.icon}</div><div style={{fontSize:18,fontWeight:900,color:'#fff',marginTop:4}}>{s.value}</div><div style={{fontSize:9,color:'rgba(255,255,255,0.7)',fontWeight:600,marginTop:3,lineHeight:1.3}}>{s.label}</div></div>)}</div></div>
    </div>
  )
}

export default function ClassPage() {
  return (
    <Suspense fallback={<div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}><style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>{[1,2,3,4].map(i => <div key={i} style={{ height:56,borderRadius:12,background:'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)',backgroundSize:'200% 100%',animation:'shimmer 1.4s infinite' }} />)}</div>}>
      <ClassPageInner />
    </Suspense>
  )
}
