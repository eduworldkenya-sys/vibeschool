'use client'
import {useEffect,useState} from 'react'
import Link from 'next/link'
import {useParams} from 'next/navigation'
import {supabase} from '@/lib/supabase'

type Settings={
  age_band:'junior'|'primary'|'teen'
  focus_recommended:boolean
  quiet_hours_enabled:boolean
  quiet_start:string
  quiet_end:string
  study_target_minutes:number
  community_allowed:boolean
  messages_allowed:boolean
  purchase_approval_required:boolean
  progress_summary_enabled:boolean
}
const defaults:Settings={age_band:'primary',focus_recommended:false,quiet_hours_enabled:false,quiet_start:'21:00',quiet_end:'07:00',study_target_minutes:60,community_allowed:false,messages_allowed:false,purchase_approval_required:true,progress_summary_enabled:true}
const pane:React.CSSProperties={background:'var(--vs-card,#fff)',border:'1px solid var(--vs-border,#e2e8f0)',borderRadius:16,padding:18,display:'grid',gap:14}
export default function ParentChildControls(){
 const params=useParams()
 const studentId=typeof params.id==='string'?params.id:''
 const [settings,setSettings]=useState<Settings>(defaults)
 const [authorized,setAuthorized]=useState(false)
 const [loading,setLoading]=useState(true)
 const [saving,setSaving]=useState(false)
 const [status,setStatus]=useState('')
 useEffect(()=>{let active=true;(async()=>{
   const {data:{user}}=await supabase.auth.getUser()
   if(!user||!studentId){if(active)setLoading(false);return}
   const {data:link,error:linkError}=await supabase.from('parent_student_links').select('student_id,access_level').eq('student_id',studentId).eq('parent_id',user.id).neq('access_level','none').limit(1).maybeSingle()
   if(!active)return
   if(linkError||!link){setStatus('No authorized guardian link was found.');setLoading(false);return}
   const {data,error}=await supabase.from('learner_parent_controls').select('*').eq('student_id',studentId).maybeSingle()
   if(!active)return
   if(error){setStatus('Parent controls are not available yet. Check the database rollout.');setLoading(false);return}
   if(data)setSettings({...defaults,...data})
   setAuthorized(true);setLoading(false)
 })();return()=>{active=false}},[studentId])
 function toggle(key:keyof Settings){setSettings(v=>({...v,[key]:!v[key]}))}
 async function save(){
   setSaving(true);setStatus('')
   const {data:{user}}=await supabase.auth.getUser()
   if(!user||!authorized){setStatus('Parent authorization is required.');setSaving(false);return}
   const {error}=await supabase.from('learner_parent_controls').upsert({student_id:studentId,updated_by:user.id,...settings,updated_at:new Date().toISOString()},{onConflict:'student_id'})
   setStatus(error?'Could not save: '+error.message:'Preferences saved for this linked learner.')
   setSaving(false)
 }
 const Toggle=({id,label,detail}:{id:keyof Settings,label:string,detail:string})=><label style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,borderTop:'1px solid var(--vs-border,#e2e8f0)',paddingTop:12}}><span><strong>{label}</strong><small style={{display:'block',opacity:.75,marginTop:4}}>{detail}</small></span><input type="checkbox" checked={Boolean(settings[id])} onChange={()=>toggle(id)} style={{width:22,height:22}}/></label>
 return <main style={{maxWidth:760,margin:'0 auto',padding:'24px 16px 90px',display:'grid',gap:16,color:'var(--vs-text,#14253a)'}}>
   <Link href="/parent/students">← My children</Link>
   <header><p style={{fontWeight:700,letterSpacing:1,fontSize:12}}>VIBESCHOOL FAMILY</p><h1 style={{fontSize:28,margin:'4px 0'}}>Parent Controls</h1><p>Support a safe, independent learning experience. Core lessons, practice and exams remain accessible.</p></header>
   {loading?<p role="status">Checking your guardian relationship…</p>:!authorized?<p role="alert">{status||'Parent access unavailable.'}</p>:<>
   <section style={pane}><h2>Learning routine</h2>
     <label>Guidance level <select value={settings.age_band} onChange={e=>setSettings(v=>({...v,age_band:e.target.value as Settings['age_band']}))} style={{display:'block',padding:12,width:'100%',marginTop:8}}><option value="junior">Junior · More guidance</option><option value="primary">Primary · Guided independence</option><option value="teen">Teen · More independence</option></select></label>
     <Toggle id="focus_recommended" label="Recommend Focus Mode" detail="Encourage fewer distractions; the learner can continue their work."/>
     <Toggle id="quiet_hours_enabled" label="Quiet hours" detail="Preference for a calmer routine, not a device-level lock."/>
     {settings.quiet_hours_enabled&&<div style={{display:'flex',gap:12,flexWrap:'wrap'}}><label>From <input type="time" value={settings.quiet_start.slice(0,5)} onChange={e=>setSettings(v=>({...v,quiet_start:e.target.value}))}/></label><label>Until <input type="time" value={settings.quiet_end.slice(0,5)} onChange={e=>setSettings(v=>({...v,quiet_end:e.target.value}))}/></label></div>}
     <label>Daily study target: {settings.study_target_minutes} minutes<input style={{display:'block',width:'100%'}} type="range" min={15} max={240} step={15} value={settings.study_target_minutes} onChange={e=>setSettings(v=>({...v,study_target_minutes:Number(e.target.value)}))}/></label>
   </section>
   <section style={pane}><h2>Privacy & permissions</h2>
     <Toggle id="community_allowed" label="Community participation preference" detail="Only where a moderated feature is available; not an access grant."/>
     <Toggle id="messages_allowed" label="Messaging preference" detail="Does not override platform safeguarding or messaging authorization."/>
     <Toggle id="purchase_approval_required" label="Require purchase approval" detail="Preference recorded here; checkout enforcement needs separate integration."/>
     <Toggle id="progress_summary_enabled" label="Parent learning summaries" detail="Use the existing learner Reports, not duplicate academic records."/>
   </section>
   <p style={{fontSize:13,opacity:.8}}>These are saved guardian preferences. They do not block external apps, grant school access, replace consent, or enforce payment and community permissions until connected to those services.</p>
   <button type="button" disabled={saving} onClick={()=>void save()} style={{padding:'15px 20px',borderRadius:12,border:0,background:'var(--vs-accent,#176b4a)',color:'white',fontWeight:700}}>{saving?'Saving…':'Save parent preferences'}</button>
   {status&&<p role="status">{status}</p>}
   </>}
 </main>
}
