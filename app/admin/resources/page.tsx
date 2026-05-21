'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface ResourceDocument {
  id: string
  school_id: string
  title: string
  category: string
  file_url: string | null
  file_type: string | null
  file_size_kb: number | null
  visibility: 'admin_only' | 'staff' | 'everyone'
  uploaded_by: string
  created_at: string
  uploader_name?: string
}

const C = {
  hero:      '#0a1628',
  heroMid:   '#0d2347',
  emerald:   '#10b981',
  emeraldLt: '#d1fae5',
  bg:        '#f0f4f8',
  border:    '#e2e8f0',
  surface:   '#ffffff',
  text:      '#0f172a',
  muted:     '#64748b',
}

const CATEGORIES = ['policy','moe_circular','form','template','report','other']
const VISIBILITIES = ['admin_only','staff','everyone']

const CATEGORY_LABELS: Record<string, string> = {
  policy:       'Policy',
  moe_circular: 'MOE Circular',
  form:         'Form',
  template:     'Template',
  report:       'Report',
  other:        'Other',
}

const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  policy:       { bg: '#dbeafe', color: '#1d4ed8' },
  moe_circular: { bg: '#fce7f3', color: '#be185d' },
  form:         { bg: '#fef9c3', color: '#a16207' },
  template:     { bg: '#d1fae5', color: '#065f46' },
  report:       { bg: '#ede9fe', color: '#6d28d9' },
  other:        { bg: '#f1f5f9', color: '#475569' },
}

const VISIBILITY_COLORS: Record<string, { bg: string; color: string }> = {
  admin_only: { bg: '#fee2e2', color: '#b91c1c' },
  staff:      { bg: '#fef3c7', color: '#92400e' },
  everyone:   { bg: '#d1fae5', color: '#065f46' },
}

const VISIBILITY_LABELS: Record<string, string> = {
  admin_only: 'Admin Only',
  staff:      'Staff',
  everyone:   'Everyone',
}

const FILE_ICONS: Record<string, string> = {
  pdf:  '📄',
  docx: '📝',
  zip:  '🗜️',
  png:  '🖼️',
  mp4:  '🎬',
  other: '📎',
}

function formatSize(kb: number | null): string {
  if (!kb) return ''
  if (kb < 1024) return `${kb} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-KE', {
    day: 'numeric', month: 'short', year: 'numeric'
  })
}

const TABS = [
  { key: 'documents', label: 'Documents', icon: '📁' },
  { key: 'learning',  label: 'Learning',  icon: '📚' },
  { key: 'assets',    label: 'Assets',    icon: '🏫' },
  { key: 'library',   label: 'Library',   icon: '📖' },
  { key: 'store',     label: 'Store',     icon: '🏪' },
  { key: 'staff',     label: 'Staff',     icon: '👩‍🏫' },
]

export default function AdminResourcesPage() {
  const router = useRouter()
  

  const [activeTab, setActiveTab] = useState('documents')
  const [schoolId, setSchoolId]   = useState<string | null>(null)
  const [userId, setUserId]       = useState<string | null>(null)

  // Documents state
  const [docs, setDocs]                 = useState<ResourceDocument[]>([])
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [filterCat, setFilterCat]       = useState('all')
  const [filterVis, setFilterVis]       = useState('all')
  const [showModal, setShowModal]       = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ResourceDocument | null>(null)
  const [uploading, setUploading]       = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [success, setSuccess]           = useState<string | null>(null)

  // Upload form state
  const [formTitle, setFormTitle]   = useState('')
  const [formCat, setFormCat]       = useState('policy')
  const [formVis, setFormVis]       = useState<'admin_only'|'staff'|'everyone'>('staff')
  const [formFile, setFormFile]     = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // ─── Auth + school ──────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: p } = await supabase
        .from('profiles')
        .select('school_id')
        .eq('id', user.id)
        .single()
      if (!p?.school_id) { router.push('/login'); return }
      setUserId(user.id)
      setSchoolId(p.school_id)
    }
    init()
  }, [])

  // ─── Fetch documents ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!schoolId) return
    fetchDocs()
  }, [schoolId])

  async function fetchDocs() {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('resource_documents')
      .select('*, uploader:uploaded_by(full_name)')
      .eq('school_id', schoolId!)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (err) { setError('Failed to load documents.'); setLoading(false); return }

    const mapped: ResourceDocument[] = (data || []).map((d: any) => ({
      ...d,
      uploader_name: d.uploader?.full_name ?? 'Unknown',
    }))
    setDocs(mapped)
    setLoading(false)
  }

  // ─── Upload ─────────────────────────────────────────────────────────────────
  async function handleUpload() {
    if (!formTitle.trim()) { setError('Title is required.'); return }
    if (!formFile)          { setError('Please select a file.'); return }
    if (!schoolId || !userId) return

    setUploading(true)
    setError(null)

    const ext      = formFile.name.split('.').pop()?.toLowerCase() ?? 'other'
    const safeName = `${Date.now()}_${formFile.name.replace(/\s+/g, '_')}`
    const path     = `${schoolId}/${safeName}`

    const { error: upErr } = await supabase.storage
      .from('resource-documents')
      .upload(path, formFile, { upsert: false })

    if (upErr) { setError('File upload failed: ' + upErr.message); setUploading(false); return }

    const { data: urlData } = supabase.storage
      .from('resource-documents')
      .getPublicUrl(path)

    const fileType = ['pdf','docx','zip','png','mp4'].includes(ext) ? ext : 'other'
    const fileSizeKb = Math.round(formFile.size / 1024)

    const { error: dbErr } = await supabase.from('resource_documents').insert({
      school_id:   schoolId,
      title:       formTitle.trim(),
      category:    formCat,
      file_url:    urlData.publicUrl,
      file_type:   fileType,
      file_size_kb: fileSizeKb,
      visibility:  formVis,
      uploaded_by: userId,
    })

    if (dbErr) { setError('Saved file but DB insert failed: ' + dbErr.message); setUploading(false); return }

    setSuccess('Document uploaded successfully.')
    setShowModal(false)
    resetForm()
    fetchDocs()
    setUploading(false)
    setTimeout(() => setSuccess(null), 3000)
  }

  // ─── Soft delete ────────────────────────────────────────────────────────────
  async function handleDelete(doc: ResourceDocument) {
    const { error: err } = await supabase
      .from('resource_documents')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', doc.id)
    if (err) { setError('Delete failed.'); return }
    setDeleteTarget(null)
    setSuccess('Document removed.')
    fetchDocs()
    setTimeout(() => setSuccess(null), 3000)
  }

  function resetForm() {
    setFormTitle('')
    setFormCat('policy')
    setFormVis('staff')
    setFormFile(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  // ─── Filtered docs ──────────────────────────────────────────────────────────
  const filtered = docs.filter(d => {
    const matchSearch = d.title.toLowerCase().includes(search.toLowerCase())
    const matchCat    = filterCat === 'all' || d.category === filterCat
    const matchVis    = filterVis === 'all' || d.visibility === filterVis
    return matchSearch && matchCat && matchVis
  })

  // ─── Stats ──────────────────────────────────────────────────────────────────
  const stats = [
    { label: 'Total Assets',       value: '—', icon: '🏫' },
    { label: 'Books Borrowed',     value: '—', icon: '📖' },
    { label: 'Pending Requests',   value: '—', icon: '⏳' },
    { label: 'Low Stock Items',    value: '—', icon: '⚠️' },
  ]

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, ${C.hero} 0%, ${C.heroMid} 100%)`,
        padding: '20px 16px 0',
        position: 'sticky', top: 0, zIndex: 40,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button
            onClick={() => router.back()}
            style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10,
              width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#fff', fontSize: 18 }}
          >‹</button>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>Admin</div>
            <div style={{ color: '#fff', fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}>Resources</div>
          </div>
        </div>

        {/* Stats bar */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12,
          scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {stats.map(s => (
            <div key={s.label} style={{
              background: 'rgba(255,255,255,0.10)', borderRadius: 12, padding: '10px 14px',
              minWidth: 110, flexShrink: 0, border: '1px solid rgba(255,255,255,0.08)',
            }}>
              <div style={{ fontSize: 18 }}>{s.icon}</div>
              <div style={{ color: '#fff', fontSize: 18, fontWeight: 700, marginTop: 2 }}>{s.value}</div>
              <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10, fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '10px 14px', whiteSpace: 'nowrap',
              color: activeTab === t.key ? C.emerald : 'rgba(255,255,255,0.55)',
              fontWeight: activeTab === t.key ? 700 : 500,
              fontSize: 13,
              borderBottom: activeTab === t.key ? `2px solid ${C.emerald}` : '2px solid transparent',
              transition: 'all 0.2s',
            }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ padding: '16px' }}>

        {/* ── DOCUMENTS TAB ── */}
        {activeTab === 'documents' && (
          <div>

            {/* Toast */}
            {success && (
              <div style={{ background: C.emeraldLt, color: '#065f46', borderRadius: 10,
                padding: '10px 14px', marginBottom: 12, fontSize: 13, fontWeight: 600 }}>
                ✅ {success}
              </div>
            )}
            {error && (
              <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 10,
                padding: '10px 14px', marginBottom: 12, fontSize: 13, fontWeight: 600 }}>
                ⚠️ {error}
                <button onClick={() => setError(null)}
                  style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer',
                    color: '#b91c1c', fontWeight: 700 }}>✕</button>
              </div>
            )}

            {/* Search + Filters */}
            <div style={{ background: C.surface, borderRadius: 16, padding: 14,
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 12 }}>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search documents…"
                style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: 10,
                  padding: '9px 12px', fontSize: 14, color: C.text, outline: 'none',
                  boxSizing: 'border-box', marginBottom: 10 }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
                  style={{ flex: 1, border: `1px solid ${C.border}`, borderRadius: 10,
                    padding: '8px 10px', fontSize: 13, color: C.text, background: C.surface, outline: 'none' }}>
                  <option value="all">All Categories</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                </select>
                <select value={filterVis} onChange={e => setFilterVis(e.target.value)}
                  style={{ flex: 1, border: `1px solid ${C.border}`, borderRadius: 10,
                    padding: '8px 10px', fontSize: 13, color: C.text, background: C.surface, outline: 'none' }}>
                  <option value="all">All Visibility</option>
                  {VISIBILITIES.map(v => <option key={v} value={v}>{VISIBILITY_LABELS[v]}</option>)}
                </select>
              </div>
            </div>

            {/* Count */}
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, paddingLeft: 2 }}>
              {loading ? 'Loading…' : `${filtered.length} document${filtered.length !== 1 ? 's' : ''}`}
            </div>

            {/* Document cards */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>
                <div style={{ fontSize: 32 }}>📁</div>
                <div style={{ marginTop: 8, fontSize: 14 }}>Loading documents…</div>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 48, background: C.surface,
                borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <div style={{ fontSize: 40 }}>📁</div>
                <div style={{ fontWeight: 700, fontSize: 16, marginTop: 12, color: C.text }}>No documents yet</div>
                <div style={{ color: C.muted, fontSize: 13, marginTop: 6 }}>
                  Upload policies, MOE circulars, forms and more.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filtered.map(doc => (
                  <div key={doc.id} style={{
                    background: C.surface, borderRadius: 16,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    padding: '14px 14px 12px',
                    border: `1px solid ${C.border}`,
                  }}>
                    {/* Top row */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      {/* File icon */}
                      <div style={{
                        width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                        background: C.bg, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: 22,
                      }}>
                        {FILE_ICONS[doc.file_type ?? 'other'] ?? '📎'}
                      </div>
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: C.text,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {doc.title}
                        </div>
                        <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                          {doc.uploader_name} · {formatDate(doc.created_at)}
                          {doc.file_size_kb ? ` · ${formatSize(doc.file_size_kb)}` : ''}
                        </div>
                        {/* Badges */}
                        <div style={{ display: 'flex', gap: 6, marginTop: 7, flexWrap: 'wrap' }}>
                          <span style={{
                            ...CATEGORY_COLORS[doc.category],
                            fontSize: 10, fontWeight: 700, padding: '2px 8px',
                            borderRadius: 20, textTransform: 'uppercase', letterSpacing: 0.5,
                          }}>
                            {CATEGORY_LABELS[doc.category] ?? doc.category}
                          </span>
                          <span style={{
                            ...VISIBILITY_COLORS[doc.visibility],
                            fontSize: 10, fontWeight: 700, padding: '2px 8px',
                            borderRadius: 20, textTransform: 'uppercase', letterSpacing: 0.5,
                          }}>
                            {VISIBILITY_LABELS[doc.visibility]}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      {doc.file_url ? (
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            flex: 1, background: C.emerald, color: '#fff',
                            borderRadius: 10, padding: '8px 0', textAlign: 'center',
                            fontWeight: 700, fontSize: 13, textDecoration: 'none',
                            display: 'block',
                          }}
                        >
                          ↗ Open
                        </a>
                      ) : (
                        <div style={{ flex: 1, background: C.bg, borderRadius: 10,
                          padding: '8px 0', textAlign: 'center', fontSize: 13, color: C.muted }}>
                          No file
                        </div>
                      )}
                      <button
                        onClick={() => setDeleteTarget(doc)}
                        style={{
                          background: '#fee2e2', color: '#b91c1c', border: 'none',
                          borderRadius: 10, padding: '8px 16px', fontWeight: 700,
                          fontSize: 13, cursor: 'pointer',
                        }}
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── OTHER TABS (stubs) ── */}
        {activeTab !== 'documents' && (
          <div style={{ textAlign: 'center', padding: 60, color: C.muted }}>
            <div style={{ fontSize: 40 }}>
              {TABS.find(t => t.key === activeTab)?.icon}
            </div>
            <div style={{ fontWeight: 700, fontSize: 16, marginTop: 12, color: C.text }}>
              {TABS.find(t => t.key === activeTab)?.label} — Coming Soon
            </div>
            <div style={{ fontSize: 13, marginTop: 6 }}>
              This tab will be built in the next session.
            </div>
          </div>
        )}
      </div>

      {/* ── FAB ── */}
      {activeTab === 'documents' && (
        <button
          onClick={() => { resetForm(); setError(null); setShowModal(true) }}
          style={{
            position: 'fixed', bottom: 24, right: 20,
            background: C.emerald, color: '#fff', border: 'none',
            borderRadius: 20, padding: '14px 22px',
            fontWeight: 700, fontSize: 15, cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(16,185,129,0.45)',
            display: 'flex', alignItems: 'center', gap: 8,
            zIndex: 50,
          }}
        >
          <span style={{ fontSize: 20, lineHeight: 1 }}>+</span> Upload
        </button>
      )}

      {/* ── Upload Modal ── */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          zIndex: 100, display: 'flex', alignItems: 'flex-end',
        }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}
        >
          <div style={{
            background: C.surface, borderRadius: '20px 20px 0 0',
            width: '100%', maxHeight: '90vh', overflowY: 'auto',
            padding: '20px 16px 32px',
          }}>
            {/* Handle */}
            <div style={{ width: 36, height: 4, background: C.border,
              borderRadius: 2, margin: '0 auto 16px' }} />

            <div style={{ fontWeight: 800, fontSize: 18, color: C.text, marginBottom: 18 }}>
              Upload Document
            </div>

            {error && (
              <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 10,
                padding: '10px 12px', marginBottom: 14, fontSize: 13, fontWeight: 600 }}>
                ⚠️ {error}
              </div>
            )}

            {/* Title */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: C.muted,
                textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>
                Title *
              </label>
              <input
                value={formTitle}
                onChange={e => setFormTitle(e.target.value)}
                placeholder="e.g. School Fees Policy 2025"
                style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: 10,
                  padding: '10px 12px', fontSize: 14, color: C.text, outline: 'none',
                  boxSizing: 'border-box' }}
              />
            </div>

            {/* Category */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: C.muted,
                textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>
                Category *
              </label>
              <select
                value={formCat}
                onChange={e => setFormCat(e.target.value)}
                style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: 10,
                  padding: '10px 12px', fontSize: 14, color: C.text,
                  background: C.surface, outline: 'none', boxSizing: 'border-box' }}
              >
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>

            {/* Visibility */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: C.muted,
                textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>
                Visibility *
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                {VISIBILITIES.map(v => (
                  <button key={v} onClick={() => setFormVis(v as any)}
                    style={{
                      flex: 1, padding: '9px 4px', borderRadius: 10, fontSize: 12, fontWeight: 700,
                      cursor: 'pointer', border: `2px solid ${formVis === v ? C.emerald : C.border}`,
                      background: formVis === v ? C.emeraldLt : C.surface,
                      color: formVis === v ? '#065f46' : C.muted,
                      transition: 'all 0.15s',
                    }}>
                    {VISIBILITY_LABELS[v]}
                  </button>
                ))}
              </div>
            </div>

            {/* File picker */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: C.muted,
                textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>
                File *
              </label>
              <div
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2px dashed ${formFile ? C.emerald : C.border}`,
                  borderRadius: 12, padding: '18px 12px', textAlign: 'center',
                  cursor: 'pointer', background: formFile ? C.emeraldLt : C.bg,
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ fontSize: 28 }}>{formFile ? '✅' : '📤'}</div>
                <div style={{ fontSize: 13, fontWeight: 600, marginTop: 6, color: C.text }}>
                  {formFile ? formFile.name : 'Tap to select file'}
                </div>
                {formFile && (
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                    {formatSize(Math.round(formFile.size / 1024))}
                  </div>
                )}
                {!formFile && (
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                    PDF, DOCX, ZIP, PNG, MP4
                  </div>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.docx,.zip,.png,.mp4"
                style={{ display: 'none' }}
                onChange={e => setFormFile(e.target.files?.[0] ?? null)}
              />
            </div>

            {/* Submit */}
            <button
              onClick={handleUpload}
              disabled={uploading}
              style={{
                width: '100%', background: uploading ? C.muted : C.emerald,
                color: '#fff', border: 'none', borderRadius: 12,
                padding: '14px', fontWeight: 800, fontSize: 15,
                cursor: uploading ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s',
              }}
            >
              {uploading ? 'Uploading…' : 'Upload Document'}
            </button>

            <button
              onClick={() => setShowModal(false)}
              style={{ width: '100%', background: 'none', border: 'none',
                color: C.muted, fontSize: 14, marginTop: 12, cursor: 'pointer', padding: 8 }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteTarget && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20,
        }}>
          <div style={{ background: C.surface, borderRadius: 20, padding: 24, width: '100%', maxWidth: 340 }}>
            <div style={{ fontSize: 32, textAlign: 'center' }}>🗑️</div>
            <div style={{ fontWeight: 800, fontSize: 16, textAlign: 'center', marginTop: 10, color: C.text }}>
              Remove Document?
            </div>
            <div style={{ fontSize: 13, color: C.muted, textAlign: 'center', marginTop: 6, marginBottom: 20 }}>
              "{deleteTarget.title}" will be removed. This cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteTarget(null)}
                style={{ flex: 1, background: C.bg, border: `1px solid ${C.border}`,
                  borderRadius: 12, padding: 12, fontWeight: 700, fontSize: 14,
                  cursor: 'pointer', color: C.text }}>
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteTarget)}
                style={{ flex: 1, background: '#ef4444', border: 'none',
                  borderRadius: 12, padding: 12, fontWeight: 700, fontSize: 14,
                  cursor: 'pointer', color: '#fff' }}>
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
