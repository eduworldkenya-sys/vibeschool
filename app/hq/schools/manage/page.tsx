'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { HQPage, HQPanel } from '@/components/hq/HQShell'
import { hqSupabase } from '@/lib/hq/supabase'

type Entry={id:string;name:string;county:string|null;sub_county:string|null;school_level:string|null;latitude:number|null;longitude:number|null;slug:string|null}
type Patch={id:string;county?:string;sub_county?:string;type?:string;latitude?:number;longitude?:number}
export default function HQSchoolDirectoryManage(){
 const [query,setQuery]=useState('')
 const [rows,setRows]=useState<Entry[]>([])
 const [selected,setSelected]=useState<Entry|null>(null)
 const [county,setCounty]=useState('')
 const [sub,setSub]=useState('')
 const [level,setLevel]=useState('')
 const [lat,setLat]=useState('')
 const [lng,setLng]=useState('')
 const [batch,setBatch]=useState('')
 const [note,setNote]=useState('')
 const [busy,setBusy]=useState(false)
 const [message,setMessage]=useState('')
 useEffect(()=>{if(query.trim().length<2){setRows([]);return}
  let live=true;const timeout=setTimeout(()=>{
   void hqSupabase.rpc('hq_school_directory_manage_search_v1',{p_query:query.trim(),p_limit:30})
    .then(({data,error})=>{if(live){setRows(error?[]:(data||[]) as Entry[]);if(error)setMessage('Search unavailable or HQ owner permission required.')}})
  },240);return()=>{live=false;clearTimeout(timeout)}
 },[query])
 function pick(s:Entry){setSelected(s);setCounty(s.county||'');setSub(s.sub_county||'');setLevel(s.school_level||'');setLat(s.latitude==null?'':String(s.latitude));setLng(s.longitude==null?'':String(s.longitude));setMessage('')}
 async function apply(changes:Patch[]){
  setMessage('')
  if(note.trim().length<10){setMessage('Add an evidence note of at least 10 characters.');return}
  if(!changes.length||changes.length>100){setMessage('Select 1–100 changes.');return}
  if(!window.confirm('Apply '+changes.length+' audited school directory correction(s)?'))return
  setBusy(true)
  const {data,error}=await hqSupabase.rpc('hq_school_directory_apply_edits_v1',{p_changes:changes,p_evidence_note:note.trim()})
  setBusy(false);setMessage(error?'Correction not applied: '+error.message:String(data)+' record(s) updated and logged.')
  if(!error){setSelected(null);setQuery('');setBatch('')}
 }
 function saveOne(){
  if(!selected)return
  const change:Patch={id:selected.id}
  if(county.trim()!== (selected.county||''))change.county=county.trim()
  if(sub.trim()!== (selected.sub_county||''))change.sub_county=sub.trim()
  if(level.trim()!== (selected.school_level||''))change.type=level.trim()
  const a=lat.trim(),b=lng.trim()
  if(a!==String(selected.latitude??'')||b!==String(selected.longitude??'')){
   if(!a||!b||!Number.isFinite(Number(a))||!Number.isFinite(Number(b))){setMessage('Enter both valid coordinates.');return}
   change.latitude=Number(a);change.longitude=Number(b)
  }
  if(Object.keys(change).length===1){setMessage('No changes to apply.');return}
  void apply([change])
 }
 function applyBatch(){let parsed:unknown
  try{parsed=JSON.parse(batch)}catch{setMessage('Bulk changes must be valid JSON.');return}
  if(!Array.isArray(parsed)||parsed.some(x=>!x||typeof x!=='object'||typeof x.id!=='string')){setMessage('Use an array of school ID and field patches.');return}
  void apply(parsed as Patch[])
 }
 const field:React.CSSProperties={display:'grid',gap:6,fontSize:13}
 const input:React.CSSProperties={padding:11,borderRadius:10,border:'1px solid #526477',background:'#152235',color:'white',width:'100%'}
 return <HQPage title="School directory corrections" description="Owner-only corrections with permanent before/after audit records. School identities, verification flags and slugs are not editable here.">
  <div style={{display:'grid',gap:16}}>
   <Link href="/hq/schools" style={{color:'#93c5fd'}}>Back to Schools HQ</Link>
   <HQPanel title="Find directory record" description="Search the existing school directory. Review exact school and county before editing.">
    <div style={{padding:16,display:'grid',gap:12}}>
     <input aria-label="Search schools" style={input} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search school name (2+ characters)"/>
     <div style={{display:'grid',gap:8}}>{rows.map(s=><button key={s.id} onClick={()=>pick(s)} style={{...input,textAlign:'left',cursor:'pointer'}}>
      <strong>{s.name}</strong> · {[s.sub_county,s.county].filter(Boolean).join(', ')}
      <small style={{display:'block',opacity:.7}}>{s.id} {s.slug?'· /school/'+s.slug:''}</small>
     </button>)}</div>
    </div>
   </HQPanel>
   {selected&&<HQPanel title={'Correct: '+selected.name} description="Only geography, school level and approximate coordinates can be changed.">
    <div style={{display:'grid',gap:12,padding:16}}>
     <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:10}}>
      <label style={field}>County<input style={input} value={county} onChange={e=>setCounty(e.target.value)}/></label>
      <label style={field}>Sub-county<input style={input} value={sub} onChange={e=>setSub(e.target.value)}/></label>
      <label style={field}>School level<input style={input} value={level} onChange={e=>setLevel(e.target.value)}/></label>
      <label style={field}>Latitude<input style={input} inputMode="decimal" value={lat} onChange={e=>setLat(e.target.value)}/></label>
      <label style={field}>Longitude<input style={input} inputMode="decimal" value={lng} onChange={e=>setLng(e.target.value)}/></label>
     </div>
     <button disabled={busy} style={{...input,cursor:'pointer',textAlign:'center'}} onClick={saveOne}>Save audited correction</button>
    </div>
   </HQPanel>}
   <HQPanel title="Bulk corrections" description="Optional advanced tool: provide a JSON array of up to 100 records, each with id and approved fields. All changes share the evidence note below.">
    <div style={{display:'grid',gap:10,padding:16}}>
     <textarea aria-label="Bulk correction JSON" style={{...input,minHeight:100}} value={batch} onChange={e=>setBatch(e.target.value)}
      placeholder={'[{"id":"school-uuid","sub_county":"Corrected name"}]'}/>
     <button disabled={busy||!batch.trim()} style={{...input,cursor:'pointer'}} onClick={applyBatch}>Review and apply bulk corrections</button>
    </div>
   </HQPanel>
   <label style={field}>Evidence / reason for correction (required)<textarea style={{...input,minHeight:85}} value={note} onChange={e=>setNote(e.target.value)} placeholder="Source, observation date and reason for these changes"/></label>
   {message&&<p role="status" style={{color:'#fcd34d',fontSize:13}}>{message}</p>}
  </div>
 </HQPage>
}
