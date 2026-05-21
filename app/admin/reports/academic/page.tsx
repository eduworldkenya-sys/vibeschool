'use client'
import { supabase } from '@/lib/supabase'

import { useEffect, useState } from 'react'


interface TermOption { id: string; name: string }
interface ClassOption { id: string; name: string }
interface GradeSummary {
  student_name: string
  admission_number: string
  class_name: string
  subject: string
  score: number | null
  grade: string | null
}

export default function AcademicReportPage() {
  const [terms, setTerms] = useState<TermOption[]>([])
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [selectedTerm, setSelectedTerm] = useState('')
  const [selectedClass, setSelectedClass] = useState('')
  const [grades, setGrades] = useState<GradeSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [insight, setInsight] = useState('')
  const [kpis, setKpis] = useState({ total: 0, avg: 0, passing: 0, failing: 0 })
  const [sortField, setSortField] = useState<keyof GradeSummary>('student_name')
  const [sortAsc, setSortAsc] = useState(true)

  // Load terms and classes on mount
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

  // Load grades when filters change
  useEffect(() => {
    if (!selectedTerm) return
    fetchGrades()
  }, [selectedTerm, selectedClass])

  async function fetchGrades() {
    setLoading(true)
    try {
      let query = supabase
        .from('traditional_grades')
        .select(`
          score,
          grade,
          subjects(name),
          students(full_name, admission_number),
          classes(name)
        `)
        .eq('term_id', selectedTerm)

      if (selectedClass) query = query.eq('class_id', selectedClass)

      const { data, error } = await query.limit(200)
      if (error) throw error

      const mapped: GradeSummary[] = (data || []).map((r: any) => ({
        student_name: r.students?.full_name ?? '—',
        admission_number: r.students?.admission_number ?? '—',
        class_name: r.classes?.name ?? '—',
        subject: r.subjects?.name ?? '—',
        score: r.score,
        grade: r.grade,
      }))

      setGrades(mapped)
      computeKPIs(mapped)
      generateInsight(mapped)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  function computeKPIs(data: GradeSummary[]) {
    const scores = data.filter(d => d.score !== null).map(d => d.score as number)
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
    const passing = scores.filter(s => s >= 50).length
    const failing = scores.filter(s => s < 50).length
    setKpis({ total: data.length, avg, passing, failing })
  }

  function generateInsight(data: GradeSummary[]) {
    if (!data.length) return
    const scores = data.filter(d => d.score !== null).map(d => d.score as number)
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
    const failRate = scores.length ? Math.round((scores.filter(s => s < 50).length / scores.length) * 100) : 0
    if (failRate > 40) {
      setInsight(`⚠️ ${failRate}% of students are below 50. Immediate intervention recommended.`)
    } else if (avg >= 75) {
      setInsight(`✅ Strong performance — class average is ${avg}%. Keep up the momentum.`)
    } else {
      setInsight(`📊 Class average stands at ${avg}%. ${failRate}% of students need academic support.`)
    }
  }

  function handleSort(field: keyof GradeSummary) {
    if (sortField === field) setSortAsc(!sortAsc)
    else { setSortField(field); setSortAsc(true) }
  }

  const sorted = [...grades].sort((a, b) => {
    const av = a[sortField] ?? ''
    const bv = b[sortField] ?? ''
    return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
  })

  function gradeColor(score: number | null) {
    if (score === null) return 'text-slate-400'
    if (score >= 75) return 'text-green-400'
    if (score >= 50) return 'text-yellow-400'
    return 'text-red-400'
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      {/* Top Bar */}
      <div className="bg-[#1e293b] border-b border-slate-700 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <a href="/admin/reports" className="text-slate-400 hover:text-white text-xl">←</a>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Academic Report</h1>
            <p className="text-xs text-slate-400">Grades & Performance</p>
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
            className="w-full bg-[#0f172a] border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="">Select Term</option>
            {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select
            value={selectedClass}
            onChange={e => setSelectedClass(e.target.value)}
            className="w-full bg-[#0f172a] border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
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
        {grades.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#1e293b] rounded-xl p-4 border border-slate-700">
              <p className="text-2xl font-bold text-blue-400">{kpis.total}</p>
              <p className="text-xs text-slate-400 mt-1">Total Records</p>
            </div>
            <div className="bg-[#1e293b] rounded-xl p-4 border border-slate-700">
              <p className="text-2xl font-bold text-yellow-400">{kpis.avg}%</p>
              <p className="text-xs text-slate-400 mt-1">Class Average</p>
            </div>
            <div className="bg-[#1e293b] rounded-xl p-4 border border-slate-700">
              <p className="text-2xl font-bold text-green-400">{kpis.passing}</p>
              <p className="text-xs text-slate-400 mt-1">Passing (≥50)</p>
            </div>
            <div className="bg-[#1e293b] rounded-xl p-4 border border-slate-700">
              <p className="text-2xl font-bold text-red-400">{kpis.failing}</p>
              <p className="text-xs text-slate-400 mt-1">Below 50</p>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin text-3xl mb-3">⏳</div>
            <p className="text-slate-400 text-sm">Loading grades...</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && !selectedTerm && (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">📚</p>
            <p className="text-slate-400 text-sm">Select a term to load academic data</p>
          </div>
        )}

        {/* Data Table */}
        {!loading && grades.length > 0 && (
          <div className="bg-[#1e293b] rounded-xl border border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700">
              <p className="text-sm font-semibold">Grade Records</p>
              <p className="text-xs text-slate-400">{grades.length} entries — tap column to sort</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-[#0f172a]">
                  <tr>
                    {[
                      { key: 'student_name', label: 'Student' },
                      { key: 'class_name', label: 'Class' },
                      { key: 'subject', label: 'Subject' },
                      { key: 'score', label: 'Score' },
                      { key: 'grade', label: 'Grade' },
                    ].map(col => (
                      <th
                        key={col.key}
                        onClick={() => handleSort(col.key as keyof GradeSummary)}
                        className="px-3 py-2.5 text-left text-slate-400 font-medium cursor-pointer hover:text-white"
                      >
                        {col.label} {sortField === col.key ? (sortAsc ? '↑' : '↓') : ''}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.slice(0, 100).map((row, i) => (
                    <tr key={i} className="border-t border-slate-700/50 hover:bg-slate-700/20">
                      <td className="px-3 py-2.5 text-white font-medium">{row.student_name}</td>
                      <td className="px-3 py-2.5 text-slate-300">{row.class_name}</td>
                      <td className="px-3 py-2.5 text-slate-300">{row.subject}</td>
                      <td className={`px-3 py-2.5 font-bold ${gradeColor(row.score)}`}>
                        {row.score ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 text-slate-300">{row.grade ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {sorted.length > 100 && (
              <div className="px-4 py-3 border-t border-slate-700 text-xs text-slate-400">
                Showing 100 of {sorted.length} records
              </div>
            )}
          </div>
        )}

        {!loading && selectedTerm && grades.length === 0 && (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-slate-400 text-sm">No grade data found for selected filters</p>
          </div>
        )}

      </div>
    </div>
  )
}
