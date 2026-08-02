"use client";
import { nairobiDateStr } from '@/lib/time'
export const dynamic = "force-dynamic";

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface ResourceRequest {
  id: string; school_id: string; requested_by: string; item_id: string | null
  item_name: string | null; quantity: number; reason: string | null
  status: 'pending' | 'approved' | 'rejected' | 'fulfilled'
  reviewed_by: string | null; reviewed_at: string | null; created_at: string
  requester_name?: string
}

interface ResourceAsset {
  id: string; school_id: string; name: string; category: string
  quantity: number; item_condition: 'good' | 'fair' | 'needs_repair' | 'condemned'
  location: string | null; serial_no: string | null; last_checked: string | null
  added_by: string; created_at: string
}

interface LibraryBook {
  id: string; school_id: string; title: string; author: string
  isbn: string | null; subject: string | null; class_level: string | null
  total_copies: number; available_copies: number
  added_by: string; created_at: string
}

interface LibraryBorrowing {
  id: string; school_id: string; book_id: string
  borrower_type: 'student' | 'staff'
  student_id: string | null; staff_id: string | null
  issued_by: string; issued_at: string; due_date: string
  returned_at: string | null
  condition_out: string; condition_in: string | null
  fine_amount: number; fine_paid: boolean
  notes: string | null; created_at: string
  book_title?: string; borrower_name?: string; issuer_name?: string
}

interface StaffProfile {
  id: string; full_name: string; email: string; role: string
  resource_role?: 'librarian' | 'store_keeper' | 'general' | null
  resource_role_id?: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const C = {
  hero: '#0a1628', heroMid: '#0d2347', emerald: '#10b981', emeraldLt: '#d1fae5',
  bg: '#f0f4f8', border: '#e2e8f0', surface: '#ffffff', text: '#0f172a', muted: '#64748b',
}

const TABS = [
  { key: 'documents', label: 'Documents', icon: '📁' },
  { key: 'store',     label: 'Store',     icon: '🏪' },
  { key: 'assets',    label: 'Assets',    icon: '🏫' },
  { key: 'library',   label: 'Library',   icon: '📖' },
  { key: 'staff',     label: 'Staff',     icon: '👩‍🏫' },
]

const DOC_CATEGORIES = ['policy','moe_circular','form','template','report','other']
const DOC_VISIBILITIES = ['admin_only','staff','everyone']
const CATEGORY_LABELS: Record<string,string> = {
  policy:'Policy', moe_circular:'MOE Circular', form:'Form',
  template:'Template', report:'Report', other:'Other',
}
const CATEGORY_COLORS: Record<string,React.CSSProperties> = {
  policy:       { background:'#dbeafe', color:'#1d4ed8' },
  moe_circular: { background:'#fce7f3', color:'#be185d' },
  form:         { background:'#fef9c3', color:'#a16207' },
  template:     { background:'#d1fae5', color:'#065f46' },
  report:       { background:'#ede9fe', color:'#6d28d9' },
  other:        { background:'#f1f5f9', color:'#475569' },
}
const VISIBILITY_COLORS: Record<string,React.CSSProperties> = {
  admin_only: { background:'#fee2e2', color:'#b91c1c' },
  staff:      { background:'#fef3c7', color:'#92400e' },
  everyone:   { background:'#d1fae5', color:'#065f46' },
}
const VISIBILITY_LABELS: Record<string,string> = {
  admin_only:'Admin Only', staff:'Staff', everyone:'Everyone',
}
const FILE_ICONS: Record<string,string> = {
  pdf:'📄', docx:'📝', zip:'🗜️', png:'🖼️', mp4:'🎬', other:'📎',
}

const STORE_CATEGORIES = ['stationery','cleaning','furniture','electronics','other']
const STORE_CAT_LABELS: Record<string,string> = {
  stationery:'Stationery', cleaning:'Cleaning',
  furniture:'Furniture', electronics:'Electronics', other:'Other',
}
const STORE_CAT_COLORS: Record<string,React.CSSProperties> = {
  stationery:  { background:'#dbeafe', color:'#1d4ed8' },
  cleaning:    { background:'#d1fae5', color:'#065f46' },
  furniture:   { background:'#fef3c7', color:'#92400e' },
  electronics: { background:'#ede9fe', color:'#6d28d9' },
  other:       { background:'#f1f5f9', color:'#475569' },
}

const ASSET_CATEGORIES = ['furniture','electronics','sports','lab','other']
const ASSET_CAT_LABELS: Record<string,string> = {
  furniture:'Furniture', electronics:'Electronics',
  sports:'Sports', lab:'Lab', other:'Other',
}
const ASSET_CONDITION_COLORS: Record<string,React.CSSProperties> = {
  good:         { background:'#d1fae5', color:'#065f46' },
  fair:         { background:'#fef9c3', color:'#a16207' },
  needs_repair: { background:'#ffedd5', color:'#c2410c' },
  condemned:    { background:'#fee2e2', color:'#b91c1c' },
}
const ASSET_CONDITION_LABELS: Record<string,string> = {
  good:'Good', fair:'Fair', needs_repair:'Needs Repair', condemned:'Condemned',
}

const RESOURCE_ROLES = ['general','librarian','store_keeper'] as const
const RESOURCE_ROLE_LABELS: Record<string,string> = {
  general:'General', librarian:'Librarian', store_keeper:'Store Keeper',
}
const RESOURCE_ROLE_COLORS: Record<string,React.CSSProperties> = {
  librarian:    { background:'#dbeafe', color:'#1d4ed8' },
  store_keeper: { background:'#ffedd5', color:'#c2410c' },
  general:      { background:'#f1f5f9', color:'#475569' },
}

const CONDITION_OPTIONS    = ['good','fair','damaged']
const CONDITION_IN_OPTIONS = ['good','fair','damaged','lost']

const MAX_FILE_SIZE_MB = 50
const MAX_DUE_DATE_DAYS = 365

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSize(kb: number | null): string {
  if (!kb) return ''
  return kb < 1024 ? `${kb} KB` : `${(kb / 1024).toFixed(1)} MB`
}
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-KE', { day:'numeric', month:'short', year:'numeric' })
}
function today(): string {
  return nairobiDateStr()
}
function maxDueDate(): string {
  const d = new Date()
  d.setDate(d.getDate() + MAX_DUE_DATE_DAYS)
  return nairobiDateStr(d)
}
function isOverdue(dueDate: string, returnedAt: string | null): boolean {
  return !returnedAt && new Date(dueDate) < new Date()
}
function calcFine(dueDate: string): number {
  const days = Math.floor((Date.now() - new Date(dueDate).getTime()) / 86400000)
  return days > 0 ? days * 5 : 0
}
function initials(name: string): string {
  return name.split(' ').map(n => n[0] ?? '').join('').toUpperCase().slice(0, 2)
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const inp: React.CSSProperties = {
  width: '100%', border: `1px solid ${C.border}`, borderRadius: 10,
  padding: '10px 12px', fontSize: 14, color: C.text, outline: 'none',
  boxSizing: 'border-box', background: C.surface,
}
const lbl: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase',
  letterSpacing: 0.5, display: 'block', marginBottom: 6,
}
const field = (mb = 14): React.CSSProperties => ({ marginBottom: mb })

const badge = (styles: React.CSSProperties): React.CSSProperties => ({
  fontSize: 10, fontWeight: 700, padding: '2px 8px',
  borderRadius: 20, textTransform: 'uppercase', ...styles,
})

// ─── Confirm Dialog ───────────────────────────────────────────────────────────

function ConfirmDialog({
  icon, title, message, confirmLabel = 'Confirm', confirmColor = '#ef4444',
  onCancel, onConfirm,
}: {
  icon: string; title: string; message: string
  confirmLabel?: string; confirmColor?: string
  onCancel: () => void; onConfirm: () => void
}) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:C.surface, borderRadius:20, padding:24, width:'100%', maxWidth:340 }}>
        <div style={{ fontSize:32, textAlign:'center' }}>{icon}</div>
        <div style={{ fontWeight:800, fontSize:16, textAlign:'center', marginTop:10, color:C.text }}>{title}</div>
        <div style={{ fontSize:13, color:C.muted, textAlign:'center', marginTop:6, marginBottom:20 }}>{message}</div>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onCancel} style={{ flex:1, background:C.bg, border:`1px solid ${C.border}`, borderRadius:12, padding:12, fontWeight:700, fontSize:14, cursor:'pointer', color:C.text }}>Cancel</button>
          <button onClick={onConfirm} style={{ flex:1, background:confirmColor, border:'none', borderRadius:12, padding:12, fontWeight:700, fontSize:14, cursor:'pointer', color:'#fff' }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

// ─── BottomSheet ──────────────────────────────────────────────────────────────

function BottomSheet({ title, subtitle, onClose, children }: {
  title: string; subtitle?: string; onClose: () => void; children: React.ReactNode
}) {
  return (
    <div
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:100, display:'flex', alignItems:'flex-end' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background:C.surface, borderRadius:'20px 20px 0 0', width:'100%', maxHeight:'90vh', overflowY:'auto', padding:'20px 16px 32px' }}>
        <div style={{ width:36, height:4, background:C.border, borderRadius:2, margin:'0 auto 16px' }} />
        <div style={{ fontWeight:800, fontSize:18, color:C.text, marginBottom: subtitle ? 4 : 18 }}>{title}</div>
        {subtitle && <div style={{ fontSize:13, color:C.muted, marginBottom:18 }}>{subtitle}</div>}
        {children}
      </div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminResourcesPage() {
  const router = useRouter()

  const [activeTab, setActiveTab] = useState('documents')
  const [schoolId, setSchoolId]   = useState<string | null>(null)
  const [userId, setUserId]       = useState<string | null>(null)

  // ── Documents ──
  const [docs, setDocs]                       = useState<ResourceDocument[]>([])
  const [docsLoading, setDocsLoading]         = useState(true)
  const [docSearch, setDocSearch]             = useState('')
  const [filterCat, setFilterCat]             = useState('all')
  const [filterVis, setFilterVis]             = useState('all')
  const [showDocModal, setShowDocModal]       = useState(false)
  const [deleteDocTarget, setDeleteDocTarget] = useState<ResourceDocument | null>(null)
  const [docUploading, setDocUploading]       = useState(false)
  const [formTitle, setFormTitle]             = useState('')
  const [formCat, setFormCat]                 = useState('policy')
  const [formVis, setFormVis]                 = useState<'admin_only'|'staff'|'everyone'>('staff')
  const [formFile, setFormFile]               = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Store ──
  const [storeItems, setStoreItems]               = useState<StoreItem[]>([])
  const [storeLoading, setStoreLoading]           = useState(false)
  const [storeTxnCount, setStoreTxnCount]         = useState(0)
  const [storeSearch, setStoreSearch]             = useState('')
  const [storeCatFilter, setStoreCatFilter]       = useState('all')
  const [storeRequests, setStoreRequests]         = useState<ResourceRequest[]>([])
  const [showAddItem, setShowAddItem]             = useState(false)
  const [showTxnModal, setShowTxnModal]           = useState(false)
  const [txnTarget, setTxnTarget]                 = useState<StoreItem | null>(null)
  const [txnType, setTxnType]                     = useState<'stock_in'|'stock_out'>('stock_in')
  const [txnQty, setTxnQty]                       = useState('')
  const [txnRef, setTxnRef]                       = useState('')
  const [txnIssuedTo, setTxnIssuedTo]             = useState('')
  const [txnNotes, setTxnNotes]                   = useState('')
  const [txnLoading, setTxnLoading]               = useState(false)
  const [itemName, setItemName]                   = useState('')
  const [itemCat, setItemCat]                     = useState('stationery')
  const [itemUnit, setItemUnit]                   = useState('piece')
  const [itemQty, setItemQty]                     = useState('0')
  const [itemThreshold, setItemThreshold]         = useState('5')
  const [itemLoading, setItemLoading]             = useState(false)
  const [deleteStoreTarget, setDeleteStoreTarget] = useState<StoreItem | null>(null)
  const [storeViewMode, setStoreViewMode]         = useState<'items'|'requests'>('items')

  // ── Assets ──
  const [assets, setAssets]                       = useState<ResourceAsset[]>([])
  const [assetsLoading, setAssetsLoading]         = useState(false)
  const [assetSearch, setAssetSearch]             = useState('')
  const [assetCatFilter, setAssetCatFilter]       = useState('all')
  const [assetCondFilter, setAssetCondFilter]     = useState('all')
  const [showAddAsset, setShowAddAsset]           = useState(false)
  const [editAsset, setEditAsset]                 = useState<ResourceAsset | null>(null)
  const [deleteAssetTarget, setDeleteAssetTarget] = useState<ResourceAsset | null>(null)
  const [condemnTarget, setCondemnTarget]         = useState<ResourceAsset | null>(null)
  const [assetLoading, setAssetLoading]           = useState(false)
  const [aName, setAName]                         = useState('')
  const [aCat, setACat]                           = useState('furniture')
  const [aQty, setAQty]                           = useState('1')
  const [aCond, setACond]                         = useState<ResourceAsset['item_condition']>('good')
  const [aLocation, setALocation]                 = useState('')
  const [aSerial, setASerial]                     = useState('')
  const [aLastChecked, setALastChecked]           = useState('')

  // ── Library ──
  const [libView, setLibView]                     = useState<'books'|'borrowings'>('books')
  const [books, setBooks]                         = useState<LibraryBook[]>([])
  const [borrowings, setBorrowings]               = useState<LibraryBorrowing[]>([])
  const [libLoading, setLibLoading]               = useState(false)
  const [bookSearch, setBookSearch]               = useState('')
  const [showAddBook, setShowAddBook]             = useState(false)
  const [showIssueModal, setShowIssueModal]       = useState(false)
  const [showReturnModal, setShowReturnModal]     = useState(false)
  const [issueTarget, setIssueTarget]             = useState<LibraryBook | null>(null)
  const [returnTarget, setReturnTarget]           = useState<LibraryBorrowing | null>(null)
  const [deleteBookTarget, setDeleteBookTarget]   = useState<LibraryBook | null>(null)
  const [libActionLoading, setLibActionLoading]   = useState(false)
  const [bTitle, setBTitle]                       = useState('')
  const [bAuthor, setBAuthor]                     = useState('')
  const [bIsbn, setBIsbn]                         = useState('')
  const [bSubject, setBSubject]                   = useState('')
  const [bClassLevel, setBClassLevel]             = useState('')
  const [bCopies, setBCopies]                     = useState('1')
  const [borrowerType, setBorrowerType]           = useState<'student'|'staff'>('student')
  const [borrowerName, setBorrowerName]           = useState('')
  const [issueDue, setIssueDue]                   = useState('')
  const [issueCondOut, setIssueCondOut]           = useState('good')
  const [returnCondIn, setReturnCondIn]           = useState('good')
  const [returnFinePaid, setReturnFinePaid]       = useState(false)

  // ── Staff ──
  const [staffList, setStaffList]       = useState<StaffProfile[]>([])
  const [staffLoading, setStaffLoading] = useState(false)
  const [staffSearch, setStaffSearch]   = useState('')
  const [roleUpdating, setRoleUpdating] = useState<string | null>(null)

  // ── Toast ──
  const [toastMsg, setToastMsg]   = useState<string | null>(null)
  const [toastType, setToastType] = useState<'success'|'error'>('success')

  function toast(msg: string, type: 'success'|'error' = 'success') {
    setToastMsg(msg); setToastType(type)
    setTimeout(() => setToastMsg(null), type === 'error' ? 4000 : 3000)
  }

  // ─── Auth ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/admin/login'); return }
      const [pRes, adminRes, memberRes] = await Promise.all([
        supabase.from('profiles').select('school_id').eq('id', user.id).single(),
        supabase.from('admin_profiles').select('school_id').eq('profile_id', user.id).maybeSingle(),
        supabase.from('school_members').select('school_id').eq('profile_id', user.id).maybeSingle(),
      ])
      const resolvedId = memberRes.data?.school_id ?? adminRes.data?.school_id ?? pRes.data?.school_id ?? null
      if (!resolvedId) { router.push('/admin/login'); return }
      setUserId(user.id)
      setSchoolId(resolvedId)
    }
    init()
  }, [])

  useEffect(() => {
    if (!schoolId) return
    if (activeTab === 'documents') fetchDocs()
    if (activeTab === 'store')     { fetchStoreItems(); fetchStoreRequests(); fetchStoreTxnCount() }
    if (activeTab === 'assets')    fetchAssets()
    if (activeTab === 'library')   { fetchBooks(); fetchBorrowings() }
    if (activeTab === 'staff')     fetchStaff()
  }, [schoolId, activeTab])

  // ─── Documents ─────────────────────────────────────────────────────────────

  async function fetchDocs() {
    setDocsLoading(true)
    const { data, error: err } = await supabase
      .from('resource_documents')
      .select('*, uploader:uploaded_by(full_name)')
      .eq('school_id', schoolId!)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    if (err) { toast('Failed to load documents.', 'error'); setDocsLoading(false); return }
    setDocs((data ?? []).map(row => {
      const uploader = Array.isArray(row.uploader)
        ? row.uploader[0] ?? null
        : row.uploader

      const visibility: ResourceDocument['visibility'] =
        row.visibility === 'admin_only' ||
        row.visibility === 'staff' ||
        row.visibility === 'everyone'
          ? row.visibility
          : 'staff'

      return {
        id: row.id,
        school_id: row.school_id ?? '',
        title: row.title,
        category: row.category ?? 'other',
        file_url: row.file_url,
        file_type: row.file_type,
        file_size_kb: row.file_size_kb,
        visibility,
        uploaded_by: row.uploaded_by ?? '',
        created_at: row.created_at ?? new Date(0).toISOString(),
        uploader_name: uploader?.full_name ?? 'Unknown',
      }
    }))
    setDocsLoading(false)
  }

  async function handleUpload() {
    if (!formTitle.trim()) { toast('Title is required.', 'error'); return }
    if (!formFile)          { toast('Please select a file.', 'error'); return }
    if (!schoolId || !userId) return

    // FIX: enforce file size limit
    if (formFile.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast(`File too large. Max ${MAX_FILE_SIZE_MB}MB.`, 'error'); return
    }

    setDocUploading(true)
    const ext      = formFile.name.split('.').pop()?.toLowerCase() ?? 'other'
    const safeName = `${Date.now()}_${formFile.name.replace(/\s+/g, '_')}`
    const path     = `${schoolId}/${safeName}`

    const { error: upErr } = await supabase.storage
      .from('resource-documents').upload(path, formFile, { upsert: false })
    if (upErr) { toast('Upload failed: ' + upErr.message, 'error'); setDocUploading(false); return }

    const { data: urlData } = supabase.storage
      .from('resource-documents').getPublicUrl(path)

    const { error: dbErr } = await supabase.from('resource_documents').insert({
      school_id: schoolId, title: formTitle.trim(), category: formCat,
      file_url: urlData.publicUrl,
      file_type: ['pdf','docx','zip','png','mp4'].includes(ext) ? ext : 'other',
      file_size_kb: Math.round(formFile.size / 1024),
      visibility: formVis, uploaded_by: userId,
    })
    if (dbErr) { toast('DB insert failed: ' + dbErr.message, 'error'); setDocUploading(false); return }

    toast('Document uploaded.')
    setShowDocModal(false); resetDocForm(); fetchDocs()
    setDocUploading(false)
  }

  async function handleDeleteDoc(doc: ResourceDocument) {
    await supabase.from('resource_documents')
      .update({ deleted_at: new Date().toISOString() }).eq('id', doc.id)
    setDeleteDocTarget(null); toast('Document removed.'); fetchDocs()
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

  // ─── Store ─────────────────────────────────────────────────────────────────

  async function fetchStoreItems() {
    setStoreLoading(true)
    const { data } = await supabase
      .from('store_items').select('*').eq('school_id', schoolId!)
      .is('deleted_at', null).order('name')
    setStoreItems((data ?? []).map(row => ({
      id: row.id,
      school_id: row.school_id ?? '',
      name: row.name,
      category: row.category ?? 'other',
      unit: row.unit ?? 'piece',
      quantity: row.quantity ?? 0,
      low_stock_threshold: row.low_stock_threshold ?? 0,
      added_by: row.added_by ?? '',
      created_at: row.created_at ?? new Date(0).toISOString(),
    })))
    setStoreLoading(false)
  }
  async function fetchStoreTxnCount() {
    const { count } = await supabase
      .from('store_transactions').select('id', { count:'exact', head:true })
      .eq('school_id', schoolId!).is('deleted_at', null)
    setStoreTxnCount(count ?? 0)
  }
  async function fetchStoreRequests() {
    const { data } = await supabase
      .from('resource_requests')
      .select('*, requester:requested_by(full_name)')
      .eq('school_id', schoolId!).eq('status', 'pending')
      .is('deleted_at', null).order('created_at', { ascending: false })
    setStoreRequests((data ?? []).map(row => {
      const requester = Array.isArray(row.requester)
        ? row.requester[0] ?? null
        : row.requester

      const status: ResourceRequest['status'] =
        row.status === 'approved' ||
        row.status === 'rejected' ||
        row.status === 'fulfilled'
          ? row.status
          : 'pending'

      return {
        id: row.id,
        school_id: row.school_id ?? '',
        requested_by: row.requested_by ?? '',
        item_id: row.item_id,
        item_name: row.item_name,
        quantity: row.quantity ?? 0,
        reason: row.reason,
        status,
        reviewed_by: row.reviewed_by,
        reviewed_at: row.reviewed_at,
        created_at: row.created_at ?? new Date(0).toISOString(),
        requester_name: requester?.full_name ?? 'Unknown',
      }
    }))
  }

  async function handleAddItem() {
    if (!itemName.trim()) { toast('Item name required.', 'error'); return }
    setItemLoading(true)
    const { error: err } = await supabase.from('store_items').insert({
      school_id: schoolId, name: itemName.trim(), category: itemCat,
      unit: itemUnit.trim() || 'piece', quantity: parseInt(itemQty) || 0,
      low_stock_threshold: parseInt(itemThreshold) || 5, added_by: userId,
    })
    if (err) { toast('Failed: ' + err.message, 'error'); setItemLoading(false); return }
    toast('Item added.')
    setShowAddItem(false)
    setItemName(''); setItemCat('stationery'); setItemUnit('piece')
    setItemQty('0'); setItemThreshold('5')
    fetchStoreItems(); fetchStoreTxnCount(); setItemLoading(false)
  }

  async function handleTxn() {
    if (!txnTarget || parseInt(txnQty) <= 0) { toast('Enter valid quantity.', 'error'); return }
    setTxnLoading(true)
    const qty    = parseInt(txnQty)
    const newQty = txnType === 'stock_in' ? txnTarget.quantity + qty : txnTarget.quantity - qty
    if (newQty < 0) { toast('Not enough stock.', 'error'); setTxnLoading(false); return }

    const { error: e1 } = await supabase.from('store_transactions').insert({
      school_id: schoolId, item_id: txnTarget.id, txn_type: txnType,
      quantity: qty, reference: txnRef || null,
      issued_to: txnIssuedTo || null, notes: txnNotes || null, created_by: userId,
    })
    if (e1) { toast('Transaction failed.', 'error'); setTxnLoading(false); return }

    await supabase.from('store_items').update({ quantity: newQty }).eq('id', txnTarget.id)
    toast(txnType === 'stock_in' ? `+${qty} added.` : `-${qty} issued.`)
    setShowTxnModal(false); setTxnTarget(null)
    setTxnQty(''); setTxnRef(''); setTxnIssuedTo(''); setTxnNotes('')
    fetchStoreItems(); fetchStoreTxnCount(); setTxnLoading(false)
  }

  async function handleDeleteStoreItem(item: StoreItem) {
    await supabase.from('store_items')
      .update({ deleted_at: new Date().toISOString() }).eq('id', item.id)
    setDeleteStoreTarget(null); toast('Item removed.'); fetchStoreItems()
  }

  async function handleRequestAction(req: ResourceRequest, action: 'approved'|'rejected') {
    const { error: err } = await supabase.from('resource_requests').update({
      status: action, reviewed_by: userId, reviewed_at: new Date().toISOString(),
    }).eq('id', req.id)
    if (err) { toast('Action failed.', 'error'); return }
    toast(`Request ${action}.`); fetchStoreRequests()
  }

  const filteredItems = storeItems.filter(i =>
    i.name.toLowerCase().includes(storeSearch.toLowerCase()) &&
    (storeCatFilter === 'all' || i.category === storeCatFilter)
  )
  const lowStockCount = storeItems.filter(i => i.quantity <= i.low_stock_threshold).length

  // ─── Assets ────────────────────────────────────────────────────────────────

  async function fetchAssets() {
    setAssetsLoading(true)
    const { data } = await supabase
      .from('resource_assets').select('*').eq('school_id', schoolId!)
      .is('deleted_at', null).order('name')
    setAssets((data ?? []).map(row => {
      const itemCondition: ResourceAsset['item_condition'] =
        row.condition === 'fair' ||
        row.condition === 'needs_repair' ||
        row.condition === 'condemned'
          ? row.condition
          : 'good'

      return {
        id: row.id,
        school_id: row.school_id ?? '',
        name: row.name,
        category: row.category ?? 'other',
        quantity: row.quantity ?? 0,
        item_condition: itemCondition,
        location: row.location,
        serial_no: row.serial_no,
        last_checked: row.last_checked,
        added_by: row.added_by ?? '',
        created_at: row.created_at ?? new Date(0).toISOString(),
      }
    }))
    setAssetsLoading(false)
  }

  function resetAssetForm() {
    setAName(''); setACat('furniture'); setAQty('1'); setACond('good')
    setALocation(''); setASerial(''); setALastChecked('')
  }

  function loadAssetToForm(a: ResourceAsset) {
    setAName(a.name); setACat(a.category); setAQty(String(a.quantity))
    setACond(a.item_condition); setALocation(a.location ?? '')
    setASerial(a.serial_no ?? ''); setALastChecked(a.last_checked ?? '')
  }

  async function handleSaveAsset() {
    if (!aName.trim()) { toast('Name required.', 'error'); return }
    setAssetLoading(true)
    const payload = {
      school_id: schoolId, name: aName.trim(), category: aCat,
      quantity: parseInt(aQty) || 1, condition: aCond,
      location: aLocation || null, serial_no: aSerial || null,
      last_checked: aLastChecked || null, added_by: userId,
    }
    if (editAsset) {
      const { error: err } = await supabase
        .from('resource_assets').update(payload).eq('id', editAsset.id)
      if (err) { toast('Update failed.', 'error'); setAssetLoading(false); return }
      toast('Asset updated.'); setEditAsset(null)
    } else {
      const { error: err } = await supabase.from('resource_assets').insert(payload)
      if (err) { toast('Failed: ' + err.message, 'error'); setAssetLoading(false); return }
      toast('Asset added.'); setShowAddAsset(false)
    }
    resetAssetForm(); fetchAssets(); setAssetLoading(false)
  }

  async function handleCondemnAsset(a: ResourceAsset) {
    await supabase.from('resource_assets')
      .update({ condition: 'condemned' }).eq('id', a.id)
    setCondemnTarget(null); toast('Asset marked condemned.'); fetchAssets()
  }

  async function handleDeleteAsset(a: ResourceAsset) {
    await supabase.from('resource_assets')
      .update({ deleted_at: new Date().toISOString() }).eq('id', a.id)
    setDeleteAssetTarget(null); toast('Asset removed.'); fetchAssets()
  }

  async function handleLastChecked(a: ResourceAsset) {
    await supabase.from('resource_assets')
      .update({ last_checked: today() }).eq('id', a.id)
    toast('Last checked updated.'); fetchAssets()
  }

  const filteredAssets = assets.filter(a =>
    a.name.toLowerCase().includes(assetSearch.toLowerCase()) &&
    (assetCatFilter === 'all' || a.category === assetCatFilter) &&
    (assetCondFilter === 'all' || a.item_condition === assetCondFilter)
  )

  const assetCondCounts = {
    good:         assets.filter(a => a.item_condition === 'good').length,
    fair:         assets.filter(a => a.item_condition === 'fair').length,
    needs_repair: assets.filter(a => a.item_condition === 'needs_repair').length,
    condemned:    assets.filter(a => a.item_condition === 'condemned').length,
  }

  // ─── Library ───────────────────────────────────────────────────────────────

  async function fetchBooks() {
    setLibLoading(true)
    const { data } = await supabase
      .from('library_books').select('*').eq('school_id', schoolId!)
      .is('deleted_at', null).order('title')
    setBooks((data ?? []).map(row => ({
      id: row.id,
      school_id: row.school_id ?? '',
      title: row.title,
      author: row.author ?? 'Unknown author',
      isbn: row.isbn,
      subject: row.subject,
      class_level: row.class_level,
      total_copies: row.total_copies ?? 0,
      available_copies: row.available_copies ?? 0,
      added_by: row.added_by ?? '',
      created_at: row.created_at ?? new Date(0).toISOString(),
    })))
    setLibLoading(false)
  }

  async function fetchBorrowings() {
    const { data } = await supabase
      .from('library_borrowings')
      .select('*, book:book_id(title), issuer:issued_by(full_name)')
      .eq('school_id', schoolId!)
      .is('returned_at', null)
      .is('deleted_at', null)
      .order('due_date')
    setBorrowings((data ?? []).map(row => {
      const book = Array.isArray(row.book)
        ? row.book[0] ?? null
        : row.book

      const issuer = Array.isArray(row.issuer)
        ? row.issuer[0] ?? null
        : row.issuer

      const borrowerType: LibraryBorrowing['borrower_type'] =
        row.borrower_type === 'staff' ? 'staff' : 'student'

      return {
        id: row.id,
        school_id: row.school_id ?? '',
        book_id: row.book_id ?? '',
        borrower_type: borrowerType,
        student_id: row.student_id,
        staff_id: row.staff_id,
        issued_by: row.issued_by ?? '',
        issued_at: row.issued_at ?? new Date(0).toISOString(),
        due_date: row.due_date,
        returned_at: row.returned_at,
        condition_out: row.condition_out ?? 'good',
        condition_in: row.condition_in,
        fine_amount: Number(row.fine_amount ?? 0),
        fine_paid: row.fine_paid ?? false,
        notes: row.notes,
        created_at: row.created_at ?? new Date(0).toISOString(),
        book_title: book?.title ?? 'Unknown',
        issuer_name: issuer?.full_name ?? 'Unknown',
        borrower_name: row.notes ?? '—',
      }
    }))
  }

  async function handleAddBook() {
    if (!bTitle.trim() || !bAuthor.trim()) {
      toast('Title and author required.', 'error'); return
    }
    setLibActionLoading(true)
    const copies = parseInt(bCopies) || 1
    const { error: err } = await supabase.from('library_books').insert({
      school_id: schoolId, title: bTitle.trim(), author: bAuthor.trim(),
      isbn: bIsbn || null, subject: bSubject || null, class_level: bClassLevel || null,
      total_copies: copies, available_copies: copies, added_by: userId,
    })
    if (err) { toast('Failed: ' + err.message, 'error'); setLibActionLoading(false); return }
    toast('Book added.'); setShowAddBook(false)
    setBTitle(''); setBAuthor(''); setBIsbn(''); setBSubject('')
    setBClassLevel(''); setBCopies('1')
    fetchBooks(); setLibActionLoading(false)
  }

  async function handleIssueBook() {
    if (!issueTarget || !borrowerName.trim() || !issueDue) {
      toast('Fill all required fields.', 'error'); return
    }
    if (issueTarget.available_copies <= 0) {
      toast('No copies available.', 'error'); return
    }
    setLibActionLoading(true)

    // FIX: properly set student_id / staff_id based on borrower type.
    // We store the name in `notes` since we don't have a foreign key lookup UI here.
    // student_id and staff_id remain null until a picker is added.
    const { error: e1 } = await supabase.from('library_borrowings').insert({
      school_id:     schoolId,
      book_id:       issueTarget.id,
      borrower_type: borrowerType,
      student_id:    null,   // extend later with student picker
      staff_id:      null,   // extend later with staff picker
      issued_by:     userId!,
      issued_at:     new Date().toISOString(),
      due_date:      issueDue,
      condition_out: issueCondOut,
      fine_amount:   0,
      fine_paid:     false,
      notes:         borrowerName.trim(),   // borrower name stored here
    })
    if (e1) { toast('Issue failed: ' + e1.message, 'error'); setLibActionLoading(false); return }

    await supabase.from('library_books')
      .update({ available_copies: issueTarget.available_copies - 1 })
      .eq('id', issueTarget.id)

    toast('Book issued.')
    setShowIssueModal(false); setIssueTarget(null)
    setBorrowerName(''); setIssueDue(''); setIssueCondOut('good')
    fetchBooks(); fetchBorrowings(); setLibActionLoading(false)
  }

  async function handleReturnBook() {
    if (!returnTarget) return
    setLibActionLoading(true)

    // FIX: only calculate fine if actually overdue; don't overwrite existing fine_amount
    // if the book is being returned on time.
    const overdue = isOverdue(returnTarget.due_date, null)
    const fine    = overdue ? calcFine(returnTarget.due_date) : 0

    const { error: e1 } = await supabase.from('library_borrowings').update({
      returned_at:  new Date().toISOString(),
      condition_in: returnCondIn,
      fine_amount:  fine,
      fine_paid:    overdue ? returnFinePaid : false,
    }).eq('id', returnTarget.id)
    if (e1) { toast('Return failed: ' + e1.message, 'error'); setLibActionLoading(false); return }

    if (returnTarget.book_id) {
      await supabase.rpc('increment_available_copies', { book_id: returnTarget.book_id })
    }

    toast('Book returned.')
    setShowReturnModal(false); setReturnTarget(null)
    setReturnCondIn('good'); setReturnFinePaid(false)
    fetchBooks(); fetchBorrowings(); setLibActionLoading(false)
  }

  async function handleDeleteBook(book: LibraryBook) {
    await supabase.from('library_books')
      .update({ deleted_at: new Date().toISOString() }).eq('id', book.id)
    setDeleteBookTarget(null); toast('Book removed.'); fetchBooks()
  }

  const filteredBooks = books.filter(b =>
    b.title.toLowerCase().includes(bookSearch.toLowerCase()) ||
    b.author.toLowerCase().includes(bookSearch.toLowerCase())
  )
  const overdueCount = borrowings.filter(b => isOverdue(b.due_date, b.returned_at)).length
  const unpaidFines  = borrowings
    .filter(b => b.fine_amount > 0 && !b.fine_paid)
    .reduce((s, b) => s + b.fine_amount, 0)

  // ─── Staff ─────────────────────────────────────────────────────────────────

  async function fetchStaff() {
    setStaffLoading(true)
    const { data: profiles } = await supabase
      .from('profiles').select('id, full_name, role')
      .eq('school_id', schoolId!).neq('role', 'admin').order('full_name')

    // FIX: ensure resource_roles table has unique constraint on (school_id, profile_id)
    // for the upsert in handleRoleChange to work correctly.
    const { data: roles } = await supabase
      .from('resource_roles').select('id, profile_id, role')
      .eq('school_id', schoolId!).is('deleted_at', null)

    const roleMap: Record<string, {
      role: StaffProfile['resource_role']
      id: string
    }> = {}

    for (const row of roles ?? []) {
      if (!row.profile_id) continue

      const role: StaffProfile['resource_role'] =
        row.role === 'librarian' ||
        row.role === 'store_keeper'
          ? row.role
          : 'general'

      roleMap[row.profile_id] = {
        role,
        id: row.id,
      }
    }

    setStaffList((profiles ?? []).map(row => ({
      id: row.id,
      full_name: row.full_name,
      email: '',
      role: row.role ?? 'staff',
      resource_role: roleMap[row.id]?.role ?? 'general',
      resource_role_id: roleMap[row.id]?.id ?? null,
    })))
    setStaffLoading(false)
  }

  async function handleRoleChange(
    person: StaffProfile,
    newRole: typeof RESOURCE_ROLES[number],
  ) {
    if (!userId) return
    setRoleUpdating(person.id)
    // NOTE: requires unique constraint on (school_id, profile_id) in resource_roles table
    const { error: err } = await supabase.from('resource_roles').upsert({
      school_id:   schoolId,
      profile_id:  person.id,
      role:        newRole,
      assigned_by: userId,
      assigned_at: new Date().toISOString(),
    }, { onConflict: 'school_id,profile_id' })
    if (err) { toast('Role update failed.', 'error'); setRoleUpdating(null); return }
    toast('Role updated.'); setRoleUpdating(null); fetchStaff()
  }

  const filteredStaff    = staffList.filter(s =>
    s.full_name.toLowerCase().includes(staffSearch.toLowerCase())
  )
  const librarianCount   = staffList.filter(s => s.resource_role === 'librarian').length
  const storeKeeperCount = staffList.filter(s => s.resource_role === 'store_keeper').length

  // ─── Header stats (loaded lazily per tab) ──────────────────────────────────

  const headerStats = [
    { label:'Total Assets',     value: assets.length         || null, icon:'🏫' },
    { label:'Books Available',  value: books.reduce((s,b) => s + b.available_copies, 0) || null, icon:'📖' },
    { label:'Pending Requests', value: storeRequests.length  || null, icon:'⏳' },
    { label:'Low Stock',        value: lowStockCount         || null, icon:'⚠️' },
  ]

  // ─── FAB helper ────────────────────────────────────────────────────────────

  function FAB({ label, onClick }: { label: string; onClick: () => void }) {
    return (
      <button onClick={onClick} style={{
        position:'fixed', bottom:90, right:20,
        background:C.emerald, color:'#fff', border:'none',
        borderRadius:20, padding:'14px 22px', fontWeight:700,
        fontSize:15, cursor:'pointer',
        boxShadow:'0 4px 20px rgba(16,185,129,0.45)',
        display:'flex', alignItems:'center', gap:8, zIndex:50,
      }}>
        <span style={{ fontSize:20, lineHeight:1 }}>+</span> {label}
      </button>
    )
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight:'100vh', background:C.bg, fontFamily:"'Plus Jakarta Sans', sans-serif" }}>

      {/* Header */}
      <div style={{
        background:`linear-gradient(135deg, ${C.hero} 0%, ${C.heroMid} 100%)`,
        padding:'20px 16px 0', position:'sticky', top:0, zIndex:40,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
          <button
            onClick={() => router.back()}
            style={{
              background:'rgba(255,255,255,0.12)', border:'none', borderRadius:10,
              width:36, height:36, display:'flex', alignItems:'center',
              justifyContent:'center', cursor:'pointer', color:'#fff', fontSize:18,
            }}
          >‹</button>
          <div>
            <div style={{ color:'rgba(255,255,255,0.6)', fontSize:11, fontWeight:600, letterSpacing:1, textTransform:'uppercase' }}>Admin</div>
            <div style={{ color:'#fff', fontSize:20, fontWeight:700 }}>Resources</div>
          </div>
        </div>

        {/* Stats strip */}
        <div style={{ display:'flex', gap:8, overflowX:'auto', paddingBottom:12, scrollbarWidth:'none' }}>
          {headerStats.map(s => (
            <div key={s.label} style={{
              background:'rgba(255,255,255,0.10)', borderRadius:12,
              padding:'10px 14px', minWidth:110, flexShrink:0,
              border:'1px solid rgba(255,255,255,0.08)',
            }}>
              <div style={{ fontSize:18 }}>{s.icon}</div>
              <div style={{ color: s.value ? C.emerald : '#fff', fontSize:18, fontWeight:700, marginTop:2 }}>
                {s.value ?? '—'}
              </div>
              <div style={{ color:'rgba(255,255,255,0.55)', fontSize:10, fontWeight:500 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', overflowX:'auto', scrollbarWidth:'none' }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                background:'none', border:'none', cursor:'pointer',
                padding:'10px 14px', whiteSpace:'nowrap',
                color: activeTab === t.key ? C.emerald : 'rgba(255,255,255,0.55)',
                fontWeight: activeTab === t.key ? 700 : 500,
                fontSize:13,
                borderBottom: activeTab === t.key ? `2px solid ${C.emerald}` : '2px solid transparent',
                transition:'all 0.2s',
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Toast */}
      <div style={{ padding:'10px 16px 0' }}>
        {toastMsg && toastType === 'success' && (
          <div style={{ background:C.emeraldLt, color:'#065f46', borderRadius:10, padding:'10px 14px', marginBottom:4, fontSize:13, fontWeight:600 }}>
            ✅ {toastMsg}
          </div>
        )}
        {toastMsg && toastType === 'error' && (
          <div style={{ background:'#fee2e2', color:'#b91c1c', borderRadius:10, padding:'10px 14px', marginBottom:4, fontSize:13, fontWeight:600 }}>
            ⚠️ {toastMsg}
            <button onClick={() => setToastMsg(null)} style={{ float:'right', background:'none', border:'none', cursor:'pointer', color:'#b91c1c', fontWeight:700 }}>✕</button>
          </div>
        )}
      </div>

      <div style={{ padding:'8px 16px 100px' }}>

        {/* ══ DOCUMENTS ══ */}
        {activeTab === 'documents' && (
          <div>
            <div style={{ background:C.surface, borderRadius:16, padding:14, boxShadow:'0 1px 3px rgba(0,0,0,0.08)', marginBottom:12 }}>
              <input
                value={docSearch} onChange={e => setDocSearch(e.target.value)}
                placeholder="Search documents…" style={{ ...inp, marginBottom:10 }}
              />
              <div style={{ display:'flex', gap:8 }}>
                <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ flex:1, border:`1px solid ${C.border}`, borderRadius:10, padding:'8px 10px', fontSize:13, color:C.text, background:C.surface, outline:'none' }}>
                  <option value="all">All Categories</option>
                  {DOC_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                </select>
                <select value={filterVis} onChange={e => setFilterVis(e.target.value)} style={{ flex:1, border:`1px solid ${C.border}`, borderRadius:10, padding:'8px 10px', fontSize:13, color:C.text, background:C.surface, outline:'none' }}>
                  <option value="all">All Visibility</option>
                  {DOC_VISIBILITIES.map(v => <option key={v} value={v}>{VISIBILITY_LABELS[v]}</option>)}
                </select>
              </div>
            </div>

            <div style={{ fontSize:12, color:C.muted, marginBottom:10, paddingLeft:2 }}>
              {docsLoading ? 'Loading…' : `${filteredDocs.length} document${filteredDocs.length !== 1 ? 's' : ''}`}
            </div>

            {docsLoading ? (
              <div style={{ textAlign:'center', padding:40, color:C.muted }}>Loading…</div>
            ) : filteredDocs.length === 0 ? (
              <div style={{ textAlign:'center', padding:48, background:C.surface, borderRadius:16 }}>
                <div style={{ fontSize:40 }}>📁</div>
                <div style={{ fontWeight:700, fontSize:16, marginTop:12, color:C.text }}>No documents yet</div>
                <div style={{ color:C.muted, fontSize:13, marginTop:6 }}>Upload policies, MOE circulars and more.</div>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {filteredDocs.map(doc => (
                  <div key={doc.id} style={{ background:C.surface, borderRadius:16, padding:'14px 14px 12px', border:`1px solid ${C.border}`, boxShadow:'0 1px 3px rgba(0,0,0,0.08)' }}>
                    <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                      <div style={{ width:42, height:42, borderRadius:12, flexShrink:0, background:C.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>
                        {FILE_ICONS[doc.file_type ?? 'other'] ?? '📎'}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:700, fontSize:14, color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{doc.title}</div>
                        <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>
                          {doc.uploader_name} · {formatDate(doc.created_at)}
                          {doc.file_size_kb ? ` · ${formatSize(doc.file_size_kb)}` : ''}
                        </div>
                        <div style={{ display:'flex', gap:6, marginTop:7, flexWrap:'wrap' }}>
                          <span style={badge(CATEGORY_COLORS[doc.category])}>{CATEGORY_LABELS[doc.category]}</span>
                          <span style={badge(VISIBILITY_COLORS[doc.visibility])}>{VISIBILITY_LABELS[doc.visibility]}</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:8, marginTop:12 }}>
                      {doc.file_url
                        ? <a href={doc.file_url} target="_blank" rel="noopener noreferrer" style={{ flex:1, background:C.emerald, color:'#fff', borderRadius:10, padding:'8px 0', textAlign:'center', fontWeight:700, fontSize:13, textDecoration:'none', display:'block' }}>↗ Open</a>
                        : <div style={{ flex:1, background:C.bg, borderRadius:10, padding:'8px 0', textAlign:'center', fontSize:13, color:C.muted }}>No file</div>
                      }
                      <button onClick={() => setDeleteDocTarget(doc)} style={{ background:'#fee2e2', color:'#b91c1c', border:'none', borderRadius:10, padding:'8px 16px', fontWeight:700, fontSize:13, cursor:'pointer' }}>🗑</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ STORE ══ */}
        {activeTab === 'store' && (
          <div>
            <div style={{ display:'flex', background:C.surface, borderRadius:14, padding:4, marginBottom:14, boxShadow:'0 1px 3px rgba(0,0,0,0.08)' }}>
              {(['items','requests'] as const).map(v => (
                <button
                  key={v} onClick={() => setStoreViewMode(v)}
                  style={{
                    flex:1, background: storeViewMode === v ? C.emerald : 'none',
                    color: storeViewMode === v ? '#fff' : C.muted,
                    border:'none', borderRadius:10, padding:'9px 0',
                    fontWeight:700, fontSize:13, cursor:'pointer', transition:'all 0.2s',
                  }}
                >
                  {v === 'items' ? '📦 Inventory' : `📋 Requests${storeRequests.length > 0 ? ` (${storeRequests.length})` : ''}`}
                </button>
              ))}
            </div>

            {storeViewMode === 'items' && (
              <div>
                <div style={{ display:'flex', gap:8, marginBottom:14 }}>
                  {[
                    { label:'Total Items',  value:storeItems.length, icon:'📦', color:C.emerald },
                    { label:'Low Stock',    value:lowStockCount,     icon:'⚠️', color: lowStockCount > 0 ? '#ef4444' : C.muted },
                    { label:'Transactions', value:storeTxnCount,     icon:'🔄', color:C.text },
                  ].map(s => (
                    <div key={s.label} style={{ flex:1, background:C.surface, borderRadius:14, padding:'12px 10px', boxShadow:'0 1px 3px rgba(0,0,0,0.08)', border:`1px solid ${C.border}` }}>
                      <div style={{ fontSize:18 }}>{s.icon}</div>
                      <div style={{ fontSize:20, fontWeight:800, color:s.color, marginTop:4 }}>{s.value}</div>
                      <div style={{ fontSize:10, color:C.muted, marginTop:2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                <div style={{ background:C.surface, borderRadius:16, padding:14, boxShadow:'0 1px 3px rgba(0,0,0,0.08)', marginBottom:12 }}>
                  <input value={storeSearch} onChange={e => setStoreSearch(e.target.value)} placeholder="Search items…" style={{ ...inp, marginBottom:10 }} />
                  <select value={storeCatFilter} onChange={e => setStoreCatFilter(e.target.value)} style={inp}>
                    <option value="all">All Categories</option>
                    {STORE_CATEGORIES.map(c => <option key={c} value={c}>{STORE_CAT_LABELS[c]}</option>)}
                  </select>
                </div>

                <div style={{ fontSize:12, color:C.muted, marginBottom:10 }}>
                  {storeLoading ? 'Loading…' : `${filteredItems.length} item${filteredItems.length !== 1 ? 's' : ''}`}
                </div>

                {storeLoading ? (
                  <div style={{ textAlign:'center', padding:40, color:C.muted }}>Loading…</div>
                ) : filteredItems.length === 0 ? (
                  <div style={{ textAlign:'center', padding:48, background:C.surface, borderRadius:16 }}>
                    <div style={{ fontSize:40 }}>📦</div>
                    <div style={{ fontWeight:700, fontSize:16, marginTop:12, color:C.text }}>No items yet</div>
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    {filteredItems.map(item => {
                      const isLow = item.quantity <= item.low_stock_threshold
                      return (
                        <div key={item.id} style={{ background:C.surface, borderRadius:16, padding:'14px 14px 12px', border: isLow ? '1px solid #fca5a5' : `1px solid ${C.border}`, boxShadow:'0 1px 3px rgba(0,0,0,0.08)' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                            <div style={{ width:44, height:44, borderRadius:12, background: isLow ? '#fee2e2' : C.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>📦</div>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                <div style={{ fontWeight:700, fontSize:14, color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.name}</div>
                                {isLow && <span style={badge({ background:'#fee2e2', color:'#b91c1c' })}>Low</span>}
                              </div>
                              <div style={{ display:'flex', gap:6, marginTop:5, flexWrap:'wrap' }}>
                                <span style={badge(STORE_CAT_COLORS[item.category])}>{STORE_CAT_LABELS[item.category]}</span>
                                <span style={{ fontSize:12, color:C.muted }}>{item.unit}</span>
                              </div>
                            </div>
                            <div style={{ textAlign:'right', flexShrink:0 }}>
                              <div style={{ fontSize:26, fontWeight:800, color: isLow ? '#ef4444' : C.text, lineHeight:1 }}>{item.quantity}</div>
                              <div style={{ fontSize:10, color:C.muted }}>in stock</div>
                            </div>
                          </div>
                          <div style={{ display:'flex', gap:8, marginTop:12 }}>
                            <button onClick={() => { setTxnTarget(item); setTxnType('stock_in');  setShowTxnModal(true) }} style={{ flex:1, background:C.emeraldLt, color:'#065f46', border:'none', borderRadius:10, padding:'8px 0', fontWeight:700, fontSize:12, cursor:'pointer' }}>+ In</button>
                            <button onClick={() => { setTxnTarget(item); setTxnType('stock_out'); setShowTxnModal(true) }} style={{ flex:1, background:'#fef3c7', color:'#92400e', border:'none', borderRadius:10, padding:'8px 0', fontWeight:700, fontSize:12, cursor:'pointer' }}>− Out</button>
                            <button onClick={() => setDeleteStoreTarget(item)} style={{ background:'#fee2e2', color:'#b91c1c', border:'none', borderRadius:10, padding:'8px 12px', fontWeight:700, fontSize:13, cursor:'pointer' }}>🗑</button>
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
                  <div style={{ textAlign:'center', padding:48, background:C.surface, borderRadius:16 }}>
                    <div style={{ fontSize:40 }}>📋</div>
                    <div style={{ fontWeight:700, fontSize:16, marginTop:12, color:C.text }}>No pending requests</div>
                    <div style={{ color:C.muted, fontSize:13, marginTop:6 }}>Teacher requests will appear here.</div>
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    {storeRequests.map(req => (
                      <div key={req.id} style={{ background:C.surface, borderRadius:16, padding:14, border:`1px solid ${C.border}`, boxShadow:'0 1px 3px rgba(0,0,0,0.08)' }}>
                        <div style={{ fontWeight:700, fontSize:14, color:C.text }}>{req.item_name ?? 'Unknown Item'}</div>
                        <div style={{ fontSize:12, color:C.muted, marginTop:3 }}>By {req.requester_name} · Qty: {req.quantity}</div>
                        {req.reason && <div style={{ fontSize:12, color:C.text, marginTop:4, fontStyle:'italic' }}>"{req.reason}"</div>}
                        <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>{formatDate(req.created_at)}</div>
                        <div style={{ display:'flex', gap:8, marginTop:12 }}>
                          <button onClick={() => handleRequestAction(req, 'approved')} style={{ flex:1, background:C.emeraldLt, color:'#065f46', border:'none', borderRadius:10, padding:'9px 0', fontWeight:700, fontSize:13, cursor:'pointer' }}>✓ Approve</button>
                          <button onClick={() => handleRequestAction(req, 'rejected')} style={{ flex:1, background:'#fee2e2', color:'#b91c1c', border:'none', borderRadius:10, padding:'9px 0', fontWeight:700, fontSize:13, cursor:'pointer' }}>✕ Reject</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══ ASSETS ══ */}
        {activeTab === 'assets' && (
          <div>
            <div style={{ display:'flex', gap:8, marginBottom:14, overflowX:'auto' }}>
              {[
                { label:'Good',     value:assetCondCounts.good,         color:'#065f46', bg:'#d1fae5' },
                { label:'Fair',     value:assetCondCounts.fair,         color:'#a16207', bg:'#fef9c3' },
                { label:'Repair',   value:assetCondCounts.needs_repair, color:'#c2410c', bg:'#ffedd5' },
                { label:'Condemned',value:assetCondCounts.condemned,    color:'#b91c1c', bg:'#fee2e2' },
              ].map(s => (
                <div key={s.label} style={{ flex:1, background:s.bg, borderRadius:14, padding:'10px 8px', minWidth:72, flexShrink:0 }}>
                  <div style={{ fontSize:20, fontWeight:800, color:s.color }}>{s.value}</div>
                  <div style={{ fontSize:10, color:s.color, marginTop:2, fontWeight:600 }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div style={{ background:C.surface, borderRadius:16, padding:14, boxShadow:'0 1px 3px rgba(0,0,0,0.08)', marginBottom:12 }}>
              <input value={assetSearch} onChange={e => setAssetSearch(e.target.value)} placeholder="Search assets…" style={{ ...inp, marginBottom:10 }} />
              <div style={{ display:'flex', gap:8 }}>
                <select value={assetCatFilter} onChange={e => setAssetCatFilter(e.target.value)} style={{ flex:1, border:`1px solid ${C.border}`, borderRadius:10, padding:'8px 10px', fontSize:13, color:C.text, background:C.surface, outline:'none' }}>
                  <option value="all">All Categories</option>
                  {ASSET_CATEGORIES.map(c => <option key={c} value={c}>{ASSET_CAT_LABELS[c]}</option>)}
                </select>
                <select value={assetCondFilter} onChange={e => setAssetCondFilter(e.target.value)} style={{ flex:1, border:`1px solid ${C.border}`, borderRadius:10, padding:'8px 10px', fontSize:13, color:C.text, background:C.surface, outline:'none' }}>
                  <option value="all">All Conditions</option>
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                  <option value="needs_repair">Needs Repair</option>
                  <option value="condemned">Condemned</option>
                </select>
              </div>
            </div>

            <div style={{ fontSize:12, color:C.muted, marginBottom:10 }}>
              {assetsLoading ? 'Loading…' : `${filteredAssets.length} of ${assets.length} asset${assets.length !== 1 ? 's' : ''}`}
            </div>

            {assetsLoading ? (
              <div style={{ textAlign:'center', padding:40, color:C.muted }}>Loading…</div>
            ) : filteredAssets.length === 0 ? (
              <div style={{ textAlign:'center', padding:48, background:C.surface, borderRadius:16 }}>
                <div style={{ fontSize:40 }}>🏫</div>
                <div style={{ fontWeight:700, fontSize:16, marginTop:12, color:C.text }}>No assets yet</div>
                <div style={{ color:C.muted, fontSize:13, marginTop:6 }}>Track furniture, electronics, sports equipment and more.</div>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {filteredAssets.map(asset => (
                  <div key={asset.id} style={{ background:C.surface, borderRadius:16, padding:'14px 14px 12px', border:`1px solid ${C.border}`, boxShadow:'0 1px 3px rgba(0,0,0,0.08)' }}>
                    <div>
                      <div style={{ fontWeight:700, fontSize:15, color:C.text }}>{asset.name}</div>
                      <div style={{ display:'flex', gap:6, marginTop:6, flexWrap:'wrap' }}>
                        <span style={badge({ background:'#f1f5f9', color:'#475569' })}>{ASSET_CAT_LABELS[asset.category]}</span>
                        <span style={badge(ASSET_CONDITION_COLORS[asset.item_condition])}>{ASSET_CONDITION_LABELS[asset.item_condition]}</span>
                      </div>
                      <div style={{ fontSize:12, color:C.muted, marginTop:6 }}>
                        Qty: <strong style={{ color:C.text }}>{asset.quantity}</strong>
                        {asset.location ? ` · 📍 ${asset.location}` : ''}
                        {asset.serial_no ? ` · S/N: ${asset.serial_no}` : ''}
                      </div>
                      {asset.last_checked && (
                        <div style={{ fontSize:11, color:C.muted, marginTop:3 }}>Last checked: {formatDate(asset.last_checked)}</div>
                      )}
                    </div>
                    <div style={{ display:'flex', gap:8, marginTop:12, flexWrap:'wrap' }}>
                      <button onClick={() => { loadAssetToForm(asset); setEditAsset(asset) }} style={{ flex:1, background:C.emeraldLt, color:'#065f46', border:'none', borderRadius:10, padding:'8px 0', fontWeight:700, fontSize:12, cursor:'pointer', minWidth:60 }}>✏️ Edit</button>
                      <button onClick={() => handleLastChecked(asset)} style={{ flex:1, background:'#dbeafe', color:'#1d4ed8', border:'none', borderRadius:10, padding:'8px 0', fontWeight:700, fontSize:12, cursor:'pointer', minWidth:60 }}>✓ Checked</button>
                      {asset.item_condition !== 'condemned' && (
                        <button onClick={() => setCondemnTarget(asset)} style={{ flex:1, background:'#ffedd5', color:'#c2410c', border:'none', borderRadius:10, padding:'8px 0', fontWeight:700, fontSize:12, cursor:'pointer', minWidth:60 }}>⚠️ Condemn</button>
                      )}
                      <button onClick={() => setDeleteAssetTarget(asset)} style={{ background:'#fee2e2', color:'#b91c1c', border:'none', borderRadius:10, padding:'8px 12px', fontWeight:700, fontSize:13, cursor:'pointer' }}>🗑</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ LIBRARY ══ */}
        {activeTab === 'library' && (
          <div>
            <div style={{ display:'flex', gap:8, marginBottom:14 }}>
              {[
                { label:'Total Books', value:books.length,                                        icon:'📚', color:C.emerald },
                { label:'Available',   value:books.reduce((s,b) => s + b.available_copies, 0),   icon:'✅', color:'#065f46' },
                { label:'Overdue',     value:overdueCount,                                        icon:'⏰', color: overdueCount > 0 ? '#ef4444' : C.muted },
                { label:'Fines (KES)', value:unpaidFines,                                         icon:'💰', color: unpaidFines > 0 ? '#b91c1c' : C.muted },
              ].map(s => (
                <div key={s.label} style={{ flex:1, background:C.surface, borderRadius:14, padding:'10px 8px', boxShadow:'0 1px 3px rgba(0,0,0,0.08)', border:`1px solid ${C.border}` }}>
                  <div style={{ fontSize:16 }}>{s.icon}</div>
                  <div style={{ fontSize:18, fontWeight:800, color:s.color, marginTop:2 }}>{s.value}</div>
                  <div style={{ fontSize:9, color:C.muted, marginTop:2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div style={{ display:'flex', background:C.surface, borderRadius:14, padding:4, marginBottom:14, boxShadow:'0 1px 3px rgba(0,0,0,0.08)' }}>
              {(['books','borrowings'] as const).map(v => (
                <button key={v} onClick={() => setLibView(v)} style={{ flex:1, background: libView === v ? C.emerald : 'none', color: libView === v ? '#fff' : C.muted, border:'none', borderRadius:10, padding:'9px 0', fontWeight:700, fontSize:13, cursor:'pointer', transition:'all 0.2s' }}>
                  {v === 'books' ? '📚 Catalog' : `📋 Borrowings${borrowings.length > 0 ? ` (${borrowings.length})` : ''}`}
                </button>
              ))}
            </div>

            {libView === 'books' && (
              <div>
                <div style={{ background:C.surface, borderRadius:16, padding:14, boxShadow:'0 1px 3px rgba(0,0,0,0.08)', marginBottom:12 }}>
                  <input value={bookSearch} onChange={e => setBookSearch(e.target.value)} placeholder="Search by title or author…" style={inp} />
                </div>
                {libLoading ? (
                  <div style={{ textAlign:'center', padding:40, color:C.muted }}>Loading…</div>
                ) : filteredBooks.length === 0 ? (
                  <div style={{ textAlign:'center', padding:48, background:C.surface, borderRadius:16 }}>
                    <div style={{ fontSize:40 }}>📚</div>
                    <div style={{ fontWeight:700, fontSize:16, marginTop:12, color:C.text }}>No books yet</div>
                    <div style={{ color:C.muted, fontSize:13, marginTop:6 }}>Add your library catalog.</div>
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    {filteredBooks.map(book => (
                      <div key={book.id} style={{ background:C.surface, borderRadius:16, padding:'14px 14px 12px', border:`1px solid ${C.border}`, boxShadow:'0 1px 3px rgba(0,0,0,0.08)' }}>
                        <div style={{ fontWeight:700, fontSize:15, color:C.text }}>{book.title}</div>
                        <div style={{ fontSize:13, color:C.muted, marginTop:2 }}>by {book.author}</div>
                        <div style={{ display:'flex', gap:6, marginTop:8, flexWrap:'wrap', alignItems:'center' }}>
                          {book.subject     && <span style={badge({ background:'#dbeafe', color:'#1d4ed8' })}>{book.subject}</span>}
                          {book.class_level && <span style={badge({ background:'#f1f5f9', color:'#475569' })}>Class {book.class_level}</span>}
                          <span style={badge({ background: book.available_copies > 0 ? C.emeraldLt : '#fee2e2', color: book.available_copies > 0 ? '#065f46' : '#b91c1c' })}>
                            {book.available_copies}/{book.total_copies} avail.
                          </span>
                        </div>
                        <div style={{ display:'flex', gap:8, marginTop:12 }}>
                          <button
                            onClick={() => { setIssueTarget(book); setShowIssueModal(true) }}
                            disabled={book.available_copies === 0}
                            style={{ flex:1, background: book.available_copies > 0 ? C.emerald : C.bg, color: book.available_copies > 0 ? '#fff' : C.muted, border:'none', borderRadius:10, padding:'8px 0', fontWeight:700, fontSize:13, cursor: book.available_copies > 0 ? 'pointer' : 'not-allowed' }}
                          >Issue Book</button>
                          <button onClick={() => setDeleteBookTarget(book)} style={{ background:'#fee2e2', color:'#b91c1c', border:'none', borderRadius:10, padding:'8px 12px', fontWeight:700, fontSize:13, cursor:'pointer' }}>🗑</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {libView === 'borrowings' && (
              <div>
                {borrowings.length === 0 ? (
                  <div style={{ textAlign:'center', padding:48, background:C.surface, borderRadius:16 }}>
                    <div style={{ fontSize:40 }}>📋</div>
                    <div style={{ fontWeight:700, fontSize:16, marginTop:12, color:C.text }}>No active borrowings</div>
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    {borrowings.map(b => {
                      const overdue = isOverdue(b.due_date, b.returned_at)
                      const fine    = overdue ? calcFine(b.due_date) : 0
                      return (
                        <div key={b.id} style={{ background:C.surface, borderRadius:16, padding:'14px 14px 12px', border: overdue ? '1px solid #fca5a5' : `1px solid ${C.border}`, boxShadow:'0 1px 3px rgba(0,0,0,0.08)' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                            <div style={{ flex:1 }}>
                              <div style={{ fontWeight:700, fontSize:14, color:C.text }}>{b.book_title}</div>
                              {/* FIX: use borrower_name (which is set from notes) */}
                              <div style={{ fontSize:12, color:C.muted, marginTop:3 }}>
                                {b.borrower_name} · {b.borrower_type}
                              </div>
                              <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>
                                Issued: {formatDate(b.issued_at)} · Due: {formatDate(b.due_date)}
                              </div>
                              {overdue && (
                                <div style={{ fontSize:12, color:'#b91c1c', fontWeight:700, marginTop:4 }}>
                                  ⏰ Overdue · Fine: KES {fine}
                                </div>
                              )}
                            </div>
                            {overdue && (
                              <span style={badge({ background:'#fee2e2', color:'#b91c1c' })}>Overdue</span>
                            )}
                          </div>
                          <button
                            onClick={() => { setReturnTarget(b); setReturnCondIn('good'); setReturnFinePaid(false); setShowReturnModal(true) }}
                            style={{ width:'100%', background:C.emerald, color:'#fff', border:'none', borderRadius:10, padding:'9px 0', fontWeight:700, fontSize:13, cursor:'pointer', marginTop:12 }}
                          >Return Book</button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══ STAFF ══ */}
        {activeTab === 'staff' && (
          <div>
            <div style={{ display:'flex', gap:8, marginBottom:14 }}>
              {[
                { label:'Total Staff',   value:staffList.length, icon:'👥', color:C.emerald },
                { label:'Librarians',    value:librarianCount,   icon:'📖', color:'#1d4ed8' },
                { label:'Store Keepers', value:storeKeeperCount, icon:'🏪', color:'#c2410c' },
              ].map(s => (
                <div key={s.label} style={{ flex:1, background:C.surface, borderRadius:14, padding:'12px 10px', boxShadow:'0 1px 3px rgba(0,0,0,0.08)', border:`1px solid ${C.border}` }}>
                  <div style={{ fontSize:18 }}>{s.icon}</div>
                  <div style={{ fontSize:20, fontWeight:800, color:s.color, marginTop:4 }}>{s.value}</div>
                  <div style={{ fontSize:10, color:C.muted, marginTop:2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div style={{ background:C.surface, borderRadius:16, padding:14, boxShadow:'0 1px 3px rgba(0,0,0,0.08)', marginBottom:12 }}>
              <input value={staffSearch} onChange={e => setStaffSearch(e.target.value)} placeholder="Search staff…" style={inp} />
            </div>

            {staffLoading ? (
              <div style={{ textAlign:'center', padding:40, color:C.muted }}>Loading…</div>
            ) : filteredStaff.length === 0 ? (
              <div style={{ textAlign:'center', padding:48, background:C.surface, borderRadius:16 }}>
                <div style={{ fontSize:40 }}>👥</div>
                <div style={{ fontWeight:700, fontSize:16, marginTop:12, color:C.text }}>No staff found</div>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {filteredStaff.map(person => {
                  const role   = person.resource_role ?? 'general'
                  const colors = RESOURCE_ROLE_COLORS[role]
                  return (
                    <div key={person.id} style={{ background:C.surface, borderRadius:16, padding:14, border:`1px solid ${C.border}`, boxShadow:'0 1px 3px rgba(0,0,0,0.08)' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                        <div style={{ width:44, height:44, borderRadius:22, background:C.hero, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:800, fontSize:15, flexShrink:0 }}>
                          {initials(person.full_name)}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontWeight:700, fontSize:14, color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{person.full_name}</div>
                          <div style={{ fontSize:12, color:C.muted, marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{person.email}</div>
                          <span style={badge({ ...colors, marginTop:4, display:'inline-block' })}>{RESOURCE_ROLE_LABELS[role]}</span>
                        </div>
                      </div>
                      <div style={{ marginTop:12 }}>
                        <label style={lbl}>Assign Resource Role</label>
                        <select
                          value={role}
                          disabled={roleUpdating === person.id}
                          onChange={e => handleRoleChange(person, e.target.value as typeof RESOURCE_ROLES[number])}
                          style={{ ...inp, fontSize:13 }}
                        >
                          {RESOURCE_ROLES.map(r => <option key={r} value={r}>{RESOURCE_ROLE_LABELS[r]}</option>)}
                        </select>
                        {roleUpdating === person.id && <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>Updating…</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══ FABs ══ */}
      {activeTab === 'documents' && (
        <FAB label="Upload" onClick={() => { resetDocForm(); setShowDocModal(true) }} />
      )}
      {activeTab === 'store' && storeViewMode === 'items' && (
        <FAB label="Add Item" onClick={() => setShowAddItem(true)} />
      )}
      {activeTab === 'assets' && !editAsset && (
        <FAB label="Add Asset" onClick={() => { resetAssetForm(); setShowAddAsset(true) }} />
      )}
      {activeTab === 'library' && libView === 'books' && (
        <FAB label="Add Book" onClick={() => setShowAddBook(true)} />
      )}

      {/* ══ MODALS ══ */}

      {/* Upload Document */}
      {showDocModal && (
        <BottomSheet title="Upload Document" onClose={() => setShowDocModal(false)}>
          <div style={field()}>
            <label style={lbl}>Title *</label>
            <input value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="e.g. School Fees Policy 2025" style={inp} />
          </div>
          <div style={field()}>
            <label style={lbl}>Category *</label>
            <select value={formCat} onChange={e => setFormCat(e.target.value)} style={inp}>
              {DOC_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </select>
          </div>
          <div style={field()}>
            <label style={lbl}>Visibility *</label>
            <div style={{ display:'flex', gap:8 }}>
              {DOC_VISIBILITIES.map(v => (
                <button key={v} onClick={() => setFormVis(v as typeof formVis)} style={{ flex:1, padding:'9px 4px', borderRadius:10, fontSize:12, fontWeight:700, cursor:'pointer', border:`2px solid ${formVis === v ? C.emerald : C.border}`, background: formVis === v ? C.emeraldLt : C.surface, color: formVis === v ? '#065f46' : C.muted }}>
                  {VISIBILITY_LABELS[v]}
                </button>
              ))}
            </div>
          </div>
          <div style={field(20)}>
            <label style={lbl}>File * (max {MAX_FILE_SIZE_MB}MB)</label>
            <div
              onClick={() => fileRef.current?.click()}
              style={{ border:`2px dashed ${formFile ? C.emerald : C.border}`, borderRadius:12, padding:'18px 12px', textAlign:'center', cursor:'pointer', background: formFile ? C.emeraldLt : C.bg }}
            >
              <div style={{ fontSize:28 }}>{formFile ? '✅' : '📤'}</div>
              <div style={{ fontSize:13, fontWeight:600, marginTop:6, color:C.text }}>{formFile ? formFile.name : 'Tap to select file'}</div>
              {!formFile && <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>PDF, DOCX, ZIP, PNG, MP4</div>}
            </div>
            <input ref={fileRef} type="file" accept=".pdf,.docx,.zip,.png,.mp4" style={{ display:'none' }} onChange={e => setFormFile(e.target.files?.[0] ?? null)} />
          </div>
          <button onClick={handleUpload} disabled={docUploading} style={{ width:'100%', background: docUploading ? C.muted : C.emerald, color:'#fff', border:'none', borderRadius:12, padding:14, fontWeight:800, fontSize:15, cursor: docUploading ? 'not-allowed' : 'pointer' }}>
            {docUploading ? 'Uploading…' : 'Upload Document'}
          </button>
          <button onClick={() => setShowDocModal(false)} style={{ width:'100%', background:'none', border:'none', color:C.muted, fontSize:14, marginTop:12, cursor:'pointer', padding:8 }}>Cancel</button>
        </BottomSheet>
      )}

      {/* Add Store Item */}
      {showAddItem && (
        <BottomSheet title="Add Store Item" onClose={() => setShowAddItem(false)}>
          {[
            { label:'Item Name *',       value:itemName,      set:setItemName,      placeholder:'e.g. A4 Paper Ream' },
            { label:'Unit',              value:itemUnit,      set:setItemUnit,      placeholder:'e.g. piece, box, litre' },
            { label:'Opening Qty',       value:itemQty,       set:setItemQty,       placeholder:'0', type:'number' },
            { label:'Low Stock Alert At',value:itemThreshold, set:setItemThreshold, placeholder:'5', type:'number' },
          ].map(f => (
            <div key={f.label} style={field()}>
              <label style={lbl}>{f.label}</label>
              <input value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder} type={f.type ?? 'text'} style={inp} />
            </div>
          ))}
          <div style={field(20)}>
            <label style={lbl}>Category *</label>
            <select value={itemCat} onChange={e => setItemCat(e.target.value)} style={inp}>
              {STORE_CATEGORIES.map(c => <option key={c} value={c}>{STORE_CAT_LABELS[c]}</option>)}
            </select>
          </div>
          <button onClick={handleAddItem} disabled={itemLoading} style={{ width:'100%', background: itemLoading ? C.muted : C.emerald, color:'#fff', border:'none', borderRadius:12, padding:14, fontWeight:800, fontSize:15, cursor: itemLoading ? 'not-allowed' : 'pointer' }}>
            {itemLoading ? 'Adding…' : 'Add Item'}
          </button>
          <button onClick={() => setShowAddItem(false)} style={{ width:'100%', background:'none', border:'none', color:C.muted, fontSize:14, marginTop:12, cursor:'pointer', padding:8 }}>Cancel</button>
        </BottomSheet>
      )}

      {/* Stock In / Out */}
      {showTxnModal && txnTarget && (
        <BottomSheet
          title={txnType === 'stock_in' ? '+ Stock In' : '− Stock Out'}
          subtitle={`${txnTarget.name} · Current: ${txnTarget.quantity} ${txnTarget.unit}`}
          onClose={() => setShowTxnModal(false)}
        >
          <div style={field()}>
            <label style={lbl}>Quantity *</label>
            <input value={txnQty} onChange={e => setTxnQty(e.target.value)} placeholder="0" type="number" min="1" style={inp} />
          </div>
          <div style={field()}>
            <label style={lbl}>Reference</label>
            <input value={txnRef} onChange={e => setTxnRef(e.target.value)} placeholder="e.g. LPO-001, Invoice #123" style={inp} />
          </div>
          {txnType === 'stock_out' && (
            <div style={field()}>
              <label style={lbl}>Issued To</label>
              <input value={txnIssuedTo} onChange={e => setTxnIssuedTo(e.target.value)} placeholder="e.g. Mr. Kamau, Class 4B" style={inp} />
            </div>
          )}
          <div style={field(20)}>
            <label style={lbl}>Notes</label>
            <input value={txnNotes} onChange={e => setTxnNotes(e.target.value)} placeholder="Optional notes" style={inp} />
          </div>
          <button onClick={handleTxn} disabled={txnLoading} style={{ width:'100%', background: txnLoading ? C.muted : txnType === 'stock_in' ? C.emerald : '#f59e0b', color:'#fff', border:'none', borderRadius:12, padding:14, fontWeight:800, fontSize:15, cursor: txnLoading ? 'not-allowed' : 'pointer' }}>
            {txnLoading ? 'Saving…' : txnType === 'stock_in' ? 'Confirm Stock In' : 'Confirm Stock Out'}
          </button>
          <button onClick={() => setShowTxnModal(false)} style={{ width:'100%', background:'none', border:'none', color:C.muted, fontSize:14, marginTop:12, cursor:'pointer', padding:8 }}>Cancel</button>
        </BottomSheet>
      )}

      {/* Add / Edit Asset */}
      {(showAddAsset || editAsset) && (
        <BottomSheet
          title={editAsset ? 'Edit Asset' : 'Add Asset'}
          onClose={() => { setShowAddAsset(false); setEditAsset(null); resetAssetForm() }}
        >
          <div style={field()}>
            <label style={lbl}>Name *</label>
            <input value={aName} onChange={e => setAName(e.target.value)} placeholder="e.g. Student Desk" style={inp} />
          </div>
          <div style={field()}>
            <label style={lbl}>Category *</label>
            <select value={aCat} onChange={e => setACat(e.target.value)} style={inp}>
              {ASSET_CATEGORIES.map(c => <option key={c} value={c}>{ASSET_CAT_LABELS[c]}</option>)}
            </select>
          </div>
          <div style={{ display:'flex', gap:10, marginBottom:14 }}>
            <div style={{ flex:1 }}>
              <label style={lbl}>Quantity</label>
              <input value={aQty} onChange={e => setAQty(e.target.value)} type="number" min="1" style={inp} />
            </div>
            <div style={{ flex:1 }}>
              <label style={lbl}>Condition</label>
              <select value={aCond} onChange={e => setACond(e.target.value as ResourceAsset['item_condition'])} style={inp}>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
                <option value="needs_repair">Needs Repair</option>
                <option value="condemned">Condemned</option>
              </select>
            </div>
          </div>
          <div style={field()}>
            <label style={lbl}>Location</label>
            <input value={aLocation} onChange={e => setALocation(e.target.value)} placeholder="e.g. Block A, Room 3" style={inp} />
          </div>
          <div style={field()}>
            <label style={lbl}>Serial No.</label>
            <input value={aSerial} onChange={e => setASerial(e.target.value)} placeholder="Optional" style={inp} />
          </div>
          <div style={field(20)}>
            <label style={lbl}>Last Checked</label>
            <input value={aLastChecked} onChange={e => setALastChecked(e.target.value)} type="date" style={inp} />
          </div>
          <button onClick={handleSaveAsset} disabled={assetLoading} style={{ width:'100%', background: assetLoading ? C.muted : C.emerald, color:'#fff', border:'none', borderRadius:12, padding:14, fontWeight:800, fontSize:15, cursor: assetLoading ? 'not-allowed' : 'pointer' }}>
            {assetLoading ? 'Saving…' : editAsset ? 'Save Changes' : 'Add Asset'}
          </button>
          <button onClick={() => { setShowAddAsset(false); setEditAsset(null); resetAssetForm() }} style={{ width:'100%', background:'none', border:'none', color:C.muted, fontSize:14, marginTop:12, cursor:'pointer', padding:8 }}>Cancel</button>
        </BottomSheet>
      )}

      {/* Add Book */}
      {showAddBook && (
        <BottomSheet title="Add Book" onClose={() => setShowAddBook(false)}>
          {[
            { label:'Title *',        value:bTitle,      set:setBTitle,      placeholder:'e.g. A Tale of Two Cities' },
            { label:'Author *',       value:bAuthor,     set:setBAuthor,     placeholder:'e.g. Charles Dickens' },
            { label:'ISBN',           value:bIsbn,       set:setBIsbn,       placeholder:'Optional' },
            { label:'Subject',        value:bSubject,    set:setBSubject,    placeholder:'e.g. English' },
            { label:'Class Level',    value:bClassLevel, set:setBClassLevel, placeholder:'e.g. Form 3' },
            { label:'No. of Copies',  value:bCopies,     set:setBCopies,     placeholder:'1', type:'number' },
          ].map(f => (
            <div key={f.label} style={field()}>
              <label style={lbl}>{f.label}</label>
              <input value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder} type={f.type ?? 'text'} style={inp} />
            </div>
          ))}
          <button onClick={handleAddBook} disabled={libActionLoading} style={{ width:'100%', background: libActionLoading ? C.muted : C.emerald, color:'#fff', border:'none', borderRadius:12, padding:14, fontWeight:800, fontSize:15, cursor: libActionLoading ? 'not-allowed' : 'pointer', marginTop:6 }}>
            {libActionLoading ? 'Adding…' : 'Add Book'}
          </button>
          <button onClick={() => setShowAddBook(false)} style={{ width:'100%', background:'none', border:'none', color:C.muted, fontSize:14, marginTop:12, cursor:'pointer', padding:8 }}>Cancel</button>
        </BottomSheet>
      )}

      {/* Issue Book */}
      {showIssueModal && issueTarget && (
        <BottomSheet
          title="Issue Book"
          subtitle={issueTarget.title}
          onClose={() => setShowIssueModal(false)}
        >
          <div style={field()}>
            <label style={lbl}>Borrower Type</label>
            <div style={{ display:'flex', gap:8 }}>
              {(['student','staff'] as const).map(t => (
                <button key={t} onClick={() => setBorrowerType(t)} style={{ flex:1, padding:'9px 4px', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer', border:`2px solid ${borrowerType === t ? C.emerald : C.border}`, background: borrowerType === t ? C.emeraldLt : C.surface, color: borrowerType === t ? '#065f46' : C.muted, textTransform:'capitalize' }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div style={field()}>
            <label style={lbl}>Borrower Name *</label>
            <input value={borrowerName} onChange={e => setBorrowerName(e.target.value)} placeholder="Full name" style={inp} />
          </div>
          <div style={field()}>
            <label style={lbl}>Due Date *</label>
            {/* FIX: max due date capped at 1 year out */}
            <input value={issueDue} onChange={e => setIssueDue(e.target.value)} type="date" min={today()} max={maxDueDate()} style={inp} />
          </div>
          <div style={field(20)}>
            <label style={lbl}>Condition Out</label>
            <select value={issueCondOut} onChange={e => setIssueCondOut(e.target.value)} style={inp}>
              {CONDITION_OPTIONS.map(c => <option key={c} value={c} style={{ textTransform:'capitalize' }}>{c}</option>)}
            </select>
          </div>
          <button onClick={handleIssueBook} disabled={libActionLoading} style={{ width:'100%', background: libActionLoading ? C.muted : C.emerald, color:'#fff', border:'none', borderRadius:12, padding:14, fontWeight:800, fontSize:15, cursor: libActionLoading ? 'not-allowed' : 'pointer' }}>
            {libActionLoading ? 'Issuing…' : 'Issue Book'}
          </button>
          <button onClick={() => setShowIssueModal(false)} style={{ width:'100%', background:'none', border:'none', color:C.muted, fontSize:14, marginTop:12, cursor:'pointer', padding:8 }}>Cancel</button>
        </BottomSheet>
      )}

      {/* Return Book */}
      {showReturnModal && returnTarget && (
        <BottomSheet
          title="Return Book"
          subtitle={returnTarget.book_title}
          onClose={() => setShowReturnModal(false)}
        >
          {isOverdue(returnTarget.due_date, null) && (
            <div style={{ background:'#fee2e2', color:'#b91c1c', borderRadius:12, padding:'10px 14px', marginBottom:14, fontSize:13, fontWeight:700 }}>
              ⏰ Overdue by {Math.floor((Date.now() - new Date(returnTarget.due_date).getTime()) / 86400000)} day(s) · Fine: KES {calcFine(returnTarget.due_date)}
            </div>
          )}
          <div style={field()}>
            <label style={lbl}>Condition Returned In</label>
            <select value={returnCondIn} onChange={e => setReturnCondIn(e.target.value)} style={inp}>
              {CONDITION_IN_OPTIONS.map(c => <option key={c} value={c} style={{ textTransform:'capitalize' }}>{c}</option>)}
            </select>
          </div>
          {isOverdue(returnTarget.due_date, null) && (
            <div style={field(20)}>
              <label style={lbl}>Fine Payment</label>
              <div style={{ display:'flex', gap:8 }}>
                {[false, true].map(paid => (
                  <button key={String(paid)} onClick={() => setReturnFinePaid(paid)} style={{ flex:1, padding:'9px 4px', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer', border:`2px solid ${returnFinePaid === paid ? C.emerald : C.border}`, background: returnFinePaid === paid ? C.emeraldLt : C.surface, color: returnFinePaid === paid ? '#065f46' : C.muted }}>
                    {paid ? '✅ Paid' : '❌ Unpaid'}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button onClick={handleReturnBook} disabled={libActionLoading} style={{ width:'100%', background: libActionLoading ? C.muted : C.emerald, color:'#fff', border:'none', borderRadius:12, padding:14, fontWeight:800, fontSize:15, cursor: libActionLoading ? 'not-allowed' : 'pointer' }}>
            {libActionLoading ? 'Processing…' : 'Confirm Return'}
          </button>
          <button onClick={() => setShowReturnModal(false)} style={{ width:'100%', background:'none', border:'none', color:C.muted, fontSize:14, marginTop:12, cursor:'pointer', padding:8 }}>Cancel</button>
        </BottomSheet>
      )}

      {/* ── Confirm Dialogs ── */}
      {deleteDocTarget && (
        <ConfirmDialog
          icon="🗑️" title="Remove Document?"
          message={`"${deleteDocTarget.title}" will be removed.`}
          confirmLabel="Remove"
          onCancel={() => setDeleteDocTarget(null)}
          onConfirm={() => handleDeleteDoc(deleteDocTarget)}
        />
      )}
      {deleteStoreTarget && (
        <ConfirmDialog
          icon="🗑️" title="Remove Item?"
          message={`"${deleteStoreTarget.name}" will be removed.`}
          confirmLabel="Remove"
          onCancel={() => setDeleteStoreTarget(null)}
          onConfirm={() => handleDeleteStoreItem(deleteStoreTarget)}
        />
      )}
      {deleteAssetTarget && (
        <ConfirmDialog
          icon="🗑️" title="Remove Asset?"
          message={`"${deleteAssetTarget.name}" will be removed.`}
          confirmLabel="Remove"
          onCancel={() => setDeleteAssetTarget(null)}
          onConfirm={() => handleDeleteAsset(deleteAssetTarget)}
        />
      )}
      {condemnTarget && (
        <ConfirmDialog
          icon="⚠️" title="Mark as Condemned?"
          message={`"${condemnTarget.name}" will be marked condemned. You can reverse this by editing.`}
          confirmLabel="Condemn"
          onCancel={() => setCondemnTarget(null)}
          onConfirm={() => handleCondemnAsset(condemnTarget)}
        />
      )}
      {deleteBookTarget && (
        <ConfirmDialog
          icon="🗑️" title="Remove Book?"
          message={`"${deleteBookTarget.title}" will be removed from the catalog.`}
          confirmLabel="Remove"
          onCancel={() => setDeleteBookTarget(null)}
          onConfirm={() => handleDeleteBook(deleteBookTarget)}
        />
      )}

    </div>
  )
}
