"use client"
import Link from "next/link"
import {useEffect,useMemo,useState} from "react"
import {HQPage,HQPanel,hqButtonStyle} from "@/components/hq/HQShell"

type Question={id:string;prompt:string;options:string[];answer:number;clue:string}
type Mode="quiz"|"million"|"rush"|"reveal"|"pick"|"scratch"
const MODES:{id:Mode;name:string;description:string}[]=[
{id:"quiz",name:"VibeQuiz",description:"Answer five questions and share a result"},
{id:"million",name:"VibeMillion",description:"Climb the ten-level hot seat"},
{id:"rush",name:"VibeRush",description:"Race a 30-second countdown"},
{id:"reveal",name:"VibeReveal",description:"Reveal clues before answering"},
{id:"pick",name:"VibePick",description:"Choose between two answers"},
{id:"scratch",name:"VibeScratch",description:"Reveal a mystery question by tapping"}
]
const SEED:Question[]=[
{id:"a",prompt:"What is the capital city of Kenya?",options:["Nairobi","Kisumu","Nakuru","Mombasa"],answer:0,clue:"It is also Kenya's largest city."},
{id:"b",prompt:"What is 12 × 8?",options:["84","96","108","88"],answer:1,clue:"Think of eight groups of twelve."},
{id:"c",prompt:"Which ocean borders Kenya?",options:["Atlantic","Pacific","Indian","Arctic"],answer:2,clue:"It also borders India."},
{id:"d",prompt:"What is half of 150?",options:["65","70","75","85"],answer:2,clue:"Divide 150 into two equal parts."},
{id:"e",prompt:"Which planet is known as the Red Planet?",options:["Venus","Mars","Jupiter","Mercury"],answer:1,clue:"Its surface contains iron oxide."},
{id:"f",prompt:"Which is the largest two-digit number?",options:["90","98","99","100"],answer:2,clue:"Two digits can each be as high as nine."},
{id:"g",prompt:"What is 30% of 200?",options:["30","40","60","80"],answer:2,clue:"First find one tenth."},
{id:"h",prompt:"Which shape has three sides?",options:["Square","Triangle","Pentagon","Rectangle"],answer:1,clue:"Its name begins with tri."},
{id:"i",prompt:"What is 9 squared?",options:["18","72","81","90"],answer:2,clue:"Multiply nine by itself."},
{id:"j",prompt:"What is the next number: 3, 6, 9, 12, ...?",options:["13","14","15","18"],answer:2,clue:"Each term increases by three."}
]
const KEY="vibeschool.marketing.games.v1"
const field:React.CSSProperties={border:"1px solid #3c526d",background:"#0e2135",borderRadius:9,padding:"10px",color:"white",width:"100%",font:"inherit",minWidth:0}
const tile:React.CSSProperties={border:"1px solid #39506d",background:"#10253d",borderRadius:13,padding:15}
const flex:React.CSSProperties={display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}
const cards:React.CSSProperties={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:12}
const uid=()=>Math.random().toString(36).slice(2,10)+Date.now().toString(36)
export default function TrialMarketingGames(){
 const [bank,setBank]=useState<Question[]>(SEED)
 const [mode,setMode]=useState<Mode>("quiz")
 const [index,setIndex]=useState(0)
 const [score,setScore]=useState(0)
 const [picked,setPicked]=useState<number|null>(null)
 const [ended,setEnded]=useState(false)
 const [seconds,setSeconds]=useState(30)
 const [revealed,setRevealed]=useState(false)
 const [showClue,setShowClue]=useState(false)
 const [edit,setEdit]=useState(false)
 const [draft,setDraft]=useState<Question>({id:"",prompt:"",options:["","","",""],answer:0,clue:""})
 const [ready,setReady]=useState(false)
 const [message,setMessage]=useState("")
 useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem(KEY)||"null");if(Array.isArray(saved)&&saved.length){const valid=saved.filter((q:Question)=>typeof q.id==="string"&&typeof q.prompt==="string"&&Array.isArray(q.options)&&q.options.length===4&&q.options.every((s:string)=>typeof s==="string")&&Number.isInteger(q.answer)&&q.answer>=0&&q.answer<4&&typeof q.clue==="string");if(valid.length)setBank(valid.slice(0,100))}}catch{}setReady(true)},[])
 useEffect(()=>{if(ready)try{localStorage.setItem(KEY,JSON.stringify(bank))}catch{setMessage("Browser storage unavailable; changes are not saved.")}},[bank,ready])
 const count=mode==="million"?Math.min(10,bank.length):mode==="pick"?Math.min(5,bank.length):Math.min(5,bank.length)
 const question=bank[index%bank.length]
 const done=ended || index>=count
 const clock=mode==="rush"&&!done&&picked===null
 useEffect(()=>{if(!clock)return;const t=window.setInterval(()=>setSeconds(s=>Math.max(0,s-1)),1000);return()=>window.clearInterval(t)},[clock])
 useEffect(()=>{if(mode==="rush"&&seconds===0&&!ended)setEnded(true)},[seconds,mode,ended])
 function reset(next:Mode=mode){setMode(next);setIndex(0);setScore(0);setPicked(null);setEnded(false);setSeconds(30);setRevealed(false);setShowClue(false)}
 function answer(n:number){if(picked!==null||done)return;setPicked(n);if(n===question.answer)setScore(s=>s+1);else if(mode==="million")setEnded(true)}
 function next(){if(index+1>=count)setEnded(true);else{setIndex(i=>i+1);setPicked(null);setRevealed(false);setShowClue(false)}}
 function save(){if(!draft.prompt.trim()||draft.options.some(x=>!x.trim())){setMessage("Add a question and all four answers.");return}const q={...draft,id:draft.id||uid(),prompt:draft.prompt.trim(),options:draft.options.map(x=>x.trim()),clue:draft.clue.trim()};setBank(b=>draft.id?b.map(x=>x.id===q.id?q:x):[...b,q]);setDraft({id:"",prompt:"",options:["","","",""],answer:0,clue:""});setMessage("Question saved in this browser.");reset()}
 const share=()=>{const text="I scored "+score+"/"+count+" in "+MODES.find(m=>m.id===mode)?.name+"! Try VibeSchool: https://vibeschool.co.ke";void navigator.clipboard.writeText(text).then(()=>setMessage("Share message copied."),()=>setMessage("Could not copy. Browser permission may be needed."))}
 const exportBank=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(bank,null,2)],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download="vibeschool-marketing-games.json";a.click();window.setTimeout(()=>URL.revokeObjectURL(url),500)}
 return <HQPage title="Trial Marketing Games" description="Six playable founder-operated promotional formats. Use them in demos and recordings, then refine before public promotion." actions={<><Link href="/hq/marketing/lab" style={{color:"#a6d6ff"}}>← Marketing Lab</Link><button style={hqButtonStyle} onClick={exportBank}>Export question bank</button></>}>
 <p style={{fontSize:12,color:"#adc4db"}}>Private HQ trial · no external contestants, paid prizes or automatic posting · questions are shared across modes and saved only in this browser.</p>
 <div style={cards}>{MODES.map(m=><button key={m.id} onClick={()=>reset(m.id)} aria-pressed={mode===m.id} style={{...tile,textAlign:"left",color:"white",cursor:"pointer",outline:mode===m.id?"2px solid #36d7bd":"none"}}><strong>{m.name}</strong><p style={{fontSize:12,color:"#bdd0df",marginBottom:0}}>{m.description}</p></button>)}</div>
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,330px),1fr))",gap:16,marginTop:18,alignItems:"start"}}>
 <HQPanel title={MODES.find(m=>m.id===mode)?.name||"Game"} description="Press an answer and proceed. All outcomes are trial results, not awards.">
 <div style={{padding:16}}>
 <div style={{...flex,justifyContent:"space-between",marginBottom:18}}><span>Question {Math.min(index+1,count)} / {count}</span><strong>Score {score}</strong>{mode==="rush"&&<strong aria-live="off">{seconds}s</strong>}</div>
 <div style={{height:6,background:"#233d54",borderRadius:8,overflow:"hidden",marginBottom:18}}><div style={{height:"100%",background:"#31c9ba",width:Math.min(100,(index/count)*100)+"%"}}/></div>
 {done?<div style={{textAlign:"center",padding:"25px 5px"}}><div style={{fontSize:40}}>★</div><h2>Game complete</h2><p>You scored {score} out of {count}{mode==="million"&&picked!==null&&picked!==question.answer?" · Hot seat ended":""}.</p><div style={{...flex,justifyContent:"center"}}><button style={hqButtonStyle} onClick={()=>reset()}>Play again</button><button style={hqButtonStyle} onClick={share}>Copy result</button></div></div>:
 <>
 {mode==="scratch"&&!revealed?<div style={{...tile,textAlign:"center",padding:35}}><h2>Mystery question</h2><p>Tap to reveal what is underneath.</p><button style={hqButtonStyle} onClick={()=>setRevealed(true)}>Reveal question</button></div>:
 <>
 {mode==="reveal"&&!revealed?<div style={{...tile,textAlign:"center",padding:28}}><h2>Hidden challenge</h2><p>Reveal the clue, then guess.</p><button style={hqButtonStyle} onClick={()=>{setRevealed(true);setShowClue(true)}}>Reveal clue</button></div>:
 <>
 <h2 style={{fontSize:21,lineHeight:1.35}}>{question.prompt}</h2>
 {showClue&&question.clue&&<p style={{background:"#233b53",padding:10,borderRadius:7}}>Clue: {question.clue}</p>}
 <div style={{display:"grid",gap:9,gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))"}}>{question.options.slice(0,mode==="pick"?2:4).map((option,i)=><button key={i} disabled={picked!==null} onClick={()=>answer(i)} style={{...tile,textAlign:"left",color:"white",minHeight:65,cursor:picked===null?"pointer":"default",borderColor:picked!==null&&i===question.answer?"#3fdaa8":picked===i?"#f28e8e":"#39506d"}}>{option}</button>)}</div>
 {picked===null&&mode!=="rush"&&mode!=="pick"&&<button style={{...hqButtonStyle,marginTop:13}} onClick={()=>setShowClue(v=>!v)}>{showClue?"Hide clue":"Show clue"}</button>}
 {picked!==null&&<div style={{marginTop:14}}><p role="status">{picked===question.answer?"Correct!":"Answer recorded."} {mode==="pick"?"": "Correct answer: "+question.options[question.answer]+"."}</p><button style={hqButtonStyle} onClick={next}>{index+1===count?"Finish":"Next →"}</button></div>}
 </>}
 </>}
 </>}
 </div></HQPanel>
 <HQPanel title="Customize the games" description="One editable question bank. Different game styles, no duplicated content.">
 <div style={{padding:15}}>
 <p style={{color:"#acc4d8",fontSize:13}}>{bank.length} questions available. Saved to your current browser. Editing resets the current game.</p>
 <button style={hqButtonStyle} onClick={()=>setEdit(v=>!v)}>{edit?"Hide editor":"Edit questions"}</button>
 {edit&&<div style={{display:"grid",gap:10,marginTop:14}}>
 <label>Question<input style={field} value={draft.prompt} maxLength={250} onChange={e=>setDraft(d=>({...d,prompt:e.target.value}))}/></label>
 {draft.options.map((option,i)=><label key={i}>Answer {i+1}<input style={field} value={option} maxLength={160} onChange={e=>setDraft(d=>({...d,options:d.options.map((o,j)=>j===i?e.target.value:o)}))}/></label>)}
 <label>Correct answer<select style={field} value={draft.answer} onChange={e=>setDraft(d=>({...d,answer:Number(e.target.value)}))}>{[0,1,2,3].map(i=><option key={i} value={i}>Answer {i+1}</option>)}</select></label>
 <label>Optional clue<input style={field} value={draft.clue} maxLength={250} onChange={e=>setDraft(d=>({...d,clue:e.target.value}))}/></label>
 <button style={hqButtonStyle} onClick={save}>{draft.id?"Update question":"Add question"}</button>
 <div style={{maxHeight:300,overflowY:"auto"}}>{bank.map(q=><div key={q.id} style={{...flex,justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid #34465c"}}><span style={{fontSize:12,flex:"1 1 160px"}}>{q.prompt}</span><button style={hqButtonStyle} onClick={()=>setDraft({...q,options:[...q.options]})}>Edit</button><button disabled={bank.length<=1} style={hqButtonStyle} onClick={()=>{if(window.confirm("Delete this question?")){setBank(b=>b.filter(x=>x.id!==q.id));reset()}}}>Remove</button></div>)}</div>
 </div>}
 {message&&<p role="status" style={{fontSize:12,color:"#ffcf83"}}>{message}</p>}
 <p style={{fontSize:12,color:"#acc4d8",marginTop:12}}>VibePick presents the first two choices as a binary choice; in that format a selection is an opinion, not a factual grade. Use suitable two-choice questions when recording.</p>
 </div></HQPanel>
 </div>
 <p style={{fontSize:12,color:"#acc4d8",marginTop:18}}>Trial formats: VibeScratch uses tap-to-reveal rather than touch scratching; VibeRush has a 30-second clock. These are playable prototypes, not public contests or verified prize draws.</p>
 </HQPage>
}
