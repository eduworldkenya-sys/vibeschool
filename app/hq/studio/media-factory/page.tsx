"use client"

import Link from "next/link"
import {useCallback,useEffect,useMemo,useState} from "react"
import {hqSupabase} from "@/lib/hq/supabase"
import {HQPage,HQPanel,HQ_THEME as C,hqButtonStyle} from "@/components/hq/HQShell"

type StudioOverview={publications?:{total?:number;draft?:number;published?:number};moderation?:{exam_flags?:number;open_incidents?:number;assessment_requests?:number}}
type GrowthSummary={active_campaigns:number;touches:number;signups:number;activated:number;paid:number;revenue_kes:number;active_creators:number}
type GrowthReport={generated_at:string;window_days:number;summary:GrowthSummary}
type State={studio:StudioOverview|null;growth:GrowthReport|null;error:string;updatedAt:Date|null}

const emptyGrowth:GrowthReport={generated_at:"",window_days:30,summary:{active_campaigns:0,touches:0,signups:0,activated:0,paid:0,revenue_kes:0,active_creators:0}}
const lanes=[
  ["Brief","Shape audience, hook and outcome",C.blue],
  ["Create","Produce video, visual or campaign asset",C.violet],
  ["Review","Accuracy, brand and release evidence",C.amber],
  ["Ready","Approved assets waiting for Growth",C.green],
] as const
const formats=[
  ["Vertical short","TikTok · Reels · Shorts","9:16","15–60 sec","↗"],
  ["Revision clip","Exam prep · worked answer","9:16 / 16:9","30 sec–3 min","◇"],
  ["Lesson visual","Explainer · concept animation","16:9","1–8 min","◫"],
  ["Campaign creative","Flyer · QR · social card","1:1 / A4","Static","⌁"],
] as const

export default function MediaFactoryPage(){
  const[state,setState]=useState<State>({studio:null,growth:null,error:"",updatedAt:null})
  const[loading,setLoading]=useState(true)
  const load=useCallback(async()=>{
    setLoading(true)
    const [studio,growth]=await Promise.all([
      hqSupabase.rpc("hq_studio_overview"),
      hqSupabase.rpc("hq_growth_command_overview",{p_days:30}),
    ])
    setState({
      studio:(studio.data as StudioOverview|null)??null,
      growth:(growth.data as GrowthReport|null)??emptyGrowth,
      error:[studio.error?.message,growth.error?.message].filter(Boolean).join(" · "),
      updatedAt:new Date(),
    })
    setLoading(false)
  },[])
  useEffect(()=>{void load()},[load])

  const m=useMemo(()=>{
    const p=state.studio?.publications
    const mod=state.studio?.moderation
    const g=state.growth?.summary??emptyGrowth.summary
    return {
      source:p?.total??0,
      creating:p?.draft??0,
      review:(mod?.exam_flags??0)+(mod?.open_incidents??0)+(mod?.assessment_requests??0),
      ready:p?.published??0,
      campaigns:g.active_campaigns??0,
      touches:g.touches??0,
      signups:g.signups??0,
      activated:g.activated??0,
      paid:g.paid??0,
      revenue:g.revenue_kes??0,
      creators:g.active_creators??0,
    }
  },[state])
  const conversion=m.signups>0?Math.round(m.paid/m.signups*1000)/10:0
  const counts=[m.source,m.creating,m.review,m.ready]

  return <HQPage title="Media Factory" description="Create high-performing media from trusted VibeSchool content, then hand approved assets to Growth. Live evidence, simple controls, no authority bypass." actions={<>
    <button onClick={()=>void load()} disabled={loading} style={hqButtonStyle}>{loading?"Refreshing…":"Refresh live state"}</button>
    <Link href="/hq/studio/editor" style={{...hqButtonStyle,textDecoration:"none",display:"inline-flex",alignItems:"center",background:"linear-gradient(135deg,#2563eb,#7c3aed)",border:"1px solid rgba(129,140,248,.42)"}}>Create source asset</Link>
  </>}>
    <style jsx>{`
      .hero{position:relative;overflow:hidden;border:1px solid rgba(96,165,250,.18);border-radius:22px;padding:22px;background:radial-gradient(circle at 88% 8%,rgba(124,58,237,.28),transparent 28rem),radial-gradient(circle at 5% 0%,rgba(14,165,233,.2),transparent 24rem),linear-gradient(145deg,#0a1930,#091423 68%);box-shadow:0 26px 70px rgba(0,0,0,.28)}
      .hero:after{content:"";position:absolute;inset:0;pointer-events:none;background-image:linear-gradient(rgba(148,163,184,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(148,163,184,.025) 1px,transparent 1px);background-size:28px 28px;mask-image:linear-gradient(to bottom,black,transparent 90%)}
      .eyebrow{font-size:10px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:#67e8f9}.headline{font-size:clamp(27px,4vw,48px);line-height:1;letter-spacing:-.045em;margin:10px 0 9px;max-width:760px}.hero p{margin:0;max-width:720px;color:#94a3b8;font-size:13px;line-height:1.65}.pulse{display:inline-flex;align-items:center;gap:7px;margin-top:18px;padding:7px 10px;border-radius:999px;border:1px solid rgba(52,211,153,.22);background:rgba(16,185,129,.07);font-size:10px;font-weight:850;color:#a7f3d0}.pulse i{width:7px;height:7px;border-radius:50%;background:#34d399;box-shadow:0 0 0 5px rgba(52,211,153,.1)}
      .signals{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:9px;margin-top:14px}.signal{min-height:86px;padding:13px;border:1px solid rgba(148,163,184,.12);border-radius:14px;background:rgba(255,255,255,.025)}.signal small{display:block;color:#7f93aa;font-size:9px;font-weight:850;text-transform:uppercase;letter-spacing:.07em}.signal strong{display:block;font-size:24px;margin-top:7px;letter-spacing:-.04em}.signal span{display:block;color:#8fa2ba;font-size:9.5px;margin-top:3px}
      .grid{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(280px,.75fr);gap:12px;margin-top:12px}.pipeline{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding:14px}.lane{position:relative;padding:14px;border:1px solid rgba(148,163,184,.11);border-radius:13px;background:rgba(255,255,255,.018);min-height:134px}.lane:after{content:"→";position:absolute;right:-8px;top:28px;color:#43556c}.lane:last-child:after{display:none}.laneLabel{font-size:11px;font-weight:900}.laneCount{font-size:31px;font-weight:950;letter-spacing:-.05em;margin:18px 0 5px}.laneHint{font-size:10px;line-height:1.45;color:#8498af}.side{padding:14px}.row{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:11px 0;border-bottom:1px solid rgba(148,163,184,.09)}.row:last-child{border-bottom:0}.row span{font-size:11px;color:#8fa2ba}.row strong{font-size:13px}.good{color:#86efac!important}.warn{color:#fcd34d!important}
      .formats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;padding:14px}.format{display:block;text-decoration:none;color:#f8fafc;padding:14px;border-radius:14px;border:1px solid rgba(148,163,184,.11);background:linear-gradient(180deg,rgba(255,255,255,.035),rgba(255,255,255,.012));transition:.18s ease}.format:hover{transform:translateY(-2px);border-color:rgba(96,165,250,.32);background:rgba(59,130,246,.07)}.icon{font-size:20px;color:#7dd3fc}.format h3{font-size:12px;margin:12px 0 4px}.format p{font-size:10px;color:#8799ae;margin:0 0 12px}.meta{display:flex;gap:6px;flex-wrap:wrap}.chip{font-size:9px;font-weight:800;color:#b8c7d8;border:1px solid rgba(148,163,184,.12);border-radius:999px;padding:4px 6px}.actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;padding:14px}.action{display:flex;align-items:center;gap:10px;padding:12px;border-radius:12px;border:1px solid rgba(148,163,184,.11);text-decoration:none;color:#eef6ff;background:rgba(255,255,255,.02)}.action b{display:block;font-size:11px}.action small{display:block;color:#8295ab;font-size:9.5px;margin-top:3px;line-height:1.35}.mark{width:35px;height:35px;display:grid;place-items:center;border-radius:10px;background:rgba(59,130,246,.1);color:#93c5fd;font-weight:900}.error{margin:0 0 12px;padding:11px 13px;border:1px solid rgba(244,63,94,.28);border-radius:11px;color:#fecdd3;background:rgba(244,63,94,.06);font-size:11px}
      @media(max-width:980px){.signals{grid-template-columns:repeat(3,minmax(0,1fr))}.grid{grid-template-columns:1fr}.pipeline,.formats{grid-template-columns:repeat(2,minmax(0,1fr))}.lane:nth-child(2):after{display:none}.actions{grid-template-columns:1fr}}
      @media(max-width:560px){.hero{padding:18px 15px;border-radius:17px}.headline{font-size:31px}.signals{grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.signal:last-child{grid-column:1/-1}.pipeline,.formats{grid-template-columns:1fr}.lane{min-height:auto}.lane:after{display:none}.laneCount{margin-top:11px}}
    `}</style>

    {state.error&&<div className="error">Some live Media Factory signals could not be loaded: {state.error}</div>}
    <section className="hero">
      <div className="eyebrow">Creative production system</div>
      <h2 className="headline">Create. Prove. Ship what works.</h2>
      <p>Media Factory turns curriculum-backed VibeSchool knowledge into shorts, revision clips, lesson visuals and campaign creative. Growth owns distribution and measured conversion; Media Factory uses those signals to decide what to make next.</p>
      <div className="pulse"><i/> LIVE · {state.updatedAt?`updated ${state.updatedAt.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}`:"connecting to HQ evidence"}</div>
      <div className="signals">
        <div className="signal"><small>Source library</small><strong>{loading?"…":m.source}</strong><span>canonical publications</span></div>
        <div className="signal"><small>In creation</small><strong>{loading?"…":m.creating}</strong><span>draft source assets</span></div>
        <div className="signal"><small>Growth live</small><strong>{loading?"…":m.campaigns}</strong><span>active campaigns</span></div>
        <div className="signal"><small>Paid / signup</small><strong>{loading?"…":`${conversion}%`}</strong><span>{m.paid} paid from {m.signups} signups</span></div>
        <div className="signal"><small>Attributed revenue</small><strong>{loading?"…":`KES ${m.revenue.toLocaleString()}`}</strong><span>{m.creators} active creators</span></div>
      </div>
    </section>

    <div className="grid">
      <HQPanel title="Production pulse" description="A live view of the governed content-to-media handoff."><div className="pipeline">{lanes.map(([label,hint,tone],i)=><div className="lane" key={label}><div className="laneLabel" style={{color:tone}}>{label}</div><div className="laneCount">{loading?"…":counts[i]}</div><div className="laneHint">{hint}</div></div>)}</div></HQPanel>
      <HQPanel title="Control status" description="Fast production without invisible authority."><div className="side"><div className="row"><span>Publishing authority</span><strong className="good">Governed</strong></div><div className="row"><span>Moderation queue</span><strong className={m.review?"warn":"good"}>{loading?"…":m.review}</strong></div><div className="row"><span>Distribution owner</span><strong>Growth Command</strong></div><div className="row"><span>Source of truth</span><strong>Studio / Content</strong></div></div></HQPanel>
    </div>

    <div style={{height:12}}/>
    <HQPanel title="Start from a format" description="Production presets inspired by modern design tools: obvious intent, obvious canvas, minimal friction."><div className="formats">{formats.map(([title,desc,ratio,duration,icon])=><Link href="/hq/studio/editor" className="format" key={title}><div className="icon">{icon}</div><h3>{title}</h3><p>{desc}</p><div className="meta"><span className="chip">{ratio}</span><span className="chip">{duration}</span></div></Link>)}</div></HQPanel>

    <div style={{height:12}}/>
    <HQPanel title="Work the loop" description="Every action continues through a canonical VibeSchool surface."><div className="actions"><Link href="/hq/studio/editor" className="action"><span className="mark">✦</span><span><b>Create from Studio</b><small>Build the trusted source or rich media brief.</small></span></Link><Link href="/hq/content" className="action"><span className="mark">✓</span><span><b>Review & release</b><small>Use hardened publishing and human approval.</small></span></Link><Link href="/hq/growth" className="action"><span className="mark">↗</span><span><b>Hand off to Growth</b><small>Inspect channels, campaigns, creators and conversion evidence.</small></span></Link></div></HQPanel>
  </HQPage>
}
