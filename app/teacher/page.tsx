"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useToast } from '@/app/teacher/layout'
import SmartTimetablePreview from '@/components/teacher/SmartTimetablePreview'
import SmartInsightSlides from '@/components/teacher/SmartInsightSlides'

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
function classColor(name: string) {
  const palette = [
    { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
    { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
    { bg: '#d1fae5', border: '#10b981', text: '#065f46' },
    { bg: '#ede9fe', border: '#8b5cf6', text: '#5b21b6' },
    { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' },
    { bg: '#e0f2fe', border: '#0ea5e9', text: '#075985' },
  ]
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return palette[Math.abs(h) % palette.length]
}

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
const IcoAlert = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
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
const IcoCal = ({ size = 20, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
)
const IcoClip = ({ size = 20, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 11 12 14 22 4"/>
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
  </svg>
)
const IcoBook = ({ size = 20, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
  </svg>
)
const IcoNote = ({ size = 20, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="9" y1="13" x2="15" y2="13"/>
    <line x1="9" y1="17" x2="15" y2="17"/>
  </svg>
)
const IcoChart = ({ size = 20, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
)
const IcoStudents = ({ size = 20, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
)

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
          {[1,2,3,4].map(i => <div key={i} style={{ flex:1, background:'rgba(255,255,255,0.07)', borderRadius:14, padding:'12px 8px' }}><Bone w="55%" h={20} /><div style={{marginTop:5}}><Bone w="75%" h={9}/></div></div>)}
        </div>
      </div>
      <div style={{ background:'#fff', borderRadius:20, border:'1px solid #f0ece6', padding:18, marginBottom:12 }}>
        <Bone w={130} h={10} /><div style={{marginTop:14,display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>{[1,2,3,4,5,6].map(i=><Bone key={i} h={72} r={16}/>)}</div>
      </div>
      <div style={{ background:'#fff', borderRadius:20, border:'1px solid #f0ece6', padding:18, marginBottom:12 }}>
        <Bone w={100} h={10} />{[1,2,3].map(i=><div key={i} style={{marginTop:12}}><Bone h={60} r={14}/></div>)}
      </div>
    </div>
  )
}

function LessonSlide({ slot, onAttend, onPlan, onClass }: {
  slot:     Slot
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
      {isLive && (
        <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:'linear-gradient(90deg,#10b981,#34d399,#10b981)', backgroundSize:'200% 100%', animation:'slideShimmer 2s linear infinite' }} />
      )}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          {isLive && <span style={{ width:7, height:7, borderRadius:'50%', background:'#34d399', display:'inline-block', animation:'livePulse 1.8s infinite', flexShrink:0 }} />}
          <span style={{ fontSize:10, fontWeight:800, letterSpacing:1, textTransform:'uppercase', color: isLive ? '#6ee7b7' : '#9ca3af' }}>
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
      <div style={{ fontSize:18, fontWeight:800, color: isLive ? '#fff' : '#111827', lineHeight:1.2, marginBottom:4 }}>{slot.subject}</div>
      <div style={{ fontSize:13, color: isLive ? 'rgba(255,255,255,0.6)' : '#9ca3af', marginBottom:4 }}>{slot.class}</div>
      <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:16 }}>
        <IcoClock size={12} color={isLive ? 'rgba(255,255,255,0.45)' : '#9ca3af'} />
        <span style={{ fontSize:12, color: isLive ? 'rgba(255,255,255,0.45)' : '#9ca3af' }}>
          {fmt12(slot.start)} – {fmt12(slot.end)} · {slot.room}
        </span>
      </div>
      {!isDone && (
        <div style={{ display:'flex', gap:8 }}>
          {!slot.attendanceMarked && (
            <button onClick={onAttend} style={{ flex:1, padding:'9px 0', borderRadius:12, border:'none', background:'#10b981', color:'#fff', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
              Mark Attendance
            </button>
          )}
          <button onClick={onPlan} style={{ flex: slot.attendanceMarked ? 1 : 0, padding:'9px 14px', borderRadius:12, border:`1.5px solid ${isLive ? 'rgba(255,255,255,0.25)' : '#e5e7eb'}`, background:'transparent', color: isLive ? '#fff' : '#374151', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
            Plan
          </button>
          <button onClick={onClass} style={{ padding:'9px 14px', borderRadius:12, border:`1.5px solid ${isLive ? 'rgba(255,255,255,0.25)' : '#e5e7eb'}`, background:'transparent', color: isLive ? '#fff' : '#374151', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
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

function ClassSummaryCard({ cls, onOpen, onAttend, onPlan }: {
  cls:      ClassCard
  onOpen:   () => void
  onAttend: (classId: string) => void
  onPlan:   (classId: string, subjectId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const col     = classColor(cls.name)
  const attPct  = cls.totalToday > 0 ? Math.round((cls.presentToday / cls.totalToday) * 100) : null
  const pending = cls.todaySlots.filter(s => !s.attendanceMarked && toMin(s.end) > nowMin())

  return (
    <div style={{ background:'#fff', borderRadius:20, border:'1px solid #f0ece6', overflow:'hidden', boxShadow:'0 2px 12px rgba(0,0,0,0.05)', marginBottom:10 }}>
      <div style={{ height:4, background:col.border }} />
      <div style={{ padding:'16px 16px 14px' }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:12 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:17, fontWeight:800, color:'#111827', lineHeight:1.2 }}>
              {cls.name}{cls.stream ? ` · ${cls.stream}` : ''}
            </div>
            <div style={{ fontSize:12, color:'#9ca3af', marginTop:3 }}>{cls.subject || 'Class Teacher'}</div>
          </div>
          <button onClick={onOpen} style={{ padding:'7px 14px', borderRadius:12, border:`1.5px solid ${col.border}`, background:col.bg, color:col.text, fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'inherit', flexShrink:0, marginLeft:10, display:'flex', alignItems:'center', gap:5 }}>
            Open <IcoChevRight size={12} color={col.text} />
          </button>
        </div>
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
        {pending.length > 0 && (
          <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:12, padding:'10px 12px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
            <div style={{ display:'flex', alignItems:'center', gap:7 }}>
              <IcoAlert size={14} color="#92400e" />
              <span style={{ fontSize:12, fontWeight:600, color:'#92400e' }}>
                {pending.length} {pending.length === 1 ? 'class needs' : 'classes need'} attendance
              </span>
            </div>
            <button onClick={() => onAttend(cls.id)} style={{ padding:'6px 12px', borderRadius:10, border:'none', background:'#f59e0b', color:'#fff', fontWeight:700, fontSize:11, cursor:'pointer', fontFamily:'inherit', flexShrink:0 }}>
              Mark
            </button>
          </div>
        )}
        {cls.unclaimedCount > 0 && (
          <div style={{ marginTop:8, background:'#f0f9ff', border:'1px solid #bae6fd', borderRadius:12, padding:'9px 12px', display:'flex', alignItems:'center', gap:7 }}>
            <IcoUsers size={13} color="#0369a1" />
            <span style={{ fontSize:12, fontWeight:600, color:'#0369a1' }}>{cls.unclaimedCount} unclaimed student{cls.unclaimedCount > 1 ? 's' : ''}</span>
          </div>
        )}
      </div>
      {cls.todaySlots.length > 0 && (
        <>
          <div onClick={() => setExpanded(!expanded)} style={{ padding:'10px 16px', borderTop:'1px solid #f5f0ec', display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer', background:'#faf9f7' }}>
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

export default function TeacherDashboard() {
  const router        = useRouter()
  const { showToast } = useToast()

  const [data,        setData]        = useState<PageData | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [weather,     setWeather]     = useState<{ temp: number; icon: string; desc: string } | null>(null)
  const slideRef                      = useRef<HTMLDivElement>(null)
  const [activeSlide, setActiveSlide] = useState(0)

  useEffect(() => {
    async function fetchWeather(lat: number, lon: number, city: string) {
      try {
        const r    = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`)
        const d    = await r.json()
        const code = d.current_weather.weathercode
        const temp = Math.round(d.current_weather.temperature)
        const icons: Record<number, string> = {0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',48:'🌫️',51:'🌦️',53:'🌦️',55:'🌧️',61:'🌧️',63:'🌧️',65:'🌧️',71:'🌨️',73:'🌨️',75:'🌨️',80:'🌦️',81:'🌧️',82:'⛈️',95:'⛈️',96:'⛈️',99:'⛈️'}
        const descs: Record<number, string> = {0:'Clear',1:'Mostly clear',2:'Partly cloudy',3:'Overcast',45:'Foggy',48:'Foggy',51:'Drizzle',53:'Drizzle',55:'Drizzle',61:'Rain',63:'Rain',65:'Heavy rain',71:'Snow',73:'Snow',75:'Heavy snow',80:'Showers',81:'Showers',82:'Thunderstorm',95:'Thunderstorm',96:'Thunderstorm',99:'Thunderstorm'}
        setWeather({ temp, icon: icons[code] ?? '🌡️', desc: `${city} · ${descs[code] ?? 'Weather'}` })
      } catch {}
    }
    async function initWeather() {
      const stored = localStorage.getItem('wx_loc')
      if (stored) {
        const s = JSON.parse(stored)
        await fetchWeather(s.lat, s.lon, s.city)
        return
      }
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            try {
              const r   = await fetch('http://ip-api.com/json/')
              const loc = await r.json()
              const city = loc.city ?? 'My Location'
              const lat  = pos.coords.latitude
              const lon  = pos.coords.longitude
              localStorage.setItem('wx_loc', JSON.stringify({ lat, lon, city }))
              await fetchWeather(lat, lon, city)
            } catch {
              await fetchWeather(pos.coords.latitude, pos.coords.longitude, 'My Location')
            }
          },
          async () => {
            try {
              const r   = await fetch('http://ip-api.com/json/')
              const loc = await r.json()
              await fetchWeather(loc.lat ?? -1.2921, loc.lon ?? 36.8219, loc.city ?? 'Nairobi')
            } catch {
              await fetchWeather(-1.2921, 36.8219, 'Nairobi')
            }
          }
        )
      } else {
        try {
          const r   = await fetch('http://ip-api.com/json/')
          const loc = await r.json()
          await fetchWeather(loc.lat ?? -1.2921, loc.lon ?? 36.8219, loc.city ?? 'Nairobi')
        } catch {
          await fetchWeather(-1.2921, 36.8219, 'Nairobi')
        }
      }
    }
    initWeather()
  }, [])

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/admin/login'); return }

    const uid    = user.id
    const today  = new Date().toISOString().split('T')[0]
    const rawDow = new Date().getDay()
    const dow    = rawDow === 0 ? 7 : rawDow

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

    const { data: schoolData } = await supabase
      .from('profiles')
      .select('school_id')
      .eq('id', uid)
      .single()

    const schoolId = schoolData?.school_id ?? null

    const [schoolRes, attBatchRes] = await Promise.all([
      schoolId
        ? supabase.from('schools').select('name').eq('id', schoolId).single()
        : Promise.resolve({ data: null }),
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

      const claimRes = await supabase
        .from('student_claim_codes')
        .select('student_id,claimed')
        .eq('claimed', false)
        .in('student_id', (studentRes?.data ?? []).map((s: any) => s.id))

      const studentMap: Record<string, number>   = {}
      const studentIds: Record<string, string[]> = {}
      for (const s of studentRes.data ?? []) {
        studentMap[s.class_id] = (studentMap[s.class_id] ?? 0) + 1
        studentIds[s.class_id] = [...(studentIds[s.class_id] ?? []), s.id]
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
        const scores = scoreMap[c.id] ?? []
        const avg    = scores.length > 0
          ? (scores.reduce((a: number, b: number) => a + b, 0) / scores.length).toFixed(1) + '/4'
          : '—'
        const cSlots = todaySlots.filter(s => s.classId === c.id)
        return {
          id:              c.id,
          name:            c.name,
          stream:          c.stream ?? '',
          subject:         c.subject ?? '',
          studentCount:    studentMap[c.id]   ?? 0,
          presentToday:    presentMap[c.id]   ?? 0,
          totalToday:      totalMap[c.id]     ?? 0,
          homeworkPending: hwMap[c.id]        ?? 0,
          avgScore:        avg,
          unclaimedCount:  unclaimedMap[c.id] ?? 0,
          todaySlots:      cSlots,
        }
      })
    }

    setData({ fullName, school: (schoolRes.data as any)?.name ?? '', allSlots, todaySlots, classes })
    setLoading(false)
  }

  function onSlideScroll() {
    if (!slideRef.current) return
    const el    = slideRef.current
    const index = Math.round(el.scrollLeft / (el.offsetWidth * 0.82))
    setActiveSlide(index)
  }

  if (loading) return <LoadingSkeleton />
  if (!data)   return null

  const cur           = nowMin()
  const totalLessons  = data.todaySlots.length
  const markedCount   = data.todaySlots.filter(s => s.attendanceMarked).length
  const pendingAtt    = data.todaySlots.filter(s => !s.attendanceMarked && toMin(s.end) > cur).length
  const totalStudents = data.classes.reduce((a, c) => a + c.studentCount, 0)
  const totalPresent  = data.classes.reduce((a, c) => a + c.presentToday, 0)
  const totalEnrolled = data.classes.reduce((a, c) => a + c.totalToday, 0)
  const overallAttPct = totalEnrolled > 0 ? Math.round((totalPresent / totalEnrolled) * 100) : 0

  const QUICK_ACTIONS = [
    { label: 'Timetable', Icon: IcoCal,      href: '/teacher/timetable',   bg: '#ede9fe', ink: '#5b21b6' },
    { label: 'Attendance',Icon: IcoClip,     href: '/teacher/attendance',  bg: '#d1fae5', ink: '#065f46' },
    { label: 'Lesson Plan',Icon: IcoBook,    href: '/teacher/lessonplan',  bg: '#dbeafe', ink: '#1e40af' },
    { label: 'Notes',     Icon: IcoNote,     href: '/teacher/lessonnotes', bg: '#fef3c7', ink: '#92400e' },
    { label: 'Results',   Icon: IcoChart,    href: '/teacher/results',     bg: '#fff7ed', ink: '#9a3412' },
    { label: 'Students',  Icon: IcoStudents, href: '/teacher/students',    bg: '#f0f9ff', ink: '#075985' },
  ]

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
        .chip-tap:active        { opacity:0.75 !important; }
      `}</style>

      {/* ── HERO ── */}
      <div style={{ background:'linear-gradient(135deg,#1e1b4b 0%,#2d2a6e 50%,#1a3a2a 100%)', borderRadius:24, padding:'22px 20px 20px', marginBottom:14, position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', bottom:-60, left:-30, width:220, height:220, borderRadius:'50%', background:'radial-gradient(circle,rgba(245,158,11,0.15) 0%,transparent 70%)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', top:-40, right:-20, width:180, height:180, borderRadius:'50%', background:'radial-gradient(circle,rgba(16,185,129,0.1) 0%,transparent 70%)', pointerEvents:'none' }} />

        {/* Dynamic face */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:18, position:'relative' }}>
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

            const dateStr = new Date().toLocaleDateString('en-KE', { weekday:'long', day:'numeric', month:'long' })

            if (noSlots) {
              const todayDow  = new Date().getDay() === 0 ? 7 : new Date().getDay()
              const nextSlotW = data.allSlots
                .filter(s => Number(s.day_of_week) > todayDow)
                .sort((a,b) => Number(a.day_of_week) - Number(b.day_of_week) || toMin(a.start) - toMin(b.start))[0]
              const DNAMES = ['','Mon','Tue','Wed','Thu','Fri','Sat','Sun']
              return (
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,0.35)', fontWeight:600, letterSpacing:0.3, marginBottom:8 }}>{dateStr}</div>
                  {nextSlotW ? (
                    <>
                      <div style={{ fontSize:11, fontWeight:700, color:'#fbbf24', letterSpacing:1.4, textTransform:'uppercase', marginBottom:4 }}>Next · {DNAMES[Number(nextSlotW.day_of_week)]}</div>
                      <div style={{ fontSize:20, fontWeight:800, color:'#fff', lineHeight:1.15 }}>{nextSlotW.subject}</div>
                      <div style={{ fontSize:12, color:'rgba(255,255,255,0.55)', marginTop:4 }}>{nextSlotW.class} · {fmt12(nextSlotW.start)}{nextSlotW.room ? ` · ${nextSlotW.room}` : ''}</div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.35)', letterSpacing:1.4, textTransform:'uppercase', marginBottom:4 }}>Free day</div>
                      <div style={{ fontSize:20, fontWeight:800, color:'#fff', lineHeight:1.15 }}>{data.school}</div>
                      <div style={{ fontSize:12, color:'rgba(255,255,255,0.45)', marginTop:4 }}>No lessons scheduled this week</div>
                    </>
                  )}
                </div>
              )
            }

            if (isEvening) return (
              <div style={{ flex:1 }}>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.35)', fontWeight:600, letterSpacing:0.3, marginBottom:8 }}>{dateStr}</div>
                <div style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.35)', letterSpacing:1.4, textTransform:'uppercase', marginBottom:4 }}>This week</div>
                <div style={{ fontSize:20, fontWeight:800, color:'#fff', lineHeight:1.15 }}>Week {Math.ceil(new Date().getDate()/7)} · Term 2</div>
                <div style={{ fontSize:12, color:'rgba(255,255,255,0.45)', marginTop:4 }}>{data.allSlots.length} lessons · {data.classes.length} classes</div>
              </div>
            )

            if (firstSlot && minsToFirst > 30 && lessonsDone === 0) return (
              <div style={{ flex:1 }}>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.35)', fontWeight:600, letterSpacing:0.3, marginBottom:8 }}>{dateStr}</div>
                <div style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.35)', letterSpacing:1.4, textTransform:'uppercase', marginBottom:4 }}>First lesson at {fmt12(firstSlot.start)}</div>
                <div style={{ fontSize:20, fontWeight:800, color:'#fff', lineHeight:1.15 }}>{data.todaySlots.length} lesson{data.todaySlots.length !== 1 ? 's' : ''} today</div>
                <div style={{ fontSize:12, color:'rgba(255,255,255,0.45)', marginTop:4 }}>{totalStudents} students · {data.classes.length} class{data.classes.length !== 1 ? 'es' : ''}</div>
              </div>
            )

            if (firstSlot && minsToFirst <= 30 && minsToFirst > 0 && lessonsDone === 0) return (
              <div style={{ flex:1 }}>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.35)', fontWeight:600, letterSpacing:0.3, marginBottom:8 }}>{dateStr}</div>
                <div style={{ fontSize:11, fontWeight:700, color:'#fbbf24', letterSpacing:1.4, textTransform:'uppercase', marginBottom:4 }}>Starting in {minsToFirst} min{minsToFirst !== 1 ? 's' : ''}</div>
                <div style={{ fontSize:20, fontWeight:800, color:'#fff', lineHeight:1.15 }}>{firstSlot.subject}</div>
                <div style={{ fontSize:12, color:'rgba(255,255,255,0.55)', marginTop:4 }}>{firstSlot.class}{firstSlot.room ? ` · ${firstSlot.room}` : ''}</div>
              </div>
            )

            if (liveSlot) return (
              <div style={{ flex:1 }}>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.35)', fontWeight:600, letterSpacing:0.3, marginBottom:8 }}>{dateStr}</div>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                  <div style={{ width:7, height:7, borderRadius:'50%', background:'#10b981', animation:'livePulse 2s infinite' }} />
                  <div style={{ fontSize:11, fontWeight:700, color:'#6ee7b7', letterSpacing:1.4, textTransform:'uppercase' }}>Now in session</div>
                </div>
                <div style={{ fontSize:20, fontWeight:800, color:'#fff', lineHeight:1.15 }}>{liveSlot.subject}</div>
                <div style={{ fontSize:12, color:'rgba(255,255,255,0.55)', marginTop:4 }}>{liveSlot.class}{liveSlot.room ? ` · ${liveSlot.room}` : ''} · ends {fmt12(liveSlot.end)}</div>
              </div>
            )

            if (nextSlot && !liveSlot && !dayDone) {
              const minsToNext = toMin(nextSlot.start) - cur2
              return (
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,0.35)', fontWeight:600, letterSpacing:0.3, marginBottom:8 }}>{dateStr}</div>
                  <div style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.35)', letterSpacing:1.4, textTransform:'uppercase', marginBottom:4 }}>Break · {minsToNext} min{minsToNext !== 1 ? 's' : ''} to next</div>
                  <div style={{ fontSize:20, fontWeight:800, color:'#fff', lineHeight:1.15 }}>{nextSlot.subject}</div>
                  <div style={{ fontSize:12, color:'rgba(255,255,255,0.55)', marginTop:4 }}>{nextSlot.class} · {lessonsDone} done · {lessonsLeft} left</div>
                </div>
              )
            }

            return (
              <div style={{ flex:1 }}>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.35)', fontWeight:600, letterSpacing:0.3, marginBottom:8 }}>{dateStr}</div>
                <div style={{ fontSize:11, fontWeight:700, color:'#6ee7b7', letterSpacing:1.4, textTransform:'uppercase', marginBottom:4 }}>Day complete</div>
                <div style={{ fontSize:20, fontWeight:800, color:'#fff', lineHeight:1.15 }}>{lessonsDone} lesson{lessonsDone !== 1 ? 's' : ''} delivered</div>
                <div style={{ fontSize:12, color:'rgba(255,255,255,0.45)', marginTop:4 }}>
                  {(() => {
                    const tom = data.allSlots.filter(s => Number(s.day_of_week) === (new Date().getDay() % 7) + 1)
                    return tom.length > 0
                      ? `Tomorrow · ${tom.length} lesson${tom.length !== 1 ? 's' : ''} · starts ${fmt12(tom.reduce((a,b) => toMin(a.start) < toMin(b.start) ? a : b).start)}`
                      : 'No lessons tomorrow'
                  })()}
                </div>
              </div>
            )
          })()}

          {/* Weather */}
          <div style={{ textAlign:'right', flexShrink:0, alignSelf:'flex-start' }}>
            <div style={{ fontSize:20, fontWeight:200, color:'rgba(255,255,255,0.75)', lineHeight:1 }}>
              {weather ? `${weather.icon} ${weather.temp}°` : '🌡️ --°'}
            </div>
            <div style={{ fontSize:9, color:'rgba(255,255,255,0.25)', fontWeight:700, marginTop:3, letterSpacing:1, textTransform:'uppercase' }}>
              {weather ? weather.desc : 'weather'}
            </div>
          </div>
        </div>

        {/* Stat chips — all tappable */}
        <div style={{ display:'flex', gap:8, position:'relative' }}>
          {[
            { label:'Lessons',    value: totalLessons,                                    sub: 'today',   href: '/teacher/timetable'  },
            { label:'Students',   value: totalStudents,                                   sub: `${data.classes.length} class${data.classes.length !== 1 ? 'es' : ''}`, href: '/teacher/students' },
            { label:'Attendance', value: overallAttPct > 0 ? `${overallAttPct}%` : '—',  sub: 'today',   href: '/teacher/attendance' },
            { label:'Pending',    value: pendingAtt,                                      sub: 'to mark', href: '/teacher/attendance', warn: pendingAtt > 0 },
          ].map(s => (
            <div
              key={s.label}
              className="chip-tap"
              onClick={() => router.push(s.href)}
              style={{
                flex: 1,
                background: s.warn ? 'rgba(245,158,11,0.18)' : 'rgba(255,255,255,0.07)',
                border: `1px solid ${s.warn ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.09)'}`,
                borderRadius: 14, padding: '10px 6px', textAlign: 'center',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize:18, fontWeight:800, color: s.warn ? '#fbbf24' : '#fff', lineHeight:1 }}>{s.value}</div>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.4)', fontWeight:600, marginTop:3, textTransform:'uppercase', letterSpacing:0.7 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── QUICK ACTIONS ── */}
      <div style={{ background:'#fff', borderRadius:20, border:'1px solid #f0ece6', padding:'18px 16px', marginBottom:14, boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
        <div style={{ fontSize:10, fontWeight:800, color:'#9ca3af', letterSpacing:1.6, textTransform:'uppercase', marginBottom:14 }}>Quick Actions</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
          {QUICK_ACTIONS.map(a => (
            <button
              key={a.label}
              className="tap-shrink"
              onClick={() => router.push(a.href)}
              style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8, padding:'14px 6px', borderRadius:16, border:'none', background:a.bg, cursor:'pointer', fontFamily:'inherit', transition:'transform 0.12s' }}
            >
              <span style={{ color:a.ink, display:'flex' }}><a.Icon size={20} color={a.ink} /></span>
              <span style={{ fontSize:10, fontWeight:800, color:a.ink, textAlign:'center', lineHeight:1.3 }}>{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── TODAY'S LESSONS ── */}
      {data.todaySlots.length > 0 && (
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:10, fontWeight:800, color:'#9ca3af', letterSpacing:1.6, textTransform:'uppercase', marginBottom:12, paddingLeft:2 }}>
            Today · {data.todaySlots.length} {data.todaySlots.length === 1 ? 'lesson' : 'lessons'}
            {markedCount > 0 && <span style={{ color:'#10b981', marginLeft:8 }}>{markedCount} marked</span>}
          </div>
          <div
            ref={slideRef}
            onScroll={onSlideScroll}
            style={{ display:'flex', gap:12, overflowX:'auto', scrollSnapType:'x mandatory', paddingBottom:4, scrollbarWidth:'none', WebkitOverflowScrolling:'touch' }}
          >
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
            <div style={{ width:20, flexShrink:0 }} />
          </div>
          {data.todaySlots.length > 1 && (
            <div style={{ display:'flex', justifyContent:'center', gap:5, marginTop:10 }}>
              {data.todaySlots.map((_, i) => (
                <div key={i} style={{ width: i === activeSlide ? 18 : 6, height:6, borderRadius:3, background: i === activeSlide ? '#1e1b4b' : '#e5e7eb', transition:'all 0.2s ease' }} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── MY CLASSES ── */}
      {data.classes.length > 0 && (
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:10, fontWeight:800, color:'#9ca3af', letterSpacing:1.6, textTransform:'uppercase', marginBottom:12, paddingLeft:2 }}>My Classes</div>
          {data.classes.map((cls, i) => (
            <div key={cls.id} style={{ animation:`fadeUp 0.3s ease ${i*80}ms both` }}>
              <ClassSummaryCard
                cls={cls}
                onOpen={()         => router.push('/teacher/classhub/' + cls.id)}
                onAttend={(cid)    => router.push('/teacher/attendance?classId=' + cid)}
                onPlan={(cid)      => router.push('/teacher/lessonplan?classId=' + cid)}
              />
            </div>
          ))}
        </div>
      )}

      {data.classes.length === 0 && (
        <div style={{ background:'#fff', borderRadius:20, border:'1px solid #f0ece6', padding:'28px 20px', textAlign:'center', marginBottom:14 }}>
          <div style={{ fontSize:13, color:'#9ca3af', fontWeight:500, marginBottom:12 }}>No classes assigned yet</div>
          <button
            className="tap-shrink"
            onClick={() => router.push('/teacher/onboarding/class')}
            style={{ padding:'10px 20px', borderRadius:12, border:'none', background:'#1e1b4b', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}
          >
            Create a class
          </button>
        </div>
      )}

      {/* ── SMART TIMETABLE PREVIEW ── */}
      <SmartTimetablePreview />
      <SmartInsightSlides />

      {/* ── SCHOOL PULSE ── */}
      <div style={{ textAlign:'center', padding:'4px 0 2px' }}>
        <span style={{ fontSize:11, color:'#d1ccc5', fontWeight:500 }}>
          {data.school} · {new Date().toLocaleDateString('en-KE', { weekday:'long' })}
        </span>
      </div>
    </div>
  )
}
