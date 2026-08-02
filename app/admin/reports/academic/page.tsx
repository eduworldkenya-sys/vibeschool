"use client";
export const dynamic = "force-dynamic";
import { supabase } from '@/lib/supabase'

import { useEffect, useState } from 'react'


interface TermOption {
  id: string
  name: string
  term: number
  academic_year: number
}
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
        supabase.from('academic_terms').select('id, name, term, academic_year').order('start_date', { ascending: false }),
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
    const term = terms.find(t => t.id === selectedTerm)
    if (!term) return

    setLoading(true)
    try {
      let query = supabase
        .from('traditional_grades')
        .select(`
          marks,
          out_of,
          subjects(name),
          students(name, admission_number),
          classes(name)
        `)
        .eq('term', term.term)
        .eq('academic_year', term.academic_year)

      if (selectedClass) query = query.eq('class_id', selectedClass)

      const { data, error } = await query.limit(200)
      if (error) throw error

      const mapped: GradeSummary[] = (data || []).map((r: any) => {
        const marks = Number(r.marks)
        const outOf = Number(r.out_of)
        const score = outOf > 0 ? Math.round((marks / outOf) * 100) : null
        const grade = score === null
          ? null
          : score >= 80 ? 'A'
          : score >= 75 ? 'A-'
          : score >= 70 ? 'B+'
          : score >= 65 ? 'B'
          : score >= 60 ? 'B-'
          : score >= 55 ? 'C+'
          : score >= 50 ? 'C'
          : score >= 45 ? 'C-'
          : score >= 40 ? 'D+'
          : score >= 35 ? 'D'
          : score >= 30 ? 'D-'
          : 'E'

        return {
          student_name: r.students?.name ?? '—',
          admission_number: r.students?.admission_number ?? '—',
          class_name: r.classes?.name ?? '—',
          subject: r.subjects?.name ?? '—',
          score,
          grade,
        }
      })

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
    <div style={{minHeight:"100vh",background:"#0f172a",color:"#f1f5f9"}}>
      {/* Top Bar */}
      <div style={{background:"#1e293b",borderBottom:"1px solid #334155",padding:"16px",position:"sticky",top:0,zIndex:10}}>
        <div style={{maxWidth:"672px",margin:"0 auto",display:"flex",alignItems:"center",gap:"12px"}}>
          <a href="/admin/reports" style={{color:"#94a3b8",fontSize:"20px",textDecoration:"none"}}>←</a>
          <div style={{flex:1}}>
            <h1 style={{fontSize:"18px",fontWeight:700,margin:0}}>Academic Report</h1>
            <p style={{fontSize:"11px",color:"#94a3b8",margin:0}}>Grades & Performance</p>
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
        {grades.length > 0 && (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
            <div style={{background:"#1e293b",borderRadius:"12px",padding:"16px",border:"1px solid #334155"}}>
              <p style={{fontSize:"24px",fontWeight:800,color:"#38bdf8",margin:0}}>{kpis.total}</p>
              <p style={{fontSize:"11px",color:"#94a3b8",marginTop:"4px"}}>Total Records</p>
            </div>
            <div style={{background:"#1e293b",borderRadius:"12px",padding:"16px",border:"1px solid #334155"}}>
              <p style={{fontSize:"24px",fontWeight:800,color:"#f59e0b",margin:0}}>{kpis.avg}%</p>
              <p style={{fontSize:"11px",color:"#94a3b8",marginTop:"4px"}}>Class Average</p>
            </div>
            <div style={{background:"#1e293b",borderRadius:"12px",padding:"16px",border:"1px solid #334155"}}>
              <p style={{fontSize:"24px",fontWeight:800,color:"#10b981",margin:0}}>{kpis.passing}</p>
              <p style={{fontSize:"11px",color:"#94a3b8",marginTop:"4px"}}>Passing (≥50)</p>
            </div>
            <div style={{background:"#1e293b",borderRadius:"12px",padding:"16px",border:"1px solid #334155"}}>
              <p style={{fontSize:"24px",fontWeight:800,color:"#ef4444",margin:0}}>{kpis.failing}</p>
              <p style={{fontSize:"11px",color:"#94a3b8",marginTop:"4px"}}>Below 50</p>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{textAlign:"center",padding:"48px 0"}}>
            <div style={{fontSize:"30px",marginBottom:"12px"}}>⏳</div>
            <p style={{color:"#94a3b8",fontSize:"14px"}}>Loading grades...</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && !selectedTerm && (
          <div style={{textAlign:"center",padding:"64px 0"}}>
            <p style={{fontSize:"36px",marginBottom:"12px"}}>📚</p>
            <p style={{color:"#94a3b8",fontSize:"14px"}}>Select a term to load academic data</p>
          </div>
        )}

        {/* Data Table */}
        {!loading && grades.length > 0 && (
          <div style={{background:"#1e293b",borderRadius:"12px",border:"1px solid #334155",overflow:"hidden"}}>
            <div style={{padding:"12px 16px",borderBottom:"1px solid #334155"}}>
              <p style={{fontSize:"13px",fontWeight:600,margin:0,color:"#f1f5f9"}}>Grade Records</p>
              <p style={{fontSize:"11px",color:"#94a3b8",margin:0}}>{grades.length} entries — tap column to sort</p>
            </div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",fontSize:"11px",borderCollapse:"collapse"}}>
                <thead style={{background:"#0f172a"}}>
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
                        style={{padding:"10px 12px",textAlign:"left",color:"#94a3b8",fontWeight:500,cursor:"pointer"}}
                      >
                        {col.label} {sortField === col.key ? (sortAsc ? '↑' : '↓') : ''}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.slice(0, 100).map((row, i) => (
                    <tr key={i} style={{borderTop:"1px solid rgba(51,65,85,0.5)"}}>
                      <td style={{padding:"10px 12px",color:"#f1f5f9",fontWeight:500}}>{row.student_name}</td>
                      <td style={{padding:"10px 12px",color:"#cbd5e1"}}>{row.class_name}</td>
                      <td style={{padding:"10px 12px",color:"#cbd5e1"}}>{row.subject}</td>
                      <td style={{padding:"10px 12px",fontWeight:700}}>
                        {row.score ?? '—'}
                      </td>
                      <td style={{padding:"10px 12px",color:"#cbd5e1"}}>{row.grade ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {sorted.length > 100 && (
              <div style={{padding:"12px 16px",borderTop:"1px solid #334155",fontSize:"11px",color:"#94a3b8"}}>
                Showing 100 of {sorted.length} records
              </div>
            )}
          </div>
        )}

        {!loading && selectedTerm && grades.length === 0 && (
          <div style={{textAlign:"center",padding:"48px 0"}}>
            <p style={{fontSize:"36px",marginBottom:"12px"}}>📭</p>
            <p style={{color:"#94a3b8",fontSize:"14px"}}>No grade data found for selected filters</p>
          </div>
        )}

      </div>
    </div>
  )
}
