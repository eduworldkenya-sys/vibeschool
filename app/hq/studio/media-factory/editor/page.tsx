"use client"

import Link from "next/link"
import {useMemo,useState} from "react"
import {hqSupabase} from "@/lib/hq/supabase"
import {HQPage,HQPanel,HQ_THEME as C,hqButtonStyle} from "@/components/hq/HQShell"

type Tab="brief"|"production"|"review"
type Brief={id:string;title:string;hook:string;message:string;cta:string;format:string;duration:string}
type Persisted={artifactId:string;versionId:string}

const formats=["Vertical short","Revision clip","Lesson visual","Campaign creative"] as const
const audiences=["Form 1","Form 2","Form 3","Form 4","Teachers","Parents"] as const
const subjects=["Chemistry","Mathematics","English","Biology","Physics","General"] as const

function makeBriefs(insight:string):Brief[]{
 const signal=insight.trim()||"Growth has identified a promising education signal"
 return [
  {id:"hook",title:"Lead with the signal",hook:"You have 45 seconds to solve this.",message:`Turn this Growth signal into a direct learner payoff: ${signal}`,cta:"Try the full lesson on VibeSchool",format:"Vertical short",duration:"45 sec"},
  {id:"proof",title:"Show the proof",hook:"Most learners miss this one step.",message:`Demonstrate the concept clearly, then connect it to the measured signal: ${signal}`,cta:"Revise the topic on VibeSchool",format:"Revision clip",duration:"60 sec"},
  {id:"school",title:"School-gate conversion",hook:"Before your next lesson, test yourself on this.",message:`Create a practical school-facing asset inspired by: ${signal}`,cta:"Scan to continue on VibeSchool",format:"Campaign creative",duration:"Static / 30 sec"},
 ]
}

export default function MediaFactoryEditorPage(){
 const[tab,setTab]=useState<Tab>("brief")
 const[insight,setInsight]=useState("")
 const[briefs,setBriefs]=useState<Brief[]>([])
 const[title,setTitle]=useState("")
 const[hook,setHook]=useState("")
 const[message,setMessage]=useState("")
 const[cta,setCta]=useState("")
 const[format,setFormat]=useState<(typeof formats)[number]>("Vertical short")
 const[audience,setAudience]=useState<(typeof audiences)[number]>("Form 4")
 const[subject,setSubject]=useState<(typeof subjects)[number]>("Chemistry")
 const[topic,setTopic]=useState("")
 const[duration,setDuration]=useState("45 sec")
 const[productionNotes,setProductionNotes]=useState("")
 const[copyright,setCopyright]=useState(false)
 const[curriculum,setCurriculum]=useState(false)
 const[brand,setBrand]=useState(false)
 const[dirty,setDirty]=useState(false)
 const[artifactId,setArtifactId]=useState<string|null>(null)
 const[versionId,setVersionId]=useState<string|null>(null)
 const[saving,setSaving]=useState(false)
 const[submitted,setSubmitted]=useState(false)
 const[error,setError]=useState("")
 const[savedAt,setSavedAt]=useState<Date|null>(null)
 const ready=title.trim().length>2&&hook.trim().length>5&&message.trim().length>8&&cta.trim().length>2&&copyright&&curriculum&&brand
 const completion=useMemo(()=>[title,hook,message,cta,topic].filter(v=>v.trim()).length,[title,hook,message,cta,topic])
 function touch(){setDirty(true);setSubmitted(false)}
 function loadBrief(b:Brief){setTitle(b.title);setHook(b.hook);setMessage(b.message);setCta(b.cta);setFormat(b.format as (typeof formats)[number]);setDuration(b.duration);touch();setTab("brief")}
 function updateFormat(v:(typeof formats)[number]){setFormat(v);if(v==="Vertical short")setDuration("45 sec");if(v==="Campaign creative")setDuration("Static");touch()}
 function structuredContent(){return {schema:"vibeschool.media-factory.asset.v1",source:{kind:"growth-intelligence",insight:insight.trim()||null},brief:{title:title.trim(),audience,subject,topic:topic.trim()||null,hook:hook.trim(),core_message:message.trim(),cta:cta.trim(),format,duration},production:{notes:productionNotes.trim()||null},preflight:{copyright_cleared:copyright,curriculum_aligned:curriculum,brand_compliant:brand},authority:{publishing:"governed",distribution_owner:"Growth Command",direct_publish:false}}}
 async function saveDraft():Promise<Persisted|null>{
  if(title.trim().length<3){setError("Add an asset title before saving the governed draft.");setTab("brief");return null}
  setSaving(true);setError("")
  try{
   let id=artifactId
   if(!id){
    const artifactKey=`media-${new Date().toISOString().slice(0,10)}-${crypto.randomUUID()}`
    const created=await hqSupabase.rpc("hq_library_create_artifact",{p_artifact_key:artifactKey,p_title:title.trim(),p_artifact_type:"media-production-asset",p_department_key:"content",p_purpose:"Governed Studio Media Factory production asset",p_confidentiality:"internal",p_metadata:{studio_surface:"media-factory",format,audience,subject,topic:topic.trim()||null,growth_insight:insight.trim()||null}})
    if(created.error)throw created.error
    id=created.data as string
    setArtifactId(id)
   }
   const version=await hqSupabase.rpc("hq_library_add_version",{p_artifact_id:id,p_structured_content:structuredContent(),p_storage_bucket:null,p_storage_path:null,p_mime_type:"application/vnd.vibeschool.media-factory+json",p_byte_size:null,p_content_hash:null,p_change_summary:versionId?"Media Factory draft update":"Initial Media Factory draft",p_worker_id:null,p_source_run_id:null,p_promote:true})
   if(version.error)throw version.error
   const nextVersion=version.data as string
   setVersionId(nextVersion);setDirty(false);setSavedAt(new Date());return{artifactId:id,versionId:nextVersion}
  }catch(e){setError(e instanceof Error?e.message:"Media draft could not be saved");return null}finally{setSaving(false)}
 }
 async function submitForReview(){
  if(!ready||saving)return
  setError("")
  const persisted=dirty||!artifactId||!versionId?await saveDraft():{artifactId,versionId}
  if(!persisted)return
  setSaving(true)
  try{
   const review=await hqSupabase.rpc("hq_library_request_approval",{p_artifact_id:persisted.artifactId,p_version_id:persisted.versionId,p_decision_id:null,p_notes:"Submitted from HQ Studio Media Factory after copyright, curriculum and brand pre-flight checks."})
   if(review.error)throw review.error
   setSubmitted(true);setDirty(false);setSavedAt(new Date())
  }catch(e){setError(e instanceof Error?e.message:"Governance review could not be requested")}finally{setSaving(false)}
 }
 return <HQPage title="Media Factory Editor" description="Build media briefs and production-ready assets from Growth intelligence without bypassing governance." actions={<><Link href="/hq/studio/media-factory" style={{...hqButtonStyle,textDecoration:"none"}}>← Media Factory</Link><button style={hqButtonStyle} disabled={saving||submitted} onClick={()=>void saveDraft()}>{saving?"Saving…":dirty||!artifactId?"Save governed draft":savedAt?`Saved ${savedAt.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}`:"Saved"}</button></>}>
  <style jsx>{`
   .notice{margin-bottom:12px;padding:11px 13px;border:1px solid rgba(96,165,250,.2);border-radius:12px;background:rgba(59,130,246,.055);font-size:11px;line-height:1.55;color:#bfdbfe}.error{margin-bottom:12px;padding:11px 13px;border:1px solid rgba(244,63,94,.28);border-radius:12px;background:rgba(244,63,94,.06);font-size:11px;color:#fecdd3}.layout{display:grid;grid-template-columns:minmax(240px,.72fr) minmax(0,1.55fr) minmax(250px,.78fr);gap:12px}.pad{padding:14px}.label{display:block;font-size:9px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#7890aa;margin:13px 0 6px}.field,.select,.area{width:100%;box-sizing:border-box;border:1px solid rgba(148,163,184,.14);background:#091523;color:#f8fafc;border-radius:10px;padding:10px;font:inherit;font-size:11px;outline:none}.area{min-height:86px;resize:vertical;line-height:1.5}.field:focus,.select:focus,.area:focus{border-color:rgba(96,165,250,.55);box-shadow:0 0 0 3px rgba(59,130,246,.08)}.generate{width:100%;margin-top:10px;border:1px solid rgba(129,140,248,.35);background:linear-gradient(135deg,#2563eb,#7c3aed);color:white;border-radius:10px;padding:10px;font-size:11px;font-weight:900;cursor:pointer}.cyborg{margin-top:9px;padding:9px;border:1px solid rgba(251,191,36,.18);border-radius:10px;background:rgba(245,158,11,.05);color:#fcd34d;font-size:9.5px;line-height:1.45}.brief{margin-top:9px;padding:11px;border:1px solid rgba(148,163,184,.12);border-radius:11px;background:rgba(255,255,255,.02)}.brief b{font-size:11px}.brief p{font-size:9.5px;color:#8fa2ba;line-height:1.45;margin:5px 0}.load{border:0;background:transparent;color:#93c5fd;padding:0;font-size:9.5px;font-weight:900;cursor:pointer}.tabs{display:flex;gap:6px;padding:12px;border-bottom:1px solid rgba(148,163,184,.1)}.tab{border:1px solid rgba(148,163,184,.12);background:transparent;color:#8fa2ba;border-radius:999px;padding:7px 10px;font-size:10px;font-weight:850;cursor:pointer}.active{background:rgba(59,130,246,.12);border-color:rgba(96,165,250,.35);color:#dbeafe}.two{display:grid;grid-template-columns:1fr 1fr;gap:9px}.upload{margin-top:12px;min-height:180px;border:1px dashed rgba(148,163,184,.25);border-radius:14px;display:grid;place-items:center;text-align:center;color:#7890aa;padding:20px}.upload strong{display:block;color:#dbeafe;font-size:12px;margin-bottom:5px}.check{display:flex;gap:9px;align-items:flex-start;padding:10px 0;border-bottom:1px solid rgba(148,163,184,.08);font-size:10.5px;color:#a9bacd}.check input{margin-top:1px}.status{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid rgba(148,163,184,.08);font-size:10px}.status span{color:#8295ab}.ok{color:#86efac}.warn{color:#fcd34d}.submit{width:100%;margin-top:13px;border:1px solid rgba(52,211,153,.25);background:rgba(16,185,129,.09);color:#a7f3d0;border-radius:10px;padding:10px;font-size:10.5px;font-weight:900;cursor:pointer}.submit:disabled{opacity:.45;cursor:not-allowed}.meter{height:6px;background:rgba(148,163,184,.1);border-radius:99px;overflow:hidden;margin-top:8px}.meter i{display:block;height:100%;background:linear-gradient(90deg,#3b82f6,#8b5cf6);width:${completion*20}%}.muted{font-size:9.5px;color:#7f93aa;line-height:1.5}.pill{display:inline-block;margin:3px 4px 0 0;padding:4px 6px;border-radius:999px;border:1px solid rgba(148,163,184,.12);font-size:9px;color:#a9bacd}@media(max-width:1050px){.layout{grid-template-columns:1fr}.two{grid-template-columns:1fr}}`}</style>
  <div className="notice"><b>Canonical persistence active:</b> media drafts now use the existing HQ Company Library, including owner authorization, RLS, immutable numbered versions and the governed approval lifecycle. <code>/hq/studio/editor</code> remains the publication/textbook editor. Cyborg model execution remains behind the canonical mission gateway; no direct provider call is introduced.</div>
  {error&&<div className="error">{error}</div>}
  <div className="layout">
   <HQPanel title="AI brief generator" description="Turn Growth evidence into structured production options."><div className="pad"><label className="label">Growth insight</label><textarea className="area" value={insight} onChange={e=>{setInsight(e.target.value);touch()}} placeholder="Example: Form 4 Chemistry vertical shorts convert 3.2× better"/><button className="generate" onClick={()=>setBriefs(makeBriefs(insight))}>Generate working briefs</button><div className="cyborg"><b>Cyborg boundary:</b> working briefs use a deterministic local scaffold today. Production AI will only be enabled through canonical Cyborg mission intake with evidence and economics; no direct provider call exists here.</div>{briefs.map(b=><div className="brief" key={b.id}><b>{b.title}</b><p>{b.hook}</p><span className="pill">{b.format}</span><span className="pill">{b.duration}</span><div style={{marginTop:8}}><button className="load" onClick={()=>loadBrief(b)}>Load into canvas →</button></div></div>)}</div></HQPanel>
   <HQPanel title="Production canvas" description="Brief → production → pre-flight review."><div className="tabs">{(["brief","production","review"] as Tab[]).map(x=><button key={x} onClick={()=>setTab(x)} className={`tab ${tab===x?"active":""}`}>{x[0].toUpperCase()+x.slice(1)}</button>)}</div><div className="pad">{tab==="brief"&&<><div className="two"><div><label className="label">Asset title</label><input className="field" value={title} onChange={e=>{setTitle(e.target.value);touch()}}/></div><div><label className="label">Target audience</label><select className="select" value={audience} onChange={e=>{setAudience(e.target.value as typeof audience);touch()}}>{audiences.map(x=><option key={x}>{x}</option>)}</select></div></div><div className="two"><div><label className="label">Subject</label><select className="select" value={subject} onChange={e=>{setSubject(e.target.value as typeof subject);touch()}}>{subjects.map(x=><option key={x}>{x}</option>)}</select></div><div><label className="label">Topic / strand</label><input className="field" value={topic} onChange={e=>{setTopic(e.target.value);touch()}} placeholder="e.g. Acids and Bases"/></div></div><label className="label">The hook · first 3 seconds</label><textarea className="area" value={hook} onChange={e=>{setHook(e.target.value);touch()}}/><label className="label">Core educational message</label><textarea className="area" value={message} onChange={e=>{setMessage(e.target.value);touch()}}/><label className="label">Call to action</label><input className="field" value={cta} onChange={e=>{setCta(e.target.value);touch()}}/><div className="two"><div><label className="label">Format</label><select className="select" value={format} onChange={e=>updateFormat(e.target.value as typeof format)}>{formats.map(x=><option key={x}>{x}</option>)}</select></div><div><label className="label">Estimated duration</label><input className="field" value={duration} onChange={e=>{setDuration(e.target.value);touch()}}/></div></div></>}{tab==="production"&&<><div className="upload"><div><strong>Media production drop zone</strong><div>Binary upload remains gated until the private Storage path and policy are explicitly commissioned.</div><div style={{marginTop:8}}>Draft structure and production direction are already versioned in the HQ Library.</div></div><label className="label">Production notes</label><textarea className="area" value={productionNotes} onChange={e=>{setProductionNotes(e.target.value);touch()}} placeholder="Shot list, subtitle notes, visual direction, source references…"/><p className="muted">Timeline editing and real-time collaboration remain future capabilities; this surface does not pretend they exist before media binaries and collaboration lineage are proven.</p></>}{tab==="review"&&<><label className="check"><input type="checkbox" checked={copyright} onChange={e=>{setCopyright(e.target.checked);touch()}}/><span><b>Copyright / rights cleared</b><br/>Every external visual, audio track and source has an explicit usage basis.</span></label><label className="check"><input type="checkbox" checked={curriculum} onChange={e=>{setCurriculum(e.target.checked);touch()}}/><span><b>Curriculum aligned</b><br/>Claims and learning content map to the intended Kenyan curriculum outcome.</span></label><label className="check"><input type="checkbox" checked={brand} onChange={e=>{setBrand(e.target.checked);touch()}}/><span><b>Brand compliant</b><br/>CTA, naming and visual treatment match VibeSchool standards.</span></label><button className="submit" disabled={!ready||saving||submitted} onClick={()=>void submitForReview()}>{submitted?"Submitted to Governance Review":saving?"Submitting…":"Submit for Governance Review"}</button><p className="muted">Submission creates a real pending HQ Library approval and moves the artifact into the governed <b>in_review</b> lifecycle. It does not publish or distribute the asset.</p></>}</div></HQPanel>
   <HQPanel title="Governance & metadata" description="Fast creation with visible authority boundaries."><div className="pad"><div className="status"><span>Persistence</span><b className={artifactId?"ok":"warn"}>{artifactId?"HQ Library":"Unsaved"}</b></div><div className="status"><span>RLS protection</span><b className="ok">Owner protected</b></div><div className="status"><span>Version lineage</span><b className={versionId?"ok":"warn"}>{versionId?"Immutable version":"Not saved"}</b></div><div className="status"><span>Copyright</span><b className={copyright?"ok":"warn"}>{copyright?"Cleared":"Pending"}</b></div><div className="status"><span>Curriculum</span><b className={curriculum?"ok":"warn"}>{curriculum?"Checked":"Pending"}</b></div><div className="status"><span>Brand</span><b className={brand?"ok":"warn"}>{brand?"Checked":"Pending"}</b></div><div className="status"><span>Review state</span><b className={submitted?"ok":"warn"}>{submitted?"In review":"Draft"}</b></div><div className="status"><span>Distribution authority</span><b>Growth Command</b></div><label className="label">Asset completeness</label><b style={{fontSize:22}}>{completion}/5</b><div className="meter"><i/></div><label className="label">Current metadata</label><span className="pill">{subject}</span><span className="pill">{audience}</span><span className="pill">{format}</span>{topic&&<span className="pill">{topic}</span>}<div style={{marginTop:15,padding:11,borderRadius:11,border:"1px solid rgba(251,191,36,.18)",background:"rgba(245,158,11,.05)",fontSize:9.5,lineHeight:1.5,color:"#fcd34d"}}><b>No direct publishing.</b><br/>Approved media must leave Studio through governance and be distributed by Growth Command.</div><div style={{marginTop:10,padding:11,borderRadius:11,border:"1px solid rgba(52,211,153,.14)",background:"rgba(16,185,129,.04)",fontSize:9.5,lineHeight:1.5,color:"#a7f3d0"}}>{submitted?"This exact saved version is now waiting in the governed approval lane.":ready?"Pre-flight is complete. Save the exact version, then submit it to governance review.":"Complete the brief and all three review checks before governed submission."}</div></div></HQPanel>
  </div>
 </HQPage>
}
