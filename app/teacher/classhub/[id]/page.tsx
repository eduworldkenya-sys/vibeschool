"use client";
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
  { id: 'attendance', label: 'Attendance',   icon: '✅', bg: '#065f46', route: '/teacher/attendance' },
  { id: 'history',    label: 'History',      icon: '📈', bg: '#047857', route: '' },
  { id: 'lessonplan', label: 'Lesson Plans', icon: '📖', bg: '#6d28d9', route: '/teacher/lessonplan' },
  { id: 'assessment', label: 'Assessment',   icon: '📊', bg: '#92400e', route: '/teacher/assessment' },
  { id: 'scheme',     label: 'Scheme',       icon: '📋', bg: '#0f4c75', route: '/teacher/scheme' },
  { id: 'timetable',  label: 'Timetable',    icon: '🗓️', bg: '#075985', route: '/teacher/timetable' },
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

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }

    if (!isSubject) {
      const { data: ownRow } = await supabase
        .from('teacher_classes')
        .select('class_id')
        .eq('teacher_id', user.id)
        .eq('class_id', classId)
        .limit(1)
        .maybeSingle()
      if (!ownRow) { router.push('/teacher/classhub'); return }
    }
    const classQuery = supabase.from('classes').select('name, stream, subject').eq('id', classId).single()

    const [clsRes, studsRes, requestsRes] = await Promise.all([
      classQuery,
      supabase.from('student_classes').select('student_id, students(id, name, admission_number, profile_id, created_at)').eq('class_id', classId).eq('is_current', true),
      supabase.from('class_join_requests').select('id').eq('class_id', classId).eq('status', 'pending'),
    ])

    if (!clsRes.data) { router.push(isSubject ? '/teacher/subjecthub' : '/teacher/classhub'); return }
    setClassInfo(clsRes.data)

    const loadedStudents = (studsRes.data ?? []).map((r: any) => r.students).filter(Boolean)
    setStudents(loadedStudents)
    setJoinRequests(requestsRes.data?.length ?? 0)

    const today = nairobiDateStr()
    const ids = loadedStudents.map(s => s.id)

    const [codesRes, attRes, assessRes, grpRes] = await Promise.all([
      loadedStudents.length > 0
        ? supabase.from('student_claim_codes').select('student_id, code').eq('claimed', false).eq('role', 'shared').is('revoked_at', null).gt('expires_at', new Date().toISOString()).in('student_id', ids)
        : Promise.resolve({ data: [] }),
      supabase.from('attendance').select('status').eq('class_id', classId).gte('timestamp', today + 'T00:00:00').lte('timestamp', today + 'T23:59:59'),
      supabase.from('cbc_assessments').select('performance').eq('class_id', classId),
      loadedStudents.length > 0
        ? supabase.from('class_groups').select('id, name, color').eq('class_id', classId).eq('type', 'learning')
        : Promise.resolve({ data: [] }),
    ])

    const codes: Record<string, string> = {}
    for (const c of (codesRes.data ?? [])) { codes[(c as {student_id:string;code:string}).student_id] = (c as {student_id:string;code:string}).code }
    setClaimCodes(codes)

    const attRows = attRes.data ?? []
    if (loadedStudents.length > 0) {
      const present = attRows.filter((r: {status:string}) => r.status === 'present').length
      setAttendanceRate(Math.round((present / loadedStudents.length) * 100) + '%')
    }

    const PERF_MAP: Record<string, number> = { BE: 1, AE: 2, ME: 3, EE: 4 }
    const scored = (assessRes.data ?? []).map((r: {performance:string}) => PERF_MAP[r.performance]).filter((v): v is number => v !== undefined)
    if (scored.length > 0) {
      const avg = scored.reduce((a, b) => a + b, 0) / scored.length
      setAvgScore(avg.toFixed(1) + '/4')
    }

    if (loadedStudents.length > 0) {
      const grpData = grpRes.data ?? []
      const { data: mbrData } = await supabase.from('class_group_members').select('student_id, group_id').in('group_id', grpData.map((g: {id:string}) => g.id))
      const sGroups: Record<string, { name: string; color: string }> = {}
      for (const m of mbrData ?? []) {
        const grp = grpData.find((g: {id:string;name:string;color:string}) => g.id === m.group_id)
        if (grp) sGroups[m.student_id] = { name: grp.name, color: grp.color }
      }
      setStudentGroups(sGroups)
    }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [classId, mode])

  async function handleAdd() {
    setError('')
    if (!form.name.trim()) { setError('Student name is required.'); return }
    setSaving(true)

    const { data: clsData } = await supabase.from('classes').select('school_id').eq('id', classId).single()

    const { data: studentId, error: err } = await supabase
      .rpc('teacher_add_student', {
        p_name:             form.name.trim(),
        p_admission_number: form.admission_number.trim() || undefined,
        p_class_id:         classId,
        p_school_id:        clsData?.school_id ?? undefined,
      })

    if (err || !studentId) { setSaving(false); setError(err?.message ?? 'Failed to add student — no ID returned'); return }

    setSaving(false)
    setForm({ name: '', admission_number: '' })
    setShowForm(false)
    loadData()
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
    if (a.id === 'groups')   route = `/teacher/classhub/${classId}/groups`
    if (a.id === 'homework') route = `/teacher/classhub/${classId}/homework`
    if (a.id === 'projects') route = `/teacher/classhub/${classId}/projects`
    if (a.id === 'exercises') route = `/teacher/classhub/${classId}/exercises`
    if (a.id === 'history') route = `/teacher/classhub/${classId}/attendance-history`
    const r = buildRoute(route)
    if (r) router.push(r)
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
          <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6' }}><div><p style={{ fontSize: 14, fontWeight: 800, color: C.textPrimary, margin: 0 }}>{isSubject ? 'Class Students' : 'Student Roster'}</p><p style={{ fontSize: 11, color: C.textMuted, margin: '2px 0 0' }}>{students.length} enrolled</p></div>{!isSubject && <button onClick={() => setShowForm(v => !v)} style={{ padding: '8px 14px', borderRadius: 10, background: showForm ? '#f3f4f6' : C.dark, color: showForm ? C.textPrimary : '#fff', fontWeight: 700, fontSize: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>{showForm ? 'Cancel' : '+ Add'}</button>}</div>

          {!isSubject && showForm && <div style={{ padding: '16px', borderBottom: '1px solid #f3f4f6' }}><div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}><div><label style={labelStyle}>Full Name *</label><input style={inputStyle} placeholder="e.g. Amara Osei" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div><div><label style={labelStyle}>Admission Number (optional)</label><input style={inputStyle} placeholder="e.g. ADM/2024/001" value={form.admission_number} onChange={e => setForm(f => ({ ...f, admission_number: e.target.value }))} /></div></div>{error && <p style={{ color: C.error, fontSize: 12, marginTop: 8 }}>{error}</p>}<button onClick={handleAdd} disabled={saving} style={{ marginTop: 14, width: '100%', padding: '11px', borderRadius: 10, background: saving ? C.accentLight : C.accent, color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>{saving ? 'Saving…' : 'Add Student'}</button></div>}

          {loading ? <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>{[1,2,3].map(i => <div key={i} style={{ height: 44, borderRadius: 8, background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />)}</div> : students.length === 0 ? <div style={{ padding: '28px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 28 }}>🎒</span><p style={{ fontSize: 13, color: C.textMuted, textAlign: 'center', margin: 0 }}>{isSubject ? 'No students enrolled in this class.' : 'No students yet. Tap + Add to enrol.'}</p></div> : <div>{students.map((s,i) => { const code=claimCodes[s.id]; const claimed=!!s.profile_id; return <div key={s.id} style={{ padding: '12px 16px', borderTop: i===0?'none':'1px solid #f3f4f6' }}><button onClick={() => router.push('/teacher/classhub/' + classId + '/student/' + s.id)} style={{ width:'100%',background:'none',border:'none',padding:0,cursor:'pointer',fontFamily:'inherit',textAlign:'left' }}><div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}><div style={{ display:'flex',alignItems:'center',gap:12 }}><div style={{ width:40,height:40,borderRadius:'50%',background:claimed?C.accentLight:'#ede9fe',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:14,color:claimed?'#065f46':C.dark,flexShrink:0 }}>{s.name.charAt(0).toUpperCase()}</div><div><p style={{ fontSize:14,fontWeight:700,color:C.textPrimary,margin:0 }}>{s.name}</p><div style={{ display:'flex',alignItems:'center',gap:6,marginTop:2 }}>{s.admission_number && <p style={{fontSize:11,color:C.textMuted,margin:0}}>{s.admission_number}</p>}{studentGroups[s.id] && <span style={{fontSize:10,fontWeight:700,padding:'1px 7px',borderRadius:20,background:studentGroups[s.id].color+'22',color:studentGroups[s.id].color,border:'1px solid '+studentGroups[s.id].color+'44'}}>{studentGroups[s.id].name.split(' ')[0]}</span>}<span style={{fontSize:10,fontWeight:700,padding:'1px 7px',borderRadius:20,background:claimed?C.accentLight:'#fef3c7',color:claimed?'#065f46':'#92400e'}}>{claimed?'Claimed ✓':'Unclaimed'}</span></div></div></div><span style={{fontSize:16,color:C.textMuted}}>›</span></div></button>{!isSubject && !claimed && <div style={{ marginTop:10,padding:'10px 12px',background:C.surface,borderRadius:10,border:'1px solid #e5e7eb' }}>{code ? <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}><div><p style={{fontSize:10,fontWeight:700,color:C.textMuted,margin:'0 0 2px',textTransform:'uppercase',letterSpacing:.5}}>Learner Code</p><p style={{fontSize:18,fontWeight:900,color:C.dark,margin:0,letterSpacing:3,fontFamily:'monospace'}}>{code}</p></div><div style={{display:'flex',gap:6}}><button onClick={() => handleCopyCode(s.id,code)} style={{padding:'6px 12px',borderRadius:8,border:'1.5px solid #10b981',background:copiedId===s.id?C.accentLight:'transparent',color:C.accent,fontWeight:700,fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>{copiedId===s.id?'Copied!':'Copy'}</button><button onClick={() => handleGenerateCode(s.id)} disabled={generating===s.id} style={{padding:'6px 12px',borderRadius:8,border:'1.5px solid #e5e7eb',background:'transparent',color:C.textMuted,fontWeight:700,fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>{generating===s.id?'…':'New'}</button></div></div> : <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}><p style={{fontSize:12,color:C.textMuted,margin:0}}>No active learner code</p><button onClick={() => handleGenerateCode(s.id)} disabled={generating===s.id} style={{padding:'6px 14px',borderRadius:8,border:'none',background:C.dark,color:'#fff',fontWeight:700,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>{generating===s.id?'Generating…':'Generate Code'}</button></div>}</div>}</div> })}</div>}
        </div>
      )}

      {!isSubject && !showRoster && <div style={{ margin:'14px 16px 0' }}><button onClick={() => setShowRoster(true)} style={{ width:'100%',padding:'13px',borderRadius:14,border:'1.5px dashed #d1d5db',background:'transparent',color:C.textMuted,fontWeight:700,fontSize:13,cursor:'pointer',fontFamily:'inherit' }}>👥 View Student Roster ({students.length})</button></div>}

      <div style={{ margin:'14px 16px 0',background:'#fff',borderRadius:20,padding:'16px',boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}><div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12 }}><p style={{ fontSize:10,fontWeight:800,color:C.textMuted,letterSpacing:1.4,textTransform:'uppercase',margin:0 }}>Class Activity</p></div>{students.length===0 ? <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:10,padding:'12px 0'}}><span style={{fontSize:28}}>🎒</span><p style={{fontSize:13,color:C.textMuted,textAlign:'center',margin:0}}>No students yet — add your first student to get started</p><button onClick={() => {setShowRoster(true);setShowForm(true)}} style={{padding:'8px 16px',borderRadius:10,border:'none',background:C.accent,color:'#fff',fontWeight:700,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>+ Add First Student</button></div> : students.filter(s=>s.profile_id).length===0 ? <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:10,padding:'12px 0'}}><span style={{fontSize:28}}>📲</span><p style={{fontSize:13,color:C.textMuted,textAlign:'center',margin:0}}>{students.length} student{students.length>1?'s':''} unclaimed — share learner codes to activate accounts</p><button onClick={() => setShowRoster(true)} style={{padding:'8px 16px',borderRadius:10,border:'none',background:C.dark,color:'#fff',fontWeight:700,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>View Learner Codes →</button></div> : <div style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0'}}><div style={{width:38,height:38,borderRadius:12,background:'#f3f4f6',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>📋</div><div><p style={{fontSize:13,fontWeight:700,color:C.textPrimary,margin:0}}>No recent activity</p><p style={{fontSize:11,color:C.textMuted,margin:'2px 0 0'}}>Class updates will appear here</p></div></div>}</div>

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
