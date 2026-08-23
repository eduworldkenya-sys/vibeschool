"use client"

import Link from "next/link"
import {useMemo,useState} from "react"
import {useSearchParams} from "next/navigation"
import {HQPage,HQPanel,hqButtonStyle} from "@/components/hq/HQShell"

type Brief={title:string;hook:string;coreMessage:string;callToAction:string;format:string;duration:string;audience:string}

const presets:Record<string,{label:string;duration:string;ratio:string}>={
  short:{label:"Vertical short",duration:"15–60 sec",ratio:"9:16"},
  revision:{label:"Revision clip",duration:"30 sec–3 min",ratio:"9:16 / 16:9"},
  visual:{label:"Lesson visual",duration:"1–8 min",ratio:"16:9"},
  campaign:{label:"Campaign creative",duration:"Static",ratio:"1:1 / A4"},
}

function buildBriefs(insight:string,format:string):Brief[]{
  const cleaned=insight.trim()||"Grade 10 Chemistry learners need faster, clearer revision support"
  const p=presets[format]??presets.short
  const audience=/teacher/i.test(cleaned)?"Kenyan secondary-school teachers":"Kenyan secondary-school learners"
  return [
    {title:`Fast win: ${cleaned.slice(0,58)}`,hook:"Can you answer this before the timer ends?",coreMessage:cleaned,callToAction:"Open VibeSchool and continue the lesson or practice set.",format:p.label,duration:p.duration,audience},
    {title:`Teach the mistake: ${cleaned.slice(0,48)}`,hook:"Most learners lose this mark for one simple reason.",coreMessage:`Turn the insight into one misconception, one correction and one worked example: ${cleaned}`,callToAction:"Try the related VibeSchool question and check your answer.",format:p.label,duration:p.duration,audience},
    {title:`Exam-mode challenge: ${cleaned.slice(0,46)}`,hook:"You have 20 seconds. What is the correct answer?",coreMessage:`Convert the insight into an exam-style challenge with a clear reveal: ${cleaned}`,callToAction:"Scan or open VibeSchool for the full revision path.",format:p.label,duration:p.duration,audience},
  ]
}

export default function MediaFactoryEditorPage(){
  const search=useSearchParams()
  const format=search.get("format")??"short"
  const preset=presets[format]??presets.short
  const[tab,setTab]=useState<"brief"|"production"|"review">("brief")
  const[insight,setInsight]=useState("Grade 10 Chemistry vertical revision clips are driving stronger learner engagement")
  const[briefs,setBriefs]=useState<Brief[]>([])
  const[selected,setSelected]=useState<Brief|null>(null)
  const generated=useMemo(()=>briefs.length>0,[briefs])
  const generate=()=>{const next=buildBriefs(insight,format);setBriefs(next);setSelected(next[0])}

  return <HQPage title="Media Factory Editor" description="Turn Growth intelligence into governed educational media briefs. Fast creation, clear evidence, no publishing bypass." actions={<>
    <Link href="/hq/studio/media-factory" style={{...hqButtonStyle,textDecoration:"none"}}>← Media Factory</Link>
    <Link href="/hq/growth" style={{...hqButtonStyle,textDecoration:"none"}}>Growth Command</Link>
  </>}>
    <style jsx>{`
      .layout{display:grid;grid-template-columns:minmax(230px,.72fr) minmax(0,1.5fr) minmax(230px,.72fr);gap:12px}.pad{padding:14px}.hint{font-size:10px;line-height:1.55;color:#8fa2ba;margin:0 0 10px}.textarea,.input{width:100%;box-sizing:border-box;background:#0a1220;border:1px solid rgba(148,163,184,.18);color:#e5edf7;border-radius:10px;padding:10px;font:inherit;font-size:12px;outline:none}.textarea{min-height:118px;resize:vertical}.textarea:focus,.input:focus{border-color:rgba(96,165,250,.6);box-shadow:0 0 0 3px rgba(59,130,246,.08)}.primary{width:100%;border:1px solid rgba(129,140,248,.45);background:linear-gradient(135deg,#2563eb,#7c3aed);color:white;border-radius:10px;padding:10px 12px;font-size:11px;font-weight:900;cursor:pointer}.brief{margin-top:8px;padding:10px;border:1px solid rgba(148,163,184,.12);border-radius:11px;background:rgba(255,255,255,.02);cursor:pointer}.brief:hover{border-color:rgba(96,165,250,.35)}.brief b{display:block;font-size:11px}.brief small{display:block;color:#8295ab;font-size:9px;line-height:1.45;margin-top:4px}.tabs{display:inline-flex;gap:3px;padding:3px;border:1px solid rgba(148,163,184,.12);background:#0a1220;border-radius:10px;margin-bottom:10px}.tab{border:0;background:transparent;color:#8fa2ba;padding:7px 11px;border-radius:7px;font-size:10px;font-weight:850;cursor:pointer}.active{background:#1e293b;color:white}.fields{display:grid;gap:12px}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}.label{display:block;font-size:9px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#7890a8;margin:0 0 6px}.canvas{padding:16px;min-height:520px}.drop{min-height:380px;display:grid;place-items:center;text-align:center;border:1px dashed rgba(96,165,250,.3);border-radius:14px;background:radial-gradient(circle at 50% 20%,rgba(59,130,246,.08),transparent 45%),rgba(255,255,255,.01)}.drop b{font-size:16px}.drop span{display:block;color:#8093a9;font-size:10px;margin-top:5px}.status{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid rgba(148,163,184,.09);font-size:10px}.ok{color:#86efac;font-weight:850}.pending{color:#fcd34d;font-weight:850}.note{margin-top:12px;padding:10px;border-radius:10px;border:1px solid rgba(96,165,250,.18);background:rgba(59,130,246,.06);font-size:9.5px;line-height:1.5;color:#a9c5e8}.metric{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:10px}.chip{padding:9px;border:1px solid rgba(148,163,184,.1);border-radius:10px;background:rgba(255,255,255,.02)}.chip small{display:block;color:#7f93aa;font-size:8px;text-transform:uppercase;font-weight:900}.chip b{display:block;font-size:11px;margin-top:4px}.empty{color:#72869c;font-size:10px;padding:20px 0;text-align:center}@media(max-width:980px){.layout{grid-template-columns:1fr}.canvas{min-height:auto}.drop{min-height:260px}}@media(max-width:540px){.grid2{grid-template-columns:1fr}}
    `}</style>
    <div className="layout">
      <HQPanel title="Intelligence input" description="Convert a measured Growth finding into production-ready briefs."><div className="pad"><p className="hint">Use an actual audience, campaign or content signal. The brief composer stays deterministic in this non-activating foundation; governed model execution remains behind the Cyborg capability boundary.</p><textarea className="textarea" value={insight} onChange={e=>setInsight(e.target.value)} maxLength={600}/><button className="primary" onClick={generate}>✦ Generate 3 briefs</button>{generated?briefs.map((b,i)=><button key={i} className="brief" onClick={()=>setSelected(b)} style={{width:"100%",textAlign:"left",color:"inherit"}}><b>{b.title}</b><small>{b.hook}</small></button>):<div className="empty">No generated briefs yet.</div>}</div></HQPanel>
      <div>
        <div className="tabs">{(["brief","production","review"] as const).map(t=><button key={t} onClick={()=>setTab(t)} className={`tab ${tab===t?"active":""}`}>{t[0].toUpperCase()+t.slice(1)}</button>)}</div>
        <HQPanel title={tab==="brief"?"Creative canvas":tab==="production"?"Production workspace":"Governance review"} description={`${preset.label} · ${preset.ratio} · ${preset.duration}`}><div className="canvas">
          {tab==="brief"&&<div className="fields"><div><label className="label">Asset title</label><input className="input" value={selected?.title??""} onChange={e=>setSelected(s=>({...s??buildBriefs(insight,format)[0],title:e.target.value}))} placeholder="Choose or generate a brief"/></div><div className="grid2"><div><label className="label">Target audience</label><input className="input" value={selected?.audience??""} onChange={e=>setSelected(s=>({...s??buildBriefs(insight,format)[0],audience:e.target.value}))}/></div><div><label className="label">Duration</label><input className="input" value={selected?.duration??preset.duration} onChange={e=>setSelected(s=>({...s??buildBriefs(insight,format)[0],duration:e.target.value}))}/></div></div><div><label className="label">Hook · first 3 seconds</label><textarea className="textarea" value={selected?.hook??""} onChange={e=>setSelected(s=>({...s??buildBriefs(insight,format)[0],hook:e.target.value}))}/></div><div><label className="label">Core message</label><textarea className="textarea" value={selected?.coreMessage??""} onChange={e=>setSelected(s=>({...s??buildBriefs(insight,format)[0],coreMessage:e.target.value}))}/></div><div><label className="label">Call to action</label><input className="input" value={selected?.callToAction??""} onChange={e=>setSelected(s=>({...s??buildBriefs(insight,format)[0],callToAction:e.target.value}))}/></div></div>}
          {tab==="production"&&<div className="drop"><div><b>Production workspace ready</b><span>Script, capture and asset upload controls attach here without replacing the canonical publication editor.</span></div></div>}
          {tab==="review"&&<div className="drop"><div><b>Ready for governed review</b><span>Accuracy, copyright, brand and human-release evidence must clear before Growth distribution.</span></div></div>}
        </div></HQPanel>
      </div>
      <HQPanel title="Governance & feedback" description="What can happen next—and what cannot."><div className="pad"><div className="status"><span>HQ surface</span><strong className="ok">Protected</strong></div><div className="status"><span>Direct publish</span><strong className="ok">Denied</strong></div><div className="status"><span>Growth handoff</span><strong className="pending">Review first</strong></div><div className="status"><span>Cyborg provider call</span><strong className="pending">Not activated</strong></div><div className="metric"><div className="chip"><small>Views</small><b>Awaiting attribution</b></div><div className="chip"><small>Signups</small><b>Awaiting attribution</b></div><div className="chip"><small>Paid</small><b>Awaiting attribution</b></div><div className="chip"><small>Revenue</small><b>KES —</b></div></div><div className="note">Studio creates and prepares evidence. It does not gain publishing authority. Approved assets continue to Growth Command for measured distribution. Asset-level performance storage should be added only against the canonical schema, not by inventing a parallel table.</div></div></HQPanel>
    </div>
  </HQPage>
}
