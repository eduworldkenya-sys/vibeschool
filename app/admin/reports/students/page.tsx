'use client'
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
    <div className="min-h-screen bg-[#0f172a] text-white">
      {/* Top Bar */}
      <div className="bg-[#1e293b] border-b border-slate-700 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <a href="/admin/reports" className="text-slate-400 hover:text-white text-xl">←</a>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Students Report</h1>
            <p className="text-xs text-slate-400">Enrollment · Health · Library · Badges</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                tab === t.key
                  ? 'bg-pink-600 text-white'
                  : 'bg-[#1e293b] text-slate-400 border border-slate-700'
              }`}
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
            className="w-full bg-[#1e293b] border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-pink-500"
          />
        )}

        {/* AI Insight */}
        {insight && (
          <div className="bg-amber-900/40 border border-amber-600/50 rounded-xl px-4 py-3 flex gap-3 items-start">
            <span className="text-xl">🤖</span>
            <p className="text-sm text-amber-200">{insight}</p>
          </div>
        )}

        {/* KPI Cards — enrollment only */}
        {tab === 'enrollment' && students.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#1e293b] rounded-xl p-4 border border-slate-700">
              <p className="text-2xl font-bold text-pink-400">{kpis.total}</p>
              <p className="text-xs text-slate-400 mt-1">Total Students</p>
            </div>
            <div className="bg-[#1e293b] rounded-xl p-4 border border-slate-700">
              <p className="text-2xl font-bold text-blue-400">{kpis.classes}</p>
              <p className="text-xs text-slate-400 mt-1">Classes</p>
            </div>
            <div className="bg-[#1e293b] rounded-xl p-4 border border-slate-700">
              <p className="text-2xl font-bold text-cyan-400">{kpis.male}</p>
              <p className="text-xs text-slate-400 mt-1">Boys</p>
            </div>
            <div className="bg-[#1e293b] rounded-xl p-4 border border-slate-700">
              <p className="text-2xl font-bold text-fuchsia-400">{kpis.female}</p>
              <p className="text-xs text-slate-400 mt-1">Girls</p>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin text-3xl mb-3">⏳</div>
            <p className="text-slate-400 text-sm">Loading student data...</p>
          </div>
        )}

        {/* Enrollment Table */}
        {!loading && tab === 'enrollment' && filteredStudents.length > 0 && (
          <div className="bg-[#1e293b] rounded-xl border border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700">
              <p className="text-sm font-semibold">Student Enrollment</p>
              <p className="text-xs text-slate-400">{filteredStudents.length} students</p>
            </div>
            <div className="divide-y divide-slate-700/50">
              {filteredStudents.slice(0, 100).map((row, i) => (
                <div key={i} className="px-4 py-3 hover:bg-slate-700/20">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white">{row.full_name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {row.admission_number} · {row.class_name} · {row.gender}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full capitalize ${statusBadge(row.status)}`}>
                      {row.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {filteredStudents.length > 100 && (
              <div className="px-4 py-3 border-t border-slate-700 text-xs text-slate-400">
                Showing 100 of {filteredStudents.length} students
              </div>
            )}
          </div>
        )}

        {/* Health Table */}
        {!loading && tab === 'health' && healthRows.length > 0 && (
          <div className="bg-[#1e293b] rounded-xl border border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700">
              <p className="text-sm font-semibold">Health Records</p>
              <p className="text-xs text-slate-400">{healthRows.length} records</p>
            </div>
            <div className="divide-y divide-slate-700/50">
              {healthRows.slice(0, 100).map((row, i) => (
                <div key={i} className="px-4 py-3 hover:bg-slate-700/20">
                  <p className="text-sm font-semibold text-white">{row.student_name}</p>
                  <p className="text-xs text-red-300 mt-0.5">{row.condition}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{row.diagnosed_date} · {row.notes}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Library Table */}
        {!loading && tab === 'library' && libraryRows.length > 0 && (
          <div className="bg-[#1e293b] rounded-xl border border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700">
              <p className="text-sm font-semibold">Library Borrowings</p>
              <p className="text-xs text-slate-400">{libraryRows.length} records</p>
            </div>
            <div className="divide-y divide-slate-700/50">
              {libraryRows.slice(0, 100).map((row, i) => (
                <div key={i} className="px-4 py-3 hover:bg-slate-700/20">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white">{row.student_name}</p>
                      <p className="text-xs text-blue-300 mt-0.5">{row.book_title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Borrowed: {row.borrowed_date} · Due: {row.return_date}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full capitalize ${statusBadge(row.status)}`}>
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
          <div className="bg-[#1e293b] rounded-xl border border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700">
              <p className="text-sm font-semibold">Badges Awarded</p>
              <p className="text-xs text-slate-400">{badgeRows.length} badges</p>
            </div>
            <div className="divide-y divide-slate-700/50">
              {badgeRows.slice(0, 100).map((row, i) => (
                <div key={i} className="px-4 py-3 hover:bg-slate-700/20 flex items-center gap-3">
                  <span className="text-2xl">🏅</span>
                  <div>
                    <p className="text-sm font-semibold text-white">{row.student_name}</p>
                    <p className="text-xs text-yellow-300 mt-0.5">{row.badge_name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{row.awarded_date}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty states */}
        {!loading && tab === 'enrollment' && filteredStudents.length === 0 && (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">🎓</p>
            <p className="text-slate-400 text-sm">No students found</p>
          </div>
        )}
        {!loading && tab === 'health' && healthRows.length === 0 && (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">🏥</p>
            <p className="text-slate-400 text-sm">No health records found</p>
          </div>
        )}
        {!loading && tab === 'library' && libraryRows.length === 0 && (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">📚</p>
            <p className="text-slate-400 text-sm">No library records found</p>
          </div>
        )}
        {!loading && tab === 'badges' && badgeRows.length === 0 && (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">🏅</p>
            <p className="text-slate-400 text-sm">No badges awarded yet</p>
          </div>
        )}

      </div>
    </div>
  )
}
