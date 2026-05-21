'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const categories = [
  { key: 'academic',     label: 'Academic',     icon: '📚', href: '/reports/academic',     color: 'from-blue-600 to-blue-800' },
  { key: 'attendance',   label: 'Attendance',   icon: '📅', href: '/reports/attendance',   color: 'from-green-600 to-green-800' },
  { key: 'finance',      label: 'Finance',      icon: '💰', href: '/reports/finance',      color: 'from-yellow-600 to-yellow-800' },
  { key: 'staff',        label: 'Staff',        icon: '👨‍🏫', href: '/reports/staff',        color: 'from-purple-600 to-purple-800' },
  { key: 'students',     label: 'Students',     icon: '👥', href: '/reports/students',     color: 'from-pink-600 to-pink-800' },
  { key: 'operational',  label: 'Operational',  icon: '🏛️', href: '/reports/operational',  color: 'from-orange-600 to-orange-800' },
  { key: 'system',       label: 'System',       icon: '🔐', href: '/reports/system',       color: 'from-red-600 to-red-800' },
]

export default function ReportsPage() {
  const [search, setSearch] = useState('')
  const [schoolName, setSchoolName] = useState('EduWorld Kenya')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadSchool() {
      const { data } = await supabase.from('schools').select('name').limit(1).single()
      if (data?.name) setSchoolName(data.name)
      setLoading(false)
    }
    loadSchool()
  }, [])

  const filtered = categories.filter(c =>
    c.label.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      {/* Header */}
      <div className="bg-[#1e293b] border-b border-slate-700 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-bold text-white">Reports</h1>
              {!loading && (
                <p className="text-xs text-slate-400">{schoolName}</p>
              )}
            </div>
            <span className="text-2xl">📊</span>
          </div>
          {/* Search */}
          <input
            type="text"
            placeholder="Search reports..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-[#0f172a] border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#1e293b] rounded-xl p-3 text-center border border-slate-700">
            <p className="text-2xl font-bold text-blue-400">7</p>
            <p className="text-xs text-slate-400 mt-1">Categories</p>
          </div>
          <div className="bg-[#1e293b] rounded-xl p-3 text-center border border-slate-700">
            <p className="text-2xl font-bold text-green-400">134</p>
            <p className="text-xs text-slate-400 mt-1">Data Tables</p>
          </div>
          <div className="bg-[#1e293b] rounded-xl p-3 text-center border border-slate-700">
            <p className="text-2xl font-bold text-yellow-400">5</p>
            <p className="text-xs text-slate-400 mt-1">Live Views</p>
          </div>
        </div>

        {/* Categories */}
        <div>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Report Categories
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {filtered.map(cat => (
              <Link key={cat.key} href={cat.href}>
                <div className={`bg-gradient-to-br ${cat.color} rounded-xl p-4 border border-slate-700 active:scale-95 transition-transform cursor-pointer`}>
                  <div className="text-3xl mb-2">{cat.icon}</div>
                  <p className="font-semibold text-white text-sm">{cat.label}</p>
                  <p className="text-xs text-white/60 mt-0.5">View reports →</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-500 text-sm">No categories match "{search}"</p>
          </div>
        )}

      </div>
    </div>
  )
}
