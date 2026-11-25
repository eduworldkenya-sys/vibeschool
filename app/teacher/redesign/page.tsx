"use client";

import {useEffect,useRef,useState} from "react";
import Image from "next/image";
import {Bell,BookOpen,CalendarDays,CheckCircle2,CheckCheck,ChevronRight,ClipboardCheck,ClipboardList,History,Layers,LayoutGrid,Library,NotebookPen,Presentation,Radio,Settings,SlidersHorizontal,Video,X} from "lucide-react";
import {teacherTabs,teacherTools,type TeacherTab} from "@/components/teacher/navigation";
import s from "./redesign.module.css";

const stages=[{label:"Scheme",icon:Layers},{label:"Plan",icon:ClipboardList},{label:"Notes",icon:NotebookPen},{label:"Resources",icon:Library},{label:"Slides",icon:Presentation}];
const registry=Object.values(teacherTools).flat().filter(t=>t.href!=="/teacher/pulse"&&t.href!=="/teacher/more");
const defaults=["/teacher/lessonplan","/teacher/lesson-notes","/teacher/scheme","/teacher/timetable","/teacher/live-studio","/teacher/resources","/teacher/attendance","/teacher/homework","/teacher/assessment","/teacher/assessment/marking","/teacher/students"];
const short:Record<string,string>={"/teacher/lessonplan":"Plan","/teacher/lesson-notes":"Notes","/teacher/scheme":"Scheme","/teacher/live-studio":"Studio","/teacher/assessment":"Assess","/teacher/assessment/marking":"Marking"};
const initialPins=defaults.filter(href=>registry.some(t=>t.href===href));
type Theme="system"|"light"|"dark";
type DemoState="normal"|"empty"|"loading"|"error";
type Panel={kind:"stage";index:number}|{kind:"live"|"studio"|"past"|"mark"|"attendance"|"settings"|"notifications"|"teach"|"tools"|"timetable"}|{kind:"pending";label:string};
function toolPanel(href:string,label:string):Panel{
 const i=["/teacher/scheme","/teacher/lessonplan","/teacher/lesson-notes","/teacher/resources"].indexOf(href);
 if(i>=0)return {kind:"stage",index:i};
 switch(href){case "/teacher/live-studio":return {kind:"studio"};case "/teacher/attendance":return {kind:"attendance"};case "/teacher/assessment/marking":case "/teacher/homework":return {kind:"mark"};case "/teacher/timetable":return {kind:"timetable"};case "/teacher/settings":case "/teacher/profile":return {kind:"settings"};case "/teacher/notifications":return {kind:"notifications"};case "/teacher/teach-today":return {kind:"teach"};default:return {kind:"pending",label}}
}

export default function TeacherRedesignPage(){
 const [tab,setTab]=useState<TeacherTab>("today");
 const [theme,setTheme]=useState<Theme>("system");
 const [density,setDensity]=useState("compact"),[size,setSize]=useState("default");
 const [mode,setMode]=useState<DemoState>("normal"),[done,setDone]=useState([true,true,true,false,false]);
 const [audience,setAudience]=useState("Grade 4 Kilimanjaro"),[live,setLive]=useState<string|null>(null),[past,setPast]=useState<string[]>([]);
 const [mark,setMark]=useState(5),[attendance,setAttendance]=useState(2);
 const [pins,setPins]=useState(initialPins),[edit,setEdit]=useState(false),[query,setQuery]=useState("");
 const [panel,setPanel]=useState<Panel|null>(null),[message,setMessage]=useState("");
 const [notes,setNotes]=useState("Identify homophones in short sentences."),[draft,setDraft]=useState("");
 const [checked,setChecked]=useState(false);
 const dialog=useRef<HTMLDialogElement>(null);
 const opener=useRef<HTMLElement|null>(null);
 const completed=done.filter(Boolean).length;
 const open=(p:Panel)=>{opener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setMessage("");setChecked(p.kind==="stage"?done[p.index]:false);setDraft(p.kind==="stage"&&p.index===2?notes:"");setQuery("");setPanel(p)};
 const close=()=>{setPanel(null);setMessage("")};
 useEffect(()=>{const d=dialog.current;if(panel&&d&&!d.open)d.showModal();if(!panel&&d?.open){d.close();opener.current?.focus()}},[panel]);
 function reset(){setTheme("system");setDensity("compact");setSize("default");setMode("normal");setPins(initialPins);setDone([true,true,true,false,false]);setMark(5);setAttendance(2);setLive(null);setPast([]);setAudience("Grade 4 Kilimanjaro");setNotes("Identify homophones in short sentences.");setMessage("Preview reset")}
 function togglePin(href:string){setPins(old=>old.includes(href)?old.filter(x=>x!==href):old.length<11?[...old,href]:old)}
 const visible=registry.filter(t=>t.label.toLowerCase().includes(query.trim().toLowerCase()));
 const selectedTab=teacherTabs.find(t=>t.id===tab)!;
 const panelTitle=panel?.kind==="stage"?stages[panel.index].label:panel?.kind==="pending"?panel.label:panel?({live:"Live Classroom",studio:"Live Studio",past:"Past classes",mark:"Mark submissions",attendance:"Record attendance",settings:"Appearance & workspace",notifications:"Notifications",teach:"Teach lesson",tools:"All tools",timetable:"Timetable"}[panel.kind]):"";
 return <div className={s.shell} data-theme={theme} data-density={density} data-size={size}>
  <header className={s.header}>
   <div className={s.brand}><Image className={s.lightLogo} src="/brand/vibeschool-wordmark.svg" alt="VibeSchool" width={620} height={160}/><Image className={s.darkLogo} src="/brand/vibeschool-wordmark-dark.svg" alt="VibeSchool" width={620} height={160}/><small>Teacher workspace</small></div>
   <button className={s.iconButton} aria-label="Appearance settings" onClick={()=>open({kind:"settings"})}><Settings size={21}/></button>
   <button className={s.iconButton} aria-label="Notifications" onClick={()=>open({kind:"notifications"})}><Bell size={21}/></button>
   <button className={s.avatar} aria-label="Demo teacher profile" onClick={()=>open({kind:"settings"})}>M</button>
  </header>
  <main className={s.main} aria-label={selectedTab.label}>
   <div className={s.row}><h1>{selectedTab.label}</h1><span className={s.preview}>Redesign · mock data</span></div>
   {tab==="today"?<div className={s.layout}>
    <div className={s.stack}>
     <section className={s.hero} aria-label="Next lesson">
      <div className={s.row}><strong>Hello, Mumbi</strong><small>Sample timetable</small></div>
      {mode==="error"?<><p>Could not load the sample lesson.</p><button className={s.primary} onClick={()=>setMode("normal")}>Retry</button></>:mode==="loading"?<><p role="status">Loading sample lesson…</p><button className={s.outline} onClick={()=>setMode("normal")}>Show sample data</button></>:mode==="empty"?<><strong>No lesson scheduled</strong><div className={s.actions}><button className={s.primary} onClick={()=>open({kind:"stage",index:1})}>Prepare lesson</button><button className={s.outline} onClick={()=>open({kind:"timetable"})}>Timetable</button></div></>:<>
       <div className={s.lessonTitle}><small>Next lesson</small><strong>English</strong><time>2:00 PM</time></div><small>Grade 4 · Kilimanjaro</small>
       <div className={s.row}><small>Preparation</small><small>{completed}/5 done · {5-completed} remaining</small></div>
       <div className={s.stages}>{stages.map((stage,i)=><button key={stage.label} data-done={done[i]} aria-label={stage.label+(done[i]?", complete":", pending")} onClick={()=>open({kind:"stage",index:i})}>{done[i]?<CheckCircle2 size={19}/>:<stage.icon size={19}/>}<span>{stage.label}</span><span className={s.bar}/></button>)}</div>
       <div className={s.actions}><button className={s.primary} onClick={()=>open({kind:"stage",index:Math.max(0,done.indexOf(false))})}>{completed===5?"View preparation":"Continue preparation"}</button><button className={s.outline} onClick={()=>open({kind:"teach"})}>Teach now ↗</button></div>
      </>}
     </section>
     <section className={s.panel} aria-label="VibeSchool Live">
      <div className={s.liveHead}><div className={s.liveIcon}><Video size={24}/></div><div><h2>VibeSchool Live</h2><small>{live?"Sample class in progress":"Online classroom"}</small></div><button className={s.primary+" "+s.inline} onClick={()=>open({kind:"live"})}><Radio size={16}/>{live?"Resume":"Go Live"}</button></div>
      <div className={s.liveControls}><select aria-label="Live class audience" disabled={!!live} value={audience} onChange={e=>setAudience(e.target.value)}>{["Grade 4 Kilimanjaro","Invited learners","Public class"].map(a=><option key={a}>{a}</option>)}</select><button className={s.inline} onClick={()=>open({kind:"studio"})}><Presentation size={16}/>Studio</button><button className={s.inline} onClick={()=>open({kind:"past"})}><History size={16}/>Past</button></div>
     </section>
     <section className={s.panel+" "+s.counts} aria-label="Sample lesson records">
      <button onClick={()=>open({kind:"timetable"})}><strong>{mode==="empty"?0:4}</strong><small>Lessons</small></button><button onClick={()=>open({kind:"mark"})}><strong>{mark}</strong><small>To mark</small></button><button onClick={()=>open({kind:"attendance"})}><strong>{attendance}</strong><small>Attendance</small></button>
     </section>
    </div>
    <div className={s.stack}>
     <section className={s.panel} aria-label="Your workspace"><div className={s.row}><h2>Your workspace</h2><button aria-expanded={edit} className={s.inline} onClick={()=>{setEdit(!edit);setQuery("")}}><SlidersHorizontal size={18}/>{edit?"Done":"Edit"}</button></div>
      {edit?<><input type="search" aria-label="Find tools" placeholder="Find tools" value={query} onChange={e=>setQuery(e.target.value)}/><small>{pins.length}/11 shortcuts · preview session</small><div className={s.choices}>{visible.map(t=><label key={t.href}><input type="checkbox" checked={pins.includes(t.href)} disabled={!pins.includes(t.href)&&pins.length>=11} onChange={()=>togglePin(t.href)}/>{t.label}</label>)}</div>{!visible.length&&<p className={s.empty}>No matching tools</p>}<button className={s.outline} onClick={()=>setPins(initialPins)}>Reset shortcuts</button></>:<div className={s.tools}>{pins.map(href=>{const t=registry.find(x=>x.href===href);return t?<button key={href} onClick={()=>open(toolPanel(href,t.label))}><span className={s.toolIcon}><t.icon size={21}/></span>{short[href]??t.label}</button>:null})}<button onClick={()=>open({kind:"tools"})}><span className={s.toolIcon}><LayoutGrid size={21}/></span>All tools</button></div>}
     </section>
     <section className={s.panel}><h2>Action centre</h2><div className={s.queue}>{mark>0&&<button onClick={()=>open({kind:"mark"})}><CheckCheck size={20}/><span><strong>Mark {mark} submissions</strong><small>Grade 4 · Mathematics</small></span><ChevronRight size={17}/></button>}{attendance>0&&<button onClick={()=>open({kind:"attendance"})}><ClipboardCheck size={20}/><span><strong>Record attendance</strong><small>Grade 4 · English</small></span><ChevronRight size={17}/></button>}{completed<5&&mode==="normal"&&<button onClick={()=>open({kind:"stage",index:done.indexOf(false)})}><BookOpen size={20}/><span><strong>Continue preparation</strong><small>{stages[done.indexOf(false)].label} · English</small></span><ChevronRight size={17}/></button>}{!mark&&!attendance&&(completed===5||mode!=="normal")&&<p className={s.empty}>No pending actions</p>}</div></section>
    </div>
   </div>:<section className={s.panel}><h2>{selectedTab.label}</h2><p className={s.muted}>Full workspace not built yet. Existing tools are listed for reference.</p><div className={s.directory}>{teacherTools[tab].map(t=><button key={t.href} onClick={()=>open(toolPanel(t.href,t.label))}><t.icon size={20}/><span>{t.label}</span><ChevronRight size={16}/></button>)}</div></section>}
  </main>
  <nav className={s.nav} aria-label="Redesign navigation">{teacherTabs.map(t=><button key={t.id} aria-current={t.id===tab?"page":undefined} onClick={()=>{setTab(t.id);setEdit(false);setQuery("")}}><t.icon size={22}/>{t.label}</button>)}</nav>
  <dialog ref={dialog} className={s.dialog} aria-labelledby="redesign-panel-title" onCancel={e=>{e.preventDefault();close()}}>
   {panel&&<div className={s.dialogBody}><div className={s.row}><h2 id="redesign-panel-title">{panelTitle}</h2><button aria-label="Close" onClick={close}><X size={20}/></button></div>
    {panel.kind==="stage"?<><small>English · Grade 4 · Sample preparation</small>{panel.index===2?<label>Teacher notes<input type="text" value={draft} onChange={e=>setDraft(e.target.value)} style={{width:"100%",minHeight:44}}/></label>:<p>{["Review the scheme and learning outcomes.","Prepare the lesson sequence.","Review teacher notes.","Link a teaching resource.","Prepare the sample slide deck."][panel.index]}</p>}<label className={s.check}><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)}/>Preparation complete</label><button className={s.primary} onClick={()=>{setDone(old=>old.map((x,i)=>i===panel.index?checked:x));if(panel.index===2)setNotes(draft);close()}}>Save and return</button></>:
    panel.kind==="live"?<><small>{live??audience} · Mock classroom only</small><div className={s.liveCanvas}><Presentation size={38}/><strong>English</strong><span>{live?"Sample session active":"Ready for a sample session"}</span></div>{live?<button className={s.outline} onClick={()=>{setPast(p=>[live,...p]);setLive(null);close()}}>End sample class</button>:<button className={s.primary} onClick={()=>setLive(audience)}>Start sample class</button>}</>:
    panel.kind==="studio"?<><p>Prepare your sample lesson before going live.</p>{[4,3,2].map(i=><button key={i} className={s.outline+" "+s.inline} onClick={()=>open({kind:"stage",index:i})}>{stages[i].label} {done[i]?"· Complete":"· Pending"}</button>)}<button className={s.primary} onClick={()=>open({kind:"live"})}>Go Live (demo)</button></>:
    panel.kind==="past"?<>{past.length?past.map((a,i)=><p key={i}>English · {a} · Ended (sample)</p>):<p className={s.empty}>No ended sample classes</p>}</>:
    panel.kind==="mark"||panel.kind==="attendance"?<><p>{panel.kind==="mark"?mark+" sample submissions to mark":attendance+" sample lessons awaiting attendance"}</p><button className={s.primary} disabled={panel.kind==="mark"?mark===0:attendance===0} onClick={()=>{if(panel.kind==="mark")setMark(n=>Math.max(0,n-1));else setAttendance(n=>Math.max(0,n-1));setMessage("Sample record updated")}}>{panel.kind==="mark"?"Complete sample marking":"Save sample attendance"}</button></>:
    panel.kind==="settings"?<div className={s.settings}><label>Theme<select value={theme} onChange={e=>setTheme(e.target.value as Theme)}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label><label>Density<select value={density} onChange={e=>setDensity(e.target.value)}><option value="compact">Compact</option><option value="comfortable">Comfortable</option></select></label><label>Text size<select value={size} onChange={e=>setSize(e.target.value)}><option value="default">Default</option><option value="large">Large</option></select></label><label>Preview lesson state<select value={mode} onChange={e=>setMode(e.target.value as DemoState)}><option value="normal">Normal</option><option value="empty">Empty</option><option value="loading">Loading</option><option value="error">Error</option></select></label><small>Settings apply to this preview session only.</small><button className={s.outline} onClick={reset}>Reset preview</button></div>:
    panel.kind==="tools"?<><input type="search" placeholder="Search tools" aria-label="Search all tools" value={query} onChange={e=>setQuery(e.target.value)}/><div className={s.directory}>{visible.map(t=><button key={t.href} onClick={()=>open(toolPanel(t.href,t.label))}><t.icon size={18}/><span>{t.label}</span><ChevronRight size={16}/></button>)}</div>{!visible.length&&<p className={s.empty}>No matching tools</p>}</>:
    panel.kind==="timetable"?<><small>Sample day · Grade 4</small>{mode==="empty"?<p>No lessons scheduled</p>:["8:00 · Mathematics","9:00 · Science","11:00 · Social Studies","14:00 · English"].map(t=><p key={t} className={s.inline}><CalendarDays size={17}/>{t}</p>)}</>:
    panel.kind==="teach"?<><strong>English · Homophones</strong><p>Sample teaching context. The full lesson workspace will be built separately.</p><button className={s.outline} onClick={()=>open({kind:"stage",index:1})}>View preparation</button><button className={s.primary} onClick={()=>open({kind:"studio"})}>Open Live Studio</button></>:
    panel.kind==="notifications"?<p className={s.empty}>No sample notifications</p>:<p>This tool remains in the existing Teacher App. Its redesigned workspace is not built yet.</p>}
    {message&&<p role="status" className={s.status}>{message}</p>}
   </div>}
  </dialog>
 </div>
}
