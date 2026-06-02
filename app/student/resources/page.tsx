"use client";

import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { C } from '@/components/teacher/ui'

interface Resource {
  id: string; title: string; description: string; type: string; subject: string
  external_url: string | null; content: string | null; created_at: string
}

const TYPES = [
  { value: 'notes', label: 'Notes', icon: '📄', color: '#1d4ed8', bg: '#dbeafe' },
  { value: 'assessment', label: 'Assessment', icon: '📝', color: '#065f46', bg: '#d1fae5' },
  { value: 'exercise', label: 'Exercise', icon: '🏋️', color: '#92400e', bg: '#fef3c7' },
  { value: 'quiz', label: 'Quiz', icon: '🧪', color: '#6d28d9', bg: '#ede9fe' },
  { value: 'video', label: 'Video', icon: '📺', color: '#991b1b', bg: '#fee2e2' },
]

function isSafeUrl(url: string | null): boolean {
  if (!url) return false
  try { return ['http:', 'https:'].includes(new URL(url).protocol) }
  catch { return false }
}

function StudentResourcesInner() {
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('student_accessible_resources').select('*').order('created_at', { ascending: false })
      setResources(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = filter === 'all' ? resources : resources.filter(r => r.type === filter)

  return (
    <div style={{ padding: '20px', fontFamily: "'Plus Jakarta Sans', sans-serif", background: '#f9fafb', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 20, fontWeight: 900, color: '#111827' }}>📚 My Learning Resources</h1>
      
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 20 }}>
        {[{ value: 'all', label: 'All', icon: '📚' }, ...TYPES].map(t => (
          <button key={t.value} onClick={() => setFilter(t.value)} style={{ padding: '6px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', background: filter === t.value ? '#374151' : '#fff', color: filter === t.value ? '#fff' : '#6b7280', fontWeight: 700, fontSize: 12 }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {loading ? <p>Loading...</p> : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', background: '#fff', borderRadius: 16 }}>
          <p>No resources found for this category.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(r => (
            <div key={r.id} style={{ background: '#fff', padding: 16, borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div onClick={() => setExpanded(expanded === r.id ? null : r.id)} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: 14 }}>{r.title}</h3>
                <span>{expanded === r.id ? '▲' : '▼'}</span>
              </div>
              {expanded === r.id && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #eee' }}>
                  <p style={{ fontSize: 13, color: '#666' }}>{r.description}</p>
                  {r.content && <pre style={{ background: '#f8f8f8', padding: 10, borderRadius: 8 }}>{r.content}</pre>}
                  {isSafeUrl(r.external_url) && (
                    <a href={r.external_url!} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 10, color: '#4f46e5', fontWeight: 700 }}>🔗 Open Link</a>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function StudentResourcesPage() {
  return <Suspense fallback={<div>Loading...</div>}><StudentResourcesInner /></Suspense>
}
