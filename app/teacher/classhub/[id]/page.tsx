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
        ? supabase.from('student_claim_codes').select('student_id, code, role, expires_at').eq('claimed', false).eq('role', 'shared').gt('expires_at', new Date().toISOString()).in('student_id', ids)
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
            {!isSubject && joinRequests > 0 && <button onClick={() => router.push('/teacher/classhub/' + classId + '/requests')} style={{ background:'rgba(255,255,255,.12)',border:0,borderRadius:10,color:'#fff',height:36,padding:'0 12px',fontWeight:800 }}>{joinRequests} requests</button>}
          </div>
        </div>
        {loading ? <Skeleton h={34} w="55%" /> : <><h1 style={{ color:'#fff',margin:0,fontSize:24 }}>{classInfo?.name}{classInfo?.stream ? ` · ${classInfo.stream}` : ''}</h1><p style={{ color:'rgba(255,255,255,.7)',margin:'5px 0 0' }}>{classInfo?.subject || 'Class workspace'}</p></>}
      </div>

      <div style={{ padding: 16 }}>
        {error && <div role="alert" style={{background:'#fef2f2',color:'#991b1b',padding:12,borderRadius:10,marginBottom:12}}>{error}</div>}
        <div style={{ display:'grid',gridTemplateColumns:gridCols,gap:8,marginBottom:16 }}>{actions.map(a=><button key={a.id} onClick={()=>handleAction(a)} style={{border:0,borderRadius:12,minHeight:70,background:a.bg,color:'#fff',fontWeight:800,cursor:'pointer'}}><div style={{fontSize:20}}>{a.icon}</div><div style={{fontSize:11,marginTop:4}}>{a.label}</div></button>)}</div>

        <section style={{background:'#fff',borderRadius:16,padding:14,border:'1px solid #e5e7eb'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}><div><h2 style={{margin:0,color:C.textPrimary,fontSize:16}}>Student Roster</h2><div style={{fontSize:11}}>{students.length} enrolled</div></div><button onClick={()=>setShowForm(v=>!v)} style={{border:0,borderRadius:9,background:C.dark,color:'#fff',padding:'8px 12px',fontWeight:800}}>+ Add</button></div>
          {showForm && <div style={{display:'grid',gap:10,marginBottom:14}}><div><label style={labelStyle}>Student name</label><input style={inputStyle} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div><div><label style={labelStyle}>Admission number</label><input style={inputStyle} value={form.admission_number} onChange={e=>setForm({...form,admission_number:e.target.value})}/></div><button disabled={saving} onClick={()=>void handleAdd()} style={{border:0,borderRadius:10,background:C.dark,color:'#fff',padding:11,fontWeight:800}}>{saving?'Saving…':'Add learner'}</button></div>}
          {students.map(student=>{const code=claimCodes[student.id]; return <div key={student.id} style={{padding:'12px 0',borderTop:'1px solid #f3f4f6'}}><div style={{display:'flex',justifyContent:'space-between',gap:12}}><div><div style={{fontWeight:900,color:C.textPrimary}}>{student.name}</div><div style={{fontSize:11,marginTop:2}}>{student.admission_number || 'No admission number'} · {student.profile_id?'Claimed':'Unclaimed'}</div></div><button onClick={()=>router.push(`/teacher/classhub/${classId}/student/${student.id}`)} style={{border:0,background:'transparent',fontSize:20}}>›</button></div>{!student.profile_id && <div style={{marginTop:9,background:'#f8fafc',padding:10,borderRadius:10}}>{code?<><div style={{fontSize:10,fontWeight:800}}>ACTIVE LEARNER CODE</div><div style={{fontFamily:'monospace',letterSpacing:3,fontSize:17,fontWeight:900,color:C.textPrimary,marginTop:4}}>{code}</div><div style={{display:'flex',gap:8,marginTop:8}}><button onClick={()=>void handleCopyCode(student.id,code)} style={{border:'1px solid #d1d5db',borderRadius:8,background:'#fff',padding:'6px 10px'}}>{copiedId===student.id?'Copied':'Copy'}</button><button disabled={generating===student.id} onClick={()=>void handleGenerateCode(student.id)} style={{border:'1px solid #d1d5db',borderRadius:8,background:'#fff',padding:'6px 10px'}}>{generating===student.id?'Generating…':'New code'}</button></div></>:<button disabled={generating===student.id} onClick={()=>void handleGenerateCode(student.id)} style={{border:0,borderRadius:9,background:C.dark,color:'#fff',padding:'8px 12px',fontWeight:800}}>{generating===student.id?'Generating…':'Generate learner code'}</button>}</div>}</div>})}
        </section>

        <section style={{marginTop:16,background:'linear-gradient(135deg,#047857,#10b981)',borderRadius:16,padding:14,color:'#fff'}}><div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,textAlign:'center'}}><div><strong>{attendanceRate}</strong><div style={{fontSize:10}}>Attendance</div></div><div><strong>{avgScore}</strong><div style={{fontSize:10}}>Avg Score</div></div><div><strong>—</strong><div style={{fontSize:10}}>Homework</div></div></div></section>
      </div>
    </div>
  )
}

export default function ClassPage(){return <Suspense fallback={<div style={{padding:24}}>Loading…</div>}><ClassPageInner/></Suspense>}
