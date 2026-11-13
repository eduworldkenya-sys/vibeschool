"use client"
import Link from "next/link"
import {useEffect,useMemo,useState} from "react"
import {HQPage,HQPanel,hqButtonStyle} from "@/components/hq/HQShell"

type Stage="idea"|"draft"|"ready"|"scheduled"|"published"|"done"|"followup"
type Item={id:string;title:string;kind:string;stage:Stage;topic:string;draft:string;plan:string;tools:string;device:string;channel:string;date:string;url:string;result:string}
type Account={id:string;platform:string;label:string;url:string}
const KEY="vibeschool.marketing.lab.v1"
const STAGES:Stage[]=["idea","draft","ready","scheduled","published","done","followup"]
const CHANNELS=["YouTube","TikTok","Facebook","Instagram","WhatsApp","X","LinkedIn","Website","Other"]
const PLATFORMS:{name:string;home:string;post:string;domains:string[]}[]=[
{name:"YouTube",home:"https://www.youtube.com/",post:"https://studio.youtube.com/",domains:["youtube.com","youtu.be"]},
{name:"TikTok",home:"https://www.tiktok.com/",post:"https://www.tiktok.com/upload",domains:["tiktok.com"]},
{name:"Facebook",home:"https://www.facebook.com/",post:"https://www.facebook.com/",domains:["facebook.com","fb.com"]},
{name:"Instagram",home:"https://www.instagram.com/",post:"https://www.instagram.com/",domains:["instagram.com"]},
{name:"WhatsApp",home:"https://web.whatsapp.com/",post:"https://web.whatsapp.com/",domains:["whatsapp.com","wa.me"]},
{name:"X",home:"https://x.com/",post:"https://x.com/compose/post",domains:["x.com","twitter.com"]},
{name:"LinkedIn",home:"https://www.linkedin.com/",post:"https://www.linkedin.com/feed/",domains:["linkedin.com"]}
]
const STARTER:Item[]=[
{id:"spin",title:"Record a VibeSpin challenge",kind:"Challenge",stage:"idea",topic:"A short attention-grabbing question",draft:"",plan:"Set up the wheel, record a genuine episode, edit and share.",tools:"VibeSpin, phone camera",device:"Phone",channel:"YouTube",date:"",url:"",result:""},
{id:"podcast",title:"Why we built VibeSchool",kind:"Podcast",stage:"idea",topic:"What is the problem VibeSchool is solving?",draft:"Opening: The challenge facing learners and teachers. Middle: Show a real product feature. Closing: Invite viewers to try it.",plan:"Write talking points; record in a quiet space using phone or PC; edit; upload.",tools:"Phone microphone, computer, internet",device:"Phone",channel:"YouTube",date:"",url:"",result:""},
{id:"demo",title:"Show a learner using VibeSchool",kind:"Product demo",stage:"idea",topic:"A real lesson and exercise",draft:"",plan:"Record screen, verify privacy, edit, publish.",tools:"Screen recorder, CapCut",device:"PC",channel:"TikTok",date:"",url:"",result:""},
{id:"flyer",title:"Create VibeSchool introduction flyer",kind:"Flyer",stage:"idea",topic:"Learn with VibeSchool",draft:"",plan:"Design in Canva and share a direct product link.",tools:"Canva, internet",device:"PC",channel:"WhatsApp",date:"",url:"",result:""}
]
const input:React.CSSProperties={background:"#0e2135",border:"1px solid #39516a",borderRadius:8,color:"#f4f8ff",padding:"9px 11px",width:"100%",font:"inherit",minWidth:0}
const grid:React.CSSProperties={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12}
const bar:React.CSSProperties={display:"flex",flexWrap:"wrap",gap:9,alignItems:"center"}
const panel:React.CSSProperties={border:"1px solid #34465c",borderRadius:12,padding:14,background:"#102339"}
const link:React.CSSProperties={color:"#9ed1ff"}
function https(v:string){try{const u=new URL(v);return u.protocol==="https:"?u.href:""}catch{return ""}}
const id=()=>Math.random().toString(36).slice(2)+Date.now().toString(36)
export default function MarketingLab(){
 const [items,setItems]=useState<Item[]>(STARTER)
 const [accounts,setAccounts]=useState<Account[]>([])
 const [ready,setReady]=useState(false)
 const [tab,setTab]=useState<"ideas"|"accounts"|"tools">("ideas")
 const [filter,setFilter]=useState("all")
 const [title,setTitle]=useState("")
 const [kind,setKind]=useState("Podcast")
 const [platform,setPlatform]=useState("YouTube")
 const [label,setLabel]=useState("")
 const [url,setUrl]=useState("")
 const [message,setMessage]=useState("")
 useEffect(()=>{try{const raw=localStorage.getItem(KEY);if(raw){const data=JSON.parse(raw);if(Array.isArray(data.items)&&Array.isArray(data.accounts)){setItems(data.items);setAccounts(data.accounts)}}}catch{setMessage("Could not load saved browser data.")}setReady(true)},[])
 useEffect(()=>{if(ready){try{localStorage.setItem(KEY,JSON.stringify({items,accounts}))}catch{setMessage("Browser storage unavailable: export your data.")}}},[ready,items,accounts])
 const counts=useMemo(()=>STAGES.map(s=>({name:s,count:items.filter(x=>x.stage===s).length})),[items])
 const update=(key:string,patch:Partial<Item>)=>setItems(old=>old.map(x=>x.id===key?{...x,...patch}:x))
 const add=()=>{if(!title.trim())return;setItems(old=>[{id:id(),title:title.trim().slice(0,180),kind,stage:"idea",topic:"",draft:"",plan:"",tools:"Phone, PC, internet",device:"Phone",channel:"YouTube",date:"",url:"",result:""},...old]);setTitle("");setFilter("all")}
 const addAccount=()=>{const p=PLATFORMS.find(x=>x.name===platform)!;const u=https(url);if(!u||!p.domains.some(d=>new URL(u).hostname===d||new URL(u).hostname.endsWith("."+d))){setMessage("Use a valid HTTPS profile address for the chosen platform.");return}setAccounts(old=>[...old,{id:id(),platform,label:label.trim()||platform,url:u}]);setLabel("");setUrl("");setMessage("Social account shortcut saved locally.")}
 const exportData=()=>{const blob=new Blob([JSON.stringify({items,accounts},null,2)],{type:"application/json"});const objectUrl=URL.createObjectURL(blob);const a=document.createElement("a");a.href=objectUrl;a.download="vibeschool-marketing-lab.json";a.click();setTimeout(()=>URL.revokeObjectURL(objectUrl),1000)}
 return <HQPage title="Marketing Lab" description="Our ideas, drafts, content schedule, social links and VibeSchool-original promotional tools. Built for one person with a phone, PC and internet." actions={<><Link href="/hq/marketing" style={link}>Marketing intelligence</Link><button style={hqButtonStyle} onClick={exportData}>Export backup</button></>}>
 <p style={{fontSize:12,color:"#a9bfd5"}}>Private HQ · browser-local workspace, not cloud-synced · scheduling tracks your plan but does not auto-publish.</p>
 {message&&<p role="status" style={{color:"#ffd08b"}}>{message}</p>}
 <section style={{...grid,marginBottom:16}}>{counts.map(x=><div key={x.name} style={panel}><span style={{textTransform:"capitalize",color:"#afc5d9",fontSize:12}}>{x.name}</span><div style={{fontSize:28,fontWeight:750}}>{x.count}</div></div>)}</section>
 <div style={{...bar,marginBottom:16}}>{([["ideas","Ideas & production"],["accounts","Our social accounts"],["tools","Our tools"]] as const).map(([key,name])=><button key={key} onClick={()=>setTab(key)} aria-pressed={tab===key} style={{...hqButtonStyle,background:tab===key?"#225984":"#102339"}}>{name}</button>)}</div>
 {tab==="ideas"&&<>
 <HQPanel title="Capture an idea" description="Podcast topics, talking points, videos, flyers, promotions and anything else we want to try."><div style={{...grid,padding:14}}>
 <label>Idea title<input style={input} value={title} maxLength={180} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Podcast: How VibeSchool works" /></label>
 <label>Type<select style={input} value={kind} onChange={e=>setKind(e.target.value)}>{["Podcast","Video","Product demo","Flyer","Challenge","VibeSpin","Blog","Live event","Promotion","Other"].map(x=><option key={x}>{x}</option>)}</select></label>
 <div style={{alignSelf:"end"}}><button style={hqButtonStyle} disabled={!title.trim()} onClick={add}>Add idea</button></div></div></HQPanel>
 <div style={{...bar,margin:"14px 0"}}><label>Show <select style={{...input,width:170,display:"inline-block",marginLeft:6}} value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All activities</option>{STAGES.map(x=><option key={x}>{x}</option>)}</select></label></div>
 <div style={{display:"grid",gap:12}}>{items.filter(x=>filter==="all"||x.stage===filter).map(x=><article key={x.id} style={panel}>
 <div style={{...bar,justifyContent:"space-between"}}><strong>{x.title}</strong><button style={{...hqButtonStyle,color:"#ffc6c6"}} onClick={()=>{if(window.confirm("Delete this idea and its draft?"))setItems(old=>old.filter(y=>y.id!==x.id))}}>Delete</button></div>
 <p style={{fontSize:12,color:"#a8c0d5"}}>{x.kind}</p><div style={grid}>
 <label>Stage<select style={input} value={x.stage} onChange={e=>update(x.id,{stage:e.target.value as Stage})}>{STAGES.map(s=><option key={s} value={s}>{s}</option>)}</select></label>
 <label>Publish to<select style={input} value={x.channel} onChange={e=>update(x.id,{channel:e.target.value})}>{CHANNELS.map(s=><option key={s}>{s}</option>)}</select></label>
 <label>Planned date<input type="date" style={input} value={x.date} onChange={e=>update(x.id,{date:e.target.value})}/></label>
 <label>Device<select style={input} value={x.device} onChange={e=>update(x.id,{device:e.target.value})}><option>Phone</option><option>PC</option><option>Phone and PC</option></select></label>
 <label>Topic / hook<input style={input} value={x.topic} onChange={e=>update(x.id,{topic:e.target.value})} placeholder="What should we talk about?"/></label>
 <label>Tools to use<input style={input} value={x.tools} onChange={e=>update(x.id,{tools:e.target.value})} placeholder="Camera, Canva, CapCut..."/></label>
 </div>
 <label style={{display:"block",marginTop:10}}>Draft / talking points / script<textarea style={{...input,minHeight:115}} value={x.draft} onChange={e=>update(x.id,{draft:e.target.value})} placeholder="Write your own opening, questions, discussion points and closing..." /></label>
 <label style={{display:"block",marginTop:10}}>How we will produce it<textarea style={{...input,minHeight:70}} value={x.plan} onChange={e=>update(x.id,{plan:e.target.value})} placeholder="Preparation, recording, editing and posting steps..." /></label>
 <div style={{...grid,marginTop:10}}><label>Published URL<input style={input} type="url" value={x.url} onChange={e=>update(x.id,{url:e.target.value})} placeholder="https://..."/></label><label>Results / next follow-up<input style={input} value={x.result} onChange={e=>update(x.id,{result:e.target.value})} placeholder="Views, enquiries, registrations, lessons learned"/></label></div>
 <div style={{...bar,marginTop:12}}>{https(x.url)&&<a style={link} href={https(x.url)} target="_blank" rel="noopener noreferrer">Open published content ↗</a>}{accounts.filter(a=>a.platform===x.channel).map(a=><a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer" style={link}>Open {a.label} ↗</a>)}{x.kind==="VibeSpin"&&<Link href="/spin-studio" style={link}>Open VibeSpin ↗</Link>}</div>
 </article>)}</div>
 </>}
 {tab==="accounts"&&<><HQPanel title="Our official accounts" description="Add the actual VibeSchool links. No guessed handles, passwords or third-party creators."><div style={{...grid,padding:14}}>
 <label>Platform<select style={input} value={platform} onChange={e=>setPlatform(e.target.value)}>{PLATFORMS.map(x=><option key={x.name}>{x.name}</option>)}</select></label>
 <label>Account name<input style={input} value={label} maxLength={80} onChange={e=>setLabel(e.target.value)} placeholder="VibeSchool official"/></label>
 <label>Profile URL<input style={input} type="url" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://..."/></label>
 <div style={{alignSelf:"end"}}><button style={hqButtonStyle} onClick={addAccount}>Save account</button></div>
 </div></HQPanel>
 <div style={{...grid,marginTop:14}}>{PLATFORMS.map(p=><article key={p.name} style={panel}><strong>{p.name}</strong><div style={{...bar,marginTop:10}}><a style={link} href={p.post} target="_blank" rel="noopener noreferrer">Posting tools ↗</a><a style={link} href={p.home} target="_blank" rel="noopener noreferrer">Platform ↗</a></div>{accounts.filter(a=>a.platform===p.name).map(a=><div key={a.id} style={{...bar,marginTop:12}}><a href={a.url} target="_blank" rel="noopener noreferrer" style={link}>{a.label} ↗</a><button style={hqButtonStyle} onClick={()=>setAccounts(old=>old.filter(x=>x.id!==a.id))}>Remove</button></div>)}{!accounts.some(a=>a.platform===p.name)&&<p style={{color:"#a8bfd5",fontSize:12}}>Add our official link when available.</p>}</article>)}</div></>}
 {tab==="tools"&&<div style={grid}>{[{name:"VibeSpin",detail:"Our interactive spinning wheel",href:"/spin-studio",internal:true},{name:"Canva",detail:"Flyers, posters and graphics",href:"https://www.canva.com/",internal:false},{name:"CapCut",detail:"Edit videos using a phone or PC",href:"https://www.capcut.com/",internal:false},{name:"Growth Command",detail:"Measure acquisition and conversion evidence",href:"/hq/growth",internal:true},{name:"Camera & screen recorder",detail:"Use the camera and screen recorder already on your device",href:"",internal:false}].map(t=><article key={t.name} style={panel}><strong>{t.name}</strong><p style={{color:"#a8bfd5",fontSize:12}}>{t.detail}</p>{t.href&&(t.internal?<Link href={t.href} style={link}>Open ↗</Link>:<a href={t.href} target="_blank" rel="noopener noreferrer" style={link}>Open ↗</a>)}</article>)}</div>}
 <p style={{marginTop:22,color:"#a8bfd5",fontSize:12}}>This lightweight first version keeps your ideas and drafts in this browser. Export backups regularly. Posting and scheduled publishing remain manual; existing HQ Marketing and Growth remain authoritative for campaign data and performance.</p>
 </HQPage>
}
