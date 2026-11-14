"use client"
import Link from "next/link"
import {useEffect,useMemo,useState} from "react"
import {hqSupabase} from "@/lib/hq/supabase"
import {HQPage,HQPanel,hqButtonStyle} from "@/components/hq/HQShell"

type Event={day:number;label:string;detail:string;good:boolean}
type Sim={day:number;reach:number;interested:number;qualified:number;customers:number;teachers:number;teacherLeads:number;revenue:number;cost:number;vitality:number;activity:number;events:Event[];history:number[];seed:number}
type Source={source:string;touches:number;signups:number;activated:number;returned_day2:number;paid:number;revenue_kes:number}
type Live={summary?:Record<string,number>;sources?:Source[]}
const STORE="vibeschool.hq.growth-tree.sim.v1"
const fresh=():Sim=>({day:1,reach:0,interested:0,qualified:0,customers:0,teachers:0,teacherLeads:0,revenue:0,cost:0,vitality:18,activity:0,events:[],history:[0],seed:17})
const fmt=(n:number)=>Math.round(n).toLocaleString("en-KE")
const money=(n:number)=>"KSh "+fmt(n)
const clamp=(n:number)=>Math.max(5,Math.min(100,n))
function nextRandom(s:Sim){const seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return [seed/4294967296,seed] as const}
function event(s:Sim,label:string,detail:string,good:boolean):Sim{return {...s,events:[{day:s.day,label,detail,good},...s.events].slice(0,10)}}
type Action="video"|"share"|"lesson"|"follow"|"recruit"|"demo"|"referral"|"activate"
const choices:{id:Action;label:string;hint:string;role:"household"|"teacher"}[]=[
{id:"video",label:"Publish short video",hint:"TikTok / YouTube",role:"household"},
{id:"share",label:"Share learning demo",hint:"WhatsApp",role:"household"},
{id:"lesson",label:"Run a free lesson",hint:"Experience the product",role:"household"},
{id:"follow",label:"Follow up prospects",hint:"Make an offer",role:"household"},
{id:"recruit",label:"Invite teachers",hint:"Build virtual classes",role:"teacher"},
{id:"demo",label:"Demo tutoring tools",hint:"Show the teaching workflow",role:"teacher"},
{id:"referral",label:"Teacher referrals",hint:"Reach parent households",role:"teacher"},
{id:"activate",label:"Activate teachers",hint:"Follow up signups",role:"teacher"}]
function act(before:Sim,id:Action):Sim{
 const s={...before,activity:before.activity+1};let r:number
 ;[r,s.seed]=nextRandom(s)
 if(id==="follow"){const n=Math.min(s.interested,Math.floor(r*4));s.interested-=n;s.qualified+=n;s.vitality=clamp(s.vitality+(n?3:0));return event(s,"Prospect follow-up",n+" households ready for subscription",n>0)}
 if(id==="activate"){const n=Math.min(s.teacherLeads,Math.floor(r*3));s.teacherLeads-=n;s.teachers+=n;s.vitality=clamp(s.vitality+2*n);return event(s,"Teacher follow-up",n+" simulated teachers activated",n>0)}
 const base:Record<Exclude<Action,"follow"|"activate">,[number,number]>={
 video:[110,.045],share:[38,.13],lesson:[27,.28],recruit:[36,.07],demo:[13,.1],referral:[55,.1]}
 const [audience,rate]=base[id];const reached=Math.floor((audience+(id==="referral"?s.teachers*12:0))*(.65+r*.9))
 ;[r,s.seed]=nextRandom(s)
 const interested=Math.floor(reached*rate*(.2+r*1.2));s.reach+=reached
 if(id==="recruit"||id==="demo")s.teacherLeads+=interested
 else{s.interested+=interested;if(id==="lesson"){const ready=Math.floor(interested*.3);s.interested-=ready;s.qualified+=ready}}
 s.vitality=clamp(s.vitality+(interested?3:1))
 return event(s,choices.find(x=>x.id===id)?.label||id,`+${reached} reached · ${interested} interested`,interested>0)
}
function passage(before:Sim):Sim{let s={...before,day:before.day+1,cost:before.cost+450,activity:0,vitality:clamp(before.vitality-(before.activity?5:13)),history:[...before.history,before.customers].slice(-60)}
 if(!before.activity){const lost=Math.min(s.interested,Math.floor(s.interested*.3));s.interested-=lost;s=event(s,"No marketing activity",`${lost} prospects cooled · vitality declined`,false)}
 return event(s,"Daily operating budget","KSh 450: bundle 100 · device 150 · founder 200",false)}
function subscription(before:Sim,price:number):Sim{if(!before.qualified)return event(before,"Payment simulation","No qualified household: follow up interested prospects first",false)
 const s={...before,qualified:before.qualified-1,customers:before.customers+1,revenue:before.revenue+price,vitality:clamp(before.vitality+14),history:[...before.history,before.customers+1].slice(-60)}
 return event(s,"SIMULATED subscription",`+1 household · ${money(price)} (not a real payment)`,true)}
function removeCustomer(before:Sim):Sim{if(!before.customers)return before
 return event({...before,customers:before.customers-1,vitality:clamp(before.vitality-10),history:[...before.history,before.customers-1].slice(-60)},"Customer lost","1 simulated paying household churned",false)}
function Tree({vitality,customers,teachers}:{vitality:number;customers:number;teachers:number}){
 const scale=.47+vitality/190
 const leaves=Array.from({length:90},(_,i)=>{const a=i*2.39996,rad=Math.sqrt((i+.5)/90);return {x:300+Math.cos(a)*164*rad,y:146+Math.sin(a)*99*rad,rotation:i*41%180,color:["#388f65","#65bd70","#93d47a","#3eaa84"][i%4]}})
 const count=Math.min(leaves.length,Math.floor(vitality*.7+customers*2+teachers))
 return <svg viewBox="0 0 600 310" role="img" aria-label={`Growth tree vitality ${vitality} percent, ${customers} simulated customers`} className="tree">
 <defs><radialGradient id="tree-aura"><stop stopColor="#7bd681" stopOpacity=".24"/><stop offset="1" stopColor="#7bd681" stopOpacity="0"/></radialGradient></defs>
 <circle cx="300" cy="140" r="150" fill="url(#tree-aura)"/><circle cx="506" cy="58" r="24" fill="#f3ca70"/><ellipse cx="300" cy="288" rx="236" ry="21" fill="#244e3d"/>
 <g transform={`translate(300 280) scale(${scale}) translate(-300 -280)`} style={{transition:"transform .45s ease"}}>
 <path d="M293 283Q285 212 274 172Q265 135 234 108M296 241Q319 179 339 154Q367 121 404 116M290 202Q282 158 304 115" fill="none" stroke="#966940" strokeWidth="19" strokeLinecap="round"/>
 {leaves.slice(0,count).map((l,i)=><ellipse key={i} cx={l.x} cy={l.y} rx={10+i%3} ry={15+i%4} fill={l.color} opacity={vitality<25?.65:1} transform={`rotate(${l.rotation} ${l.x} ${l.y})`}/>)}
 {leaves.slice(0,Math.min(customers,30)).map((l,i)=><circle key={i} cx={l.x} cy={l.y} r="6" fill="#ffd16a"/>)}
 </g><text x="300" y="309" fill="#bddacc" fontSize="11" textAnchor="middle">{customers?customers+" paying households (simulated)":"First customer is the goal"}</text></svg>
}
function Trend({values}:{values:number[]}){const series=values.length>1?values:[0,values[0]||0],max=Math.max(1,...series),points=series.map((n,i)=>[25+i*520/(series.length-1),110-90*n/max]);return <svg viewBox="0 0 565 140" role="img" aria-label="Simulated customer history" className="chart">
 <path d="M25 20H545M25 65H545M25 110H545" fill="none" stroke="#496075" strokeWidth=".7"/><path d={`M${points.map(p=>p.join(",")).join(" L")} L545,110 L25,110 Z`} fill="#3aab77" opacity=".13"/>
 <polyline points={points.map(p=>p.join(",")).join(" ")} fill="none" stroke="#70d39a" strokeWidth="3"/><text x="8" y="20" fill="#a6bfd2" fontSize="11">{max}</text><text x="12" y="114" fill="#a6bfd2" fontSize="11">0</text></svg>}
export default function GrowthTreePage(){
 const[mode,setMode]=useState<"simulation"|"live">("simulation"),[role,setRole]=useState<"household"|"teacher">("household")
 const[sim,setSim]=useState<Sim>(fresh),[ready,setReady]=useState(false),[price,setPrice]=useState(300)
 const[live,setLive]=useState<Live|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(false)
 useEffect(()=>{try{const raw=window.localStorage.getItem(STORE);if(raw){const x=JSON.parse(raw) as Sim;if(x&&Number.isFinite(x.day)&&Array.isArray(x.events)&&Array.isArray(x.history)&&x.history.length<100)setSim(x)}}catch{}setReady(true)},[])
 useEffect(()=>{if(ready)try{window.localStorage.setItem(STORE,JSON.stringify(sim))}catch{}},[ready,sim])
 async function loadLive(){setLoading(true);setError("");const r=await hqSupabase.rpc("hq_growth_command_overview",{p_days:30});if(r.error){setError(r.error.message);setLive(null)}else if(r.data&&typeof r.data==="object")setLive(r.data as Live);else setError("No verified attribution data returned");setLoading(false)}
 useEffect(()=>{if(mode==="live")void loadLive()},[mode])
 const metric=useMemo(()=>{const sources=live?.sources??[];const summary=live?.summary??{};return {touches:sources.reduce((n,x)=>n+(Number(x.touches)||0),0),signups:sources.reduce((n,x)=>n+(Number(x.signups)||0),0),paid:Number(summary.paid??sources.reduce((n,x)=>n+(Number(x.paid)||0),0)),revenue:Number(summary.revenue_kes??sources.reduce((n,x)=>n+(Number(x.revenue_kes)||0),0))}},[live])
 const milestone=sim.customers<1?1:sim.customers<10?10:sim.customers<50?50:sim.customers<100?100:Math.ceil((sim.customers+1)/100)*100
 const title=sim.customers===0?"Your first seed":sim.customers<5?"First roots":sim.customers<20?"Growing sapling":sim.customers<100?"Expanding branches":"The VibeSchool forest"
 return <HQPage title="Growth Tree" description="Visual acquisition control room. Actions grow demand; verified customers sustain the business." actions={<><Link href="/hq/marketing/lab" style={hqButtonStyle}>Marketing Lab</Link><Link href="/hq/growth" style={hqButtonStyle}>Growth Command</Link></>}>
 <div className="mode"><button aria-pressed={mode==="simulation"} onClick={()=>setMode("simulation")}>Interactive simulation</button><button aria-pressed={mode==="live"} onClick={()=>setMode("live")}>Verified acquisition data</button></div>
 {mode==="simulation"?<>
 <div className="warning">SIMULATION · Invented outcomes, not actual signups or M-PESA receipts. Saved only in this browser.</div>
 <div className="kpis">{[["People reached",sim.reach],["Interested households",sim.interested],["Qualified",sim.qualified],["Paying households",sim.customers]].map(([label,value])=><article key={label}><span>{label}</span><strong>{fmt(Number(value))}</strong></article>)}</div>
 <div className="columns"><div className="canvas"><div className="top"><div><h2>{title}</h2><p>Day {sim.day} · {sim.teachers} active virtual teachers</p></div><div className="health"><span>Tree vitality</span><strong>{sim.vitality}%</strong></div></div><Tree vitality={sim.vitality} customers={sim.customers} teachers={sim.teachers}/><div className="progress"><span>Next milestone: {sim.customers} / {milestone} customers</span><div><i style={{width:`${Math.min(100,100*sim.customers/milestone)}%`}}/></div></div></div>
 <HQPanel title="Feed the idea" description="Each action produces a variable simulated result. Activity alone does not guarantee payment.">
 <div className="inner"><div className="mode"><button aria-pressed={role==="household"} onClick={()=>setRole("household")}>Parent + learner household</button><button aria-pressed={role==="teacher"} onClick={()=>setRole("teacher")}>Teachers</button></div>
 <div className="actions">{choices.filter(x=>x.role===role).map(x=><button key={x.id} onClick={()=>setSim(s=>act(s,x.id))}><strong>{x.label}</strong><small>{x.hint}</small></button>)}</div>
 <div className="pay"><label>Subscription plan<select value={price} onChange={e=>setPrice(Number(e.target.value))}><option value={20}>Daily · KSh 20</option><option value={99}>Weekly · KSh 99</option><option value={300}>Monthly · KSh 300</option></select></label><button onClick={()=>setSim(s=>subscription(s,price))}>Simulate payment</button></div>
 <div className="foot"><button onClick={()=>setSim(passage)}>Advance one day · KSh 450 cost</button><button onClick={()=>setSim(removeCustomer)} disabled={!sim.customers}>Simulate lost customer</button></div></div></HQPanel></div>
 <div className="kpis">{[["Simulated revenue",money(sim.revenue)],["Operating costs",money(sim.cost)],["Simulated net",money(sim.revenue-sim.cost)],["Conversion",sim.reach?(100*sim.customers/sim.reach).toFixed(2)+"%":"0%"]].map(([label,value])=><article key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>
 <div className="columns bottom"><HQPanel title="Growth vs shrinkage"><div className="inner"><Trend values={sim.history}/><p className="caption">Simulated paying households across actions and days. Never use this as a forecast.</p></div></HQPanel><HQPanel title="Action → outcome"><div className="inner events">{sim.events.length?sim.events.map((e,i)=><div key={i}><span>{e.good?"▲":"▼"} D{e.day}</span><strong>{e.label}</strong><small>{e.detail}</small></div>):<p>No activity yet. Feed the tree with a campaign.</p>}<button onClick={()=>{if(window.confirm("Restart the local simulation?"))setSim(fresh())}}>Restart simulation</button></div></HQPanel></div>
 </>:<>
 <div className="warning">LIVE EVIDENCE · Aggregated 30-day attributed Growth Command records. These are not necessarily unique households or active subscriptions. Unmeasured activity remains unknown.</div>
 <div className="live-actions"><button disabled={loading} onClick={()=>void loadLive()}>{loading?"Loading…":"Refresh verified evidence"}</button><Link href="/hq/growth">Open detailed Growth Command</Link></div>
 {error&&<div role="alert" className="warning">{error}</div>}
 {live?<><div className="kpis">{[["Attributed touches",metric.touches],["Attributed signups",metric.signups],["Attributed payments",metric.paid],["Attributed revenue",money(metric.revenue)]].map(([label,value])=><article key={label}><span>{label}</span><strong>{typeof value==="number"?fmt(value):value}</strong></article>)}</div>
 <HQPanel title="Which channels produce customers?"><div className="inner">{(live.sources??[]).length?live.sources!.map(x=><div key={x.source} className="source"><span>{x.source.replaceAll("_"," ")}</span><div><i style={{width:`${Math.min(100,100*(x.paid||0)/Math.max(1,...live.sources!.map(a=>a.paid||0)))}%`}}/></div><strong>{fmt(x.paid||0)}</strong></div>):<p className="caption">No attributed source rows. No tree growth inferred.</p>}</div></HQPanel>
 <p className="caption">A live tree showing retention, household-level paid status and daily decline requires verified, deduplicated household and payment history. This view intentionally does not invent them.</p></>:!loading&&!error?<p className="caption">No verified acquisition evidence returned.</p>:null}
 </>}
 <style jsx>{`
 .mode{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}.mode button,.actions button,.pay button,.foot button,.live-actions button,.events button{cursor:pointer;background:#122b41;border:1px solid #35516a;color:#e5f4ff;border-radius:11px;padding:10px 13px;font-weight:700;font-size:12px}.mode button[aria-pressed="true"]{border-color:#6dd6a3;background:#164737;color:#d3ffe4}.warning{font-size:11px;color:#bed3e6;border:1px solid #35516a;border-radius:10px;padding:10px 12px;margin-bottom:12px}.kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:12px}.kpis article{background:#102237;border:1px solid #34485e;border-radius:12px;padding:14px;min-width:0}.kpis span,.health span{display:block;font-size:10px;color:#acc3d7}.kpis strong{display:block;font-size:clamp(17px,2vw,26px);overflow-wrap:anywhere}.columns{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(300px,.8fr);gap:12px;margin-bottom:12px}.canvas{background:radial-gradient(ellipse at 50% 50%,#193e32,#0c2128 75%);border-radius:16px;color:white;overflow:hidden}.top{display:flex;justify-content:space-between;padding:20px 20px 0;gap:10px}.top h2{margin:0;font-size:22px}.top p{margin:4px 0;color:#b5d2c2;font-size:11px}.health{text-align:right}.health strong{font-size:24px}.tree{width:100%;display:block}.progress{padding:0 20px 20px;font-size:11px}.progress>div,.source>div{height:8px;background:#365244;border-radius:8px;overflow:hidden;margin-top:7px}.progress i,.source i{display:block;height:100%;background:#7cdda1}.inner{padding:14px}.actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.actions button{text-align:left;display:grid;gap:5px}.actions small{font-weight:400;color:#acc3d7}.pay{display:flex;gap:10px;align-items:end;flex-wrap:wrap;margin-top:15px}.pay label{flex:1;min-width:160px;color:#acc3d7;font-size:11px}.pay select{display:block;margin-top:5px;background:#0f2336;color:white;border:1px solid #35516a;padding:10px;border-radius:9px;width:100%}.pay button{background:#16573f;border-color:#52ba8a}.foot{display:flex;gap:7px;flex-wrap:wrap;margin-top:11px}.foot button:disabled{opacity:.45;cursor:not-allowed}.chart{width:100%}.caption{font-size:11px;color:#acc3d7;padding:4px 12px}.events{max-height:350px;overflow:auto}.events>div{border-bottom:1px solid #31465e;padding:8px 0;display:grid;gap:2px}.events span{font-size:10px;color:#8bd5ad}.events small{color:#aac0d4;font-size:11px}.live-actions{display:flex;gap:12px;align-items:center;margin:14px 0}.live-actions a{color:#a8d6ff}.source{display:grid;grid-template-columns:140px 1fr 42px;gap:10px;align-items:center;padding:9px 0;font-size:11px;text-transform:capitalize}.source>div{margin:0}.bottom{grid-template-columns:1fr 1fr}@media(max-width:900px){.columns,.bottom{grid-template-columns:1fr}}@media(max-width:640px){.kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.source{grid-template-columns:90px 1fr 32px}}
 `}</style>
 </HQPage>
}