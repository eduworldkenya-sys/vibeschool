"use client"
import {useEffect,useRef,useState} from "react"
import styles from "./games-studio.module.css"

type Question={id:string;prompt:string;options:string[];answer:number;clue:string}
type Mode="quiz"|"million"|"rush"|"reveal"|"pick"|"scratch"
type Phase="ready"|"play"|"result"
const STORAGE="vibeschool.marketing.games.v1"
const MODES:{id:Mode;name:string;subtitle:string;symbol:string;accent:string}[]=[
{id:"quiz",name:"VibeQuiz",subtitle:"The quick-fire challenge",symbol:"?",accent:"#64ebce"},
{id:"million",name:"VibeMillion",subtitle:"Take the hot seat",symbol:"◆",accent:"#fbd26c"},
{id:"rush",name:"VibeRush",subtitle:"30 seconds. Go.",symbol:"↗",accent:"#ff8e91"},
{id:"reveal",name:"VibeReveal",subtitle:"Uncover the answer",symbol:"◈",accent:"#9eb8ff"},
{id:"pick",name:"VibePick",subtitle:"One choice. Two options.",symbol:"⇄",accent:"#ffad6d"},
{id:"scratch",name:"VibeScratch",subtitle:"Scratch the mystery",symbol:"✦",accent:"#e8a3ff"}
]
const SEED:Question[]=[
{id:"a",prompt:"What is the capital city of Kenya?",options:["Nairobi","Kisumu","Nakuru","Mombasa"],answer:0,clue:"This city is home to the Parliament of Kenya."},
{id:"b",prompt:"What is 12 × 8?",options:["84","96","108","88"],answer:1,clue:"Try 10 × 8, then add 2 × 8."},
{id:"c",prompt:"Which ocean borders Kenya?",options:["Atlantic","Pacific","Indian","Arctic"],answer:2,clue:"Its waters extend eastward toward Asia."},
{id:"d",prompt:"What is half of 150?",options:["65","70","75","85"],answer:2,clue:"Split 100 and 50 into two equal parts."},
{id:"e",prompt:"Which planet is known as the Red Planet?",options:["Venus","Mars","Jupiter","Mercury"],answer:1,clue:"It is the fourth planet from the Sun."},
{id:"f",prompt:"Which is the largest two-digit number?",options:["90","98","99","100"],answer:2,clue:"Both digits can be as large as nine."},
{id:"g",prompt:"What is 30% of 200?",options:["30","40","60","80"],answer:2,clue:"Calculate 10%, then triple that amount."},
{id:"h",prompt:"Which shape has three sides?",options:["Square","Triangle","Pentagon","Rectangle"],answer:1,clue:"The prefix 'tri' means three."},
{id:"i",prompt:"What is 9 squared?",options:["18","72","81","90"],answer:2,clue:"Multiply 9 by itself."},
{id:"j",prompt:"What comes next: 3, 6, 9, 12, ...?",options:["13","14","15","18"],answer:2,clue:"The difference between successive terms is constant."}
]
const blank=():Question=>({id:"",prompt:"",options:["","","",""],answer:0,clue:""})
const uid=()=>Math.random().toString(36).slice(2)+Date.now().toString(36)
const valid=(value:unknown):value is Question=>{if(!value||typeof value!=="object")return false;const q=value as Partial<Question>;return typeof q.id==="string"&&typeof q.prompt==="string"&&q.prompt.length<=250&&Array.isArray(q.options)&&q.options.length===4&&q.options.every(x=>typeof x==="string"&&x.length<=160)&&Number.isInteger(q.answer)&&Number(q.answer)>=0&&Number(q.answer)<4&&typeof q.clue==="string"&&q.clue.length<=250}
export default function GamesStudio(){
 const [bank,setBank]=useState<Question[]>(SEED)
 const [loaded,setLoaded]=useState(false)
 const [mode,setMode]=useState<Mode>("quiz")
 const [phase,setPhase]=useState<Phase>("ready")
 const [index,setIndex]=useState(0)
 const [score,setScore]=useState(0)
 const [chosen,setChosen]=useState<number|null>(null)
 const [seconds,setSeconds]=useState(30)
 const [clues,setClues]=useState(0)
 const [scratch,setScratch]=useState(0)
 const [fifty,setFifty]=useState(false)
 const [sound,setSound]=useState(false)
 const [record,setRecord]=useState(false)
 const [editor,setEditor]=useState(false)
 const [draft,setDraft]=useState<Question>(blank())
 const [message,setMessage]=useState("")
 const stageRef=useRef<HTMLDivElement>(null)
 const touchRef=useRef(false)
 const audioRef=useRef<AudioContext|null>(null)
 const currentMode=MODES.find(m=>m.id===mode)!
 const target=mode==="million"?Math.min(10,bank.length):Math.min(5,bank.length)
 const question=bank[Math.min(index,bank.length-1)]
 const optionIds=mode==="pick"?[question.answer,(question.answer+1)%4].sort((a,b)=>a-b):[0,1,2,3]
 const visibleIds=optionIds.filter(i=>!fifty||i===question.answer||i===((question.answer+1)%4))
 const answered=chosen!==null
 useEffect(()=>{try{const raw=JSON.parse(localStorage.getItem(STORAGE)||"null");if(Array.isArray(raw)){const good=raw.filter(valid).slice(0,100);if(good.length)setBank(good)}}catch{}setLoaded(true)},[])
 useEffect(()=>{if(loaded)try{localStorage.setItem(STORAGE,JSON.stringify(bank))}catch{setMessage("Storage is unavailable. Export your questions to keep a backup.")}},[bank,loaded])
 useEffect(()=>{if(phase!=="play"||mode!=="rush")return;const id=window.setInterval(()=>setSeconds(s=>Math.max(0,s-1)),1000);return()=>window.clearInterval(id)},[phase,mode])
 useEffect(()=>{if(mode==="rush"&&seconds===0&&phase==="play")setPhase("result")},[mode,seconds,phase])
 useEffect(()=>()=>{if(audioRef.current)void audioRef.current.close()},[])
 function tone(win:boolean){if(!sound)return;try{const Audio=window.AudioContext;if(!Audio)return;const context=audioRef.current??new Audio();audioRef.current=context;const osc=context.createOscillator(),gain=context.createGain();osc.type="sine";osc.frequency.value=win?660:220;gain.gain.setValueAtTime(.035,context.currentTime);gain.gain.exponentialRampToValueAtTime(.001,context.currentTime+.23);osc.connect(gain);gain.connect(context.destination);osc.start();osc.stop(context.currentTime+.24)}catch{}}
 function reset(next:Mode=mode){setMode(next);setPhase("ready");setIndex(0);setScore(0);setChosen(null);setSeconds(30);setClues(0);setScratch(0);setFifty(false)}
 function start(){setPhase("play");setIndex(0);setScore(0);setChosen(null);setSeconds(30);setClues(0);setScratch(0);setFifty(false)}
 function answer(i:number){if(phase!=="play"||answered)return;setChosen(i);const yes=i===question.answer;if(yes)setScore(x=>x+1);tone(yes);if(mode==="million"&&!yes)setPhase("result")}
 function advance(){if(index+1>=target)setPhase("result");else{setIndex(x=>x+1);setChosen(null);setClues(0);setScratch(0);setFifty(false)}}
 function saveQuestion(){if(!draft.prompt.trim()||draft.options.some(x=>!x.trim())){setMessage("Enter a question and four answers.");return}const q={...draft,id:draft.id||uid(),prompt:draft.prompt.trim(),options:draft.options.map(x=>x.trim()),clue:draft.clue.trim()};setBank(old=>draft.id?old.map(x=>x.id===q.id?q:x):[...old,q]);setDraft(blank());setMessage("Saved to this browser.");reset()}
 function exportQuestions(){const link=URL.createObjectURL(new Blob([JSON.stringify(bank,null,2)],{type:"application/json"}));const a=document.createElement("a");a.href=link;a.download="vibeschool-game-questions.json";a.click();window.setTimeout(()=>URL.revokeObjectURL(link),2000)}
 async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await stageRef.current?.requestFullscreen()}catch{setMessage("Fullscreen is not available on this device.")}}
 async function share(){const content="I scored "+score+"/"+target+" playing "+currentMode.name+" on VibeSchool! https://vibeschool.co.ke";try{await navigator.clipboard.writeText(content);setMessage("Result copied.")}catch{setMessage("Copy is unavailable on this device.")}}
 const scratchReady=mode!=="scratch"||scratch>=100
 const revealReady=mode!=="reveal"||clues>0
 return <main className={styles.page} style={{["--accent" as string]:currentMode.accent}}>
 <div className={styles.shell}>
 <header className={styles.header}><div><div className={styles.brand}><span className={styles.mark}>V</span> VIBESCHOOL <span className={styles.brandLight}>ORIGINALS</span></div><div className={styles.eyebrow}>THE UNLISTED PLAYGROUND / TRIAL EDITION</div><h1>Make it a <em>game.</em></h1><p>Six distinctive formats. One creative playground. Built for recordings, experiments and fun.</p></div><div className={styles.headerActions}><button type="button" onClick={()=>setEditor(x=>!x)}>{editor?"Close question editor":"Question studio"}</button><button type="button" onClick={exportQuestions}>Export questions</button></div></header>
 <nav className={styles.modeStrip} aria-label="Choose a game">{MODES.map(m=><button key={m.id} aria-pressed={mode===m.id} className={mode===m.id?styles.modeActive:""} onClick={()=>reset(m.id)}><span className={styles.modeIcon}>{m.symbol}</span><span><strong>{m.name}</strong><small>{m.subtitle}</small></span></button>)}</nav>
 <div className={record?styles.recordLayout:styles.layout}>
 {!record&&<aside className={styles.side}><div className={styles.sideCard}><span className={styles.kicker}>NOW PLAYING</span><h2>{currentMode.name}</h2><p>{currentMode.subtitle}</p><div className={styles.statGrid}><div><strong>{bank.length}</strong><span>Questions</span></div><div><strong>{target}</strong><span>Round length</span></div></div><button className={styles.start} onClick={start}>Start new round <span>→</span></button><div className={styles.muted}>Every format shares an editable question bank. No automatic publishing or cash rewards.</div></div><div className={styles.sideCard}><span className={styles.kicker}>CREATOR CONTROLS</span><label className={styles.toggle}><input type="checkbox" checked={sound} onChange={e=>setSound(e.target.checked)}/> Sound effects</label><label className={styles.toggle}><input type="checkbox" checked={record} onChange={e=>setRecord(e.target.checked)}/> Recording view</label><button onClick={fullscreen}>Fullscreen game stage ↗</button><div className={styles.muted}>For recording, use your phone or PC screen recorder. No camera permission is requested.</div></div></aside>}
 <section className={styles.playArea} aria-label="Game preview"><div className={styles.previewLabel}><span><i/> LIVE PREVIEW</span><span>{mode.toUpperCase()} · 01</span></div>
 <div className={styles.stage} ref={stageRef}>
 <div className={styles.orbOne}/><div className={styles.orbTwo}/><div className={styles.gridTexture}/>
 <div className={styles.stageTop}><div className={styles.stageBrand}><span className={styles.stageLogo}>V</span> VIBESCHOOL <strong>PLAY</strong></div><span className={styles.stageTag}>CREATOR TRIAL</span></div>
 <div className={styles.stageBody}>
 {phase==="ready"?<div className={styles.intro}><div className={styles.heroSymbol}>{currentMode.symbol}</div><span className={styles.kicker}>INTRODUCING</span><h2>{currentMode.name}</h2><p>{currentMode.subtitle}</p><div className={styles.introTags}><span>✦ Interactive</span><span>◉ Instant feedback</span><span>↗ Share-worthy</span></div><button className={styles.bigButton} onClick={start}>LET&apos;S PLAY <span>→</span></button></div>:phase==="result"?<div className={styles.intro} role="status"><div className={styles.heroSymbol}>★</div><span className={styles.kicker}>ROUND COMPLETE</span><h2>{score} <span className={styles.scoreOut}>/ {target}</span></h2><p>{mode==="million"&&chosen!==null&&chosen!==question.answer?"Hot seat ended — try another run.":score===target?"Flawless round!":"Good game. Can you do better?"}</p><div className={styles.finishActions}><button className={styles.bigButton} onClick={start}>PLAY AGAIN ↻</button><button className={styles.secondary} onClick={()=>void share()}>COPY RESULT ↗</button></div></div>:
 <div className={styles.questionScene}><div className={styles.roundMeta}><span>ROUND {String(index+1).padStart(2,"0")} / {String(target).padStart(2,"0")}</span><span>{mode==="rush"?"TIME LEFT "+seconds+"s":mode==="million"?"HOT SEAT · "+(index+1)*100+" PTS":"SCORE "+score}</span></div><div className={styles.progress}><span style={{width:(index/target)*100+"%"}}/></div>
 {mode==="scratch"&&!scratchReady?<div className={styles.revealPanel} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);touchRef.current=true;setScratch(s=>Math.min(100,s+20))}} onPointerMove={e=>{if(touchRef.current&&e.buttons>0)setScratch(s=>Math.min(100,s+7))}} onPointerUp={()=>{touchRef.current=false}} onPointerCancel={()=>{touchRef.current=false}}><span className={styles.revealIcon}>✦</span><h3>THE MYSTERY CARD</h3><p>Swipe across this panel to uncover today&apos;s question.</p><div className={styles.revealProgress}><span style={{width:scratch+"%"}}/></div><button onClick={()=>setScratch(100)}>Reveal instantly</button></div>:
 mode==="reveal"&&!revealReady?<div className={styles.revealPanel}><span className={styles.revealIcon}>◈</span><h3>WHAT&apos;S THE CHALLENGE?</h3><p>Open a clue before you make your choice.</p><button onClick={()=>setClues(1)}>UNVEIL THE CLUE ↗</button></div>:
 <><span className={styles.promptLabel}>{mode==="pick"?"THIS OR THAT":mode==="million"?"THE HOT SEAT":"YOUR CHALLENGE"}</span><h2 className={styles.prompt}>{question.prompt}</h2>{mode==="reveal"&&clues>0&&<p className={styles.clue}>CLUE · {question.clue||"Think carefully before answering."}</p>}
 <div className={mode==="pick"?styles.pickOptions:styles.options}>{visibleIds.map((i,j)=><button key={i} disabled={answered} onClick={()=>answer(i)} className={chosen!==null&&i===question.answer?styles.right:chosen===i?styles.wrong:""}><span className={styles.optionLetter}>{mode==="pick"?(j===0?"A":"B"):String.fromCharCode(65+i)}</span><span>{question.options[i]}</span>{chosen!==null&&i===question.answer&&<strong>✓</strong>}</button>)}</div>
 {mode==="million"&&!answered&&<div className={styles.lifelines}><button disabled={fifty} onClick={()=>setFifty(true)}>50:50 LIFELINE</button></div>}
 {answered&&<div className={styles.feedback} role="status"><span>{chosen===question.answer?"✓ CORRECT ANSWER":"✕ NOT QUITE"}</span><strong>{question.options[question.answer]}</strong><button onClick={advance}>{index+1>=target?"VIEW RESULT →":"NEXT QUESTION →"}</button></div>}
 </>}</div>}
 </div><div className={styles.stageBottom}><span>VIBESCHOOL ORIGINALS</span><span>PLAY · LEARN · DISCOVER</span></div>
 </div>
 <div className={styles.playTools}><div><strong>{phase==="play"?"LIVE ROUND":phase==="result"?"ROUND FINISHED":"READY TO PLAY"}</strong><span> {phase==="play"?"Choose an answer to continue.":"Choose a mode or start a new round."}</span></div><div className={styles.toolButtons}>{record&&<button onClick={()=>setRecord(false)}>Exit recording view</button>}<button onClick={fullscreen}>⛶ Fullscreen</button><button onClick={()=>reset()}>↻ Reset</button></div></div>
 </section></div>
 {editor&&!record&&<section className={styles.editor}><div className={styles.editorHead}><div><span className={styles.kicker}>CONTENT STUDIO</span><h2>Make your own game.</h2><p>Write once. Use the same questions in all six formats. Everything stays in this browser.</p></div><button onClick={()=>setEditor(false)}>Close editor ×</button></div><div className={styles.editorGrid}><div className={styles.editForm}><label>Question<input value={draft.prompt} maxLength={250} onChange={e=>setDraft(d=>({...d,prompt:e.target.value}))} placeholder="Ask something interesting..."/></label><div className={styles.answerGrid}>{draft.options.map((v,i)=><label key={i}>Answer {String.fromCharCode(65+i)}<input maxLength={160} value={v} onChange={e=>setDraft(d=>({...d,options:d.options.map((s,j)=>i===j?e.target.value:s)}))}/></label>)}</div><label>Correct answer<select value={draft.answer} onChange={e=>setDraft(d=>({...d,answer:Number(e.target.value)}))}>{[0,1,2,3].map(n=><option key={n} value={n}>Answer {String.fromCharCode(65+n)}</option>)}</select></label><label>Optional clue<input maxLength={250} value={draft.clue} onChange={e=>setDraft(d=>({...d,clue:e.target.value}))}/></label><div className={styles.editorActions}><button className={styles.bigButton} onClick={saveQuestion}>{draft.id?"SAVE CHANGES":"ADD QUESTION"}</button><button onClick={()=>setDraft(blank())}>Clear form</button></div></div><div className={styles.bankList}>{bank.map(q=><div key={q.id}><span>{q.prompt}</span><div><button onClick={()=>setDraft({...q,options:[...q.options]})}>Edit</button><button disabled={bank.length===1} onClick={()=>{if(window.confirm("Remove this question?")){setBank(b=>b.filter(x=>x.id!==q.id));reset()}}}>Remove</button></div></div>)}</div></div></section>}
 {message&&<p className={styles.toast} role="status">{message}</p>}
 <footer className={styles.footer}>UNLISTED CREATOR STUDIO <span>·</span> No prize promises <span>·</span> No automatic publishing <span>·</span> Local browser saves</footer>
 </div></main>
}
