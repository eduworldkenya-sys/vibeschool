'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface ResourceDocument {
  id: string; school_id: string; title: string; category: string
  file_url: string | null; file_type: string | null; file_size_kb: number | null
  visibility: 'admin_only' | 'staff' | 'everyone'; uploaded_by: string
  created_at: string; uploader_name?: string
}

interface StoreItem {
  id: string; school_id: string; name: string; category: string
  unit: string; quantity: number; low_stock_threshold: number
  added_by: string; created_at: string
}

interface StoreTransaction {
  id: string; school_id: string; item_id: string; txn_type: 'stock_in' | 'stock_out' | 'adjustment'
  quantity: number; reference: string | null; issued_to: string | null
  notes: string | null; created_by: string; created_at: string
}

interface ResourceRequest {
  id: string; school_id: string; requested_by: string; item_id: string | null
  item_name: string | null; quantity: number; reason: string | null
  status: 'pending' | 'approved' | 'rejected' | 'fulfilled'
  reviewed_by: string | null; reviewed_at: string | null; created_at: string
  requester_name?: string
}

const C = {
  hero: '#0a1628', heroMid: '#0d2347', emerald: '#10b981', emeraldLt: '#d1fae5',
  bg: '#f0f4f8', border: '#e2e8f0', surface: '#ffffff', text: '#0f172a', muted: '#64748b',
}

const TABS = [
  { key: 'documents', label: 'Documents', icon: '📁' },
  { key: 'learning',  label: 'Learning',  icon: '📚' },
  { key: 'assets',    label: 'Assets',    icon: '🏫' },
  { key: 'library',   label: 'Library',   icon: '📖' },
  { key: 'store',     label: 'Store',     icon: '🏪' },
  { key: 'staff',     label: 'Staff',     icon: '👩‍🏫' },
]

const DOC_CATEGORIES = ['policy','moe_circular','form','template','report','other']
const DOC_VISIBILITIES = ['admin_only','staff','everyone']
const CATEGORY_LABELS: Record<string,string> = { policy:'Policy', moe_circular:'MOE Circular', form:'Form', template:'Template', report:'Report', other:'Other' }
const CATEGORY_COLORS: Record<string,{bg:string;color:string}> = {
  policy:{bg:'#dbeafe',color:'#1d4ed8'}, moe_circular:{bg:'#fce7f3',color:'#be185d'},
  form:{bg:'#fef9c3',color:'#a16207'}, template:{bg:'#d1fae5',color:'#065f46'},
  report:{bg:'#ede9fe',color:'#6d28d9'}, other:{bg:'#f1f5f9',color:'#475569'},
}
const VISIBILITY_COLORS: Record<string,{bg:string;color:string}> = {
  admin_only:{bg:'#fee2e2',color:'#b91c1c'}, staff:{bg:'#fef3c7',color:'#92400e'}, everyone:{bg:'#d1fae5',color:'#065f46'},
}
const VISIBILITY_LABELS: Record<string,string> = { admin_only:'Admin Only', staff:'Staff', everyone:'Everyone' }
const FILE_ICONS: Record<string,string> = { pdf:'📄', docx:'📝', zip:'🗜️', png:'🖼️', mp4:'🎬', other:'📎' }

const STORE_CATEGORIES = ['stationery','cleaning','furniture','electronics','other']
const STORE_CAT_LABELS: Record<string,string> = { stationery:'Stationery', cleaning:'Cleaning', furniture:'Furniture', electronics:'Electronics', other:'Other' }
const STORE_CAT_COLORS: Record<string,{bg:string;color:string}> = {
  stationery:{bg:'#dbeafe',color:'#1d4ed8'}, cleaning:{bg:'#d1fae5',color:'#065f46'},
  furniture:{bg:'#fef3c7',color:'#92400e'}, electronics:{bg:'#ede9fe',color:'#6d28d9'},
  other:{bg:'#f1f5f9',color:'#475569'},
}

function formatSize(kb: number | null): string {
  if (!kb) return ''
  return kb < 1024 ? `${kb} KB` : `${(kb/1024).toFixed(1)} MB`
}
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-KE', { day:'numeric', month:'short', year:'numeric' })
}

export default function AdminResourcesPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('documents')
  const [schoolId, setSchoolId]   = useState<string | null>(null)
  const [userId, setUserId]       = useState<string | null>(null)

  const [docs, setDocs]                 = useState<ResourceDocument[]>([])
  const [docsLoading, setDocsLoading]   = useState(true)
  const [docSearch, setDocSearch]       = useState('')
  const [filterCat, setFilterCat]       = useState('all')
  const [filterVis, setFilterVis]       = useState('all')
  const [showDocModal, setShowDocModal] = useState(false)
  const [deleteDocTarget, setDeleteDocTarget] = useState<ResourceDocument | null>(null)
  const [docUploading, setDocUploading] = useState(false)
  const [formTitle, setFormTitle]       = useState('')
  const [formCat, setFormCat]           = useState('policy')
  const [formVis, setFormVis]           = useState<'admin_only'|'staff'|'everyone'>('staff')
  const [formFile, setFormFile]         = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [storeItems, setStoreItems]           = useState<StoreItem[]>([])
  const [storeLoading, setStoreLoading]       = useState(false)
  const [storeSearch, setStoreSearch]         = useState('')
  const [storeCatFilter, setStoreCatFilter]   = useState('all')
  const [storeRequests, setStoreRequests]     = useState<ResourceRequest[]>([])
  const [showAddItem, setShowAddItem]         = useState(false)
  const [showTxnModal, setShowTxnModal]       = useState(false)
  const [txnTarget, setTxnTarget]             = useState<StoreItem | null>(null)
  const [txnType, setTxnType]                 = useState<'stock_in'|'stock_out'>('stock_in')
  const [txnQty, setTxnQty]                   = useState('')
  const [txnRef, setTxnRef]                   = useState('')
  const [txnNotes, setTxnNotes]               = useState('')
  const [txnLoading, setTxnLoading]           = useState(false)
  const [itemName, setItemName]               = useState('')
  const [itemCat, setItemCat]                 = useState('stationery')
  const [itemUnit, setItemUnit]               = useState('piece')
  const [itemQty, setItemQty]                 = useState('0')
  const [itemThreshold, setItemThreshold]     = useState('5')
  const [itemLoading, setItemLoading]         = useState(false)
  const [deleteStoreTarget, setDeleteStoreTarget] = useState<StoreItem | null>(null)
  const [storeViewMode, setStoreViewMode]     = useState<'items'|'requests'>('items')

  const [error, setError]     = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  function toast(msg: string, type: 'success'|'error' = 'success') {
    if (type === 'success') { setSuccess(msg); setTimeout(() => setSuccess(null), 3000) }
    else { setError(msg) }
  }

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: p } = await supabase.from('profiles').select('school_id').eq('id', user.id).single()
      if (!p?.school_id) { router.push('/login'); return }
      setUserId(user.id)
      setSchoolId(p.school_id)
    }
    init()
  }, [])

  useEffect(() => {
    if (!schoolId) return
    if (activeTab === 'documents') fetchDocs()
    if (activeTab === 'store') { fetchStoreItems(); fetchStoreRequests() }
  }, [schoolId, activeTab])

  async function fetchDocs() {
    setDocsLoading(true)
    const { data, error: err } = await supabase
      .from('resource_documents')
      .select('*, uploader:uploaded_by(full_name)')
      .eq('school_id', schoolId!)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    if (err) { toast('Failed to load documents.', 'error'); setDocsLoading(false); return }
    setDocs((data || []).map((d: any) => ({ ...d, uploader_name: d.uploader?.full_name ?? 'Unknown' })))
    setDocsLoading(false)
  }

  async function handleUpload() {
    if (!formTitle.trim()) { toast('Title is required.', 'error'); return }
    if (!formFile) { toast('Please select a file.', 'error'); return }
    if (!schoolId || !userId) return
    setDocUploading(true)
    const ext      = formFile.name.split('.').pop()?.toLowerCase() ?? 'other'
    const safeName = `${Date.now()}_${formFile.name.replace(/\s+/g, '_')}`
    const path     = `${schoolId}/${safeName}`
    const { error: upErr } = await supabase.storage.from('resource-documents').upload(path, formFile, { upsert: false })
    if (upErr) { toast('File upload failed: ' + upErr.message, 'error'); setDocUploading(false); return }
    const { data: urlData } = supabase.storage.from('resource-documents').getPublicUrl(path)
    const { error: dbErr } = await supabase.from('resource_documents').insert({
      school_id: schoolId, title: formTitle.trim(), category: formCat,
      file_url: urlData.publicUrl, file_type: ['pdf','docx','zip','png','mp4'].includes(ext) ? ext : 'other',
      file_size_kb: Math.round(formFile.size / 1024), visibility: formVis, uploaded_by: userId,
    })
    if (dbErr) { toast('DB insert failed: ' + dbErr.message, 'error'); setDocUploading(false); return }
    toast('Document uploaded successfully.')
    setShowDocModal(false)
    resetDocForm()
    fetchDocs()
    setDocUploading(false)
  }

  async function handleDeleteDoc(doc: ResourceDocument) {
    const { error: err } = await supabase.from('resource_documents').update({ deleted_at: new Date().toISOString() }).eq('id', doc.id)
    if (err) { toast('Delete failed.', 'error'); return }
    setDeleteDocTarget(null)
    toast('Document removed.')
    fetchDocs()
  }

  function resetDocForm() {
    setFormTitle(''); setFormCat('policy'); setFormVis('staff'); setFormFile(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const filteredDocs = docs.filter(d =>
    d.title.toLowerCase().includes(docSearch.toLowerCase()) &&
    (filterCat === 'all' || d.category === filterCat) &&
    (filterVis === 'all' || d.visibility === filterVis)
  )

  async function fetchStoreItems() {
    setStoreLoading(true)
    const { data, error: err } = await supabase
      .from('store_items')
      .select('*')
      .eq('school_id', schoolId!)
      .is('deleted_at', null)
      .order('name')
    if (err) { toast('Failed to load store items.', 'error'); setStoreLoading(false); return }
    setStoreItems(data || [])
    setStoreLoading(false)
  }

  async function fetchStoreRequests() {
    const { data, error: err } = await supabase
      .from('resource_requests')
      .select('*, requester:requested_by(full_name)')
      .eq('school_id', schoolId!)
      .eq('status', 'pending')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    if (err) return
    setStoreRequests((data || []).map((r: any) => ({ ...r, requester_name: r.requester?.full_name ?? 'Unknown' })))
  }

  async function handleAddItem() {
    if (!itemName.trim()) { toast('Item name is required.', 'error'); return }
    if (!schoolId || !userId) return
    setItemLoading(true)
    const { error: err } = await supabase.from('store_items').insert({
      school_id: schoolId, name: itemName.trim(), category: itemCat,
      unit: itemUnit.trim() || 'piece', quantity: parseInt(itemQty) || 0,
      low_stock_threshold: parseInt(itemThreshold) || 5, added_by: userId,
    })
    if (err) { toast('Failed to add item: ' + err.message, 'error'); setItemLoading(false); return }
    toast('Item added.')
    setShowAddItem(false)
    setItemName(''); setItemCat('stationery'); setItemUnit('piece'); setItemQty('0'); setItemThreshold('5')
    fetchStoreItems()
    setItemLoading(false)
  }

  async function handleTxn() {
    if (!txnTarget || !txnQty || parseInt(txnQty) <= 0) { toast('Enter a valid quantity.', 'error'); return }
    if (!schoolId || !userId) return
    setTxnLoading(true)
    const qty = parseInt(txnQty)
    const newQty = txnType === 'stock_in' ? txnTarget.quantity + qty : txnTarget.quantity - qty
    if (newQty < 0) { toast('Not enough stock.', 'error'); setTxnLoading(false); return }
    const { error: txnErr } = await supabase.from('store_transactions').insert({
      school_id: schoolId, item_id: txnTarget.id, txn_type: txnType,
      quantity: qty, reference: txnRef || null, notes: txnNotes || null, created_by: userId,
    })
    if (txnErr) { toast('Transaction failed.', 'error'); setTxnLoading(false); return }
    const { error: updateErr } = await supabase.from('store_items').update({ quantity: newQty }).eq('id', txnTarget.id)
    if (updateErr) { toast('Stock update failed.', 'error'); setTxnLoading(false); return }
    toast(txnType === 'stock_in' ? `+${qty} ${txnTarget.unit} added.` : `-${qty} ${txnTarget.unit} removed.`)
    setShowTxnModal(false)
    setTxnTarget(null); setTxnQty(''); setTxnRef(''); setTxnNotes('')
    fetchStoreItems()
    setTxnLoading(false)
  }

  async function handleDeleteStoreItem(item: StoreItem) {
    const { error: err } = await supabase.from('store_items').update({ deleted_at: new Date().toISOString() }).eq('id', item.id)
    if (err) { toast('Delete failed.', 'error'); return }
    setDeleteStoreTarget(null)
    toast('Item removed.')
    fetchStoreItems()
  }

  async function handleRequestAction(req: ResourceRequest, action: 'approved'|'rejected') {
    if (!userId) return
    const { error: err } = await supabase.from('resource_requests').update({
      status: action, reviewed_by: userId, reviewed_at: new Date().toISOString(),
    }).eq('id', req.id)
    if (err) { toast('Action failed.', 'error'); return }
    toast(`Request ${action}.`)
    fetchStoreRequests()
  }

  const filteredItems = storeItems.filter(i =>
    i.name.toLowerCase().includes(storeSearch.toLowerCase()) &&
    (storeCatFilter === 'all' || i.category === storeCatFilter)
  )
  const lowStockCount = storeItems.filter(i => i.quantity <= i.low_stock_threshold).length

  const stats = [
    { label: 'Total Assets',     value: '—', icon: '🏫' },
    { label: 'Books Borrowed',   value: '—', icon: '📖' },
    { label: 'Pending Requests', value: storeRequests.length > 0 ? String(storeRequests.length) : '—', icon: '⏳' },
    { label: 'Low Stock',        value: lowStockCount > 0 ? String(lowStockCount) : '—', icon: '⚠️' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      <div style={{ background: `linear-gradient(135deg, ${C.hero} 0%, ${C.heroMid} 100%)`, padding: '20px 16px 0', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button onClick={() => router.back()} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontSize: 18 }}>‹</button>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>Admin</div>
            <div style={{ color: '#fff', fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}>Resources</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12, scrollbarWidth: 'none' }}>
          {stats.map(s => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,0.10)', borderRadius: 12, padding: '10px 14px', minWidth: 110, flexShrink: 0, border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: 18 }}>{s.icon}</div>
              <div style={{ color: s.value !== '—' ? C.emerald : '#fff', fontSize: 18, fontWeight: 700, marginTop: 2 }}>{s.value}</div>
              <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10, fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 0, overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch', maskImage: 'linear-gradient(to right, transparent 0%, black 4%, black 85%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 4%, black 85%, transparent 100%)' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '10px 14px', whiteSpace: 'nowrap', color: activeTab === t.key ? C.emerald : 'rgba(255,255,255,0.55)', fontWeight: activeTab === t.key ? 700 : 500, fontSize: 13, borderBottom: activeTab === t.key ? `2px solid ${C.emerald}` : '2px solid transparent', transition: 'all 0.2s' }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '12px 16px 0' }}>
        {success && <div style={{ background: C.emeraldLt, color: '#065f46', borderRadius: 10, padding: '10px 14px', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>✅ {success}</div>}
        {error && <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 10, padding: '10px 14px', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>⚠️ {error} <button onClick={() => setError(null)} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: '#b91c1c', fontWeight: 700 }}>✕</button></div>}
      </div>

      <div style={{ padding: '8px 16px 100px' }}>

        {activeTab === 'documents' && (
          <div>
            <div style={{ background: C.surface, borderRadius: 16, padding: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 12 }}>
              <input value={docSearch} onChange={e => setDocSearch(e.target.value)} placeholder="Search documents…" style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: 10, padding: '9px 12px', fontSize: 14, color: C.text, outline: 'none', boxSizing: 'border-box', marginBottom: 10 }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ flex: 1, border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 10px', fontSize: 13, color: C.text, background: C.surface, outline: 'none' }}>
                  <option value="all">All Categories</option>
                  {DOC_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                </select>
                <select value={filterVis} onChange={e => setFilterVis(e.target.value)} style={{ flex: 1, border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 10px', fontSize: 13, color: C.text, background: C.surface, outline: 'none' }}>
                  <option value="all">All Visibility</option>
                  {DOC_VISIBILITIES.map(v => <option key={v} value={v}>{VISIBILITY_LABELS[v]}</option>)}
                </select>
              </div>
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, paddingLeft: 2 }}>
              {docsLoading ? 'Loading…' : `${filteredDocs.length} document${filteredDocs.length !== 1 ? 's' : ''}`}
            </div>
            {docsLoading ? (
              <div style={{ textAlign: 'center', padding: 40, color: C.muted }}><div style={{ fontSize: 32 }}>📁</div><div style={{ marginTop: 8, fontSize: 14 }}>Loading…</div></div>
            ) : filteredDocs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 48, background: C.surface, borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <div style={{ fontSize: 40 }}>📁</div>
                <div style={{ fontWeight: 700, fontSize: 16, marginTop: 12, color: C.text }}>No documents yet</div>
                <div style={{ color: C.muted, fontSize: 13, marginTop: 6 }}>Upload policies, MOE circulars, forms and more.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filteredDocs.map(doc => (
                  <div key={doc.id} style={{ background: C.surface, borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '14px 14px 12px', border: `1px solid ${C.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0, background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{FILE_ICONS[doc.file_type ?? 'other'] ?? '📎'}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.title}</div>
                        <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{doc.uploader_name} · {formatDate(doc.created_at)}{doc.file_size_kb ? ` · ${formatSize(doc.file_size_kb)}` : ''}</div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 7, flexWrap: 'wrap' }}>
                          <span style={{ ...CATEGORY_COLORS[doc.category], fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: 0.5 }}>{CATEGORY_LABELS[doc.category] ?? doc.category}</span>
                          <span style={{ ...VISIBILITY_COLORS[doc.visibility], fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: 0.5 }}>{VISIBILITY_LABELS[doc.visibility]}</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      {doc.file_url ? (
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer" style={{ flex: 1, background: C.emerald, color: '#fff', borderRadius: 10, padding: '8px 0', textAlign: 'center', fontWeight: 700, fontSize: 13, textDecoration: 'none', display: 'block' }}>↗ Open</a>
                      ) : (
                        <div style={{ flex: 1, background: C.bg, borderRadius: 10, padding: '8px 0', textAlign: 'center', fontSize: 13, color: C.muted }}>No file</div>
                      )}
                      <button onClick={() => setDeleteDocTarget(doc)} style={{ background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: 10, padding: '8px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>🗑</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'store' && (
          <div>
            <div style={{ display: 'flex', background: C.surface, borderRadius: 14, padding: 4, marginBottom: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              {(['items','requests'] as const).map(v => (
                <button key={v} onClick={() => setStoreViewMode(v)} style={{ flex: 1, background: storeViewMode === v ? C.emerald : 'none', color: storeViewMode === v ? '#fff' : C.muted, border: 'none', borderRadius: 10, padding: '9px 0', fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s' }}>
                  {v === 'items' ? '📦 Inventory' : `📋 Requests${storeRequests.length > 0 ? ` (${storeRequests.length})` : ''}`}
                </button>
              ))}
            </div>

            {storeViewMode === 'items' && (
              <div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  {[
                    { label: 'Total Items', value: storeItems.length, icon: '📦', color: C.emerald },
                    { label: 'Low Stock', value: lowStockCount, icon: '⚠️', color: lowStockCount > 0 ? '#ef4444' : C.muted },
                  ].map(s => (
                    <div key={s.label} style={{ flex: 1, background: C.surface, borderRadius: 14, padding: '12px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: `1px solid ${C.border}` }}>
                      <div style={{ fontSize: 20 }}>{s.icon}</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: s.color, marginTop: 4 }}>{s.value}</div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                <div style={{ background: C.surface, borderRadius: 16, padding: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 12 }}>
                  <input value={storeSearch} onChange={e => setStoreSearch(e.target.value)} placeholder="Search items…" style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: 10, padding: '9px 12px', fontSize: 14, color: C.text, outline: 'none', boxSizing: 'border-box', marginBottom: 10 }} />
                  <select value={storeCatFilter} onChange={e => setStoreCatFilter(e.target.value)} style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 10px', fontSize: 13, color: C.text, background: C.surface, outline: 'none' }}>
                    <option value="all">All Categories</option>
                    {STORE_CATEGORIES.map(c => <option key={c} value={c}>{STORE_CAT_LABELS[c]}</option>)}
                  </select>
                </div>

                <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, paddingLeft: 2 }}>
                  {storeLoading ? 'Loading…' : `${filteredItems.length} item${filteredItems.length !== 1 ? 's' : ''}`}
                </div>

                {storeLoading ? (
                  <div style={{ textAlign: 'center', padding: 40, color: C.muted }}><div style={{ fontSize: 32 }}>📦</div><div style={{ marginTop: 8, fontSize: 14 }}>Loading…</div></div>
                ) : filteredItems.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 48, background: C.surface, borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                    <div style={{ fontSize: 40 }}>📦</div>
                    <div style={{ fontWeight: 700, fontSize: 16, marginTop: 12, color: C.text }}>No items yet</div>
                    <div style={{ color: C.muted, fontSize: 13, marginTop: 6 }}>Add stationery, cleaning supplies and more.</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {filteredItems.map(item => {
                      const isLow = item.quantity <= item.low_stock_threshold
                      return (
                        <div key={item.id} style={{ background: C.surface, borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '14px 14px 12px', border: isLow ? '1px solid #fca5a5' : `1px solid ${C.border}` }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 12, background: isLow ? '#fee2e2' : C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>📦</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ fontWeight: 700, fontSize: 14, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                                {isLow && <span style={{ background: '#fee2e2', color: '#b91c1c', fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 20, whiteSpace: 'nowrap', textTransform: 'uppercase' }}>Low Stock</span>}
                              </div>
                              <div style={{ display: 'flex', gap: 6, marginTop: 5, alignItems: 'center', flexWrap: 'wrap' }}>
                                <span style={{ ...STORE_CAT_COLORS[item.category], fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: 0.5 }}>{STORE_CAT_LABELS[item.category]}</span>
                                <span style={{ fontSize: 12, color: C.muted }}>{item.unit}</span>
                              </div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <div style={{ fontSize: 26, fontWeight: 800, color: isLow ? '#ef4444' : C.text, lineHeight: 1 }}>{item.quantity}</div>
                              <div style={{ fontSize: 10, color: C.muted }}>in stock</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                            <button onClick={() => { setTxnTarget(item); setTxnType('stock_in'); setShowTxnModal(true) }} style={{ flex: 1, background: C.emeraldLt, color: '#065f46', border: 'none', borderRadius: 10, padding: '8px 0', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>+ Stock In</button>
                            <button onClick={() => { setTxnTarget(item); setTxnType('stock_out'); setShowTxnModal(true) }} style={{ flex: 1, background: '#fef3c7', color: '#92400e', border: 'none', borderRadius: 10, padding: '8px 0', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>− Stock Out</button>
                            <button onClick={() => setDeleteStoreTarget(item)} style={{ background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: 10, padding: '8px 12px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>🗑</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {storeViewMode === 'requests' && (
              <div>
                {storeRequests.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 48, background: C.surface, borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                    <div style={{ fontSize: 40 }}>📋</div>
                    <div style={{ fontWeight: 700, fontSize: 16, marginTop: 12, color: C.text }}>No pending requests</div>
                    <div style={{ color: C.muted, fontSize: 13, marginTop: 6 }}>Teacher requests will appear here.</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {storeRequests.map(req => (
                      <div key={req.id} style={{ background: C.surface, borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '14px', border: `1px solid ${C.border}` }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{req.item_name ?? 'Unknown Item'}</div>
                        <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>By {req.requester_name} · Qty: {req.quantity}</div>
                        {req.reason && <div style={{ fontSize: 12, color: C.text, marginTop: 4, fontStyle: 'italic' }}>"{req.reason}"</div>}
                        <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{formatDate(req.created_at)}</div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                          <button onClick={() => handleRequestAction(req, 'approved')} style={{ flex: 1, background: C.emeraldLt, color: '#065f46', border: 'none', borderRadius: 10, padding: '9px 0', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>✓ Approve</button>
                          <button onClick={() => handleRequestAction(req, 'rejected')} style={{ flex: 1, background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: 10, padding: '9px 0', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>✕ Reject</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {!['documents','store'].includes(activeTab) && (
          <div style={{ textAlign: 'center', padding: 60, color: C.muted }}>
            <div style={{ fontSize: 40 }}>{TABS.find(t => t.key === activeTab)?.icon}</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginTop: 12, color: C.text }}>{TABS.find(t => t.key === activeTab)?.label} — Coming Soon</div>
            <div style={{ fontSize: 13, marginTop: 6 }}>This tab will be built next.</div>
          </div>
        )}
      </div>

      {activeTab === 'documents' && (
        <button onClick={() => { resetDocForm(); setError(null); setShowDocModal(true) }} style={{ position: 'fixed', bottom: 90, right: 20, background: C.emerald, color: '#fff', border: 'none', borderRadius: 20, padding: '14px 22px', fontWeight: 700, fontSize: 15, cursor: 'pointer', boxShadow: '0 4px 20px rgba(16,185,129,0.45)', display: 'flex', alignItems: 'center', gap: 8, zIndex: 50 }}>
          <span style={{ fontSize: 20, lineHeight: 1 }}>+</span> Upload
        </button>
      )}
      {activeTab === 'store' && storeViewMode === 'items' && (
        <button onClick={() => { setError(null); setShowAddItem(true) }} style={{ position: 'fixed', bottom: 90, right: 20, background: C.emerald, color: '#fff', border: 'none', borderRadius: 20, padding: '14px 22px', fontWeight: 700, fontSize: 15, cursor: 'pointer', boxShadow: '0 4px 20px rgba(16,185,129,0.45)', display: 'flex', alignItems: 'center', gap: 8, zIndex: 50 }}>
          <span style={{ fontSize: 20, lineHeight: 1 }}>+</span> Add Item
        </button>
      )}

      {showDocModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }} onClick={e => { if (e.target === e.currentTarget) setShowDocModal(false) }}>
          <div style={{ background: C.surface, borderRadius: '20px 20px 0 0', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '20px 16px 32px' }}>
            <div style={{ width: 36, height: 4, background: C.border, borderRadius: 2, margin: '0 auto 16px' }} />
            <div style={{ fontWeight: 800, fontSize: 18, color: C.text, marginBottom: 18 }}>Upload Document</div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Title *</label>
              <input value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="e.g. School Fees Policy 2025" style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 14, color: C.text, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Category *</label>
              <select value={formCat} onChange={e => setFormCat(e.target.value)} style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 14, color: C.text, background: C.surface, outline: 'none', boxSizing: 'border-box' }}>
                {DOC_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Visibility *</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {DOC_VISIBILITIES.map(v => (
                  <button key={v} onClick={() => setFormVis(v as any)} style={{ flex: 1, padding: '9px 4px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: `2px solid ${formVis === v ? C.emerald : C.border}`, background: formVis === v ? C.emeraldLt : C.surface, color: formVis === v ? '#065f46' : C.muted, transition: 'all 0.15s' }}>
                    {VISIBILITY_LABELS[v]}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>File *</label>
              <div onClick={() => fileRef.current?.click()} style={{ border: `2px dashed ${formFile ? C.emerald : C.border}`, borderRadius: 12, padding: '18px 12px', textAlign: 'center', cursor: 'pointer', background: formFile ? C.emeraldLt : C.bg, transition: 'all 0.2s' }}>
                <div style={{ fontSize: 28 }}>{formFile ? '✅' : '📤'}</div>
                <div style={{ fontSize: 13, fontWeight: 600, marginTop: 6, color: C.text }}>{formFile ? formFile.name : 'Tap to select file'}</div>
                {formFile && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{formatSize(Math.round(formFile.size / 1024))}</div>}
                {!formFile && <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>PDF, DOCX, ZIP, PNG, MP4</div>}
              </div>
              <input ref={fileRef} type="file" accept=".pdf,.docx,.zip,.png,.mp4" style={{ display: 'none' }} onChange={e => setFormFile(e.target.files?.[0] ?? null)} />
            </div>
            <button onClick={handleUpload} disabled={docUploading} style={{ width: '100%', background: docUploading ? C.muted : C.emerald, color: '#fff', border: 'none', borderRadius: 12, padding: '14px', fontWeight: 800, fontSize: 15, cursor: docUploading ? 'not-allowed' : 'pointer' }}>
              {docUploading ? 'Uploading…' : 'Upload Document'}
            </button>
            <button onClick={() => setShowDocModal(false)} style={{ width: '100%', background: 'none', border: 'none', color: C.muted, fontSize: 14, marginTop: 12, cursor: 'pointer', padding: 8 }}>Cancel</button>
          </div>
        </div>
      )}

      {showAddItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }} onClick={e => { if (e.target === e.currentTarget) setShowAddItem(false) }}>
          <div style={{ background: C.surface, borderRadius: '20px 20px 0 0', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '20px 16px 32px' }}>
            <div style={{ width: 36, height: 4, background: C.border, borderRadius: 2, margin: '0 auto 16px' }} />
            <div style={{ fontWeight: 800, fontSize: 18, color: C.text, marginBottom: 18 }}>Add Store Item</div>
            {[
              { label: 'Item Name *', value: itemName, set: setItemName, placeholder: 'e.g. A4 Paper Ream' },
              { label: 'Unit', value: itemUnit, set: setItemUnit, placeholder: 'e.g. piece, box, litre' },
              { label: 'Opening Quantity', value: itemQty, set: setItemQty, placeholder: '0', type: 'number' },
              { label: 'Low Stock Alert At', value: itemThreshold, set: setItemThreshold, placeholder: '5', type: 'number' },
            ].map(f => (
              <div key={f.label} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>{f.label}</label>
                <input value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder} type={f.type ?? 'text'} style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 14, color: C.text, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            ))}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Category *</label>
              <select value={itemCat} onChange={e => setItemCat(e.target.value)} style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 14, color: C.text, background: C.surface, outline: 'none', boxSizing: 'border-box' }}>
                {STORE_CATEGORIES.map(c => <option key={c} value={c}>{STORE_CAT_LABELS[c]}</option>)}
              </select>
            </div>
            <button onClick={handleAddItem} disabled={itemLoading} style={{ width: '100%', background: itemLoading ? C.muted : C.emerald, color: '#fff', border: 'none', borderRadius: 12, padding: '14px', fontWeight: 800, fontSize: 15, cursor: itemLoading ? 'not-allowed' : 'pointer' }}>
              {itemLoading ? 'Adding…' : 'Add Item'}
            </button>
            <button onClick={() => setShowAddItem(false)} style={{ width: '100%', background: 'none', border: 'none', color: C.muted, fontSize: 14, marginTop: 12, cursor: 'pointer', padding: 8 }}>Cancel</button>
          </div>
        </div>
      )}

      {showTxnModal && txnTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }} onClick={e => { if (e.target === e.currentTarget) setShowTxnModal(false) }}>
          <div style={{ background: C.surface, borderRadius: '20px 20px 0 0', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '20px 16px 32px' }}>
            <div style={{ width: 36, height: 4, background: C.border, borderRadius: 2, margin: '0 auto 16px' }} />
            <div style={{ fontWeight: 800, fontSize: 18, color: C.text, marginBottom: 4 }}>{txnType === 'stock_in' ? '+ Stock In' : '− Stock Out'}</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 18 }}>{txnTarget.name} · Current: {txnTarget.quantity} {txnTarget.unit}</div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Quantity *</label>
              <input value={txnQty} onChange={e => setTxnQty(e.target.value)} placeholder="0" type="number" min="1" style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 14, color: C.text, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Reference</label>
              <input value={txnRef} onChange={e => setTxnRef(e.target.value)} placeholder="e.g. LPO-001, Invoice #123" style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 14, color: C.text, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Notes</label>
              <input value={txnNotes} onChange={e => setTxnNotes(e.target.value)} placeholder="Optional notes" style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 14, color: C.text, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <button onClick={handleTxn} disabled={txnLoading} style={{ width: '100%', background: txnLoading ? C.muted : txnType === 'stock_in' ? C.emerald : '#f59e0b', color: '#fff', border: 'none', borderRadius: 12, padding: '14px', fontWeight: 800, fontSize: 15, cursor: txnLoading ? 'not-allowed' : 'pointer' }}>
              {txnLoading ? 'Saving…' : txnType === 'stock_in' ? 'Confirm Stock In' : 'Confirm Stock Out'}
            </button>
            <button onClick={() => setShowTxnModal(false)} style={{ width: '100%', background: 'none', border: 'none', color: C.muted, fontSize: 14, marginTop: 12, cursor: 'pointer', padding: 8 }}>Cancel</button>
          </div>
        </div>
      )}

      {deleteDocTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: C.surface, borderRadius: 20, padding: 24, width: '100%', maxWidth: 340 }}>
            <div style={{ fontSize: 32, textAlign: 'center' }}>🗑️</div>
            <div style={{ fontWeight: 800, fontSize: 16, textAlign: 'center', marginTop: 10, color: C.text }}>Remove Document?</div>
            <div style={{ fontSize: 13, color: C.muted, textAlign: 'center', marginTop: 6, marginBottom: 20 }}>"{deleteDocTarget.title}" will be removed.</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteDocTarget(null)} style={{ flex: 1, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer', color: C.text }}>Cancel</button>
              <button onClick={() => handleDeleteDoc(deleteDocTarget)} style={{ flex: 1, background: '#ef4444', border: 'none', borderRadius: 12, padding: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer', color: '#fff' }}>Remove</button>
            </div>
          </div>
        </div>
      )}

      {deleteStoreTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: C.surface, borderRadius: 20, padding: 24, width: '100%', maxWidth: 340 }}>
            <div style={{ fontSize: 32, textAlign: 'center' }}>🗑️</div>
            <div style={{ fontWeight: 800, fontSize: 16, textAlign: 'center', marginTop: 10, color: C.text }}>Remove Item?</div>
            <div style={{ fontSize: 13, color: C.muted, textAlign: 'center', marginTop: 6, marginBottom: 20 }}>"{deleteStoreTarget.name}" will be removed from inventory.</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteStoreTarget(null)} style={{ flex: 1, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer', color: C.text }}>Cancel</button>
              <button onClick={() => handleDeleteStoreItem(deleteStoreTarget)} style={{ flex: 1, background: '#ef4444', border: 'none', borderRadius: 12, padding: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer', color: '#fff' }}>Remove</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
