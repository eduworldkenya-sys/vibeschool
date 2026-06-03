"use client";
export const dynamic = "force-dynamic";
import { supabase } from '@/lib/supabase'

import { useEffect, useState } from 'react'


interface TermOption { id: string; name: string }
interface ClassOption { id: string; name: string }
interface AttendanceRow {
  student_name: string
  admission_number: string
  class_name: string
  present: number
  absent: number
  late: number
  total: number
  rate: number
}

export default function AttendanceReportPage() {
  const [terms, setTerms] = useState<TermOption[]>([])
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [selectedTerm, setSelectedTerm] = useState('')
  const [selectedClass, setSelectedClass] = useState('')
  const [rows, setRows] = useState<AttendanceRow[]>([])
  const [loading, setLoading] = useState(false)
  const [insight, setInsight] = useState('')
  const [kpis, setKpis] = useState({ total: 0, avgRate: 0, chronic: 0, perfect: 0 })
  const [sortField, setSortField] = useState<keyof AttendanceRow>('rate')
  const [sortAsc, setSortAsc] = useState(false)

  useEffect(() => {
    async function loadFilters() {
      const [{ data: termData }, { data: classData }] = await Promise.all([
        supabase.from('academic_terms').select('id, name').order('start_date', { ascending: false }),
        supabase.from('classes').select('id, name').order('name'),
      ])
      if (termData) setTerms(termData)
      if (classData) setClasses(classData)
    }
    loadFilters()
  }, [])

  useEffect(() => {
    if (!selectedTerm) return
    fetchAttendance()
  }, [selectedTerm, selectedClass])

  async function fetchAttendance() {
    setLoading(true)
    try {
      let query = supabase
        .from('attendance')
        .select(`
          status,
          students(full_name, admission_number),
          classes(name)
        `)
        .eq('term_id', selectedTerm)

      if (selectedClass) query = query.eq('class_id', selectedClass)

      const { data, error } = await query.limit(2000)
      if (error) throw error

      // Aggregate per student
      const map: Record<string, AttendanceRow> = {}
      for (const r of data || []) {
        const key = (r.students as any)?.admission_number ?? 'unknown'
        if (!map[key]) {
          map[key] = {
            student_name: (r.students as any)?.full_name ?? '—',
            admission_number: key,
            class_name: (r.classes as any)?.name ?? '—',
            present: 0, absent: 0, late: 0, total: 0, rate: 0,
          }
        }
        map[key].total++
        const status = String(r.status ?? '').toLowerCase()
        if (status === 'present') map[key].present++
        else if (status === 'absent') map[key].absent++
        else if (status === 'late') map[key].late++
      }

      const result = Object.values(map).map(s => ({
        ...s,
        rate: s.total > 0 ? Math.round((s.present / s.total) * 100) : 0,
      }))

      setRows(result)
      computeKPIs(result)
      generateInsight(result)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  function computeKPIs(data: AttendanceRow[]) {
    const avgRate = data.length
      ? Math.round(data.reduce((a, b) => a + b.rate, 0) / data.length)
      : 0
    const chronic = data.filter(d => d.rate < 80).length
    const perfect = data.filter(d => d.rate === 100).length
    setKpis({ total: data.length, avgRate, chronic, perfect })
  }

  function generateInsight(data: AttendanceRow[]) {
    if (!data.length) return
    const avgRate = data.length
      ? Math.round(data.reduce((a, b) => a + b.rate, 0) / data.length)
      : 0
    const chronic = data.filter(d => d.rate < 80).length
    const pct = data.length ? Math.round((chronic / data.length) * 100) : 0
    if (pct > 30) {
      setInsight(`⚠️ ${pct}% of students have chronic absenteeism (below 80%). Urgent follow-up needed.`)
    } else if (avgRate >= 90) {
      setInsight(`✅ Excellent attendance — school average is ${avgRate}%. Well done.`)
    } else {
      setInsight(`📊 Average attendance is ${avgRate}%. ${chronic} student(s) flagged as chronically absent.`)
    }
  }

  function handleSort(field: keyof AttendanceRow) {
    if (sortField === field) setSortAsc(!sortAsc)
    else { setSortField(field); setSortAsc(false) }
  }

  const sorted = [...rows].sort((a, b) => {
    const av = a[sortField] ?? 0
    const bv = b[sortField] ?? 0
    if (typeof av === 'number' && typeof bv === 'number') {
      return sortAsc ? av - bv : bv - av
    }
    return sortAsc
      ? String(av).localeCompare(String(bv))
      : String(bv).localeCompare(String(av))
  })

  function rateColor(rate: number) {
    if (rate >= 90) return 'text-green-400'
    if (rate >= 80) return 'text-yellow-400'
    return 'text-red-400'
  }

  function rateBar(rate: number) {
    const color = rate >= 90 ? 'bg-green-500' : rate >= 80 ? 'bg-yellow-500' : 'bg-red-500'
    return (
      <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
        <div style={{flex:1,background:"#334155",borderRadius:"99px",height:"6px"}}>
          <div style={{height:"6px",borderRadius:"99px",background:"#10b981",width:`${rate}%`}} />
        </div>
        <span style={{fontSize:"11px",fontWeight:700,width:"32px",textAlign:"right",color:rateColor(rate)}}>{rate}%</span>
      </div>
    )
  }

  return (
    <div style={{minHeight:"100vh",background:"#0f172a",color:"#f1f5f9"}}>
      {/* Top Bar */}
      <div style={{background:"#1e293b",borderBottom:"1px solid #334155",padding:"16px",position:"sticky",top:0,zIndex:10}}>
        <div style={{maxWidth:"672px",margin:"0 auto",display:"flex",alignItems:"center",gap:"12px"}}>
          <a href="/admin/reports" style={{color:"#94a3b8",fontSize:"20px",textDecoration:"none"}}>←</a>
          <div style={{flex:1}}>
            <h1 style={{fontSize:"18px",fontWeight:700,margin:0}}>Attendance Report</h1>
            <p style={{fontSize:"11px",color:"#94a3b8",margin:0}}>Student attendance summary</p>
          </div>
        </div>
      </div>

      <div style={{maxWidth:"672px",margin:"0 auto",padding:"20px 16px",display:"flex",flexDirection:"column",gap:"20px"}}>

        {/* Filters */}
        <div style={{background:"#1e293b",borderRadius:"12px",padding:"16px",border:"1px solid #334155",display:"flex",flexDirection:"column",gap:"12px"}}>
          <p style={{fontSize:"11px",fontWeight:600,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.8px",margin:0}}>Filters</p>
          <select
            value={selectedTerm}
            onChange={e => setSelectedTerm(e.target.value)}
            style={{width:"100%",background:"#0f172a",border:"1px solid #475569",borderRadius:"8px",padding:"10px 12px",fontSize:"13px",color:"#f1f5f9",outline:"none"}}
          >
            <option value="">Select Term</option>
            {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select
            value={selectedClass}
            onChange={e => setSelectedClass(e.target.value)}
            style={{width:"100%",background:"#0f172a",border:"1px solid #475569",borderRadius:"8px",padding:"10px 12px",fontSize:"13px",color:"#f1f5f9",outline:"none"}}
          >
            <option value="">All Classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {/* AI Insight Banner */}
        {insight && (
          <div style={{background:"rgba(120,53,15,0.4)",border:"1px solid rgba(217,119,6,0.5)",borderRadius:"12px",padding:"12px 16px",display:"flex",gap:"12px",alignItems:"flex-start"}}>
            <span style={{fontSize:"20px"}}>🤖</span>
            <p style={{fontSize:"13px",color:"#fde68a",margin:0}}>{insight}</p>
          </div>
        )}

        {/* KPI Cards */}
        {rows.length > 0 && (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
            <div style={{background:"#1e293b",borderRadius:"12px",padding:"16px",border:"1px solid #334155"}}>
              <p style={{fontSize:"24px",fontWeight:800,color:"#38bdf8",margin:0}}>{kpis.total}</p>
              <p style={{fontSize:"11px",color:"#94a3b8",marginTop:"4px"}}>Total Students</p>
            </div>
            <div style={{background:"#1e293b",borderRadius:"12px",padding:"16px",border:"1px solid #334155"}}>
              <p style={{fontSize:"24px",fontWeight:800,color:"#10b981",margin:0}}>{kpis.avgRate}%</p>
              <p style={{fontSize:"11px",color:"#94a3b8",marginTop:"4px"}}>Avg Attendance</p>
            </div>
            <div style={{background:"#1e293b",borderRadius:"12px",padding:"16px",border:"1px solid #334155"}}>
              <p style={{fontSize:"24px",fontWeight:800,color:"#ef4444",margin:0}}>{kpis.chronic}</p>
              <p style={{fontSize:"11px",color:"#94a3b8",marginTop:"4px"}}>Chronic Absent</p>
            </div>
            <div style={{background:"#1e293b",borderRadius:"12px",padding:"16px",border:"1px solid #334155"}}>
              <p style={{fontSize:"24px",fontWeight:800,color:"#f59e0b",margin:0}}>{kpis.perfect}</p>
              <p style={{fontSize:"11px",color:"#94a3b8",marginTop:"4px"}}>Perfect Attend.</p>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{textAlign:"center",padding:"48px 0"}}>
            <div style={{fontSize:"30px",marginBottom:"12px"}}>⏳</div>
            <p style={{color:"#94a3b8",fontSize:"14px"}}>Loading attendance...</p>
          </div>
        )}

        {/* Empty prompt */}
        {!loading && !selectedTerm && (
          <div style={{textAlign:"center",padding:"64px 0"}}>
            <p style={{fontSize:"36px",marginBottom:"12px"}}>📅</p>
            <p style={{color:"#94a3b8",fontSize:"14px"}}>Select a term to load attendance data</p>
          </div>
        )}

        {/* Table */}
        {!loading && rows.length > 0 && (
          <div style={{background:"#1e293b",borderRadius:"12px",border:"1px solid #334155",overflow:"hidden"}}>
            <div style={{padding:"12px 16px",borderBottom:"1px solid #334155"}}>
              <p style={{fontSize:"13px",fontWeight:600,margin:0,color:"#f1f5f9"}}>Student Attendance</p>
              <p style={{fontSize:"11px",color:"#94a3b8",margin:0}}>{rows.length} students — tap column to sort</p>
            </div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",fontSize:"11px",borderCollapse:"collapse"}}>
                <thead style={{background:"#0f172a"}}>
                  <tr>
                    {[
                      { key: 'student_name', label: 'Student' },
                      { key: 'class_name', label: 'Class' },
                      { key: 'present', label: '✅' },
                      { key: 'absent', label: '❌' },
                      { key: 'late', label: '⏰' },
                      { key: 'rate', label: 'Rate' },
                    ].map(col => (
                      <th
                        key={col.key}
                        onClick={() => handleSort(col.key as keyof AttendanceRow)}
                        style={{padding:"10px 12px",textAlign:"left",color:"#94a3b8",fontWeight:500,cursor:"pointer",whiteSpace:"nowrap"}}
                      >
                        {col.label} {sortField === col.key ? (sortAsc ? '↑' : '↓') : ''}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.slice(0, 100).map((row, i) => (
                    <tr key={i} style={{borderTop:"1px solid rgba(51,65,85,0.5)"}}>
                      <td style={{padding:"10px 12px",color:"#f1f5f9",fontWeight:500,whiteSpace:"nowrap"}}>{row.student_name}</td>
                      <td style={{padding:"10px 12px",color:"#cbd5e1",whiteSpace:"nowrap"}}>{row.class_name}</td>
                      <td style={{padding:"10px 12px",color:"#4ade80",fontWeight:700}}>{row.present}</td>
                      <td style={{padding:"10px 12px",color:"#f87171",fontWeight:700}}>{row.absent}</td>
                      <td style={{padding:"10px 12px",color:"#facc15",fontWeight:700}}>{row.late}</td>
                      <td style={{padding:"10px 12px",minWidth:"100px"}}>{rateBar(row.rate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {sorted.length > 100 && (
              <div style={{padding:"12px 16px",borderTop:"1px solid #334155",fontSize:"11px",color:"#94a3b8"}}>
                Showing 100 of {sorted.length} students
              </div>
            )}
          </div>
        )}

        {!loading && selectedTerm && rows.length === 0 && (
          <div style={{textAlign:"center",padding:"48px 0"}}>
            <p style={{fontSize:"36px",marginBottom:"12px"}}>📭</p>
            <p style={{color:"#94a3b8",fontSize:"14px"}}>No attendance data found for selected filters</p>
          </div>
        )}

      </div>
    </div>
  )
}
