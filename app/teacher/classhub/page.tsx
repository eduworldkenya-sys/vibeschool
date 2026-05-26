'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
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

interface ClassCard {
  id:              string
  name:            string
  stream:          string
  subject:         string
  studentCount:    number
  presentToday:    number
  totalToday:      number
  homeworkPending: number
  avgScore:        string
  unclaimedCount:  number
  todaySlots:      Slot[]
}

interface PageData {
  fullName:   string
  school:     string
  allSlots:   Slot[]
  todaySlots: Slot[]
  classes:    ClassCard[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toMin(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
function nowMin() {
  const n = new Date()
  return n.getHours() * 60 + n.getMinutes()
}
function fmt12(t: string) {
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')}${h >= 12 ? 'pm' : 'am'}`
}
function greet() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}
function classColor(name: string) {
  const palette = [
    { bg: '#fef3c7', border: '#f59e0b', text: '#92400e', dot: '#f59e0b' },
    { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af', dot: '#3b82f6' },
    { bg: '#d1fae5', border: '#10b981', text: '#065f46', dot: '#10b981' },
    { bg: '#ede9fe', border: '#8b5cf6', text: '#5b21b6', dot: '#8b5cf6' },
    { bg: '#fee2e2', border: '#ef4444', text: '#991b1b', dot: '#ef4444' },
    { bg: '#e0f2fe', border: '#0ea5e9', text: '#075985', dot: '#0ea5e9' },
  ]
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return palette[Math.abs(h) % palette.length]
}

// ─── SVG Icons ───────────────────────────────────────────────────────────────

const IcoCheck = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)
const IcoClock = ({ size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
)
const IcoUsers = ({ size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
)
const IcoBook = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
  </svg>
)
const IcoChart = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
)
const IcoClip = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 11 12 14 22 4"/>
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
  </svg>
)
const IcoCal = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
)
const IcoScheme = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
    <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
  </svg>
)
const IcoSchool = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
)
const IcoChevRight = ({ size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
)
const IcoChevDown = ({ size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
)
const IcoAlert = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
)

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Bone({ w = '100%', h = 14, r = 8 }: { w?: string | number; h?: number; r?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r, flexShrink: 0,
      background: 'linear-gradient(90deg,#f5f0eb 25%,#ece7e1 50%,#f5f0eb 75%)',
      backgroundSize: '200% 100%', animation: 'shimmer 1.5s ease-in-out infinite',
    }} />
  )
}

function LoadingSkeleton() {
  return (
    <div style={{ animation: 'fadeIn 0.2s ease' }}>
      <div style={{ background: 'linear-gradient(135deg,#1e1b4b,#2d2a6e 50%,#1a3a2a)', borderRadius: 24, padding: '22px 20px 20px', marginBottom: 14 }}>
        <Bone w={100} h={10} /><div style={{ marginTop: 10 }}><Bone w={200} h={26} /></div>
        <div style={{ marginTop: 6 }}><Bone w={140} h={10} /></div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          {[1,2,3].map(i => <div key={i} style={{ flex:1, background:'rgba(255,255,255,0.07)', borderRadius:14, padding:'12px 8px' }}><Bone w="55%" h={20} /><div style={{marginTop:5}}><Bone w="75%" h={9}/></div></div>)}
        </div>
      </div>
      <div style={{ background:'#fff', borderRadius:20, border:'1px solid #f0ece6', padding:18, marginBottom:12 }}>
        <Bone w={130} h={10} /><div style={{marginTop:14,display:'flex',gap:10}}><Bone h={110} r={16}/><Bone h={110} r={16}/></div>
      </div>
      <div style={{ background:'#fff', borderRadius:20, border:'1px solid #f0ece6', padding:18, marginBottom:12 }}>
        <Bone w={100} h={10} />{[1,2,3].map(i=><div key={i} style={{marginTop:12}}><Bone h={60} r={14}/></div>)}
      </div>
    </div>
  )
}

// ─── Lesson Slide Card ────────────────────────────────────────────────────────

function LessonSlide({ slot, onAttend, onPlan, onClass }: {
  slot: Slot
  onAttend: () => void
  onPlan:   () => void
  onClass:  () => void
}) {
  const cur    = nowMin()
  const isLive = toMin(slot.start) <= cur && toMin(slot.end) > cur
  const isDone = toMin(slot.end) <= cur
  const mins   = toMin(slot.start) - cur

  return (
    <div style={{
      background:   isDone ? '#f9f8f6' : isLive ? 'linear-gradient(135deg,#064e3b 0%,#065f46 100%)' : '#fff',
      borderRadius: 20,
      border:       isDone ? '1px solid #f0ece6' : isLive ? 'none' : '1px solid #f0ece6',
      padding:      '18px 18px 16px',
      minWidth:     260,
      width:        '80vw',
      maxWidth:     300,
      flexShrink:   0,
      boxShadow:    isLive ? '0 8px 32px rgba(6,79,58,0.25)' : '0 2px 8px rgba(0,0,0,0.05)',
      opacity:      isDone ? 0.65 : 1,
      position:     'relative',
      overflow:     'hidden',
    }}>
      {/* live shimmer top border */}
      {isLive && (
        <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:'linear-gradient(90deg,#10b981,#34d399,#10b981)', backgroundSize:'200% 100%', animation:'slideShimmer 2s linear infinite' }} />
      )}

      {/* status row */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          {isLive && <span style={{ width:7, height:7, borderRadius:'50%', background:'#34d399', display:'inline-block', animation:'livePulse 1.8s infinite', flexShrink:0 }} />}
          <span style={{ fontSize:10, fontWeight:800, letterSpacing:1, textTransform:'uppercase',
            color: isLive ? '#6ee7b7' : isDone ? '#9ca3af' : '#9ca3af' }}>
            {isLive ? 'Now' : isDone ? 'Done' : mins < 60 ? `In ${mins}m` : fmt12(slot.start)}
          </span>
        </div>
        {!isDone && (
          <span style={{
            fontSize:10, fontWeight:700, padding:'3px 9px', borderRadius:20,
            background: slot.attendanceMarked ? (isLive ? 'rgba(52,211,153,0.2)' : '#d1fae5') : (isLive ? 'rgba(245,158,11,0.2)' : '#fef3c7'),
            color:      slot.attendanceMarked ? (isLive ? '#6ee7b7' : '#065f46') : (isLive ? '#fbbf24' : '#92400e'),
          }}>
            {slot.attendanceMarked ? 'Att ✓' : 'Att pending'}
          </span>
        )}
      </div>

      {/* subject + class */}
      <div style={{ fontSize:18, fontWeight:800, color: isLive ? '#fff' : '#111827', lineHeight:1.2, marginBottom:4 }}>
        {slot.subject}
      </div>
      <div style={{ fontSize:13, color: isLive ? 'rgba(255,255,255,0.6)' : '#9ca3af', marginBottom:4 }}>
        {slot.class}
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:16 }}>
        <IcoClock size={12} color={isLive ? 'rgba(255,255,255,0.45)' : '#9ca3af'} />
        <span style={{ fontSize:12, color: isLive ? 'rgba(255,255,255,0.45)' : '#9ca3af' }}>
          {fmt12(slot.start)} – {fmt12(slot.end)} · {slot.room}
        </span>
      </div>

      {/* action buttons */}
      {!isDone && (
        <div style={{ display:'flex', gap:8 }}>
          {!slot.attendanceMarked && (
            <button onClick={onAttend} style={{
              flex:1, padding:'9px 0', borderRadius:12, border:'none',
              background: isLive ? '#10b981' : '#10b981',
              color:'#fff', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'inherit',
            }}>
              Mark Attendance
            </button>
          )}
          <button onClick={onPlan} style={{
            flex: slot.attendanceMarked ? 1 : 0, padding:'9px 14px', borderRadius:12,
            border: `1.5px solid ${isLive ? 'rgba(255,255,255,0.25)' : '#e5e7eb'}`,
            background:'transparent', color: isLive ? '#fff' : '#374151',
            fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'inherit',
          }}>
            Plan
          </button>
          <button onClick={onClass} style={{
            padding:'9px 14px', borderRadius:12,
            border: `1.5px solid ${isLive ? 'rgba(255,255,255,0.25)' : '#e5e7eb'}`,
            background:'transparent', color: isLive ? '#fff' : '#374151',
            fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'inherit',
          }}>
            Class
          </button>
        </div>
      )}
      {isDone && (
        <div style={{ display:'flex', gap:6 }}>
          <button onClick={onClass} style={{ flex:1, padding:'8px 0', borderRadius:12, border:'1.5px solid #e5e7eb', background:'transparent', color:'#6b7280', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
            View Class
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Class Summary Card ───────────────────────────────────────────────────────

function ClassSummaryCard({ cls, onOpen, onAttend, onPlan }: {
  cls:     ClassCard
  onOpen:  () => void
  onAttend:(classId: string) => void
  onPlan:  (classId: string, subjectId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const col      = classColor(cls.name)
  const attPct   = cls.totalToday > 0 ? Math.round((cls.presentToday / cls.totalToday) * 100) : null
  const pending  = cls.todaySlots.filter(s => !s.attendanceMarked && toMin(s.end) > nowMin())

  return (
    <div style={{
      background: '#fff', borderRadius: 20, border: '1px solid #f0ece6',
      overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
      marginBottom: 10,
    }}>
      {/* accent top bar */}
      <div style={{ height: 4, background: col.border }} />

      {/* main row */}
      <div style={{ padding: '16px 16px 14px' }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:12 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:17, fontWeight:800, color:'#111827', lineHeight:1.2 }}>
              {cls.name}{cls.stream ? ` · ${cls.stream}` : ''}
            </div>
            <div style={{ fontSize:12, color:'#9ca3af', marginTop:3 }}>{cls.subject || 'Class Teacher'}</div>
          </div>
          <button onClick={onOpen} style={{
            padding:'7px 14px', borderRadius:12, border:`1.5px solid ${col.border}`,
            background: col.bg, color: col.text, fontWeight:700, fontSize:12,
            cursor:'pointer', fontFamily:'inherit', flexShrink:0, marginLeft:10,
            display:'flex', alignItems:'center', gap:5,
          }}>
            Open <IcoChevRight size={12} color={col.text} />
          </button>
        </div>

        {/* stats row */}
        <div style={{ display:'flex', gap:8, marginBottom: pending.length > 0 ? 12 : 0 }}>
          <div style={{ flex:1, background:'#f9f8f6', borderRadius:12, padding:'10px 12px', textAlign:'center' }}>
            <div style={{ fontSize:16, fontWeight:800, color:'#111827' }}>{cls.studentCount}</div>
            <div style={{ fontSize:9, color:'#9ca3af', fontWeight:600, textTransform:'uppercase', letterSpacing:0.8, marginTop:2 }}>Students</div>
          </div>
          <div style={{ flex:1, background: attPct !== null ? (attPct >= 80 ? '#d1fae5' : attPct >= 60 ? '#fef3c7' : '#fee2e2') : '#f9f8f6', borderRadius:12, padding:'10px 12px', textAlign:'center' }}>
            <div style={{ fontSize:16, fontWeight:800, color: attPct !== null ? (attPct >= 80 ? '#065f46' : attPct >= 60 ? '#92400e' : '#991b1b') : '#9ca3af' }}>
              {attPct !== null ? `${attPct}%` : '—'}
            </div>
            <div style={{ fontSize:9, color:'#9ca3af', fontWeight:600, textTransform:'uppercase', letterSpacing:0.8, marginTop:2 }}>Att Today</div>
          </div>
          <div style={{ flex:1, background: cls.homeworkPending > 0 ? '#fff7ed' : '#f9f8f6', borderRadius:12, padding:'10px 12px', textAlign:'center' }}>
            <div style={{ fontSize:16, fontWeight:800, color: cls.homeworkPending > 0 ? '#c2410c' : '#9ca3af' }}>{cls.homeworkPending || '—'}</div>
            <div style={{ fontSize:9, color:'#9ca3af', fontWeight:600, textTransform:'uppercase', letterSpacing:0.8, marginTop:2 }}>HW Due</div>
          </div>
          <div style={{ flex:1, background:'#f9f8f6', borderRadius:12, padding:'10px 12px', textAlign:'center' }}>
            <div style={{ fontSize:16, fontWeight:800, color:'#111827' }}>{cls.avgScore}</div>
            <div style={{ fontSize:9, color:'#9ca3af', fontWeight:600, textTransform:'uppercase', letterSpacing:0.8, marginTop:2 }}>Avg</div>
          </div>
        </div>

        {/* pending attendance alerts */}
        {pending.length > 0 && (
          <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:12, padding:'10px 12px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
            <div style={{ display:'flex', alignItems:'center', gap:7 }}>
              <IcoAlert size={14} color="#92400e" />
              <span style={{ fontSize:12, fontWeight:600, color:'#92400e' }}>
                {pending.length} {pending.length === 1 ? 'class needs' : 'classes need'} attendance
              </span>
            </div>
            <button
              onClick={() => onAttend(cls.id)}
              style={{ padding:'6px 12px', borderRadius:10, border:'none', background:'#f59e0b', color:'#fff', fontWeight:700, fontSize:11, cursor:'pointer', fontFamily:'inherit', flexShrink:0 }}
            >
              Mark
            </button>
          </div>
        )}

        {/* unclaimed warning */}
        {cls.unclaimedCount > 0 && (
          <div style={{ marginTop:8, background:'#f0f9ff', border:'1px solid #bae6fd', borderRadius:12, padding:'9px 12px', display:'flex', alignItems:'center', gap:7 }}>
            <IcoUsers size={13} color="#0369a1" />
            <span style={{ fontSize:12, fontWeight:600, color:'#0369a1' }}>{cls.unclaimedCount} unclaimed student{cls.unclaimedCount > 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {/* expandable today's lessons */}
      {cls.todaySlots.length > 0 && (
        <>
          <div
            onClick={() => setExpanded(!expanded)}
            style={{ padding:'10px 16px', borderTop:'1px solid #f5f0ec', display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer', background:'#faf9f7' }}
          >
            <span style={{ fontSize:11, fontWeight:700, color:'#6b7280' }}>
              {cls.todaySlots.length} lesson{cls.todaySlots.length > 1 ? 's' : ''} today
            </span>
            <IcoChevDown size={13} color="#9ca3af" />
          </div>
          {expanded && (
            <div style={{ padding:'8px 16px 14px', display:'flex', flexDirection:'column', gap:8, animation:'fadeUp 0.18s ease' }}>
              {cls.todaySlots.map(slot => {
                const cur    = nowMin()
                const isLive = toMin(slot.start) <= cur && toMin(slot.end) > cur
                const isDone = toMin(slot.end) <= cur
                return (
                  <div key={slot.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 12px', borderRadius:12, background: isLive ? '#f0fdf4' : '#f9f8f6', border:`1px solid ${isLive ? '#a7f3d0' : '#f0ece6'}` }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background: isDone ? '#d1d5db' : isLive ? '#10b981' : '#f59e0b', flexShrink:0, animation: isLive ? 'livePulse 1.8s infinite' : 'none' }} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:'#111827' }}>{slot.subject}</div>
                      <div style={{ fontSize:11, color:'#9ca3af' }}>{fmt12(slot.start)} – {fmt12(slot.end)} · {slot.room}</div>
                    </div>
                    {!isDone && !slot.attendanceMarked && (
                      <button onClick={() => onAttend(cls.id)} style={{ padding:'5px 10px', borderRadius:8, border:'none', background:'#10b981', color:'#fff', fontWeight:700, fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>
                        Attend
                      </button>
                    )}
                    {!isDone && slot.attendanceMarked && (
                      <span style={{ fontSize:11, color:'#10b981', fontWeight:700, display:'flex', alignItems:'center', gap:3 }}>
                        <IcoCheck size={13} color="#10b981" /> Done
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ClassHubPage() {
  const router        = useRouter()
  const { showToast } = useToast()

  const [data,    setData]    = useState<PageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [clock,   setClock]   = useState('')
  const slideRef              = useRef<HTMLDivElement>(null)
  const [activeSlide, setActiveSlide] = useState(0)

  useEffect(() => {
    function tick() {
      const n = new Date()
      setClock(`${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`)
    }
    tick()
    const id = setInterval(tick, 15000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/academy/signin?role=teacher'); return }

    const uid     = user.id
    const today   = new Date().toISOString().split('T')[0]
    const rawDow  = new Date().getDay()
    const dow     = rawDow === 0 ? 7 : rawDow

    const [profileRes, teacherProfileRes, slotsRes, tcClassRes] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', uid).single(),
      supabase.from('teacher_profiles').select('designation').eq('profile_id', uid).maybeSingle(),
      supabase.from('timetable_slots')
        .select('id,day_of_week,start_time,end_time,room,class_id,subject_id,subjects(name),classes(name,stream)')
        .eq('teacher_id', uid)
        .order('day_of_week', { ascending: true })
        .order('start_time',  { ascending: true }),
      supabase.from('teacher_classes').select('class_id').eq('teacher_id', uid).eq('is_class_teacher', true),
    ])

    const designation = teacherProfileRes.data?.designation ?? null
    if (designation === 'subject_teacher') { router.push('/teacher/subjecthub'); return }

    const fullName = profileRes.data?.full_name ?? ''
    const slotIds  = (slotsRes.data ?? []).map((s: any) => s.id)
    const schoolId = await getSchoolId(uid)

    const [schoolRes, attBatchRes] = await Promise.all([
      schoolId ? supabase.from('schools').select('name').eq('id', schoolId).single() : Promise.resolve({ data: null }),
      slotIds.length > 0
        ? supabase.from('attendance').select('timetable_slot_id').in('timetable_slot_id', slotIds).eq('date', today)
        : Promise.resolve({ data: [] }),
    ])

    const markedIds = new Set((attBatchRes.data ?? []).map((r: any) => r.timetable_slot_id))

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
        attendanceMarked: markedIds.has(slot.id),
        classId:          slot.class_id,
        subjectId:        slot.subject_id,
      }
    })

    const todaySlots = allSlots.filter(s => Number(s.day_of_week) === Number(dow))

    // Load class cards
    const classIds = Array.from(new Set(
      (tcClassRes.data ?? []).map((r: any) => r.class_id).filter(Boolean)
    ))

    let classes: ClassCard[] = []

    if (classIds.length > 0) {
      const [classRes, studentRes, attTodayRes, hwRes, assessRes] = await Promise.all([
        supabase.from('classes').select('*').in('id', classIds),
        supabase.from('students').select('class_id,id').in('class_id', classIds),
        supabase.from('attendance').select('class_id,status').in('class_id', classIds).eq('date', today),
        supabase.from('homework').select('class_id,status').in('class_id', classIds).eq('status', 'pending'),
        supabase.from('cbc_assessments').select('class_id,performance').in('class_id', classIds),
      ])
      const claimRes = await supabase.from('student_claim_codes').select('student_id,claimed').eq('claimed', false).in('student_id', (studentRes?.data ?? []).map((s: any) => s.id))

      const studentMap: Record<string, number>   = {}
      const studentIds: Record<string, string[]> = {}
      for (const s of studentRes.data ?? []) {
        studentMap[s.class_id]  = (studentMap[s.class_id] ?? 0) + 1
        studentIds[s.class_id]  = [...(studentIds[s.class_id] ?? []), s.id]
      }

      const presentMap: Record<string, number> = {}
      const totalMap:   Record<string, number> = {}
      for (const a of attTodayRes.data ?? []) {
        totalMap[a.class_id]   = (totalMap[a.class_id] ?? 0) + 1
        if (a.status === 'present') presentMap[a.class_id] = (presentMap[a.class_id] ?? 0) + 1
      }

      const hwMap: Record<string, number> = {}
      for (const h of hwRes.data ?? []) hwMap[h.class_id] = (hwMap[h.class_id] ?? 0) + 1

      const PERF_MAP: Record<string, number> = { BE:1, AE:2, ME:3, EE:4 }
      const scoreMap: Record<string, number[]> = {}
      for (const a of assessRes.data ?? []) {
        const v = PERF_MAP[a.performance]
        if (v) scoreMap[a.class_id] = [...(scoreMap[a.class_id] ?? []), v]
      }

      const unclaimedStudentIds = new Set((claimRes?.data ?? []).map((c: any) => c.student_id))
      const unclaimedMap: Record<string, number> = {}
      for (const [cid, ids] of Object.entries(studentIds)) {
        unclaimedMap[cid] = ids.filter(id => unclaimedStudentIds.has(id)).length
      }

      classes = (classRes.data ?? []).map((c: any) => {
        const scores  = scoreMap[c.id] ?? []
        const avg     = scores.length > 0 ? (scores.reduce((a: number, b: number) => a + b, 0) / scores.length).toFixed(1) + '/4' : '—'
        const cSlots  = todaySlots.filter(s => s.classId === c.id)
        return {
          id:              c.id,
          name:            c.name,
          stream:          c.stream ?? '',
          subject:         c.subject ?? '',
          studentCount:    studentMap[c.id]  ?? 0,
          presentToday:    presentMap[c.id]  ?? 0,
          totalToday:      totalMap[c.id]    ?? 0,
          homeworkPending: hwMap[c.id]       ?? 0,
          avgScore:        avg,
          unclaimedCount:  unclaimedMap[c.id] ?? 0,
          todaySlots:      cSlots,
        }
      })
    }

    setData({ fullName, school: (schoolRes.data as any)?.name ?? '', allSlots, todaySlots, classes })
    setLoading(false)
  }

  // scroll handler for slide dots
  function onSlideScroll() {
    if (!slideRef.current) return
    const el    = slideRef.current
    const index = Math.round(el.scrollLeft / (el.offsetWidth * 0.82))
    setActiveSlide(index)
  }

  if (loading) return <LoadingSkeleton />
  if (!data)   return null

  const firstName     = data.fullName.split(' ')[0] || 'Teacher'
  const cur           = nowMin()
  const currentLesson = data.todaySlots.find(s => toMin(s.start) <= cur && toMin(s.end) > cur)
  const totalLessons  = data.todaySlots.length
  const markedCount   = data.todaySlots.filter(s => s.attendanceMarked).length
  const pendingAtt    = data.todaySlots.filter(s => !s.attendanceMarked && toMin(s.end) > cur).length

  const totalStudents  = data.classes.reduce((a, c) => a + c.studentCount, 0)
  const totalPresent   = data.classes.reduce((a, c) => a + c.presentToday, 0)
  const totalEnrolled  = data.classes.reduce((a, c) => a + c.totalToday, 0)
  const overallAttPct  = totalEnrolled > 0 ? Math.round((totalPresent / totalEnrolled) * 100) : 0

  return (
    <div style={{ paddingBottom: 32, animation: 'pageIn 0.28s ease' }}>
      <style>{`
        @keyframes shimmer      { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes pageIn       { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes livePulse    { 0%,100%{box-shadow:0 0 0 0 rgba(16,185,129,0.5)} 60%{box-shadow:0 0 0 6px rgba(16,185,129,0)} }
        @keyframes fadeUp       { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn       { from{opacity:0} to{opacity:1} }
        @keyframes slideShimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        .tap-shrink:active      { transform:scale(0.96) !important; }
        .tap-dim:active         { opacity:0.7 !important; }
      `}</style>

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <div style={{
        background:   'linear-gradient(135deg, #1e1b4b 0%, #2d2a6e 50%, #1a3a2a 100%)',
        borderRadius: 24,
        padding:      '22px 20px 20px',
        marginBottom: 14,
        position:     'relative',
        overflow:     'hidden',
      }}>
        {/* warm glow orbs */}
        <div style={{ position:'absolute', bottom:-60, left:-30, width:220, height:220, borderRadius:'50%', background:'radial-gradient(circle,rgba(245,158,11,0.15) 0%,transparent 70%)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', top:-40, right:-20, width:180, height:180, borderRadius:'50%', background:'radial-gradient(circle,rgba(16,185,129,0.1) 0%,transparent 70%)', pointerEvents:'none' }} />

        {/* top row */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:18, position:'relative' }}>
          {/* ── DYNAMIC FACE ── */}
          {(() => {
            const cur2        = nowMin()
            const firstSlot   = data.todaySlots.length > 0 ? data.todaySlots.reduce((a,b) => toMin(a.start) < toMin(b.start) ? a : b) : null
            const lastSlot    = data.todaySlots.length > 0 ? data.todaySlots.reduce((a,b) => toMin(a.end) > toMin(b.end) ? a : b) : null
            const liveSlot    = data.todaySlots.find(s => toMin(s.start) <= cur2 && toMin(s.end) > cur2)
            const nextSlot    = data.todaySlots.find(s => toMin(s.start) > cur2)
            const minsToFirst = firstSlot ? toMin(firstSlot.start) - cur2 : 999
            const dayDone     = lastSlot ? cur2 >= toMin(lastSlot.end) : true
            const lessonsLeft = data.todaySlots.filter(s => toMin(s.end) > cur2).length
            const lessonsDone = data.todaySlots.filter(s => toMin(s.end) <= cur2).length
            const isEvening   = cur2 >= 20 * 60
            const noSlots     = data.todaySlots.length === 0

            // FACE 7 — Rest day
            if (noSlots) return (
              <div style={{ flex:1 }}>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.35)', fontWeight:600, letterSpacing:0.3, marginBottom:8 }}>
                  {new Date().toLocaleDateString('en-KE',{ weekday:'long', day:'numeric', month:'long' })}
                </div>
                <div style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.35)', letterSpacing:1.4, textTransform:'uppercase', marginBottom:4 }}>No lessons today</div>
                <div style={{ fontSize:20, fontWeight:800, color:'#fff', lineHeight:1.15 }}>{data.school}</div>
                <div style={{ fontSize:12, color:'rgba(255,255,255,0.45)', marginTop:4 }}>
                  {data.allSlots.length > 0 ? `${data.allSlots.length} lessons set this week` : 'Set up your timetable'}
                </div>
              </div>
            )

            // FACE 6 — Evening reflection
            if (isEvening) return (
              <div style={{ flex:1 }}>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.35)', fontWeight:600, letterSpacing:0.3, marginBottom:8 }}>
                  {new Date().toLocaleDateString('en-KE',{ weekday:'long', day:'numeric', month:'long' })}
                </div>
                <div style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.35)', letterSpacing:1.4, textTransform:'uppercase', marginBottom:4 }}>This week</div>
                <div style={{ fontSize:20, fontWeight:800, color:'#fff', lineHeight:1.15 }}>Week {Math.ceil(new Date().getDate()/7)} · Term 2</div>
                <div style={{ fontSize:12, color:'rgba(255,255,255,0.45)', marginTop:4 }}>
                  {data.allSlots.length} lessons · {data.classes.length} classes
                </div>
              </div>
            )

            // FACE 1 — Early morning, >30 mins to first lesson
            if (firstSlot && minsToFirst > 30 && lessonsDone === 0) return (
              <div style={{ flex:1 }}>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.35)', fontWeight:600, letterSpacing:0.3, marginBottom:8 }}>
                  {new Date().toLocaleDateString('en-KE',{ weekday:'long', day:'numeric', month:'long' })}
                </div>
                <div style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.35)', letterSpacing:1.4, textTransform:'uppercase', marginBottom:4 }}>
                  First lesson at {fmt12(firstSlot.start)}
                </div>
                <div style={{ fontSize:20, fontWeight:800, color:'#fff', lineHeight:1.15 }}>
                  {data.todaySlots.length} lesson{data.todaySlots.length !== 1 ? 's' : ''} today
                </div>
                <div style={{ fontSize:12, color:'rgba(255,255,255,0.45)', marginTop:4 }}>
                  {totalStudents} students · {data.classes.length} class{data.classes.length !== 1 ? 'es' : ''}
                </div>
              </div>
            )

            // FACE 2 — Assembly, 30 mins or less to first lesson
            if (firstSlot && minsToFirst <= 30 && minsToFirst > 0 && lessonsDone === 0) return (
              <div style={{ flex:1 }}>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.35)', fontWeight:600, letterSpacing:0.3, marginBottom:8 }}>
                  {new Date().toLocaleDateString('en-KE',{ weekday:'long', day:'numeric', month:'long' })}
                </div>
                <div style={{ fontSize:11, fontWeight:700, color:'#fbbf24', letterSpacing:1.4, textTransform:'uppercase', marginBottom:4 }}>
                  Starting in {minsToFirst} min{minsToFirst !== 1 ? 's' : ''}
                </div>
                <div style={{ fontSize:20, fontWeight:800, color:'#fff', lineHeight:1.15 }}>
                  {firstSlot.subject}
                </div>
                <div style={{ fontSize:12, color:'rgba(255,255,255,0.55)', marginTop:4 }}>
                  {firstSlot.class}{firstSlot.room ? ` · ${firstSlot.room}` : ''}
                </div>
              </div>
            )

            // FACE 3 — In class (live slot)
            if (liveSlot) return (
              <div style={{ flex:1 }}>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.35)', fontWeight:600, letterSpacing:0.3, marginBottom:8 }}>
                  {new Date().toLocaleDateString('en-KE',{ weekday:'long', day:'numeric', month:'long' })}
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                  <div style={{ width:7, height:7, borderRadius:'50%', background:'#10b981', animation:'livePulse 2s infinite' }} />
                  <div style={{ fontSize:11, fontWeight:700, color:'#6ee7b7', letterSpacing:1.4, textTransform:'uppercase' }}>Now in session</div>
                </div>
                <div style={{ fontSize:20, fontWeight:800, color:'#fff', lineHeight:1.15 }}>{liveSlot.subject}</div>
                <div style={{ fontSize:12, color:'rgba(255,255,255,0.55)', marginTop:4 }}>
                  {liveSlot.class}{liveSlot.room ? ` · ${liveSlot.room}` : ''} · ends {fmt12(liveSlot.end)}
                </div>
              </div>
            )

            // FACE 4 — Break (between slots)
            if (nextSlot && !liveSlot && !dayDone) {
              const minsToNext = toMin(nextSlot.start) - cur2
              return (
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,0.35)', fontWeight:600, letterSpacing:0.3, marginBottom:8 }}>
                    {new Date().toLocaleDateString('en-KE',{ weekday:'long', day:'numeric', month:'long' })}
                  </div>
                  <div style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.35)', letterSpacing:1.4, textTransform:'uppercase', marginBottom:4 }}>
                    Break · {minsToNext} min{minsToNext !== 1 ? 's' : ''} to next
                  </div>
                  <div style={{ fontSize:20, fontWeight:800, color:'#fff', lineHeight:1.15 }}>{nextSlot.subject}</div>
                  <div style={{ fontSize:12, color:'rgba(255,255,255,0.55)', marginTop:4 }}>
                    {nextSlot.class} · {lessonsDone} done · {lessonsLeft} left
                  </div>
                </div>
              )
            }

            // FACE 5 — Day done
            return (
              <div style={{ flex:1 }}>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.35)', fontWeight:600, letterSpacing:0.3, marginBottom:8 }}>
                  {new Date().toLocaleDateString('en-KE',{ weekday:'long', day:'numeric', month:'long' })}
                </div>
                <div style={{ fontSize:11, fontWeight:700, color:'#6ee7b7', letterSpacing:1.4, textTransform:'uppercase', marginBottom:4 }}>Day complete</div>
                <div style={{ fontSize:20, fontWeight:800, color:'#fff', lineHeight:1.15 }}>
                  {lessonsDone} lesson{lessonsDone !== 1 ? 's' : ''} delivered
                </div>
                <div style={{ fontSize:12, color:'rgba(255,255,255,0.45)', marginTop:4 }}>
                  {(() => {
                    const tom = data.allSlots.filter(s => Number(s.day_of_week) === (new Date().getDay() % 7) + 1)
                    return tom.length > 0 ? `Tomorrow · ${tom.length} lesson${tom.length !== 1 ? 's' : ''} · starts ${fmt12(tom.reduce((a,b) => toMin(a.start) < toMin(b.start) ? a : b).start)}` : 'No lessons tomorrow'
                  })()}
                </div>
              </div>
            )
          })()}
          {/* ── CLOCK (compact) ── */}
          <div style={{ textAlign:'right', flexShrink:0, alignSelf:'flex-start' }}>
            <div style={{ fontSize:20, fontWeight:200, color:'rgba(255,255,255,0.75)', fontVariantNumeric:'tabular-nums', letterSpacing:1.5, lineHeight:1 }}>
              {clock}
            </div>
            <div style={{ fontSize:9, color:'rgba(255,255,255,0.25)', fontWeight:700, marginTop:3, letterSpacing:1, textTransform:'uppercase' }}>
              {currentLesson ? 'live' : 'now'}
            </div>
          </div>
        </div>

        {/* stat chips */}
        <div style={{ display:'flex', gap:8, position:'relative' }}>
          {[
            { label:'Lessons', value: totalLessons,               sub: totalLessons === 1 ? 'today' : 'today'  },
            { label:'Students', value: totalStudents,             sub: `${data.classes.length} class${data.classes.length !== 1 ? 'es' : ''}` },
            { label:'Attendance', value: overallAttPct > 0 ? `${overallAttPct}%` : '—', sub: 'today' },
            { label:'Pending', value: pendingAtt,                 sub: 'to mark', warn: pendingAtt > 0 },
          ].map(s => (
            <div key={s.label} style={{
              flex:1,
              background: s.warn && (s.value as number) > 0 ? 'rgba(245,158,11,0.18)' : 'rgba(255,255,255,0.07)',
              border: `1px solid ${s.warn && (s.value as number) > 0 ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.09)'}`,
              borderRadius:14, padding:'10px 6px', textAlign:'center',
            }}>
              <div style={{ fontSize:18, fontWeight:800, color: s.warn && (s.value as number) > 0 ? '#fbbf24' : '#fff', lineHeight:1 }}>{s.value}</div>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.4)', fontWeight:600, marginTop:3, textTransform:'uppercase', letterSpacing:0.7 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── SAVINGS STRIP ─────────────────────────────────────────────── */}
        {(() => {
          const attCount    = data.todaySlots.filter(s => s.attendanceMarked).length
          const savedToday  = (attCount * 15) + (markedCount * 5)
          const weekMins    = data.allSlots.length > 0
            ? (data.allSlots.filter(s => s.attendanceMarked).length * 15) + (data.classes.reduce((a,c) => a + (c.homeworkPending > 0 ? 20 : 0), 0))
            : 0
          const todayH      = Math.floor(savedToday / 60)
          const todayM      = savedToday % 60
          const weekH       = Math.floor(weekMins / 60)
          const weekM       = weekMins % 60
          const weekPct     = Math.min(100, Math.round((weekMins / 480) * 100))
          if (savedToday === 0 && weekMins === 0) return null
          return (
            <div style={{ marginTop:14, paddingTop:12, borderTop:'1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ fontSize:13 }}>⚡</span>
                  <div>
                    <span style={{ fontSize:12, fontWeight:800, color:'#fbbf24' }}>
                      {savedToday > 0 ? `Saved ${todayH > 0 ? `${todayH}h ` : ''}${todayM}m today` : `Saved ${weekH > 0 ? `${weekH}h ` : ''}${weekM}m this week`}
                    </span>
                    {weekMins > 0 && savedToday > 0 && (
                      <span style={{ fontSize:10, color:'rgba(255,255,255,0.35)', marginLeft:6 }}>
                        {weekH > 0 ? `${weekH}h ` : ''}{weekM}m this week
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.35)' }}>vs manual</div>
              </div>
              <div style={{ height:4, borderRadius:4, background:'rgba(255,255,255,0.08)', overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${weekPct}%`, borderRadius:4, background:'linear-gradient(90deg,#f59e0b,#fbbf24)', transition:'width 1s ease' }} />
              </div>
            </div>
          )
        })()}
      </div>

      {/* ── TODAY'S LESSONS — SWIPEABLE SLIDES ───────────────────────────── */}
      {data.todaySlots.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize:10, fontWeight:800, color:'#9ca3af', letterSpacing:1.6, textTransform:'uppercase', marginBottom:12, paddingLeft:2 }}>
            Today · {data.todaySlots.length} {data.todaySlots.length === 1 ? 'lesson' : 'lessons'}
            {markedCount > 0 && <span style={{ color:'#10b981', marginLeft:8 }}>{markedCount} marked</span>}
          </div>
          <div
            ref={slideRef}
            onScroll={onSlideScroll}
            style={{ display:'flex', gap:12, overflowX:'auto', scrollSnapType:'x mandatory', paddingBottom:4, scrollbarWidth:'none', WebkitOverflowScrolling:'touch' }}
          >
            <style>{`.slides-scroll::-webkit-scrollbar{display:none}`}</style>
            {data.todaySlots.map((slot, i) => (
              <div key={slot.id} style={{ scrollSnapAlign:'start', animation:`fadeUp 0.3s ease ${i*60}ms both` }}>
                <LessonSlide
                  slot={slot}
                  onAttend={() => router.push('/teacher/attendance?classId=' + slot.classId)}
                  onPlan={()   => router.push('/teacher/lessonplan?classId=' + slot.classId + '&subjectId=' + slot.subjectId)}
                  onClass={()  => router.push('/teacher/classhub/' + slot.classId)}
                />
              </div>
            ))}
            {/* trailing space */}
            <div style={{ width:20, flexShrink:0 }} />
          </div>
          {/* dots */}
          {data.todaySlots.length > 1 && (
            <div style={{ display:'flex', justifyContent:'center', gap:5, marginTop:10 }}>
              {data.todaySlots.map((_, i) => (
                <div key={i} style={{ width: i === activeSlide ? 18 : 6, height:6, borderRadius:3, background: i === activeSlide ? '#1e1b4b' : '#e5e7eb', transition:'all 0.2s ease' }} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── SMART TIMETABLE CARD ───────────────────────────────────────── */}
      {(() => {
        const cur3     = nowMin()
        const live3    = data.todaySlots.find(s => toMin(s.start) <= cur3 && toMin(s.end) > cur3)
        const next3    = data.todaySlots.find(s => toMin(s.start) > cur3)
        const prev3    = data.todaySlots.filter(s => toMin(s.end) <= cur3).slice(-1)[0]
        const noToday  = data.todaySlots.length === 0
        // find next lesson across whole week if no slots today
        const nextWeek = noToday ? data.allSlots
          .filter(s => Number(s.day_of_week) > new Date().getDay() || (Number(s.day_of_week) === new Date().getDay() && toMin(s.start) > cur3))
          .sort((a,b) => Number(a.day_of_week) - Number(b.day_of_week) || toMin(a.start) - toMin(b.start))[0] : null
        const show3    = live3 ?? next3 ?? prev3
        const label3   = live3 ? 'NOW' : next3 ? 'NEXT' : prev3 ? 'LAST' : null
        const isLive3  = !!live3

        return (
          <div style={{ background:'linear-gradient(135deg,#059669 0%,#047857 100%)', borderRadius:20, padding:'18px 18px', marginBottom:14, position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:-40, right:-30, width:160, height:160, borderRadius:'50%', background:'rgba(255,255,255,0.06)', pointerEvents:'none' }} />
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: show3 ? 12 : 0 }}>
              <div>
                <div style={{ fontSize:9, fontWeight:800, color:'rgba(255,255,255,0.55)', letterSpacing:1.8, textTransform:'uppercase', marginBottom:2 }}>SmartTimetable</div>
                <div style={{ fontSize:15, fontWeight:800, color:'#fff' }}>
                  {noToday
                    ? nextWeek ? `Next lesson ${['','Mon','Tue','Wed','Thu','Fri','Sat','Sun'][Number(nextWeek.day_of_week)] ?? ''}` : 'No lessons this week'
                    : `${data.todaySlots.length} lesson${data.todaySlots.length !== 1 ? 's' : ''} · ${data.classes.length} class${data.classes.length !== 1 ? 'es' : ''} today`}
                </div>
              </div>
              <button
                className="tap-shrink"
                onClick={() => router.push('/teacher/timetable')}
                style={{ padding:'7px 14px', borderRadius:10, border:'1px solid rgba(255,255,255,0.3)', background:'transparent', color:'#fff', fontWeight:700, fontSize:11, cursor:'pointer', fontFamily:'inherit' }}
              >
                + Add Slot
              </button>
            </div>
            {show3 && (
              <div
                className="tap-shrink"
                onClick={() => router.push('/teacher/classhub/' + show3.classId)}
                style={{ background:'rgba(255,255,255,0.15)', borderRadius:14, padding:'12px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer', backdropFilter:'blur(4px)' }}
              >
                <div>
                  <div style={{ fontSize:9, fontWeight:800, color: isLive3 ? '#6ee7b7' : 'rgba(255,255,255,0.5)', letterSpacing:1.4, textTransform:'uppercase', marginBottom:3 }}>
                    {label3}
                  </div>
                  <div style={{ fontSize:15, fontWeight:800, color:'#fff' }}>{show3.subject} · {show3.class}</div>
                  {show3.room && <div style={{ fontSize:11, color:'rgba(255,255,255,0.55)', marginTop:1 }}>{show3.room}</div>}
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.75)' }}>
                    {isLive3 ? `ends ${fmt12(show3.end)}` : live3 === undefined && next3 ? fmt12(show3.start) : fmt12(show3.end)}
                  </div>
                  {isLive3 && (
                    <div style={{ display:'flex', alignItems:'center', gap:4, justifyContent:'flex-end', marginTop:3 }}>
                      <div style={{ width:6, height:6, borderRadius:'50%', background:'#6ee7b7', animation:'livePulse 2s infinite' }} />
                      <div style={{ fontSize:10, color:'#6ee7b7', fontWeight:700 }}>Live</div>
                    </div>
                  )}
                </div>
              </div>
            )}
            {noToday && nextWeek && (
              <div style={{ marginTop:10, padding:'10px 14px', background:'rgba(255,255,255,0.1)', borderRadius:12 }}>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)', marginBottom:2 }}>{nextWeek.subject} · {nextWeek.class}</div>
                <div style={{ fontSize:12, fontWeight:700, color:'#fff' }}>{fmt12(nextWeek.start)} – {fmt12(nextWeek.end)}{nextWeek.room ? ` · ${nextWeek.room}` : ''}</div>
              </div>
            )}
          </div>
        )
      })()}
      {/* live timetable strip — shown when lessons exist */}
      {data.todaySlots.length > 0 && (() => {
        const cur2        = nowMin()
        const live        = data.todaySlots.find(s => toMin(s.start) <= cur2 && toMin(s.end) > cur2)
        const upcoming    = data.todaySlots.find(s => toMin(s.start) > cur2)
        const show        = live ?? upcoming
        if (!show) return null
        const isLive2     = live != null
        return (
          <div style={{ background:'linear-gradient(135deg,#059669 0%,#047857 100%)', borderRadius:20, padding:'18px 18px', marginBottom:14, position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:-40, right:-30, width:160, height:160, borderRadius:'50%', background:'rgba(255,255,255,0.06)', pointerEvents:'none' }} />
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <div>
                <div style={{ fontSize:9, fontWeight:800, color:'rgba(255,255,255,0.55)', letterSpacing:1.8, textTransform:'uppercase', marginBottom:2 }}>SmartTimetable</div>
                <div style={{ fontSize:15, fontWeight:800, color:'#fff' }}>
                  {data.todaySlots.length} lesson{data.todaySlots.length !== 1 ? 's' : ''} · {data.classes.length} class{data.classes.length !== 1 ? 'es' : ''} today
                </div>
              </div>
              <button
                className="tap-shrink"
                onClick={() => router.push('/teacher/timetable')}
                style={{ padding:'7px 14px', borderRadius:10, border:'1px solid rgba(255,255,255,0.3)', background:'transparent', color:'#fff', fontWeight:700, fontSize:11, cursor:'pointer', fontFamily:'inherit' }}
              >
                + Add Slot
              </button>
            </div>
            <div
              className="tap-shrink"
              onClick={() => router.push('/teacher/attendance?classId=' + show.classId)}
              style={{ background:'rgba(255,255,255,0.15)', borderRadius:14, padding:'12px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer', backdropFilter:'blur(4px)' }}
            >
              <div>
                <div style={{ fontSize:9, fontWeight:800, color: isLive2 ? '#6ee7b7' : 'rgba(255,255,255,0.5)', letterSpacing:1.4, textTransform:'uppercase', marginBottom:3 }}>
                  {isLive2 ? 'NOW' : 'NEXT'}
                </div>
                <div style={{ fontSize:15, fontWeight:800, color:'#fff' }}>{show.subject} · {show.class}</div>
                {show.room && <div style={{ fontSize:11, color:'rgba(255,255,255,0.55)', marginTop:1 }}>{show.room}</div>}
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.75)' }}>
                  {isLive2 ? `ends ${fmt12(show.end)}` : fmt12(show.start)}
                </div>
                {!show.attendanceMarked && (
                  <div style={{ fontSize:10, color:'#fcd34d', fontWeight:600, marginTop:3 }}>Att pending</div>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── MY CLASSES ────────────────────────────────────────────────────── */}
      {data.classes.length > 0 && (
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:10, fontWeight:800, color:'#9ca3af', letterSpacing:1.6, textTransform:'uppercase', marginBottom:12, paddingLeft:2 }}>
            My Classes
          </div>
          {data.classes.map((cls, i) => (
            <div key={cls.id} style={{ animation:`fadeUp 0.3s ease ${i*80}ms both` }}>
              <ClassSummaryCard
                cls={cls}
                onOpen={()         => router.push('/teacher/classhub/' + cls.id)}
                onAttend={(cid)    => router.push('/teacher/attendance?classId=' + cid)}
                onPlan={(cid, sid) => router.push('/teacher/lessonplan?classId=' + cid)}
              />
            </div>
          ))}
        </div>
      )}

      {/* no classes state */}
      {data.classes.length === 0 && (
        <div style={{ background:'#fff', borderRadius:20, border:'1px solid #f0ece6', padding:'28px 20px', textAlign:'center', marginBottom:14 }}>
          <div style={{ fontSize:13, color:'#9ca3af', fontWeight:500, marginBottom:12 }}>No classes assigned yet</div>
          <button
            className="tap-shrink"
            onClick={() => router.push('/teacher/classhub/setup')}
            style={{ padding:'10px 20px', borderRadius:12, border:'none', background:'#1e1b4b', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}
          >
            Create a class
          </button>
        </div>
      )}

      {/* ── SECONDARY ACTIONS ─────────────────────────────────────────────── */}
      <div style={{ background:'#fff', borderRadius:20, border:'1px solid #f0ece6', padding:'18px 16px', marginBottom:14, boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
        <div style={{ fontSize:10, fontWeight:800, color:'#9ca3af', letterSpacing:1.6, textTransform:'uppercase', marginBottom:14 }}>More</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
          {[
            { label:'Results',   Icon: IcoChart,  href:'/teacher/results',    bg:'#fff7ed', ink:'#9a3412' },
            { label:'Assess',    Icon: IcoClip,   href:'/teacher/assessment', bg:'#fef9c3', ink:'#854d0e' },
            { label:'Scheme',    Icon: IcoScheme, href:'/teacher/scheme',     bg:'#fce7f3', ink:'#9d174d' },
            { label:'SchoolHub', Icon: IcoSchool, href:'/teacher/schoolhub',  bg:'#f0fdf4', ink:'#166534' },
          ].map(a => (
            <button
              key={a.label}
              className="tap-shrink"
              onClick={() => router.push(a.href)}
              style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:7, padding:'12px 4px', borderRadius:16, border:'none', background:a.bg, cursor:'pointer', fontFamily:'inherit', transition:'transform 0.12s' }}
            >
              <span style={{ color:a.ink, display:'flex' }}><a.Icon size={18} color={a.ink} /></span>
              <span style={{ fontSize:9.5, fontWeight:800, color:a.ink, textAlign:'center', lineHeight:1.3 }}>{a.label}</span>
            </button>
          ))}
        </div>

        {/* ── SAVINGS STRIP ─────────────────────────────────────────────── */}
        {(() => {
          const attCount    = data.todaySlots.filter(s => s.attendanceMarked).length
          const savedToday  = (attCount * 15) + (markedCount * 5)
          const weekMins    = data.allSlots.length > 0
            ? (data.allSlots.filter(s => s.attendanceMarked).length * 15) + (data.classes.reduce((a,c) => a + (c.homeworkPending > 0 ? 20 : 0), 0))
            : 0
          const todayH      = Math.floor(savedToday / 60)
          const todayM      = savedToday % 60
          const weekH       = Math.floor(weekMins / 60)
          const weekM       = weekMins % 60
          const weekPct     = Math.min(100, Math.round((weekMins / 480) * 100))
          if (savedToday === 0 && weekMins === 0) return null
          return (
            <div style={{ marginTop:14, paddingTop:12, borderTop:'1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ fontSize:13 }}>⚡</span>
                  <div>
                    <span style={{ fontSize:12, fontWeight:800, color:'#fbbf24' }}>
                      {savedToday > 0 ? `Saved ${todayH > 0 ? `${todayH}h ` : ''}${todayM}m today` : `Saved ${weekH > 0 ? `${weekH}h ` : ''}${weekM}m this week`}
                    </span>
                    {weekMins > 0 && savedToday > 0 && (
                      <span style={{ fontSize:10, color:'rgba(255,255,255,0.35)', marginLeft:6 }}>
                        {weekH > 0 ? `${weekH}h ` : ''}{weekM}m this week
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.35)' }}>vs manual</div>
              </div>
              <div style={{ height:4, borderRadius:4, background:'rgba(255,255,255,0.08)', overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${weekPct}%`, borderRadius:4, background:'linear-gradient(90deg,#f59e0b,#fbbf24)', transition:'width 1s ease' }} />
              </div>
            </div>
          )
        })()}
      </div>

      {/* ── SCHOOL PULSE ──────────────────────────────────────────────────── */}
      <div style={{ textAlign:'center', padding:'4px 0 2px' }}>
        <span style={{ fontSize:11, color:'#d1ccc5', fontWeight:500 }}>
          {data.school} · {new Date().toLocaleDateString('en-KE',{ weekday:'long' })}
        </span>
      </div>
    </div>
  )
}
