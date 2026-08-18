"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type ProductRow = {
  product_id: string
  title: string
  orders: number
  fulfilled_orders: number
  buyers: number
  gross_revenue_kes: number
  active_entitlements: number
  publication_views: number
  reconciliation_required: number
  refunds: number
}

type Analytics = {
  ok?: boolean
  from?: string
  to?: string
  totals?: {
    days?: number
    product_count?: number
    orders?: number
    fulfilled_orders?: number
    buyers?: number
    gross_revenue_kes?: number
    active_entitlements?: number
    publication_views?: number
    reconciliation_required?: number
    refunds?: number
  }
  products?: ProductRow[]
}

const BG='#090D16', SURFACE='#111827', CARD='#1a2235', ACCENT='#CCFF00', TEXT='#fff', MUTED='rgba(255,255,255,.55)', BORDER='rgba(255,255,255,.09)'

export default function PublisherRevenuePage(){
  const router=useRouter()
  const [days,setDays]=useState(30)
  const [data,setData]=useState<Analytics|null>(null)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')

  useEffect(()=>{
    let cancelled=false
    async function load(){
      setLoading(true);setError('')
      const {data:{user}}=await supabase.auth.getUser()
      if(cancelled)return
      if(!user){router.replace('/global/signup');return}
      const {data:result,error:loadError}=await supabase.rpc('commerce_get_my_publisher_analytics',{p_days:days})
      if(cancelled)return
      if(loadError){console.error('Publisher revenue analytics failed',loadError);setError('Revenue analytics are not available yet.');setData(null)}
      else setData((result??{}) as Analytics)
      setLoading(false)
    }
    void load()
    return()=>{cancelled=true}
  },[days,router])

  const totals=data?.totals??{}
  const products=data?.products??[]
  const conversion=(totals.publication_views??0)>0?(((totals.fulfilled_orders??0)/(totals.publication_views??1))*100).toFixed(1):'—'

  return <main style={{minHeight:'100dvh',background:BG,color:TEXT,padding:'22px 16px 96px'}}><div style={{maxWidth:1040,margin:'0 auto'}}>
    <button type="button" onClick={()=>router.push('/global')} style={{background:'transparent',border:0,color:MUTED,padding:0,cursor:'pointer',fontWeight:750}}>← VibeGlobal</button>
    <section style={{margin:'24px 0'}}><div style={{color:ACCENT,fontSize:11,fontWeight:900,letterSpacing:'.13em'}}>PUBLISHER REVENUE</div><h1 style={{fontSize:'clamp(32px,7vw,56px)',lineHeight:1.02,letterSpacing:'-.045em',margin:'9px 0 12px'}}>Money follows verified access.</h1><p style={{color:MUTED,maxWidth:760,lineHeight:1.65,margin:0}}>Revenue is derived from fulfilled Learning Product orders and durable entitlements, not editable publication counters. Payment exceptions stay visible instead of being hidden inside a sales total.</p></section>

    <div style={{display:'flex',gap:8,marginBottom:18}}>{[7,30,90,365].map(value=><button key={value} type="button" onClick={()=>setDays(value)} style={{borderRadius:999,border:`1px solid ${days===value?ACCENT:BORDER}`,background:days===value?'rgba(204,255,0,.1)':SURFACE,color:days===value?ACCENT:TEXT,padding:'9px 13px',fontWeight:850,cursor:'pointer'}}>{value===365?'1 year':`${value} days`}</button>)}</div>

    {loading&&<div style={{color:MUTED,padding:'36px 0'}}>Calculating revenue from commerce ledgers…</div>}
    {!loading&&error&&<div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:16,padding:20}}>{error}</div>}
    {!loading&&!error&&<>
      <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:10}}>
        <Metric label="Gross revenue" value={`KES ${(totals.gross_revenue_kes??0).toLocaleString('en-KE')}`}/>
        <Metric label="Paid orders" value={String(totals.fulfilled_orders??0)}/>
        <Metric label="Buyers" value={String(totals.buyers??0)}/>
        <Metric label="Active access" value={String(totals.active_entitlements??0)}/>
        <Metric label="Publication views" value={String(totals.publication_views??0)}/>
        <Metric label="View → paid" value={`${conversion}${conversion==='—'?'':'%'}`}/>
      </section>

      <section style={{marginTop:18,background:CARD,border:`1px solid ${BORDER}`,borderRadius:18,padding:18}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:14,alignItems:'center',marginBottom:14}}><div><strong>Payment health</strong><div style={{color:MUTED,fontSize:12,marginTop:3}}>Anything uncertain stays outside revenue until reconciled.</div></div><div style={{display:'flex',gap:12,fontSize:12}}><span style={{color:(totals.reconciliation_required??0)>0?'#f59e0b':MUTED}}>Reconcile: {totals.reconciliation_required??0}</span><span style={{color:MUTED}}>Refunds: {totals.refunds??0}</span></div></div>
      </section>

      <section style={{marginTop:18}}><h2 style={{fontSize:17}}>Products</h2>{products.length===0?<div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:16,padding:20,color:MUTED}}>No commercial Learning Products are owned by this account yet.</div>:<div style={{display:'grid',gap:10}}>{products.map(row=><article key={row.product_id} style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:16,padding:17}}><div style={{display:'flex',justifyContent:'space-between',gap:14,alignItems:'flex-start'}}><div><strong>{row.title}</strong><div style={{color:MUTED,fontSize:12,marginTop:5}}>{row.publication_views} views · {row.fulfilled_orders} paid · {row.active_entitlements} active access</div></div><div style={{fontSize:18,fontWeight:950,color:ACCENT,whiteSpace:'nowrap'}}>KES {row.gross_revenue_kes.toLocaleString('en-KE')}</div></div>{row.reconciliation_required>0&&<div style={{marginTop:9,color:'#f59e0b',fontSize:12}}>{row.reconciliation_required} payment{row.reconciliation_required===1?'':'s'} require reconciliation.</div>}</article>)}</div>}</section>
    </>}
  </div></main>
}

function Metric({label,value}:{label:string;value:string}){return <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:16,padding:16}}><div style={{color:MUTED,fontSize:10,fontWeight:850,letterSpacing:'.08em',textTransform:'uppercase'}}>{label}</div><div style={{fontSize:22,fontWeight:950,marginTop:7}}>{value}</div></div>}
