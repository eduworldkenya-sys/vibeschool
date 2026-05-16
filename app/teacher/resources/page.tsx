'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, SectionLabel, Btn, C } from '@/components/teacher/ui'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClassOption {
  id: string
  name: string
  stream: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  PDF:  { bg: '#fee2e2', color: '#991b1b' },
  DOCX: { bg: '#dbeafe', color: '#1d4ed8' },
  ZIP:  { bg: '#fef3c7', color: '#92400e' },
  PNG:  { bg: C.accentLight, color: '#065f46' },
  MP4:  { bg: '#ede9fe', color: '#6d28d9' },
}

function FileIcon({ type }: { type: string }) {
  const tc = TYPE_COLORS[type] ?? { bg: C.surface, color: C.textMuted }
  return (
    <div style={{
      width: 40, height: 40, borderRadius: 10,
      background: tc.bg, color: tc.color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 10, fontWeight: 800, flexShrink: 0,
    }}>
      {type}
    </div>
  )
}

function Skeleton({ h = 56 }: { h?: number }) {
  return (
    <div style={{
      height: h, borderRadius: 12,
      background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
    }} />
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ResourcesPage() {
  const [classes, setClasses]   = useState<ClassOption[]>([])
  const [filter, setFilter]     = useState<string>('All')
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Not signed in.'); setLoading(false); return }

      const { data: tcData, error: tcErr } = await supabase
        .from('teacher_classes')
        .select('class_id')
        .eq('teacher_id', user.id)

      if (tcErr) { setError(tcErr.message); setLoading(false); return }

      const classIds = Array.from(new Set((tcData ?? []).map((r: { class_id: string }) => r.class_id)))

      if (classIds.length === 0) { setLoading(false); return }

      const { data: classData, error: classErr } = await supabase
        .from('classes')
        .select('id, name, stream')
        .in('id', classIds)

      if (classErr) { setError(classErr.message); setLoading(false); return }

      setClasses(classData ?? [])
      setLoading(false)
    }

    load()
  }, [])

  const filterLabels = ['All', ...classes.map(c => `${c.name} ${c.stream}`.trim())]

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes shimmer {
          0%   { background-position:  200% 0 }
          100% { background-position: -200% 0 }
        }
      `}</style>

      <div style={{ padding: '16px 16px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #374151 0%, #6b7280 100%)',
          borderRadius: 20, padding: '20px', color: '#fff',
        }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
            Resources
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>Teaching Materials</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 6 }}>
            Upload, manage, and share resources with your classes.
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ padding: '12px 14px', borderRadius: 10, background: '#fef2f2', color: C.error, fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Skeleton h={44} />
            <Skeleton h={200} />
          </div>
        )}

        {/* Filter tabs + upload */}
        {!loading && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {filterLabels.map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '6px 14px', borderRadius: 20, border: 'none',
                  cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
                  background: filter === f ? C.accent : C.surface,
                  color:      filter === f ? '#fff'    : C.textMuted,
                }}
              >
                {f}
              </button>
            ))}
            <button style={{
              marginLeft: 'auto', padding: '6px 14px', borderRadius: 20,
              border: `1.5px solid ${C.accent}`, cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
              background: 'transparent', color: C.accent,
            }}>
              + Upload
            </button>
          </div>
        )}

        {/* Resources list — table does not exist yet, empty state */}
        {!loading && (
          <Card>
            <SectionLabel>
              {filter === 'All' ? 'All Resources' : filter}
            </SectionLabel>
            <div style={{ textAlign: 'center', padding: '32px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: C.surface, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 22,
              }}>
                📁
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>No resources yet</div>
              <div style={{ fontSize: 12, color: C.textMuted, maxWidth: 240, lineHeight: 1.5 }}>
                Upload your first teaching material using the button above.
              </div>
              <button style={{
                marginTop: 4, padding: '8px 20px', borderRadius: 20,
                border: `1.5px solid ${C.accent}`, cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                background: 'transparent', color: C.accent,
              }}>
                + Upload Resource
              </button>
            </div>
          </Card>
        )}

        {/* File type legend */}
        {!loading && (
          <Card>
            <SectionLabel>Supported File Types</SectionLabel>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 4 }}>
              {Object.entries(TYPE_COLORS).map(([type, tc]) => (
                <div
                  key={type}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '4px 10px', borderRadius: 20,
                    background: tc.bg, color: tc.color,
                    fontSize: 11, fontWeight: 700,
                  }}
                >
                  {type}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Storage — placeholder until backend exists */}
        {!loading && (
          <Card>
            <SectionLabel>Storage</SectionLabel>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{ flex: 1, height: 8, background: C.border, borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 10, background: C.accent, width: '0%' }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.textPrimary, flexShrink: 0 }}>
                0 / 10 GB
              </span>
            </div>
            <div style={{ fontSize: 12, color: C.textMuted }}>No files uploaded yet.</div>
          </Card>
        )}

      </div>
    </>
  )
}