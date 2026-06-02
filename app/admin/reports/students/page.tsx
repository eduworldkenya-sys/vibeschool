"use client";
import { supabase } from '@/lib/supabase'

import { useEffect, useState } from 'react'


type TabType = 'enrollment' | 'health' | 'library' | 'badges'

interface StudentRow {
  id: string
  full_name: string
  admission_number: string
  class_name: string
  gender: string
  status: string
}

interface HealthRow {
  student_name: string
  condition: string
  diagnosed_date: string
  notes: string
}

interface LibraryRow {
  student_name: string
  book_title: string
  borrowed_date: string
  return_date: string
  status: string
}

interface BadgeRow {
  student_name: string
  badge_name: string
  awarded_date: string
}

export default function StudentsReportPage() {
  const [tab, setTab] = useState<TabType>('enrollment')
  const [students, setStudents] = useState<StudentRow[]>([])
  const [healthRows, setHealthRows] = useState<HealthRow[]>([])
  const [libraryRows, setLibraryRows] = useState<LibraryRow[]>([])
  const [badgeRows, setBadgeRows] = useState<BadgeRow[]>([])
  const [loading, setLoading] = useState(false)
  const [insight, setInsight] = useState('')
  const [kpis, setKpis] = useState({ total: 0, male: 0, female: 0, classes: 0 })
  const [search, setSearch] = useState('')

  useEffect(() => { loadTab(tab) }, [tab])

  async function loadTab(t: TabType) {
    setLoading(true)
    setInsight('')
    try {
      if (t === 'enrollment') await fetchEnrollment()
      if (t === 'health') await fetchHealth()
      if (t === 'library') await fetchLibrary()
      if (t === 'badges') await fetchBadges()
    } finally {
      setLoading(false)
    }
  }

  async function fetchEnrollment() {
    const { data, error } = await supabase
      .from('students')
      .select(`
        id, full_name, admission_number, gender, status,
        student_classes(classes(name))
      `)
      .order('full_name')
      .limit(500)
    if (error) { console.error(error); return }

    const rows: StudentRow[] = (data || []).map((r: any) => ({
      id: r.id,
      full_name: r.full_name ?? '—',
      admission_number: r.admission_number ?? '—',
      class_name: r.student_classes?.[0]?.classes?.name ?? '—',
      gender: r.gender ?? '—',
      status: r.status ?? 'active',
    }))

    setStudents(rows)
    const male = rows.filter(r => r.gender?.toLowerCase() === 'male').length
    const female = rows.filter(r => r.gender?.toLowerCase() === 'female').length
    const classes = new Set(rows.map(r => r.class_name).filter(c => c !== '—')).size
    setKpis({ total: rows.length, male, female, classes })
    setInsight(`🎓 ${rows.length} students enrolled across ${classes} classes. ${male} boys · ${female} girls.`)
  }

  async function fetchHealth() {
    const { data, error } = await supabase
      .from('health_records')
      .select('*, students(full_name)')
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) { console.error(error); return }
    const rows: HealthRow[] = (data || []).map((r: any) => ({
      student_name: r.students?.full_name ?? '—',
      condition: r.condition ?? r.diagnosis ?? '—',
      diagnosed_date: r.diagnosed_date ?? r.date ?? '—',
      notes: r.notes ?? '—',
    }))
    setHealthRows(rows)
    setInsight(`🏥 ${rows.length} health records on file. Ensure all records are up to date.`)
  }

  async function fetchLibrary() {
    const { data, error } = await supabase
      .from('library_borrowings')
      .select('*, library_books(title), students(full_name)')
      .order('borrowed_date', { ascending: false })
      .limit(200)
    if (error) { console.error(error); return }
    const rows: LibraryRow[] = (data || []).map((r: any) => ({
      student_name: r.students?.full_name ?? '—',
      book_title: r.library_books?.title ?? '—',
      borrowed_date: r.borrowed_date ?? '—',
      return_date: r.return_date ?? '—',
      status: r.status ?? '—',
    }))
    setLibraryRows(rows)
    const overdue = rows.filter(r => r.status?.toLowerCase() === 'overdue').length
    setInsight(`📚 ${rows.length} borrowing records. ${overdue} book(s) currently overdue.`)
  }

  async function fetchBadges() {
    const { data, error } = await supabase
      .from('child_badges')
      .select('*, badges(name), students(full_name)')
      .order('awarded_date', { ascending: false })
      .limit(200)
    if (error) { console.error(error); return }
    const rows: BadgeRow[] = (data || []).map((r: any) => ({
      student_name: r.students?.full_name ?? '—',
      badge_name: r.badges?.name ?? r.badge_name ?? '—',
      awarded_date: r.awarded_date ?? '—',
    }))
    setBadgeRows(rows)
    setInsight(`🏅 ${rows.length} badges awarded. Great work recognising student achievements!`)
  }

  function statusBadge(status: string) {
    const s = status.toLowerCase()
    if (s === 'active' || s === 'returned') return 'bg-green-900/50 text-green-400 border border-green-700'
    if (s === 'overdue') return 'bg-red-900/50 text-red-400 border border-red-700'
    if (s === 'inactive') return 'bg-slate-700 text-slate-400'
    return 'bg-slate-700 text-slate-300'
  }

  const tabs: { key: TabType; label: string; icon: string }[] = [
    { key: 'enrollment', label: 'Enrollment', icon: '🎓' },
    { key: 'health',     label: 'Health',     icon: '🏥' },
    { key: 'library',    label: 'Library',    icon: '📚' },
    { key: 'badges',     label: 'Badges',     icon: '🏅' },
  ]

  const filteredStudents = students.filter(s =>
    s.full_name.toLowerCase().includes(search.toLowerCase()) ||
    s.admission_number.toLowerCase().includes(search.toLowerCase()) ||
    s.class_name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{minHeight:"100vh",background:"#0f172a",color:"#f1f5f9"}}>
      {/* Top Bar */}
      <div style={{background:"#1e293b",borderBottom:"1px solid #334155",padding:"16px",position:"sticky",top:0,zIndex:10}}>
        <div style={{maxWidth:"672px",margin:"0 auto",display:"flex",alignItems:"center",gap:"12px"}}>
          <a href="/admin/reports" style={{color:"#94a3b8",fontSize:"20px",textDecoration:"none"}}>←</a>
          <div style={{flex:1}}>
            <h1 style={{fontSize:"18px",fontWeight:700,margin:0}}>Students Report</h1>
            <p style={{fontSize:"11px",color:"#94a3b8",margin:0}}>Enrollment · Health · Library · Badges</p>
          </div>
        </div>
      </div>

      <div style={{maxWidth:"672px",margin:"0 auto",padding:"20px 16px",display:"flex",flexDirection:"column",gap:"20px"}}>

        {/* Tabs */}
        <div style={{display:"flex",gap:"8px",overflowX:"auto",paddingBottom:"4px"}}>
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{display:"flex",alignItems:"center",gap:"6px",padding:"8px 16px",borderRadius:"12px",fontSize:"13px",fontWeight:500,whiteSpace:"nowrap",cursor:"pointer"}}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Search — enrollment only */}
        {tab === 'enrollment' && (
          <input
            type="text"
            placeholder="Search by name, admission no, class..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{width:"100%",background:"#1e293b",border:"1px solid #475569",borderRadius:"12px",padding:"10px 16px",fontSize:"13px",color:"#f1f5f9",outline:"none"}}
          />
        )}

        {/* AI Insight */}
        {insight && (
          <div style={{background:"rgba(120,53,15,0.4)",border:"1px solid rgba(217,119,6,0.5)",borderRadius:"12px",padding:"12px 16px",display:"flex",gap:"12px",alignItems:"flex-start"}}>
            <span style={{fontSize:"20px"}}>🤖</span>
            <p style={{fontSize:"13px",color:"#fde68a",margin:0}}>{insight}</p>
          </div>
        )}

        {/* KPI Cards — enrollment only */}
        {tab === 'enrollment' && students.length > 0 && (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
            <div style={{background:"#1e293b",borderRadius:"12px",padding:"16px",border:"1px solid #334155"}}>
              <p style={{fontSize:"24px",fontWeight:800,color:"#ec4899",margin:0}}>{kpis.total}</p>
              <p style={{fontSize:"11px",color:"#94a3b8",marginTop:"4px"}}>Total Students</p>
            </div>
            <div style={{background:"#1e293b",borderRadius:"12px",padding:"16px",border:"1px solid #334155"}}>
              <p style={{fontSize:"24px",fontWeight:800,color:"#38bdf8",margin:0}}>{kpis.classes}</p>
              <p style={{fontSize:"11px",color:"#94a3b8",marginTop:"4px"}}>Classes</p>
            </div>
            <div style={{background:"#1e293b",borderRadius:"12px",padding:"16px",border:"1px solid #334155"}}>
              <p style={{fontSize:"24px",fontWeight:800,color:"#06b6d4",margin:0}}>{kpis.male}</p>
              <p style={{fontSize:"11px",color:"#94a3b8",marginTop:"4px"}}>Boys</p>
            </div>
            <div style={{background:"#1e293b",borderRadius:"12px",padding:"16px",border:"1px solid #334155"}}>
              <p style={{fontSize:"24px",fontWeight:800,color:"#d946ef",margin:0}}>{kpis.female}</p>
              <p style={{fontSize:"11px",color:"#94a3b8",marginTop:"4px"}}>Girls</p>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{textAlign:"center",padding:"48px 0"}}>
            <div style={{fontSize:"30px",marginBottom:"12px"}}>⏳</div>
            <p style={{color:"#94a3b8",fontSize:"14px"}}>Loading student data...</p>
          </div>
        )}

        {/* Enrollment Table */}
        {!loading && tab === 'enrollment' && filteredStudents.length > 0 && (
          <div style={{background:"#1e293b",borderRadius:"12px",border:"1px solid #334155",overflow:"hidden"}}>
            <div style={{padding:"12px 16px",borderBottom:"1px solid #334155"}}>
              <p style={{fontSize:"13px",fontWeight:600,margin:0,color:"#f1f5f9"}}>Student Enrollment</p>
              <p style={{fontSize:"11px",color:"#94a3b8",margin:0}}>{filteredStudents.length} students</p>
            </div>
            <div style={{}}>
              {filteredStudents.slice(0, 100).map((row, i) => (
                <div key={i} style={{padding:"12px 16px"}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"8px"}}>
                    <div style={{flex:1}}>
                      <p style={{fontSize:"13px",fontWeight:600,color:"#f1f5f9",margin:0}}>{row.full_name}</p>
                      <p style={{fontSize:"11px",color:"#94a3b8",marginTop:"2px"}}>
                        {row.admission_number} · {row.class_name} · {row.gender}
                      </p>
                    </div>
                    <span style={{fontSize:"11px",padding:"2px 8px",borderRadius:"99px",textTransform:"capitalize"}}>
                      {row.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {filteredStudents.length > 100 && (
              <div style={{padding:"12px 16px",borderTop:"1px solid #334155",fontSize:"11px",color:"#94a3b8"}}>
                Showing 100 of {filteredStudents.length} students
              </div>
            )}
          </div>
        )}

        {/* Health Table */}
        {!loading && tab === 'health' && healthRows.length > 0 && (
          <div style={{background:"#1e293b",borderRadius:"12px",border:"1px solid #334155",overflow:"hidden"}}>
            <div style={{padding:"12px 16px",borderBottom:"1px solid #334155"}}>
              <p style={{fontSize:"13px",fontWeight:600,margin:0,color:"#f1f5f9"}}>Health Records</p>
              <p style={{fontSize:"11px",color:"#94a3b8",margin:0}}>{healthRows.length} records</p>
            </div>
            <div style={{}}>
              {healthRows.slice(0, 100).map((row, i) => (
                <div key={i} style={{padding:"12px 16px"}}>
                  <p style={{fontSize:"13px",fontWeight:600,color:"#f1f5f9",margin:0}}>{row.student_name}</p>
                  <p style={{fontSize:"11px",color:"#fca5a5",marginTop:"2px"}}>{row.condition}</p>
                  <p style={{fontSize:"11px",color:"#64748b",marginTop:"2px"}}>{row.diagnosed_date} · {row.notes}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Library Table */}
        {!loading && tab === 'library' && libraryRows.length > 0 && (
          <div style={{background:"#1e293b",borderRadius:"12px",border:"1px solid #334155",overflow:"hidden"}}>
            <div style={{padding:"12px 16px",borderBottom:"1px solid #334155"}}>
              <p style={{fontSize:"13px",fontWeight:600,margin:0,color:"#f1f5f9"}}>Library Borrowings</p>
              <p style={{fontSize:"11px",color:"#94a3b8",margin:0}}>{libraryRows.length} records</p>
            </div>
            <div style={{}}>
              {libraryRows.slice(0, 100).map((row, i) => (
                <div key={i} style={{padding:"12px 16px"}}>
                  <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"8px"}}>
                    <div style={{flex:1}}>
                      <p style={{fontSize:"13px",fontWeight:600,color:"#f1f5f9",margin:0}}>{row.student_name}</p>
                      <p style={{fontSize:"11px",color:"#93c5fd",marginTop:"2px"}}>{row.book_title}</p>
                      <p style={{fontSize:"11px",color:"#64748b",marginTop:"2px"}}>
                        Borrowed: {row.borrowed_date} · Due: {row.return_date}
                      </p>
                    </div>
                    <span style={{fontSize:"11px",padding:"2px 8px",borderRadius:"99px",textTransform:"capitalize"}}>
                      {row.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Badges Table */}
        {!loading && tab === 'badges' && badgeRows.length > 0 && (
          <div style={{background:"#1e293b",borderRadius:"12px",border:"1px solid #334155",overflow:"hidden"}}>
            <div style={{padding:"12px 16px",borderBottom:"1px solid #334155"}}>
              <p style={{fontSize:"13px",fontWeight:600,margin:0,color:"#f1f5f9"}}>Badges Awarded</p>
              <p style={{fontSize:"11px",color:"#94a3b8",margin:0}}>{badgeRows.length} badges</p>
            </div>
            <div style={{}}>
              {badgeRows.slice(0, 100).map((row, i) => (
                <div key={i} style={{padding:"12px 16px",display:"flex",alignItems:"center",gap:"12px"}}>
                  <span style={{fontSize:"24px"}}>🏅</span>
                  <div>
                    <p style={{fontSize:"13px",fontWeight:600,color:"#f1f5f9",margin:0}}>{row.student_name}</p>
                    <p style={{fontSize:"11px",color:"#fde68a",marginTop:"2px"}}>{row.badge_name}</p>
                    <p style={{fontSize:"11px",color:"#64748b",marginTop:"2px"}}>{row.awarded_date}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty states */}
        {!loading && tab === 'enrollment' && filteredStudents.length === 0 && (
          <div style={{textAlign:"center",padding:"48px 0"}}>
            <p style={{fontSize:"36px",marginBottom:"12px"}}>🎓</p>
            <p style={{color:"#94a3b8",fontSize:"14px"}}>No students found</p>
          </div>
        )}
        {!loading && tab === 'health' && healthRows.length === 0 && (
          <div style={{textAlign:"center",padding:"48px 0"}}>
            <p style={{fontSize:"36px",marginBottom:"12px"}}>🏥</p>
            <p style={{color:"#94a3b8",fontSize:"14px"}}>No health records found</p>
          </div>
        )}
        {!loading && tab === 'library' && libraryRows.length === 0 && (
          <div style={{textAlign:"center",padding:"48px 0"}}>
            <p style={{fontSize:"36px",marginBottom:"12px"}}>📚</p>
            <p style={{color:"#94a3b8",fontSize:"14px"}}>No library records found</p>
          </div>
        )}
        {!loading && tab === 'badges' && badgeRows.length === 0 && (
          <div style={{textAlign:"center",padding:"48px 0"}}>
            <p style={{fontSize:"36px",marginBottom:"12px"}}>🏅</p>
            <p style={{color:"#94a3b8",fontSize:"14px"}}>No badges awarded yet</p>
          </div>
        )}

      </div>
    </div>
  )
}
