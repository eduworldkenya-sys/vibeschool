"use client"

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type StoreItem = {
  product_id: string
  publication_id: string
  sku: string
  product_type: string
  title: string
  description: string | null
  cover_url: string | null
  subject: string | null
  grade: string | null
  language: string | null
  chapter_count: number
  total_reads: number
  sample_available: boolean
  sample_chapters: number
  offer: {
    id: string
    offer_key: string
    pricing_model: string
    amount_kes: number
    access_days: number | null
    terms_version: string | null
  }
}

type StoreResponse = { ok?: boolean; items?: StoreItem[] }

const BG = '#090D16'
const SURFACE = '#111827'
const CARD = '#1a2235'
const ACCENT = '#CCFF00'
const TEXT = '#ffffff'
const MUTED = 'rgba(255,255,255,.55)'
const BORDER = 'rgba(255,255,255,.09)'

export default function LearningProductStorePage() {
  const router = useRouter()
  const [items, setItems] = useState<StoreItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [subject, setSubject] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data, error: loadError } = await supabase.rpc('commerce_list_storefront', {
        p_subject: null,
        p_grade: null,
        p_limit: 80,
      })
      if (cancelled) return
      if (loadError) {
        console.error('Learning Product catalogue failed', loadError)
        setError('The VibeSchool store is not available right now. Free learning remains available while commerce is offline.')
        setItems([])
      } else {
        const payload = (data ?? {}) as StoreResponse
        setItems(payload.items ?? [])
      }
      setLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [])

  const subjects = useMemo(() => Array.from(new Set(items.map(item => item.subject).filter(Boolean) as string[])).sort(), [items])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter(item => {
      if (subject && item.subject !== subject) return false
      if (!q) return true
      return [item.title,item.description,item.subject,item.grade].some(value => value?.toLowerCase().includes(q))
    })
  }, [items, query, subject])

  return <main style={{ minHeight:'100dvh', background:BG, color:TEXT, padding:'22px 16px 96px' }}>
    <div style={{ maxWidth:1040, margin:'0 auto' }}>
      <button type="button" onClick={() => router.push('/global')} style={{ background:'transparent',border:0,color:MUTED,padding:0,cursor:'pointer',fontWeight:700 }}>← VibeGlobal</button>
      <section style={{ margin:'24px 0 20px' }}>
        <div style={{ color:ACCENT,fontSize:11,fontWeight:900,letterSpacing:'.13em' }}>VIBESCHOOL LEARNING STORE</div>
        <h1 style={{ fontSize:'clamp(32px,7vw,58px)',lineHeight:1.02,letterSpacing:'-.045em',margin:'9px 0 12px' }}>Find it. Sample it. Own your access.</h1>
        <p style={{ color:MUTED,fontSize:15,lineHeight:1.65,maxWidth:760,margin:0 }}>Curriculum-linked Learning Products with transparent Kenyan pricing. When a sample is available, it uses the same reader and access rules as the full publication. Paid access is granted only after M-Pesa confirms payment.</p>
      </section>

      <div style={{ display:'grid',gridTemplateColumns:'minmax(0,1fr) auto',gap:10,margin:'24px 0' }}>
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search title, subject or grade" aria-label="Search Learning Products" style={{ minHeight:48,borderRadius:13,border:`1px solid ${BORDER}`,background:SURFACE,color:TEXT,padding:'0 14px',fontSize:14,outline:'none' }}/>
        <button type="button" onClick={() => { setQuery('');setSubject(null) }} style={{ minHeight:48,borderRadius:13,border:`1px solid ${BORDER}`,background:SURFACE,color:TEXT,padding:'0 15px',fontWeight:800,cursor:'pointer' }}>Reset</button>
      </div>

      {subjects.length > 0 && <div style={{ display:'flex',gap:8,overflowX:'auto',paddingBottom:12 }}>
        <button type="button" onClick={() => setSubject(null)} style={chip(subject === null)}>All</button>
        {subjects.map(item => <button type="button" key={item} onClick={() => setSubject(subject === item ? null : item)} style={chip(subject === item)}>{item}</button>)}
      </div>}

      {loading && <div style={{ padding:'48px 0',color:MUTED }}>Loading Learning Products…</div>}
      {!loading && error && <section style={{ background:CARD,border:`1px solid ${BORDER}`,borderRadius:18,padding:22 }}><strong>Store temporarily unavailable</strong><p style={{ color:MUTED,lineHeight:1.6,marginBottom:0 }}>{error}</p></section>}
      {!loading && !error && filtered.length === 0 && <section style={{ background:CARD,border:`1px solid ${BORDER}`,borderRadius:18,padding:24 }}><strong>No paid Learning Products are live yet.</strong><p style={{ color:MUTED,lineHeight:1.6,marginBottom:0 }}>VibeSchool does not manufacture a catalogue by charging for content before its rights and offer are explicitly cleared. Continue using the free learning library while paid releases are prepared.</p></section>}

      <section style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(250px,1fr))',gap:14,marginTop:18 }}>
        {filtered.map(item => <article key={item.product_id} style={{ background:CARD,border:`1px solid ${BORDER}`,borderRadius:20,overflow:'hidden',display:'flex',flexDirection:'column' }}>
          <div style={{ aspectRatio:'16/9',background:SURFACE,overflow:'hidden' }}>{item.cover_url ? <img src={item.cover_url} alt="" style={{ width:'100%',height:'100%',objectFit:'cover' }}/> : <div style={{ width:'100%',height:'100%',display:'grid',placeItems:'center',color:'rgba(255,255,255,.2)',fontSize:48 }}>V</div>}</div>
          <div style={{ padding:18,display:'flex',flexDirection:'column',gap:10,flex:1 }}>
            <div style={{ display:'flex',gap:7,flexWrap:'wrap' }}>{item.subject && <span style={tag}>{item.subject}</span>}{item.grade && <span style={tag}>{item.grade}</span>}</div>
            <h2 style={{ fontSize:19,lineHeight:1.25,margin:0 }}>{item.title}</h2>
            {item.description && <p style={{ color:MUTED,fontSize:13,lineHeight:1.55,margin:0,display:'-webkit-box',WebkitLineClamp:3,WebkitBoxOrient:'vertical',overflow:'hidden' }}>{item.description}</p>}
            <div style={{ marginTop:'auto',paddingTop:10 }}>
              <div style={{ fontSize:23,fontWeight:950 }}>KES {item.offer.amount_kes.toLocaleString('en-KE')}</div>
              <div style={{ color:MUTED,fontSize:11,marginTop:3 }}>{item.offer.access_days ? `${item.offer.access_days} days access` : 'One-time access'} · {item.chapter_count || 0} chapters</div>
              <div style={{ display:'grid',gridTemplateColumns:item.sample_available?'1fr 1.3fr':'1fr',gap:8,marginTop:14 }}>
                {item.sample_available && <button type="button" onClick={() => router.push(`/read/textbook/${item.publication_id}`)} style={secondaryButton}>Sample {item.sample_chapters > 0 ? `${item.sample_chapters} chapter${item.sample_chapters === 1 ? '' : 's'}` : ''}</button>}
                <button type="button" onClick={() => router.push(`/learn/purchase/${item.publication_id}`)} style={primaryButton}>Unlock with M-Pesa</button>
              </div>
            </div>
          </div>
        </article>)}
      </section>
    </div>
  </main>
}

function chip(active:boolean): CSSProperties { return { flexShrink:0,borderRadius:999,border:`1px solid ${active?ACCENT:BORDER}`,background:active?'rgba(204,255,0,.1)':SURFACE,color:active?ACCENT:TEXT,padding:'9px 13px',fontWeight:800,cursor:'pointer' } }
const tag: CSSProperties = { fontSize:10,fontWeight:850,letterSpacing:'.06em',textTransform:'uppercase',color:ACCENT,background:'rgba(204,255,0,.08)',border:'1px solid rgba(204,255,0,.16)',borderRadius:999,padding:'5px 8px' }
const primaryButton: CSSProperties = { minHeight:44,border:0,borderRadius:11,background:ACCENT,color:'#090D16',fontWeight:950,cursor:'pointer',padding:'0 12px' }
const secondaryButton: CSSProperties = { minHeight:44,borderRadius:11,border:`1px solid ${BORDER}`,background:SURFACE,color:TEXT,fontWeight:850,cursor:'pointer',padding:'0 12px' }
