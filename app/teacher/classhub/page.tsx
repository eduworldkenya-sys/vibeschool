'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getSchoolId } from '@/lib/getSchoolId'
import { useRouter } from 'next/navigation'
import { useToast } from '@/app/teacher/layout'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Slot {
  id:               string
  subject:          string
  class:            string
  room:             string
  start:            string
  end:              string
  day_of_week:      number
  attendanceMarked: boolean
  classId:          string
  subjectId:        string
}

interface ClassItem {
  id:           string
  name:         string
  stream:       string
  subject:      string
  studentCount: number
  attendanceToday: 'marked' | 'pending' | 'none'
  homeworkPending: number
}

interface PageData {
  fullName:      string
  school:        string
  lessonsToday:  number
  attendancePct: number
  nextLesson:    Slot | null
  currentLesson: Slot | null
  todaySlots:    Slot[]
  classes:       ClassItem[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeToMin(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
function nowMin() {
  const n = new Date()
  return n.getHours() * 60 + n.getMinutes()
}
function fmt(t: string) {
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}
function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}
function countdown(start: string) {
  const m = timeToMin(start) - nowMin()
  if (m <= 0) return 'Now'
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}
function classAccent(name: string): string {
  const colors = ['#c2410c','#0369a1','#7c3aed','#0f766e','#b45309','#be185d','#1d4ed8','#065f46']
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

const IconAttend = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <polyline points="16 11 18 13 22 9"/>
  </svg>
)
const IconPlan = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10 9 9 9 8 9"/>
  </svg>
)
const IconResults = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
)
const IconAssess = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 11 12 14 22 4"/>
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
  </svg>
)
const IconTimetable = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
)
const IconScheme = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6"/>
    <line x1="8" y1="12" x2="21" y2="12"/>
    <line x1="8" y1="18" x2="21" y2="18"/>
    <line x1="3" y1="6" x2="3.01" y2="6"/>
    <line x1="3" y1="12" x2="3.01" y2="12"/>
    <line x1="3" y1="18" x2="3.01" y2="18"/>
  </svg>
)
const IconSubject = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
  </svg>
)
const IconSchool = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
)
const IconChevron = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
)
const IconStudents = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
)

// ─── Quick Actions ────────────────────────────────────────────────────────────

const ACTIONS = [
  { id: 'attendance', label: 'Attendance', Icon: IconAttend,   href: '/teacher/attendance', color: '#ecfdf5', ink: '#065f46', useClass: true  },
  { id: 'lessonplan', label: 'Plans',      Icon: IconPlan,     href: '/teacher/lessonplan', color: '#ede9fe', ink: '#5b21b6', useClass: true  },
  { id: 'results',    label: 'Results',    Icon: IconResults,  href: '/teacher/results',    color: '#fff7ed', ink: '#9a3412', useClass: true  },
  { id: 'assessment', label: 'Assessment', Icon: IconAssess,   href: '/teacher/assessment', color: '#fef9c3', ink: '#854d0e', useClass: true  },
  { id: 'timetable',  label: 'Timetable',  Icon: IconTimetable,href: '/teacher/timetable',  color: '#e0f2fe', ink: '#075985', useClass: false },
  { id: 'scheme',     label: 'Scheme',     Icon: IconScheme,   href: '/teacher/scheme',     color: '#fce7f3', ink: '#9d174d', useClass: false },
  { id: 'subjecthub', label: 'SubjectHub', Icon: IconSubject,  href: '/teacher/subjecthub', color: '#dbeafe', ink: '#1e40af', useClass: false },
  { id: 'schoolhub',  label: 'SchoolHub',  Icon: IconSchool,   href: '/teacher/schoolhub',  color: '#f3f4f6', ink: '#374151', useClass: false },
]

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Bone({ w = '100%', h = 14, r = 8 }: { w?: string | number; h?: number; r?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: 'linear-gradient(90deg,#f0ede8 25%,#e8e4df 50%,#f0ede8 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.6s ease-in-out infinite',
      flexShrink: 0,
    }} />
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClassHubPage() {
  const router        = useRouter()
  const { showToast } = useToast()

  const [data,      setData]      = useState<PageData | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [myClassId, setMyClassId] = useState<string | null>(null)
  const [expanded,  setExpanded]  = useState<string | null>(null)
  const [clock,     setClock]     = useState('')

  // Live clock
  useEffect(() => {
    function tick() {
      const n = new Date()
      setClock(`${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`)
    }
    tick()
    const id = setInterval(tick, 10000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/academy/signin?role=teacher'); return }

    const uid   = user.id
    const today = new Date().toISOString().split('T')[0]
    const raw   = new Date().getDay()
    const dow   = raw === 0 ? 7 : raw

    const [profileRes, slotsRes, homeClassRes, teacherProfileRes] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', uid).single(),
      supabase
        .from('timetable_slots')
        .select('id,day_of_week,start_time,end_time,room,class_id,subject_id,subjects(name),classes(name,stream)')
        .eq('teacher_id', uid)
        .order('day_of_week', { ascending: true })
        .order('start_time',  { ascending: true }),
      supabase.from('teacher_classes').select('class_id').eq('teacher_id', uid).eq('is_class_teacher', true).maybeSingle(),
      supabase.from('teacher_profiles').select('designation').eq('profile_id', uid).maybeSingle(),
    ])

    const designation = teacherProfileRes.data?.designation ?? null
    if (designation === 'subject_teacher') { router.push('/teacher/subjecthub'); return }

    const fullName       = profileRes.data?.full_name ?? ''
    const classTeacherId = homeClassRes.data?.class_id ?? null
    setMyClassId(classTeacherId)
    const schoolId       = await getSchoolId(uid)
    const slotIds        = (slotsRes.data ?? []).map((s: any) => s.id)

    const [schoolRes, attBatchRes, attTodayRes, tcClassRes] = await Promise.all([
      schoolId
        ? supabase.from('schools').select('name').eq('id', schoolId).single()
        : Promise.resolve({ data: null }),
      slotIds.length > 0
        ? supabase.from('attendance').select('timetable_slot_id').in('timetable_slot_id', slotIds).eq('date', today)
        : Promise.resolve({ data: [] }),
      classTeacherId
        ? supabase.from('attendance').select('status').eq('class_id', classTeacherId).eq('date', today)
        : Promise.resolve({ data: [] }),
      supabase.from('teacher_classes').select('class_id').eq('teacher_id', uid).eq('is_class_teacher', true),
    ])

    const markedSlotIds = new Set((attBatchRes.data ?? []).map((r: any) => r.timetable_slot_id))
    const present       = (attTodayRes.data ?? []).filter((r: any) => r.status === 'present').length
    const total         = (attTodayRes.data ?? []).length
    const attendancePct = total > 0 ? Math.round((present / total) * 100) : 0

    const allSlots: Slot[] = (slotsRes.data ?? []).map((slot: any) => {
      const cls     = slot.classes as { name: string; stream: string | null } | null
      const subject = (slot.subjects as { name: string } | null)?.name ?? 'Unknown'
      return {
        id:               slot.id,
        subject,
        class:            cls ? cls.name + (cls.stream ? ` ${cls.stream}` : '') : '',
        room:             slot.room ?? '',
        start:            slot.start_time,
        end:              slot.end_time,
        day_of_week:      slot.day_of_week,
        attendanceMarked: markedSlotIds.has(slot.id),
        classId:          slot.class_id,
        subjectId:        slot.subject_id,
      }
    })

    const todaySlots    = allSlots.filter(s => s.day_of_week === dow)
    const cur           = nowMin()
    const currentLesson = todaySlots.find(s => timeToMin(s.start) <= cur && timeToMin(s.end) > cur) ?? null
    const nextLesson    = todaySlots.find(s => timeToMin(s.start) > cur) ?? null

    // Load classes
    const classIds = Array.from(new Set(
      (tcClassRes.data ?? []).map((r: any) => r.class_id).filter(Boolean)
    ))

    let classes: ClassItem[] = []
    if (classIds.length > 0) {
      const [classRes, studentRes, hwRes] = await Promise.all([
        supabase.from('classes').select('*').in('id', classIds),
        supabase.from('students').select('class_id').in('class_id', classIds),
        supabase.from('homework').select('class_id,status').in('class_id', classIds).eq('status', 'pending'),
      ])

      const counts: Record<string, number> = {}
      for (const s of studentRes.data ?? []) counts[s.class_id] = (counts[s.class_id] ?? 0) + 1

      const hwCounts: Record<string, number> = {}
      for (const h of hwRes.data ?? []) hwCounts[h.class_id] = (hwCounts[h.class_id] ?? 0) + 1

      const attMarked = new Set(
        todaySlots.filter(s => s.attendanceMarked).map(s => s.classId)
      )
      const attNeeded = new Set(todaySlots.map(s => s.classId))

      classes = (classRes.data ?? []).map((c: any) => ({
        id:              c.id,
        name:            c.name,
        stream:          c.stream ?? '',
        subject:         c.subject ?? '',
        studentCount:    counts[c.id] ?? 0,
        attendanceToday: attMarked.has(c.id) ? 'marked' : attNeeded.has(c.id) ? 'pending' : 'none',
        homeworkPending: hwCounts[c.id] ?? 0,
      }))
    }

    setData({
      fullName,
      school:        (schoolRes.data as any)?.name ?? '',
      lessonsToday:  todaySlots.length,
      attendancePct,
      nextLesson,
      currentLesson,
      todaySlots,
      classes,
    })
    setLoading(false)
  }

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ animation: 'fadeIn 0.2s ease' }}>
        <style>{`
          @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
          @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        `}</style>
        <div style={{ background: 'linear-gradient(135deg,#1e1b4b 0%,#312e81 60%,#1e3a2f 100%)', borderRadius: 24, padding: '24px 20px 20px', marginBottom: 12 }}>
          <Bone w={100} h={10} /><div style={{marginTop:8}}><Bone w={180} h={22} /></div>
          <div style={{marginTop:4}}><Bone w={140} h={10} /></div>
          <div style={{display:'flex',gap:8,marginTop:14}}>
            {[1,2,3].map(i=><div key={i} style={{flex:1,background:'rgba(255,255,255,0.08)',borderRadius:14,padding:'12px 8px',textAlign:'center'}}><Bone w="60%" h={18}/><div style={{marginTop:5}}><Bone w="80%" h={8}/></div></div>)}
          </div>
        </div>
        <div style={{background:'#fff',borderRadius:20,border:'1px solid #f1f0ec',padding:18,marginBottom:12}}>
          <Bone w={120} h={10}/><div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginTop:12}}>{[1,2,3,4,5,6,7,8].map(i=><Bone key={i} h={68} r={14}/>)}</div>
        </div>
        <div style={{background:'#fff',borderRadius:20,border:'1px solid #f1f0ec',padding:18,marginBottom:12}}>
          <Bone w={140} h={10}/><div style={{display:'flex',flexDirection:'column',gap:0,marginTop:16}}>{[1,2,3].map(i=><Bone key={i} h={52} r={0} w="100%"/>)}</div>
        </div>
      </div>
    )
  }

  if (!data) return null

  const firstName = data.fullName.split(' ')[0] || 'Teacher'
  const liveSlot  = data.currentLesson || data.nextLesson
  const isLive    = !!data.currentLesson

  return (
    <div style={{ paddingBottom: 24, animation: 'pageIn 0.3s ease' }}>
      <style>{`
        @keyframes shimmer  { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes pageIn   { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse    { 0%,100%{box-shadow:0 0 0 0 rgba(16,185,129,0.5)} 50%{box-shadow:0 0 0 8px rgba(16,185,129,0)} }
        @keyframes fadeUp   { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .action-btn:active  { transform: scale(0.95) !important; }
        .slot-row:active    { background: #f8f7f4 !important; }
        .class-card:active  { transform: scale(0.98) !important; }
        .open-btn:active    { opacity: 0.75 !important; }
      `}</style>

      {/* ── HERO ────────────────────────────────────────────────────────────── */}
      <div style={{
        background:    'linear-gradient(135deg, #1e1b4b 0%, #2d2a6e 45%, #1a3a2a 100%)',
        borderRadius:  24,
        padding:       '22px 20px 0',
        marginBottom:  12,
        overflow:      'hidden',
        position:      'relative',
      }}>
        {/* warm glow */}
        <div style={{ position:'absolute', bottom:-40, left:-20, width:200, height:200, borderRadius:'50%', background:'radial-gradient(circle, rgba(245,158,11,0.18) 0%, transparent 70%)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', top:-30, right:-20, width:160, height:160, borderRadius:'50%', background:'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)', pointerEvents:'none' }} />

        {/* top row */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:16, position:'relative' }}>
          <div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', fontWeight:600, letterSpacing:0.5, marginBottom:5 }}>
              {new Date().toLocaleDateString('en-KE',{ weekday:'long', day:'numeric', month:'long' })}
            </div>
            <div style={{ fontSize:24, fontWeight:800, color:'#fff', lineHeight:1.15, letterSpacing:-0.5 }}>
              {greeting()},<br />{firstName}
            </div>
            <div style={{ fontSize:12, color:'rgba(255,255,255,0.45)', marginTop:5, fontWeight:500 }}>
              {data.school}
            </div>
          </div>
          <div style={{ textAlign:'right', paddingTop:2 }}>
            <div style={{ fontSize:28, fontWeight:200, color:'rgba(255,255,255,0.9)', fontVariantNumeric:'tabular-nums', letterSpacing:1, lineHeight:1 }}>
              {clock}
            </div>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.3)', fontWeight:600, marginTop:3 }}>LIVE</div>
          </div>
        </div>

        {/* stats row */}
        <div style={{ display:'flex', gap:8, marginBottom: liveSlot ? 0 : 20, position:'relative' }}>
          {[
            { label:'Lessons',    value: data.lessonsToday,       unit:'' },
            { label:'Attendance', value: data.attendancePct,      unit:'%' },
            { label:'Flags',      value: 0,                       unit:'' },
          ].map(s => (
            <div key={s.label} style={{
              flex:1, background:'rgba(255,255,255,0.07)',
              border:'1px solid rgba(255,255,255,0.1)',
              borderRadius:14, padding:'10px 8px', textAlign:'center',
              backdropFilter:'blur(8px)',
            }}>
              <div style={{ fontSize:20, fontWeight:800, color:'#fff', lineHeight:1 }}>{s.value}{s.unit}</div>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.45)', fontWeight:600, marginTop:3, textTransform:'uppercase', letterSpacing:0.8 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* live / next banner — bleeds from hero */}
        {liveSlot && (
          <div style={{
            margin:         '14px -20px 0',
            padding:        '14px 20px',
            background:     isLive ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.12)',
            borderTop:      `1px solid ${isLive ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.2)'}`,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            gap:            12,
          }}>
            <div style={{ minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
                {isLive && <span style={{ width:7, height:7, borderRadius:'50%', background:'#10b981', display:'inline-block', animation:'pulse 2s infinite', flexShrink:0 }} />}
                <span style={{ fontSize:10, fontWeight:800, color: isLive ? '#10b981' : '#f59e0b', letterSpacing:1, textTransform:'uppercase' }}>
                  {isLive ? 'Now' : `Next · ${countdown(liveSlot.start)}`}
                </span>
              </div>
              <div style={{ fontSize:14, fontWeight:700, color:'#fff', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                {liveSlot.subject} · {liveSlot.class}
              </div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)', marginTop:2 }}>
                {fmt(liveSlot.start)}–{fmt(liveSlot.end)} · {liveSlot.room}
              </div>
            </div>
            <div style={{ display:'flex', gap:6, flexShrink:0 }}>
              <button
                className="open-btn"
                onClick={() => router.push('/teacher/lessonplan?classId=' + liveSlot.classId + '&subjectId=' + liveSlot.subjectId)}
                style={{ padding:'7px 13px', borderRadius:10, border:'1.5px solid rgba(255,255,255,0.25)', background:'transparent', color:'#fff', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'inherit', transition:'opacity 0.15s' }}
              >
                Plan
              </button>
              <button
                className="open-btn"
                onClick={() => router.push('/teacher/attendance?classId=' + liveSlot.classId)}
                style={{ padding:'7px 13px', borderRadius:10, border:'none', background:'#10b981', color:'#fff', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'inherit', transition:'opacity 0.15s' }}
              >
                Attend
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── QUICK ACTIONS ───────────────────────────────────────────────────── */}
      <div style={{ background:'#fff', borderRadius:20, border:'1px solid #f1f0ec', padding:'18px 16px', marginBottom:12, boxShadow:'0 1px 4px rgba(0,0,0,0.05)' }}>
        <div style={{ fontSize:10, fontWeight:800, color:'#9ca3af', letterSpacing:1.6, textTransform:'uppercase', marginBottom:14 }}>Quick Actions</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
          {ACTIONS.map(a => (
            <button
              key={a.id}
              className="action-btn"
              onClick={() => {
                if (a.useClass && !myClassId) { showToast('No home class assigned'); return }
                router.push(a.useClass ? a.href + '?classId=' + myClassId : a.href)
              }}
              style={{
                display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                gap:7, padding:'12px 4px', borderRadius:16, border:'none',
                background: a.color, cursor:'pointer', fontFamily:'inherit',
                transition:'transform 0.12s',
              }}
            >
              <span style={{ color: a.ink, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <a.Icon />
              </span>
              <span style={{ fontSize:9.5, fontWeight:800, color: a.ink, textAlign:'center', lineHeight:1.3 }}>{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── TODAY'S TIMELINE ────────────────────────────────────────────────── */}
      <div style={{ background:'#fff', borderRadius:20, border:'1px solid #f1f0ec', padding:'18px 16px', marginBottom:12, boxShadow:'0 1px 4px rgba(0,0,0,0.05)' }}>
        <div style={{ fontSize:10, fontWeight:800, color:'#9ca3af', letterSpacing:1.6, textTransform:'uppercase', marginBottom:16 }}>Today</div>

        {data.todaySlots.length === 0 ? (
          <div style={{ textAlign:'center', padding:'24px 0' }}>
            <div style={{ fontSize:13, color:'#9ca3af', fontWeight:500, marginBottom:12 }}>No classes scheduled today</div>
            <button
              onClick={() => router.push('/teacher/timetable')}
              style={{ padding:'9px 18px', borderRadius:12, border:'none', background:'#1e1b4b', color:'#fff', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}
            >
              Set up timetable
            </button>
          </div>
        ) : (
          <div style={{ position:'relative' }}>
            {/* spine */}
            <div style={{ position:'absolute', left:38, top:10, bottom:10, width:1.5, background:'#f1f0ec', borderRadius:2 }} />

            {data.todaySlots.map((slot, i) => {
              const cur      = nowMin()
              const isNow    = timeToMin(slot.start) <= cur && timeToMin(slot.end) > cur
              const isDone   = timeToMin(slot.end) <= cur
              const isOpen   = expanded === slot.id

              return (
                <div key={slot.id}>
                  <div
                    className="slot-row"
                    onClick={() => setExpanded(isOpen ? null : slot.id)}
                    style={{
                      display:'flex', alignItems:'center', gap:0,
                      padding:'10px 0', cursor:'pointer',
                      opacity: isDone ? 0.45 : 1,
                      transition:'opacity 0.2s, background 0.15s',
                      borderRadius:12,
                    }}
                  >
                    {/* time */}
                    <div style={{ width:36, textAlign:'right', flexShrink:0, paddingRight:0 }}>
                      <span style={{ fontSize:11, fontWeight:600, color:'#9ca3af', fontVariantNumeric:'tabular-nums', letterSpacing:0.3 }}>
                        {fmt(slot.start).replace(' AM','').replace(' PM','')}
                      </span>
                    </div>

                    {/* node */}
                    <div style={{ width:28, display:'flex', justifyContent:'center', flexShrink:0, position:'relative', zIndex:1 }}>
                      {isDone ? (
                        <div style={{ width:16, height:16, borderRadius:'50%', background:'#d1fae5', display:'flex', alignItems:'center', justifyContent:'center' }}>
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </div>
                      ) : isNow ? (
                        <div style={{ width:16, height:16, borderRadius:'50%', background:'#10b981', animation:'pulse 2s infinite', flexShrink:0 }} />
                      ) : (
                        <div style={{ width:16, height:16, borderRadius:'50%', border:'2px solid #d1d5db', background:'#fff', flexShrink:0 }} />
                      )}
                    </div>

                    {/* content */}
                    <div style={{ flex:1, minWidth:0, paddingLeft:4 }}>
                      <div style={{ fontSize:13, fontWeight: isNow ? 800 : 600, color: isNow ? '#111827' : '#374151', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                        {slot.subject}
                        <span style={{ fontSize:12, fontWeight:500, color:'#9ca3af', marginLeft:6 }}>{slot.class}</span>
                      </div>
                      <div style={{ fontSize:11, color:'#9ca3af', marginTop:1 }}>{slot.room} · {fmt(slot.start)}–{fmt(slot.end)}</div>
                    </div>

                    {/* status chip */}
                    {isNow && (
                      <span style={{ fontSize:9, fontWeight:800, color:'#065f46', background:'#d1fae5', padding:'3px 8px', borderRadius:20, letterSpacing:0.5, flexShrink:0, textTransform:'uppercase' }}>Live</span>
                    )}
                    {!isNow && !isDone && !slot.attendanceMarked && (
                      <span style={{ fontSize:9, fontWeight:700, color:'#92400e', background:'#fef3c7', padding:'3px 8px', borderRadius:20, flexShrink:0 }}>Pending</span>
                    )}
                  </div>

                  {/* inline expand */}
                  {isOpen && (
                    <div style={{ marginLeft:64, marginBottom:8, display:'flex', gap:8, animation:'fadeUp 0.18s ease' }}>
                      <button
                        onClick={() => router.push('/teacher/lessonplan?classId=' + slot.classId + '&subjectId=' + slot.subjectId)}
                        style={{ padding:'7px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', background:'#fff', color:'#374151', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}
                      >
                        Plan
                      </button>
                      <button
                        onClick={() => router.push('/teacher/attendance?classId=' + slot.classId)}
                        style={{ padding:'7px 14px', borderRadius:10, border:'none', background:'#10b981', color:'#fff', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}
                      >
                        Attend
                      </button>
                      <button
                        onClick={() => router.push('/teacher/classhub/' + slot.classId)}
                        style={{ padding:'7px 14px', borderRadius:10, border:'1.5px solid #e5e7eb', background:'#fff', color:'#374151', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}
                      >
                        Class
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── MY CLASSES ──────────────────────────────────────────────────────── */}
      {data.classes.length > 0 && (
        <div style={{ marginBottom:12 }}>
          <div style={{ fontSize:10, fontWeight:800, color:'#9ca3af', letterSpacing:1.6, textTransform:'uppercase', marginBottom:12, paddingLeft:4 }}>My Classes</div>
          <div style={{ display:'flex', gap:12, overflowX:'auto', paddingBottom:8, scrollbarWidth:'none' }}>
            <style>{`.classes-scroll::-webkit-scrollbar{display:none}`}</style>
            {data.classes.map((cls, i) => {
              const accent = classAccent(cls.name)
              return (
                <div
                  key={cls.id}
                  className="class-card"
                  onClick={() => router.push('/teacher/classhub/' + cls.id)}
                  style={{
                    flexShrink:  0,
                    width:       160,
                    background:  '#fff',
                    borderRadius:20,
                    border:      '1px solid #f1f0ec',
                    overflow:    'hidden',
                    cursor:      'pointer',
                    boxShadow:   '0 2px 8px rgba(0,0,0,0.06)',
                    transition:  'transform 0.15s',
                    animation:   `fadeUp 0.3s ease ${i * 60}ms both`,
                  }}
                >
                  {/* accent strip */}
                  <div style={{ height:5, background: accent, borderRadius:'20px 20px 0 0' }} />
                  <div style={{ padding:'14px 14px 16px' }}>
                    <div style={{ fontSize:17, fontWeight:800, color:'#111827', lineHeight:1.2, marginBottom:3 }}>
                      {cls.name}{cls.stream ? ` ${cls.stream}` : ''}
                    </div>
                    <div style={{ fontSize:11, color:'#9ca3af', marginBottom:12, fontWeight:500 }}>{cls.subject || 'Class Teacher'}</div>

                    {/* students */}
                    <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:8 }}>
                      <span style={{ color:'#9ca3af' }}><IconStudents /></span>
                      <span style={{ fontSize:12, fontWeight:700, color:'#374151' }}>{cls.studentCount}</span>
                      <span style={{ fontSize:11, color:'#9ca3af' }}>students</span>
                    </div>

                    {/* attendance status */}
                    <div style={{
                      fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:0.5,
                      padding:'4px 9px', borderRadius:20, display:'inline-block',
                      background: cls.attendanceToday === 'marked' ? '#d1fae5' : cls.attendanceToday === 'pending' ? '#fef3c7' : '#f3f4f6',
                      color:      cls.attendanceToday === 'marked' ? '#065f46' : cls.attendanceToday === 'pending' ? '#92400e' : '#6b7280',
                    }}>
                      {cls.attendanceToday === 'marked' ? 'Att ✓' : cls.attendanceToday === 'pending' ? 'Att due' : 'No class'}
                    </div>

                    {/* open row */}
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:12 }}>
                      {cls.homeworkPending > 0 && (
                        <span style={{ fontSize:10, color:'#9ca3af', fontWeight:600 }}>{cls.homeworkPending} hw</span>
                      )}
                      <span style={{ marginLeft:'auto', color: accent }}><IconChevron /></span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── SCHOOL PULSE ────────────────────────────────────────────────────── */}
      <div style={{ textAlign:'center', padding:'8px 0 4px' }}>
        <span style={{ fontSize:11, color:'#c4bfb8', fontWeight:500 }}>
          {data.school} · {new Date().toLocaleDateString('en-KE',{ weekday:'long' })}
        </span>
      </div>
    </div>
  )
}
