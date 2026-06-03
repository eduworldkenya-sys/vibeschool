"use client";
'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Profile { id: string; full_name: string; role: string }
interface Props {
  schoolId: string
  selected: string[]
  onChange: (ids: string[]) => void
}

const C = { text: '#0f172a', muted: '#64748b', border: '#e2e8f0', emerald: '#10b981', card: '#ffffff', bg: '#f0f4f8' }

export default function AttendeeSelector({ schoolId, selected, onChange }: Props) {
  const [staff, setStaff]   = useState<Profile[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    supabase.from('profiles').select('id, full_name, role')
      .eq('school_id', schoolId)
      .then(({ data }) => setStaff(data ?? []))
  }, [schoolId])

  const filtered = staff.filter(s =>
    s.full_name?.toLowerCase().includes(search.toLowerCase())
  )

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id])
  }

  return (
    <div>
      <input
        placeholder="Search staff..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{
          width: '100%', padding: '10px 14px', borderRadius: 10,
          border: `1px solid ${C.border}`, fontSize: 13,
          background: C.bg, marginBottom: 10, boxSizing: 'border-box',
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
        {filtered.map(s => {
          const on = selected.includes(s.id)
          return (
            <div
              key={s.id}
              onClick={() => toggle(s.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                background: on ? C.emerald + '12' : C.card,
                border: `1px solid ${on ? C.emerald : C.border}`,
              }}
            >
              <div style={{
                width: 20, height: 20, borderRadius: 6,
                background: on ? C.emerald : 'transparent',
                border: `2px solid ${on ? C.emerald : C.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {on && <span style={{ color: '#fff', fontSize: 12 }}>✓</span>}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{s.full_name}</div>
                <div style={{ fontSize: 11, color: C.muted, textTransform: 'capitalize' }}>{s.role}</div>
              </div>
            </div>
          )
        })}
      </div>
      {selected.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 12, color: C.emerald, fontWeight: 600 }}>
          {selected.length} selected
        </div>
      )}
    </div>
  )
}
