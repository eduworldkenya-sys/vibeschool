'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

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
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-slate-700 rounded-full h-1.5">
          <div className={`${color} h-1.5 rounded-full`} style={{ width: `${rate}%` }} />
        </div>
        <span className={`text-xs font-bold w-8 text-right ${rateColor(rate)}`}>{rate}%</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      {/* Top Bar */}
      <div className="bg-[#1e293b] border-b border-slate-700 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <a href="/reports" className="text-slate-400 hover:text-white text-xl">←</a>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Attendance Report</h1>
            <p className="text-xs text-slate-400">Student attendance summary</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">

        {/* Filters */}
        <div className="bg-[#1e293b] rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Filters</p>
          <select
            value={selectedTerm}
            onChange={e => setSelectedTerm(e.target.value)}
            className="w-full bg-[#0f172a] border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-green-500"
          >
            <option value="">Select Term</option>
            {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select
            value={selectedClass}
            onChange={e => setSelectedClass(e.target.value)}
            className="w-full bg-[#0f172a] border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-green-500"
          >
            <option value="">All Classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {/* AI Insight Banner */}
        {insight && (
          <div className="bg-amber-900/40 border border-amber-600/50 rounded-xl px-4 py-3 flex gap-3 items-start">
            <span className="text-xl">🤖</span>
            <p className="text-sm text-amber-200">{insight}</p>
          </div>
        )}

        {/* KPI Cards */}
        {rows.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#1e293b] rounded-xl p-4 border border-slate-700">
              <p className="text-2xl font-bold text-blue-400">{kpis.total}</p>
              <p className="text-xs text-slate-400 mt-1">Total Students</p>
            </div>
            <div className="bg-[#1e293b] rounded-xl p-4 border border-slate-700">
              <p className="text-2xl font-bold text-green-400">{kpis.avgRate}%</p>
              <p className="text-xs text-slate-400 mt-1">Avg Attendance</p>
            </div>
            <div className="bg-[#1e293b] rounded-xl p-4 border border-slate-700">
              <p className="text-2xl font-bold text-red-400">{kpis.chronic}</p>
              <p className="text-xs text-slate-400 mt-1">Chronic Absent</p>
            </div>
            <div className="bg-[#1e293b] rounded-xl p-4 border border-slate-700">
              <p className="text-2xl font-bold text-yellow-400">{kpis.perfect}</p>
              <p className="text-xs text-slate-400 mt-1">Perfect Attend.</p>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin text-3xl mb-3">⏳</div>
            <p className="text-slate-400 text-sm">Loading attendance...</p>
          </div>
        )}

        {/* Empty prompt */}
        {!loading && !selectedTerm && (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">📅</p>
            <p className="text-slate-400 text-sm">Select a term to load attendance data</p>
          </div>
        )}

        {/* Table */}
        {!loading && rows.length > 0 && (
          <div className="bg-[#1e293b] rounded-xl border border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700">
              <p className="text-sm font-semibold">Student Attendance</p>
              <p className="text-xs text-slate-400">{rows.length} students — tap column to sort</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-[#0f172a]">
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
                        className="px-3 py-2.5 text-left text-slate-400 font-medium cursor-pointer hover:text-white whitespace-nowrap"
                      >
                        {col.label} {sortField === col.key ? (sortAsc ? '↑' : '↓') : ''}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.slice(0, 100).map((row, i) => (
                    <tr key={i} className="border-t border-slate-700/50 hover:bg-slate-700/20">
                      <td className="px-3 py-2.5 text-white font-medium whitespace-nowrap">{row.student_name}</td>
                      <td className="px-3 py-2.5 text-slate-300 whitespace-nowrap">{row.class_name}</td>
                      <td className="px-3 py-2.5 text-green-400 font-bold">{row.present}</td>
                      <td className="px-3 py-2.5 text-red-400 font-bold">{row.absent}</td>
                      <td className="px-3 py-2.5 text-yellow-400 font-bold">{row.late}</td>
                      <td className="px-3 py-2.5 min-w-[100px]">{rateBar(row.rate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {sorted.length > 100 && (
              <div className="px-4 py-3 border-t border-slate-700 text-xs text-slate-400">
                Showing 100 of {sorted.length} students
              </div>
            )}
          </div>
        )}

        {!loading && selectedTerm && rows.length === 0 && (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-slate-400 text-sm">No attendance data found for selected filters</p>
          </div>
        )}

      </div>
    </div>
  )
}
