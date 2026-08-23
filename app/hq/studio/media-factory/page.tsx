"use client"

import Link from "next/link"
import {useCallback,useEffect,useMemo,useState} from "react"
import {hqSupabase} from "@/lib/hq/supabase"
import {HQPage,HQPanel,HQ_THEME as C,hqButtonStyle} from "@/components/hq/HQShell"

type StudioOverview={
  publications?:{total?:number;draft?:number;published?:number;textbooks?:number;ebooks?:number}
  moderation?:{exam_flags?:number;open_incidents?:number;assessment_requests?:number}
}
type MarketingOverview={campaigns:number;active_campaigns:number;events_30d:number;leads_30d:number;conversions_30d:number}
type LoadState={studio:StudioOverview|null;marketing:MarketingOverview|null;error:string;updatedAt:Date|null}

const lanes=[
  {label:"Brief",hint:"Shape the audience, hook and outcome",tone:C.blue},
  {label:"Create",hint:"Produce video, visual or campaign asset",tone:C.violet},
  {label:"Review",hint:"Accuracy, brand and release evidence",tone:C.amber},
  {label:"Ready",hint:"Approved assets waiting for Growth",tone:C.green},
] as const

const formats=[
  ["Vertical short","TikTok · Reels · Shorts","9:16","00:15–00:60","↗"],
  ["Revision clip","Exam prep · worked answer","9:16 / 16:9","00:30–03:00","◇"],
  ["Lesson visual","Explainer · concept animation","16:9","01:00–08:00","◫"],
  ["Campaign creative","Flyer · QR · social card","1:1 / A4","Static","⌁"],
] as const

export default function MediaFactoryPage(){
  const[state,setState]=useState<LoadState>({studio:null,marketing:null,error:"",updatedAt:null})
  const[loading,setLoading]=useState(true)
  const load=useCallback(async()=>{
    setLoading(true)
    const [studio,marketing]=await Promise.all([
      hqSupabase.rpc("hq_studio_overview"),
      hqSupabase.rpc("hq_marketing_overview"),
    ])
    const errors=[studio.error?.message,marketing.error?.message].filter(Boolean).join(" · ")
    setState({studio:(studio.data as StudioOverview|null)??null,marketing:(marketing.data as MarketingOverview|null)??null,error:errors,updatedAt:new Date()})
    setLoading(false)
  },[])
  useEffect(()=>{void load()},[load])

  const numbers=useMemo(()=>{
    const publications=state.studio?.publications
    const moderation=state.studio?.moderation
    const review=(moderation?.exam_flags??0)+(moderation?.open_incidents??0)+(moderation?.assessment_requests??0)
    return {
      source:publications?.total??0,
      creating:publications?.draft??0,
      review,
      ready:publications?.published??0,
      campaigns:state.marketing?.active_campaigns??0,
      leads:state.marketing?.leads_30d??0,
      conversions:state.marketing?.conversions_30d??0,
    }
  },[state])

  const conversionRate=numbers.leads>0?Math.round((numbers.conversions/numbers.leads)*1000)/10:0
  const laneCounts=[numbers.source,numbers.creating,numbers.review,numbers.ready]

  return <HQPage title="Media Factory" description="Turn VibeSchool knowledge into high-performing media, then hand approved assets to Growth. Live signals only; release authority stays governed." actions={<>
    <button onClick={()=>void load()} disabled={loading} style={hqButtonStyle}>{loading?"Refreshing…":"Refresh live state"}</button>
    <Link href="/hq/studio/editor" style={{...hqButtonStyle,textDecoration:"none",display:"inline-flex",alignItems:"center",background:"linear-gradient(135deg,#2563eb,#7c3aed)",border:"1px solid rgba(129,140,248,.45)"}}>Create source asset</Link>
  </>}>
    <style jsx>{`
      .hero{position:relative;overflow:hidden;border:1px solid rgba(96,165,250,.18);border-radius:22px;padding:22px;background:radial-gradient(circle at 88% 8%,rgba(124,58,237,.28),transparent 28rem),radial-gradient(circle at 5% 0%,rgba(14,165,233,.2),transparent 24rem),linear-gradient(145deg,#0a1930,#091423 68%);box-shadow:0 26px 70px rgba(0,0,0,.28)}
      .hero:after{content:"";position:absolute;inset:0;pointer-events:none;background-image:linear-gradient(rgba(148,163,184,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(148,163,184,.025) 1px,transparent 1px);background-size:28px 28px;mask-image:linear-gradient(to bottom,black,transparent 90%)}
      .eyebrow{font-size:10px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:#67e8f9}.headline{font-size:clamp(27px,4vw,48px);line-height:1;letter-spacing:-.045em;margin:10px 0 9px;max-width:760px}.hero p{margin:0;max-width:680px;color:#94a3b8;font-size:13px;line-height:1.65}.pulse{display:inline-flex;align-items:center;gap:7px;margin-top:18px;padding:7px 10px;border-radius:999px;border:1px solid rgba(52,211,153,.22);background:rgba(16,185,129,.07);font-size:10px;font-weight:850;color:#a7f3d0}.pulse i{width:7px;height:7px;border-radius:50%;background:#34d399;box-shadow:0 0 0 5px rgba(52,211,153,.1)}
      .signalGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:14px}.signal{min-height:86px;padding:13px;border:1px solid rgba(148,163,184,.12);border-radius:14px;background:rgba(255,255,255,.025)}.signal small{display:block;color:#7f93aa;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.07em}.signal strong{display:block;font-size:25px;margin-top:7px;letter-spacing:-.04em}.signal span{display:block;color:#8fa2ba;font-size:10px;margin-top:3px}
      .sectionGrid{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(280px,.75fr);gap:12px;margin-top:12px}.pipeline{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding:14px}.lane{position:relative;padding:14px;border:1px solid rgba(148,163,184,.11);border-radius:13px;background:rgba(255,255,255,.018);min-height:134px}.lane:after{content:"→";position:absolute;right:-8px;top:28px;color:#43556c;font-size:13px}.lane:last-child:after{display:none}.laneLabel{font-size:11px;font-weight:900}.laneCount{font-size:31px;font-weight:950;letter-spacing:-.05em;margin:18px 0 5px}.laneHint{font-size:10px;line-height:1.45;color:#8498af}.sideBody{padding:14px}.sideRow{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:11px 0;border-bottom:1px solid rgba(148,163,184,.09)}.sideRow:last-child{border-bottom:0}.sideRow span{font-size:11px;color:#8fa2ba}.sideRow strong{font-size:14px}.positive{color:#86efac!important}.attention{color:#fcd34d!important}
      .formatGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;padding:14px}.format{display:block;text-decoration:none;color:#f8fafc;padding:14px;border-radius:14px;border:1px solid rgba(148,163,184,.11);background:linear-gradient(180deg,rgba(255,255,255,.035),rgba(255,255,255,.012));transition:.18s ease}.format:hover{transform:translateY(-2px);border-color:rgba(96,165,250,.32);background:rgba(59,130,246,.07)}.formatIcon{font-size:20px;color:#7dd3fc}.format h3{font-size:12px;margin:12px 0 4px}.format p{font-size:10px;color:#8799ae;margin:0 0 12px;line-height:1.45}.formatMeta{display:flex;gap:6px;flex-wrap:wrap}.chip{font-size:9px;font-weight:800;color:#b8c7d8;border:1px solid rgba(148,163,184,.12);border-radius:999px;padding:4px 6px;background:rgba(255,255,255,.02)}
      .actionGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;padding:14px}.action{display:flex;align-items:center;gap:10px;padding:12px;border-radius:12px;border:1px solid rgba(148,163,184,.11);text-decoration:none;color:#eef6ff;background:rgba(255,255,255,.02)}.action b{display:block;font-size:11px}.action small{display:block;color:#8295ab;font-size:9.5px;margin-top:3px;line-height:1.35}.actionMark{width:35px;height:35px;display:grid;place-items:center;border-radius:10px;background:rgba(59,130,246,.1);color:#93c5fd;font-weight:900}
      .error{margin:0 0 12px;padding:11px 13px;border:1px solid rgba(244,63,94,.28);border-radius:11px;color:#fecdd3;background:rgba(244,63,94,.06);font-size:11px}
      @media(max-width:900px){.signalGrid,.pipeline,.formatGrid{grid-template-columns:repeat(2,minmax(0,1fr))}.sectionGrid{grid-template-columns:1fr}.lane:nth-child(2):after{display:none}.actionGrid{grid-template-columns:1fr}}
      @media(max-width:520px){.hero{padding:18px 15px;border-radius:17px}.signalGrid{grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.signal{min-height:78px}.pipeline,.formatGrid{grid-template-columns:1fr}.lane{min-height:auto}.lane:after{display:none}.laneCount{margin-top:11px}.headline{font-size:31px}.format{min-height:0}}
    `}</style>

    {state.error&&<div className="error">Some live Media Factory signals could not be loaded: {state.error}</div>}

    <section className="hero">
      <div className="eyebrow">Creative production system</div>
      <h2 className="headline">Create. Prove. Ship what works.</h2>
      <p>Media Factory converts trusted VibeSchool content into shorts, revision clips, lesson visuals and campaign creative. Growth owns distribution and conversion; Media Factory learns from the results.</p>
      <div className="pulse"><i/> LIVE · {state.updatedAt?`updated ${state.updatedAt.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}`:"connecting to HQ signals"}</div>
      <div className="signalGrid">
        <div className="signal"><small>Source library</small><strong>{loading?"…":numbers.source}</strong><span>canonical publications</span></div>
        <div className="signal"><small>In creation</small><strong>{loading?"…":numbers.creating}</strong><span>draft source assets</span></div>
        <div className="signal"><small>Growth live</small><strong>{loading?"…":numbers.campaigns}</strong><span>active campaigns</span></div>
        <div className="signal"><small>Conversion 30d</small><strong>{loading?"…":`${conversionRate}%`}</strong><span>{numbers.conversions} conversions / {numbers.leads} leads</span></div>
      </div>
    </section>

    <div className="sectionGrid">
      <HQPanel title="Production pulse" description="A compact live view of the governed content-to-media handoff.">
        <div className="pipeline">{lanes.map((lane,i)=><div className="lane" key={lane.label}><div className="laneLabel" style={{color:lane.tone}}>{lane.label}</div><div className="laneCount">{loading?"…":laneCounts[i]}</div><div className="laneHint">{lane.hint}</div></div>)}</div>
      </HQPanel>
      <HQPanel title="Control status" description="Media production is useful only when authority stays explicit.">
        <div className="sideBody">
          <div className="sideRow"><span>Publishing authority</span><strong className="positive">Governed</strong></div>
          <div className="sideRow"><span>Moderation queue</span><strong className={numbers.review?"attention":"positive"}>{loading?"…":numbers.review}</strong></div>
          <div className="sideRow"><span>Distribution owner</span><strong>Growth</strong></div>
          <div className="sideRow"><span>Source of truth</span><strong>Studio / Content</strong></div>
        </div>
      </HQPanel>
    </div>

    <div style={{height:12}}/>
    <HQPanel title="Start from a format" description="Figma-like production presets: clear intent, expected canvas and no hidden authority.">
      <div className="formatGrid">{formats.map(([title,desc,ratio,duration,icon])=><Link href="/hq/studio/editor" className="format" key={title}><div className="formatIcon">{icon}</div><h3>{title}</h3><p>{desc}</p><div className="formatMeta"><span className="chip">{ratio}</span><span className="chip">{duration}</span></div></Link>)}</div>
    </HQPanel>

    <div style={{height:12}}/>
    <HQPanel title="Work the loop" description="Every button opens an existing governed VibeSchool surface; Media Factory does not bypass review or release controls.">
      <div className="actionGrid">
        <Link href="/hq/studio/editor" className="action"><span className="actionMark">✦</span><span><b>Create from Studio</b><small>Build the trusted source or rich media brief.</small></span></Link>
        <Link href="/hq/content" className="action"><span className="actionMark">✓</span><span><b>Review & release</b><small>Use the hardened publishing and human approval path.</small></span></Link>
        <Link href="/hq/marketing" className="action"><span className="actionMark">↗</span><span><b>Hand off to Growth</b><small>Measure campaigns, leads and conversions.</small></span></Link>
      </div>
    </HQPanel>
  </HQPage>
}
