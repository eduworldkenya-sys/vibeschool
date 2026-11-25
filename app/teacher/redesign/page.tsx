"use client";

import {useEffect,useRef,useState} from "react";
import Image from "next/image";
import {Bell,BookOpen,CheckCircle2,CheckCheck,ChevronRight,ClipboardCheck,ClipboardList,History,Layers,LayoutGrid,Library,NotebookPen,Presentation,Radio,Settings,SlidersHorizontal,Video,X,ArrowLeft,PanelLeft,Search} from "lucide-react";
import {teacherTabs,teacherTools,type TeacherTab} from "@/components/teacher/navigation";
import s from "./redesign.module.css";
import {ActionButton,SearchField,SelectField,TextField,CheckField,FilterChips,StatusPill,StateView,Progress,DataTable} from "./ui";
import {parseDestination,destinationSearch,openingFor,toolPanel,type Panel,type Destination} from "./destination";

const stages=[{label:"Scheme",icon:Layers},{label:"Plan",icon:ClipboardList},{label:"Notes",icon:NotebookPen},{label:"Resources",icon:Library},{label:"Slides",icon:Presentation}];
const registry=Object.values(teacherTools).flat().filter(t=>t.href!=="/teacher/pulse"&&t.href!=="/teacher/more");
const defaults=["/teacher/lessonplan","/teacher/lesson-notes","/teacher/scheme","/teacher/timetable","/teacher/live-studio","/teacher/resources","/teacher/attendance","/teacher/homework","/teacher/assessment","/teacher/assessment/marking","/teacher/students"];
const short:Record<string,string>={"/teacher/lessonplan":"Plan","/teacher/lesson-notes":"Notes","/teacher/scheme":"Scheme","/teacher/live-studio":"Studio","/teacher/assessment":"Assess","/teacher/assessment/marking":"Marking"};
const initialPins=defaults.filter(href=>registry.some(t=>t.href===href));
type Theme="system"|"light"|"dark";
type DemoState="normal"|"empty"|"loading"|"error";
export default function TeacherRedesignPage(){
 const [tab,setTab]=useState<TeacherTab>("today");
 const [collapsed,setCollapsed]=useState(false);
 const [accent,setAccent]=useState("blue");
 const [toolCategory,setToolCategory]=useState("all");
 const swipeStart=useRef<number|null>(null);
 const swiped=useRef(false);
 const mainRef=useRef<HTMLElement>(null);
 const positions=useRef<Record<string,number>>({});
 const currentRoute=useRef<Destination>({tab:"today",panel:null});
 const historyDepth=useRef(0);
 const [theme,setTheme]=useState<Theme>("system");
 const [density,setDensity]=useState("compact"),[size,setSize]=useState("default");
 const [mode,setMode]=useState<DemoState>("normal"),[done,setDone]=useState([true,true,true,false,false]);
 const [audience,setAudience]=useState("Grade 4 Kilimanjaro"),[live,setLive]=useState<string|null>(null),[past,setPast]=useState<string[]>([]);
 const [mark,setMark]=useState(5),[attendance,setAttendance]=useState(2);
 const [pins,setPins]=useState(initialPins),[edit,setEdit]=useState(false),[query,setQuery]=useState("");
 const [panel,setPanel]=useState<Panel|null>(null),[message,setMessage]=useState("");
 const [notes,setNotes]=useState("Identify homophones in short sentences.");
 const [pendingChecks,setPendingChecks]=useState<Record<number,boolean>>({});
 const [notesDraft,setNotesDraft]=useState<string|null>(null);
 const checked=panel?.kind==="stage"?(pendingChecks[panel.index]??done[panel.index]):false;
 const opening=openingFor(panel);
 const isWorkspace=!!panel&&opening!=="sheet";
 const dialog=useRef<HTMLDialogElement>(null);
 const opener=useRef<HTMLElement|null>(null);
 const completed=done.filter(Boolean).length;
 const routeKey=(d:Destination)=>destinationSearch(d)||"?today";
 const applyRoute=(next:Destination)=>{
  const previous=currentRoute.current;
  if(mainRef.current&&(!previous.panel||openingFor(previous.panel)!=="sheet"))positions.current[routeKey(previous)]=mainRef.current.scrollTop;
  currentRoute.current=next;setTab(next.tab);setPanel(next.panel);setMessage("");
 };
 const navigate=(next:Destination)=>{
  if(routeKey(next)===routeKey(currentRoute.current))return;
  historyDepth.current+=1;
  window.history.pushState({redesignDepth:historyDepth.current},"",window.location.pathname+destinationSearch(next));
  applyRoute(next);
 };
 const open=(p:Panel)=>{
  if(!currentRoute.current.panel)opener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
  if(p.kind==="tools"){setQuery("");setToolCategory("all")}
  navigate({tab:currentRoute.current.tab,panel:p});
 };
 const close=()=>{
  if(historyDepth.current>0){window.history.back();return}
  const next:Destination={tab:currentRoute.current.tab,panel:null};
  window.history.replaceState({redesignDepth:0},"",window.location.pathname+destinationSearch(next));applyRoute(next);
 };
 const changeTab=(next:TeacherTab)=>{setEdit(false);navigate({tab:next,panel:null})};
 useEffect(()=>{
  const initial=parseDestination(window.location.search);
  historyDepth.current=0;
  window.history.replaceState({redesignDepth:0},"",window.location.pathname+destinationSearch(initial));applyRoute(initial);
  const pop=(event:PopStateEvent)=>{historyDepth.current=typeof event.state?.redesignDepth==="number"?event.state.redesignDepth:0;applyRoute(parseDestination(window.location.search))};
  window.addEventListener("popstate",pop);return()=>window.removeEventListener("popstate",pop);
 },[]);
 useEffect(()=>{
  const d=dialog.current;
  if(panel&&opening==="sheet"&&d&&!d.open)d.showModal();
  if((!panel||opening!=="sheet")&&d?.open)d.close();
  if(!panel&&opener.current?.isConnected)opener.current.focus({preventScroll:true});
  if(panel&&opening!=="sheet")mainRef.current?.focus({preventScroll:true});
  if(!panel||opening!=="sheet"){const target=positions.current[routeKey({tab,panel})]??0;mainRef.current?.scrollTo({top:target,behavior:"auto"})}
 },[tab,panel,opening]);
 function reset(){setAccent("blue");setToolCategory("all");setTheme("system");setDensity("compact");setSize("default");setMode("normal");setPins(initialPins);setDone([true,true,true,false,false]);setMark(5);setAttendance(2);setLive(null);setPast([]);setAudience("Grade 4 Kilimanjaro");setNotes("Identify homophones in short sentences.");setNotesDraft(null);setPendingChecks({});setMessage("Preview reset")}
 function togglePin(href:string){setPins(old=>old.includes(href)?old.filter(x=>x!==href):old.length<11?[...old,href]:old)}
 const visible=registry.filter(t=>t.label.toLowerCase().includes(query.trim().toLowerCase())&&(toolCategory==="all"||teacherTools[toolCategory as TeacherTab]?.some(x=>x.href===t.href)));
 const selectedTab=teacherTabs.find(t=>t.id===tab)!;
 const panelTitle=panel?.kind==="stage"?stages[panel.index].label:panel?.kind==="pending"?panel.label:panel?({live:"Live Classroom",studio:"Live Studio",past:"Past classes",mark:"Mark submissions",attendance:"Record attendance",settings:"Appearance & workspace",notifications:"Notifications",teach:"Teach lesson",tools:"All tools",timetable:"Timetable"}[panel.kind]):"";
 const panelContent=panel&&<div className={s.dialogBody}><div className={s.row}><h2 id="redesign-panel-title">{panelTitle}</h2><button aria-label={isWorkspace?"Back":"Close"} onClick={close}>{isWorkspace?<ArrowLeft size={20}/>:<X size={20}/>}</button></div>
    {panel.kind==="stage"?<><small>English · Grade 4 · Sample preparation</small>{panel.index===2?<TextField label="Teacher notes" multiline value={notesDraft??notes} onChange={setNotesDraft}/>:<p>{["Review the scheme and learning outcomes.","Prepare the lesson sequence.","Review teacher notes.","Link a teaching resource.","Prepare the sample slide deck."][panel.index]}</p>}<CheckField label="Preparation complete" checked={checked} onChange={e=>setPendingChecks(old=>({...old,[panel.index]:e.target.checked}))}/><button className={s.primary} onClick={()=>{setDone(old=>old.map((x,i)=>i===panel.index?checked:x));if(panel.index===2){setNotes(notesDraft??notes);setNotesDraft(null)}setPendingChecks(old=>{const next={...old};delete next[panel.index];return next});close()}}>Save and return</button></>:
    panel.kind==="live"?<><small>{live??audience} · Mock classroom only</small><div className={s.liveCanvas}><Presentation size={38}/><strong>English</strong><StatusPill tone={live?"success":"neutral"}>{live?"Sample session active":"Ready for a sample session"}</StatusPill></div>{live?<button className={s.outline} onClick={()=>{setPast(p=>[live,...p]);setLive(null);close()}}>End sample class</button>:<ActionButton onClick={()=>setLive(audience)}>Start sample class</ActionButton>}</>:
    panel.kind==="studio"?<><p>Prepare your sample lesson before going live.</p>{[4,3,2].map(i=><button key={i} className={s.outline+" "+s.inline} onClick={()=>open({kind:"stage",index:i})}>{stages[i].label} {done[i]?"· Complete":"· Pending"}</button>)}<button className={s.primary} onClick={()=>open({kind:"live"})}>Go Live (demo)</button></>:
    panel.kind==="past"?<>{past.length?past.map((a,i)=><p key={i}>English · {a} · Ended (sample)</p>):<p className={s.empty}>No ended sample classes</p>}</>:
    panel.kind==="mark"||panel.kind==="attendance"?<><p>{panel.kind==="mark"?mark+" sample submissions to mark":attendance+" sample lessons awaiting attendance"}</p><button className={s.primary} disabled={panel.kind==="mark"?mark===0:attendance===0} onClick={()=>{if(panel.kind==="mark")setMark(n=>Math.max(0,n-1));else setAttendance(n=>Math.max(0,n-1));setMessage("Sample record updated")}}>{panel.kind==="mark"?"Complete sample marking":"Save sample attendance"}</button></>:
    panel.kind==="settings"?<div className={s.settings}><SelectField label="Accent" value={accent} onChange={setAccent} options={[{value:"blue",label:"Intelligent Blue"},{value:"indigo",label:"Indigo"},{value:"teal",label:"Teal"},{value:"emerald",label:"Emerald"},{value:"neutral",label:"Neutral"}]}/><label>Theme<select value={theme} onChange={e=>setTheme(e.target.value as Theme)}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label><label>Density<select value={density} onChange={e=>setDensity(e.target.value)}><option value="compact">Compact</option><option value="comfortable">Comfortable</option></select></label><label>Text size<select value={size} onChange={e=>setSize(e.target.value)}><option value="default">Default</option><option value="large">Large</option></select></label><label>Preview lesson state<select value={mode} onChange={e=>setMode(e.target.value as DemoState)}><option value="normal">Normal</option><option value="empty">Empty</option><option value="loading">Loading</option><option value="error">Error</option></select></label><small>Settings apply to this preview session only.</small><button className={s.outline} onClick={reset}>Reset preview</button></div>:
    panel.kind==="tools"?<><SearchField label="Search all tools" placeholder="Search tools" value={query} onChange={setQuery}/><FilterChips label="Tool category" value={toolCategory} onChange={setToolCategory} options={[{value:"all",label:"All"},...teacherTabs.map(t=>({value:t.id,label:t.label}))]}/><div className={s.directory}>{visible.map(t=><button key={t.href} onClick={()=>open(toolPanel(t.href,t.label))}><t.icon size={18}/><span>{t.label}</span><ChevronRight size={16}/></button>)}</div>{!visible.length&&<p className={s.empty}>No matching tools</p>}</>:
    panel.kind==="timetable"?<><small>Sample day · Grade 4</small>{mode==="empty"?<p>No lessons scheduled</p>:<DataTable caption="Sample timetable" columns={["Time","Subject"]} rows={[["8:00","Mathematics"],["9:00","Science"],["11:00","Social Studies"],["14:00","English"]].map(([time,subject])=>({key:time,cells:[time,subject]}))}/>}</>:
    panel.kind==="teach"?<><strong>English · Homophones</strong><p>Sample teaching context. The full lesson workspace will be built separately.</p><button className={s.outline} onClick={()=>open({kind:"stage",index:1})}>View preparation</button><button className={s.primary} onClick={()=>open({kind:"studio"})}>Open Live Studio</button></>:
    panel.kind==="notifications"?<StateView kind="empty" title="No sample notifications"/>:<p>This tool remains in the existing Teacher App. Its redesigned workspace is not built yet.</p>}
    {message&&<p role="status" className={s.status}>{message}</p>}
   </div>;
 return <div className={s.shell} data-theme={theme} data-density={density} data-size={size} data-collapsed={collapsed} data-accent={accent} data-immersive={opening==="immersive"}>
  <header className={s.header}>
   <button className={s.railToggle+" "+s.iconButton} aria-label={collapsed?"Expand sidebar":"Collapse sidebar"} aria-expanded={!collapsed} onClick={()=>setCollapsed(v=>!v)}><PanelLeft size={21}/></button>
   <div className={s.brand}><Image className={s.lightLogo} src="/brand/vibeschool-wordmark.svg" alt="VibeSchool" width={620} height={160}/><Image className={s.darkLogo} src="/brand/vibeschool-wordmark-dark.svg" alt="VibeSchool" width={620} height={160}/><small>Teacher workspace</small></div>
   <button className={s.iconButton} aria-label="Search tools" onClick={()=>open({kind:"tools"})}><Search size={21}/></button>
   <button className={s.iconButton} aria-label="Appearance settings" onClick={()=>open({kind:"settings"})}><Settings size={21}/></button>
   <button className={s.iconButton} aria-label="Notifications" onClick={()=>open({kind:"notifications"})}><Bell size={21}/></button>
   <button className={s.avatar} aria-label="Demo teacher profile" onClick={()=>open({kind:"settings"})}>M</button>
  </header>
  <div className={s.workspace}>
  <nav className={s.nav} aria-label="Redesign navigation">{teacherTabs.map(t=><button key={t.id} aria-current={t.id===tab?"page":undefined} aria-label={t.label} title={t.label} onClick={()=>changeTab(t.id)}><t.icon size={22}/><span>{t.label}</span></button>)}</nav>
  <main ref={mainRef} tabIndex={-1} className={s.main} aria-label={isWorkspace?panelTitle:selectedTab.label}>
   {isWorkspace?<section className={s.fullWorkspace} data-opening={opening}>{panelContent}</section>:<>
   <div className={s.row}><h1>{selectedTab.label}</h1><span className={s.preview}>Redesign · mock data</span></div>
   {tab==="today"?<div className={s.layout}>
    <div className={s.stack}>
     <section className={s.hero} aria-label="Next lesson">
      <div className={s.row}><strong>Hello, Mumbi</strong><small>Sample timetable</small></div>
      {mode==="error"?<><StateView kind="error" title="Could not load the sample lesson." action={{label:"Retry",run:()=>setMode("normal")}}/></>:mode==="loading"?<><StateView kind="loading" title="Loading sample lesson…" action={{label:"Show sample data",run:()=>setMode("normal")}}/></>:mode==="empty"?<><strong>No lesson scheduled</strong><div className={s.actions}><button className={s.primary} onClick={()=>open({kind:"stage",index:1})}>Prepare lesson</button><button className={s.outline} onClick={()=>open({kind:"timetable"})}>Timetable</button></div></>:<>
       <div className={s.lessonTitle}><small>Next lesson</small><strong>English</strong><time>2:00 PM</time></div><small>Grade 4 · Kilimanjaro</small>
       <div className={s.row}><small>Preparation</small><small>{completed}/5 done · {5-completed} remaining</small></div><Progress value={completed} max={5} label="Lesson preparation"/>
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
     <section className={s.panel} aria-label="Your workspace"><div className={s.row}><h2>Your workspace</h2><button aria-expanded={edit} className={s.inline} onClick={()=>{setEdit(!edit);setQuery("");setToolCategory("all")}}><SlidersHorizontal size={18}/>{edit?"Done":"Edit"}</button></div>
      {edit?<><SearchField label="Find tools" placeholder="Find tools" value={query} onChange={setQuery}/><small>{pins.length}/11 shortcuts · preview session</small><div className={s.choices}>{visible.map(t=><label key={t.href}><input type="checkbox" checked={pins.includes(t.href)} disabled={!pins.includes(t.href)&&pins.length>=11} onChange={()=>togglePin(t.href)}/>{t.label}</label>)}</div>{!visible.length&&<p className={s.empty}>No matching tools</p>}<button className={s.outline} onClick={()=>setPins(initialPins)}>Reset shortcuts</button></>:<div className={s.tools}>{pins.map(href=>{const t=registry.find(x=>x.href===href);return t?<button key={href} onClick={()=>open(toolPanel(href,t.label))}><span className={s.toolIcon}><t.icon size={21}/></span>{short[href]??t.label}</button>:null})}<button onClick={()=>open({kind:"tools"})}><span className={s.toolIcon}><LayoutGrid size={21}/></span>All tools</button></div>}
     </section>
     <section className={s.panel}><h2>Action centre</h2><div className={s.queue}>{mark>0&&<button onClick={()=>open({kind:"mark"})}><CheckCheck size={20}/><span><strong>Mark {mark} submissions</strong><small>Grade 4 · Mathematics</small></span><ChevronRight size={17}/></button>}{attendance>0&&<button onClick={()=>open({kind:"attendance"})}><ClipboardCheck size={20}/><span><strong>Record attendance</strong><small>Grade 4 · English</small></span><ChevronRight size={17}/></button>}{completed<5&&mode==="normal"&&<button onClick={()=>open({kind:"stage",index:done.indexOf(false)})}><BookOpen size={20}/><span><strong>Continue preparation</strong><small>{stages[done.indexOf(false)].label} · English</small></span><ChevronRight size={17}/></button>}{!mark&&!attendance&&(completed===5||mode!=="normal")&&<p className={s.empty}>No pending actions</p>}</div></section>
    </div>
   </div>:<section className={s.panel}><h2>{selectedTab.label}</h2><p className={s.muted}>Full workspace not built yet. Existing tools are listed for reference.</p><div className={s.directory}>{teacherTools[tab].map(t=><button key={t.href} onClick={()=>open(toolPanel(t.href,t.label))}><t.icon size={20}/><span>{t.label}</span><ChevronRight size={16}/></button>)}</div></section>}
   </>}
  </main>
  </div>
  <dialog ref={dialog} className={s.dialog} aria-labelledby="redesign-panel-title" onCancel={e=>{e.preventDefault();close()}} onClick={e=>{if(e.target===e.currentTarget){const rect=e.currentTarget.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)close()}}}>
   {opening==="sheet"&&panel&&<><button className={s.sheetHandle} aria-label="Close sheet" onClick={()=>{if(swiped.current){swiped.current=false;return}close()}} onPointerDown={e=>{swiped.current=false;swipeStart.current=e.clientY;e.currentTarget.setPointerCapture(e.pointerId)}} onPointerUp={e=>{const start=swipeStart.current;swipeStart.current=null;if(start!==null&&e.clientY-start>48){e.preventDefault();swiped.current=true;close()}}} onPointerCancel={()=>{swipeStart.current=null}}><span/></button>{panelContent}</>}
  </dialog>
 </div>
}
