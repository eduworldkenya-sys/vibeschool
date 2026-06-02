"use client";
'use client'
import { supabase } from '@/lib/supabase'

import { useEffect, useState } from 'react'
import Link from 'next/link'


const categories = [
  { key: 'academic',     label: 'Academic',     icon: '📚', href: '/admin/reports/academic',     color: 'from-blue-600 to-blue-800' },
  { key: 'attendance',   label: 'Attendance',   icon: '📅', href: '/admin/reports/attendance',   color: 'from-green-600 to-green-800' },
  { key: 'finance',      label: 'Finance',      icon: '💰', href: '/admin/reports/finance',      color: 'from-yellow-600 to-yellow-800' },
  { key: 'staff',        label: 'Staff',        icon: '👨‍🏫', href: '/admin/reports/staff',        color: 'from-purple-600 to-purple-800' },
  { key: 'students',     label: 'Students',     icon: '👥', href: '/admin/reports/students',     color: 'from-pink-600 to-pink-800' },
  { key: 'operational',  label: 'Operational',  icon: '🏛️', href: '/admin/reports/operational',  color: 'from-orange-600 to-orange-800' },
  { key: 'system',       label: 'System',       icon: '🔐', href: '/admin/reports/system',       color: 'from-red-600 to-red-800' },
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
    <div style={{minHeight:"100vh",background:"#0f172a",color:"#f1f5f9"}}>
      {/* Header */}
      <div style={{background:"#1e293b",borderBottom:"1px solid #334155",padding:"16px",position:"sticky",top:0,zIndex:10}}>
        <div style={{maxWidth:"672px",margin:"0 auto"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"12px"}}>
            <div>
              <h1 style={{fontSize:"20px",fontWeight:700,color:"#f1f5f9",margin:0}}>Reports</h1>
              {!loading && (
                <p style={{fontSize:"11px",color:"#94a3b8",margin:0}}>{schoolName}</p>
              )}
            </div>
            <span style={{fontSize:"24px"}}>📊</span>
          </div>
          {/* Search */}
          <input
            type="text"
            placeholder="Search reports..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{width:"100%",background:"#0f172a",border:"1px solid #475569",borderRadius:"12px",padding:"10px 16px",fontSize:"13px",color:"#f1f5f9",outline:"none"}}
          />
        </div>
      </div>

      <div style={{maxWidth:"672px",margin:"0 auto",padding:"24px 16px",display:"flex",flexDirection:"column",gap:"24px"}}>

        {/* Quick Stats */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"12px"}}>
          <div style={{background:"#1e293b",borderRadius:"12px",padding:"12px",border:"1px solid #334155",textAlign:"center"}}>
            <p style={{fontSize:"24px",fontWeight:800,color:"#38bdf8",margin:0}}>7</p>
            <p style={{fontSize:"11px",color:"#94a3b8",marginTop:"4px"}}>Categories</p>
          </div>
          <div style={{background:"#1e293b",borderRadius:"12px",padding:"12px",border:"1px solid #334155",textAlign:"center"}}>
            <p style={{fontSize:"24px",fontWeight:800,color:"#10b981",margin:0}}>134</p>
            <p style={{fontSize:"11px",color:"#94a3b8",marginTop:"4px"}}>Data Tables</p>
          </div>
          <div style={{background:"#1e293b",borderRadius:"12px",padding:"12px",border:"1px solid #334155",textAlign:"center"}}>
            <p style={{fontSize:"24px",fontWeight:800,color:"#f59e0b",margin:0}}>5</p>
            <p style={{fontSize:"11px",color:"#94a3b8",marginTop:"4px"}}>Live Views</p>
          </div>
        </div>

        {/* Categories */}
        <div>
          <h2 style={{fontSize:"12px",fontWeight:600,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"12px"}}>
            Report Categories
          </h2>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
            {filtered.map(cat => (
              <Link key={cat.key} href={cat.href}>
                <div style={{background:"linear-gradient(135deg,#1e3a5f,#0f172a)",borderRadius:"12px",padding:"16px",border:"1px solid #334155",cursor:"pointer"}}>
                  <div style={{fontSize:"30px",marginBottom:"8px"}}>{cat.icon}</div>
                  <p style={{fontWeight:600,color:"#f1f5f9",fontSize:"13px",margin:0}}>{cat.label}</p>
                  <p style={{fontSize:"11px",color:"rgba(255,255,255,0.6)",marginTop:"2px"}}>View reports →</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {filtered.length === 0 && (
          <div style={{textAlign:"center",padding:"48px 0"}}>
            <p style={{color:"#64748b",fontSize:"14px"}}>No categories match "{search}"</p>
          </div>
        )}

      </div>
    </div>
  )
}
