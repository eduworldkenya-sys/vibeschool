"use client";

import {useEffect,useRef,useState,useReducer} from "react";
import Image from "next/image";
import {Bell,BookOpen,CheckCircle2,CheckCheck,ChevronRight,ClipboardCheck,ClipboardList,History,Layers,LayoutGrid,Library,NotebookPen,Presentation,Radio,Settings,SlidersHorizontal,Video,X,ArrowLeft,PanelLeft,Search} from "lucide-react";
import {teacherTabs,teacherTools,type TeacherTab} from "@/components/teacher/navigation";
import s from "./redesign.module.css";
import DesignLab from "./design-lab";
import TeachWorkspace,{initialTeachView,type TeachView} from "./teach-workspace";
import {validPair} from "./teach-data";
import {SmartSearch,ReorderList,Accordion} from "./controls";
import {ActionButton,SearchField,SelectField,TextField,CheckField,StatusPill,StateView,Progress,DataTable} from "./ui";
import {createPreviewState,previewReducer,todayView,notifications,previewDate,classLabel,subjectLabel,sampleClasses,sampleSubjects,sampleLearners,sampleResources,sampleSlides,type Scope} from "./preview-state";
import {parseDestination,destinationSearch,openingFor,toolPanel,type Panel,type Destination} from "./destination";

const stages=[{label:"Scheme",icon:Layers},{label:"Plan",icon:ClipboardList},{label:"Notes",icon:NotebookPen},{label:"Resources",icon:Library},{label:"Slides",icon:Presentation}];
const registry=Object.values(teacherTools).flat().filter(t=>t.href!=="/teacher/pulse"&&t.href!=="/teacher/more");
const defaults=["/teacher/lessonplan","/teacher/lesson-notes","/teacher/scheme","/teacher/timetable","/teacher/live-studio","/teacher/resources","/teacher/attendance","/teacher/homework","/teacher/assessment","/teacher/assessment/marking","/teacher/students"];
const short:Record<string,string>={"/teacher/lessonplan":"Plan","/teacher/lesson-notes":"Notes","/teacher/scheme":"Scheme","/teacher/live-studio":"Studio","/teacher/assessment":"Assess","/teacher/assessment/marking":"Marking"};
const initialPins=defaults.filter(href=>registry.some(t=>t.href===href));
type Theme="system"|"light"|"dark";
type DemoState="normal"|"empty"|"loading"|"error"|"offline";
const defaultScope:Scope={classId:"all",subjectId:"all"};
const audienceLabel=(id:string)=>id==="tuition"?"Invited learners":id==="open"?"Public class":classLabel(id);
const timeLabel=(value:string)=>{const [hour,min]=value.split(":").map(Number);return (hour%12||12)+":"+String(min).padStart(2,"0")+(hour<12?" AM":" PM")};
export default function TeacherRedesignPage(){
 const [tab,setTab]=useState<TeacherTab>("today");
 const [collapsed,setCollapsed]=useState(false);
 const [accent,setAccent]=useState("blue");
 const [toolCategory,setToolCategory]=useState("all");
 const [toolQuery,setToolQuery]=useState("");
 const [recentTools,setRecentTools]=useState<string[]>([]);
 const swipeStart=useRef<number|null>(null);
 const swiped=useRef(false);
 const mainRef=useRef<HTMLElement>(null);
 const positions=useRef<Record<string,number>>({});
 const currentRoute=useRef<Destination>({tab:"today",panel:null});
 const historyDepth=useRef(0);
 const [theme,setTheme]=useState<Theme>("system");
 const [density,setDensity]=useState("compact"),[size,setSize]=useState("default");
 const [font,setFont]=useState("default"),[motion,setMotion]=useState("system");
 const [mode,setMode]=useState<DemoState>("normal");
 const [state,dispatch]=useReducer(previewReducer,undefined,createPreviewState);
 const [teachView,setTeachView]=useState<TeachView>(initialTeachView);
 const [scope,setScope]=useState<Scope>(defaultScope);
 const [context,setContext]=useState<"school"|"independent">("school");
 const [audienceChoice,setAudience]=useState("");
 const effectiveScope=context==="independent"?{classId:"independent",subjectId:"all"}:scope;
 const displayState=mode==="empty"?{...state,occurrences:state.occurrences.filter(x=>x.date!==previewDate)}:state;
 const view=todayView(displayState,effectiveScope);
 const next=view.next,live=view.active,mark=view.submissions.length,attendance=view.attendance.length;
 const audience=live?.audience??(context==="independent"?(audienceChoice==="open"?"open":"tuition"):audienceChoice||next?.classId||"class-4");
 const alerts=notifications(displayState,effectiveScope);
 const unread=alerts.filter(x=>!x.read).length;
 const past=state.sessions.filter(x=>x.status==="ended");
 const [pins,setPins]=useState(initialPins),[edit,setEdit]=useState(false),[query,setQuery]=useState("");
 const [panel,setPanel]=useState<Panel|null>(null),[message,setMessage]=useState("");
 const lesson=panel&&"occurrenceId" in panel&&panel.occurrenceId?state.occurrences.find(x=>x.id===panel.occurrenceId)??null:next;
 const teachingPanel=panel&&(panel.kind==="subjects"||panel.kind==="curriculum"||panel.kind==="scheme")?panel:null;
 const candidatePair=teachingPanel?.classId&&teachingPanel.subjectId?{classId:teachingPanel.classId,subjectId:teachingPanel.subjectId}:scope;
 const teachingScope=validPair(candidatePair,state.assignments)?candidatePair:state.assignments.find(a=>a.classId===scope.classId&&a.subjectId===scope.subjectId)??state.assignments.find(a=>a.classId===next?.classId&&a.subjectId===next?.subjectId)??state.assignments[0]??defaultScope;
 const draft=lesson?state.drafts[lesson.id]:undefined;
 const done=next?.preparation??[];
 const completed=done.filter(x=>x==="done").length;
 const unknown=done.filter(x=>x==="unknown").length;
 const nextStage=done.findIndex(x=>x!=="done");
 const checked=panel?.kind==="stage"&&lesson?(draft?.checks[panel.index]??(lesson.preparation[panel.index]==="done")):false;
 const noteValue=draft?.notes??lesson?.notes??"";
 const opening=openingFor(panel);
 const isWorkspace=!!panel&&opening!=="sheet";
 const dialog=useRef<HTMLDialogElement>(null);
 const opener=useRef<HTMLElement|null>(null);
 const routeKey=(d:Destination)=>destinationSearch(d)||"?today";
 const applyRoute=(next:Destination)=>{
  const previous=currentRoute.current;
  if(mainRef.current&&(!previous.panel||openingFor(previous.panel)!=="sheet"))positions.current[routeKey(previous)]=mainRef.current.scrollTop;
  currentRoute.current=next;setTab(next.tab);setPanel(next.panel);setMessage("");
 };
 const navigate=(next:Destination)=>{
  if(routeKey(next)===routeKey(currentRoute.current))return;
  historyDepth.current+=1;
  window.history.pushState({...window.history.state,redesignDepth:historyDepth.current},"",window.location.pathname+destinationSearch(next));
  applyRoute(next);
 };
 const open=(p:Panel)=>{
  if(!currentRoute.current.panel)opener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
  
  const prior=currentRoute.current.panel;
  const id=prior&&"occurrenceId" in prior?prior.occurrenceId:next?.id;
  const scoped=(p.kind==="stage"||p.kind==="teach"||p.kind==="studio"||p.kind==="live")&&!p.occurrenceId&&id?{...p,occurrenceId:id}:p;
  if(scoped.kind==="subjects"||scoped.kind==="curriculum"||scoped.kind==="scheme"){
   const chosen=scoped.classId&&scoped.subjectId?{classId:scoped.classId,subjectId:scoped.subjectId}:teachingScope;
   if(validPair(chosen,state.assignments)){navigate({tab:currentRoute.current.tab,panel:{...scoped,...chosen}});return}
  }
  navigate({tab:currentRoute.current.tab,panel:scoped});
 };
 const close=()=>{
  if(historyDepth.current>0){window.history.back();return}
  const next:Destination={tab:currentRoute.current.tab,panel:null};
  window.history.replaceState({...window.history.state,redesignDepth:0},"",window.location.pathname+destinationSearch(next));applyRoute(next);
 };
 const changeTab=(next:TeacherTab)=>{setEdit(false);navigate({tab:next,panel:null})};
 useEffect(()=>{
  const initial=parseDestination(window.location.search);
  historyDepth.current=0;
  window.history.replaceState({...window.history.state,redesignDepth:0},"",window.location.pathname+destinationSearch(initial));applyRoute(initial);
  const pop=(event:PopStateEvent)=>{historyDepth.current=typeof event.state?.redesignDepth==="number"?event.state.redesignDepth:0;applyRoute(parseDestination(window.location.search))};
  window.addEventListener("popstate",pop);return()=>window.removeEventListener("popstate",pop);
 },[]);
 useEffect(()=>{
  const d=dialog.current;
  if(panel&&opening==="sheet"&&d&&!d.open)d.showModal();
  if((!panel||opening!=="sheet")&&d?.open)d.close();
  if(!panel){if(opener.current?.isConnected)opener.current.focus({preventScroll:true});else mainRef.current?.focus({preventScroll:true})}
  if(panel&&opening!=="sheet")mainRef.current?.focus({preventScroll:true});
  if(!panel||opening!=="sheet"){const target=positions.current[routeKey({tab,panel})]??0;mainRef.current?.scrollTo({top:target,behavior:"auto"})}
 },[tab,panel,opening]);
 function reset(){setTeachView(initialTeachView);setAccent("blue");setToolCategory("all");setToolQuery("");setRecentTools([]);setQuery("");setTheme("system");setDensity("compact");setSize("default");setFont("default");setMotion("system");setMode("normal");setPins(initialPins);dispatch({type:"reset"});setScope(defaultScope);setContext("school");setAudience("");setMessage("Preview reset")}
 function togglePin(href:string){setPins(old=>old.includes(href)?old.filter(x=>x!==href):old.length<11?[...old,href]:old)}
 const visible=registry.filter(t=>t.label.toLowerCase().includes(query.trim().toLowerCase()));
 const toolSearchItems=teacherTabs.flatMap(tab=>teacherTools[tab.id].filter(t=>registry.some(r=>r.href===t.href)).map(t=>({id:t.href,label:t.label,category:tab.label})));
 const selectedTab=teacherTabs.find(t=>t.id===tab)!;
 const panelTitle=panel?.kind==="stage"?stages[panel.index].label:panel?.kind==="pending"?panel.label:panel?({live:"Live Classroom",studio:"Live Studio",past:"Past classes",mark:"Classroom assessment marking","homework-mark":"Mark homework submissions",attendance:"Record attendance",settings:"Appearance & workspace",notifications:"Notifications",teach:"Teach lesson",tools:"All tools",timetable:"Timetable",lab:"Design Lab",subjects:"Subject Hub",curriculum:"Curriculum Map",scheme:"Scheme of Work"}[panel.kind]):"";
 const panelContent=panel&&<div className={s.dialogBody}><div className={s.row}><h2 id="redesign-panel-title">{panelTitle}</h2><button aria-label={isWorkspace?"Back":"Close"} onClick={close}>{isWorkspace?<ArrowLeft size={20}/>:<X size={20}/>}</button></div>
    {teachingPanel?<TeachWorkspace panel={teachingPanel} state={state} dispatch={dispatch} scope={teachingScope} view={teachView} onView={patch=>setTeachView(old=>({...old,...patch}))} open={open} choose={pair=>{if(teachingPanel.kind==="subjects"){setScope(pair);setContext("school")}else open({kind:teachingPanel.kind,...pair})}}/>:
    panel.kind==="lab"?<DesignLab/>:
    panel.kind==="stage"?lesson?<><small>{subjectLabel(lesson.subjectId)} · {classLabel(lesson.classId)} · {lesson.date} {timeLabel(lesson.start)}</small><strong>{lesson.topic}</strong><small>Sample preparation · {lesson.preparation[panel.index]}</small>{panel.index===2?<TextField label="Teacher notes" multiline value={noteValue} onChange={notes=>dispatch({type:"draft",id:lesson.id,notes})}/>:panel.index===3?<p>Available: {sampleResources.filter(x=>x.subjectId===lesson.subjectId).map(x=>x.title).join(", ")||"No sample resource"}</p>:panel.index===4?<p>Available: {sampleSlides.filter(x=>x.occurrenceId===lesson.id).map(x=>x.title).join(", ")||"No sample slides"}</p>:<p>{panel.index===0?"Review sample scheme and learning outcomes.":"Review sample lesson plan."}</p>}<CheckField label="Sample preparation complete" disabled={panel.index===0} checked={checked} onChange={e=>dispatch({type:"draft",id:lesson.id,index:panel.index,checked:e.target.checked})}/><ActionButton disabled={panel.index===2&&checked&&!noteValue.trim()} onClick={()=>{dispatch({type:"savePreparation",id:lesson.id,index:panel.index});close()}}>Save and return</ActionButton>{panel.index===0&&<ActionButton variant="outline" onClick={()=>open({kind:"scheme",classId:lesson.classId,subjectId:lesson.subjectId})}>Open Scheme of Work</ActionButton>}<small>Full preparation editors are scheduled for the Teach workspace.</small></>:<StateView kind="empty" title="Choose a scheduled lesson" action={{label:"Open timetable",run:()=>open({kind:"timetable"})}}/>:
    panel.kind==="live"?<><small>{audienceLabel(live?.audience??audience)} · Mock classroom only</small><div className={s.liveCanvas}><Presentation size={38}/><strong>{live?.title??(lesson&&lesson.classId===audience?lesson.topic:"Sample online lesson")}</strong><StatusPill tone={live?.status==="active"?"success":live?.status==="paused"?"warning":"neutral"}>{live?.status==="active"?"Sample session active":live?.status==="paused"?"Sample session paused":"Ready for a sample session"}</StatusPill></div>{live?<><ActionButton variant="outline" onClick={()=>dispatch({type:live.status==="paused"?"resumeSession":"pauseSession",id:live.id})}>{live.status==="paused"?"Resume sample class":"Pause sample class"}</ActionButton><ActionButton variant="danger" onClick={()=>{dispatch({type:"endSession",id:live.id});close()}}>End sample class</ActionButton></>:<ActionButton onClick={()=>dispatch({type:"startSession",audience,occurrenceId:lesson?.id??null})}>Start sample class</ActionButton>}<small>Live teaching tools will be redesigned in the dedicated Live phase. No audio or real sessions.</small></>:
    panel.kind==="studio"?<><p>Prepare your sample lesson before going live.</p>{lesson?[4,3,2].map(i=><ActionButton key={i} variant="outline" onClick={()=>open({kind:"stage",index:i,occurrenceId:lesson.id})}>{stages[i].label} · {lesson.preparation[i]}</ActionButton>):<p>No selected dated lesson. Instant sample live remains available.</p>}<ActionButton onClick={()=>open({kind:"live",occurrenceId:lesson?.id})}>Go Live (demo)</ActionButton></>:
    panel.kind==="past"?<>{past.length?past.map(x=><div key={x.id} className={s.panel}><strong>{x.title}</strong><p>{audienceLabel(x.audience)} · Ended (sample)</p></div>):<StateView kind="empty" title="No ended sample classes"/>}</>:
    panel.kind==="mark"?<StateView kind="empty" title="Classroom marking workspace not yet redesigned" description="Homework submissions are a separate queue." action={{label:"Open homework queue",run:()=>open({kind:"homework-mark"})}}/>:
    panel.kind==="homework-mark"?<><small>{mark} sample homework submissions waiting. Full marking editor is a later phase.</small>{view.submissions.length?view.submissions.map(x=><div key={x.id} className={s.panel}><strong>{x.title}</strong><small>{sampleLearners.find(l=>l.id===x.learnerId)?.label} · {classLabel(x.classId)}</small><ActionButton variant="outline" onClick={()=>{dispatch({type:"markSubmission",id:x.id});setMessage("Sample submission marked")}}>Mark sample submission</ActionButton></div>):<StateView kind="empty" title="No pending homework submissions"/>}</>:
    panel.kind==="attendance"?<><small>{attendance} dated sample lessons awaiting attendance. Full attendance register is a later phase.</small>{view.attendance.length?view.attendance.map(x=><div key={x.id} className={s.panel}><strong>{subjectLabel(x.subjectId)} · {x.topic}</strong><small>{classLabel(x.classId)} · {x.date} {timeLabel(x.start)}</small><ActionButton variant="outline" onClick={()=>{dispatch({type:"recordAttendance",id:x.id});setMessage("Sample attendance completed")}}>Complete sample attendance</ActionButton></div>):<StateView kind="empty" title="No pending attendance"/>}</>:
    panel.kind==="settings"?<div className={s.settings}><SelectField label="Accent" value={accent} onChange={setAccent} options={[{value:"blue",label:"Intelligent Blue"},{value:"indigo",label:"Indigo"},{value:"teal",label:"Teal"},{value:"emerald",label:"Emerald"},{value:"neutral",label:"Neutral"}]}/><label>Theme<select value={theme} onChange={e=>setTheme(e.target.value as Theme)}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label><label>Density<select value={density} onChange={e=>setDensity(e.target.value)}><option value="compact">Compact</option><option value="comfortable">Comfortable</option><option value="detailed">Detailed</option></select></label><label>Text size<select value={size} onChange={e=>setSize(e.target.value)}><option value="default">Default</option><option value="large">Large</option><option value="extra-large">Extra large</option></select></label><SelectField label="Interface font" value={font} onChange={setFont} options={[{value:"default",label:"Default"},{value:"system",label:"System"}]}/><SelectField label="Motion" value={motion} onChange={setMotion} options={[{value:"system",label:"Follow system"},{value:"reduce",label:"Reduce motion"}]}/><label>Preview lesson state<select value={mode} onChange={e=>setMode(e.target.value as DemoState)}><option value="normal">Normal</option><option value="empty">Empty</option><option value="loading">Loading</option><option value="error">Error</option><option value="offline">Offline</option></select></label><small>Settings apply to this preview session only.</small><ActionButton variant="outline" onClick={()=>open({kind:"lab"})}>Open Design Lab</ActionButton><ActionButton variant="outline" onClick={reset}>Reset preview</ActionButton></div>:
    panel.kind==="tools"?<SmartSearch mode="filtered" label="Search all tools" items={toolSearchItems} value={toolQuery} onChange={setToolQuery} categoryValue={toolCategory} onCategoryChange={setToolCategory} recentValue={recentTools} onRecentChange={setRecentTools} renderIcon={item=>{const tool=registry.find(t=>t.href===item.id);return tool?<tool.icon size={18}/>:null}} onSelect={item=>open(toolPanel(item.id,item.label))}/>:
    panel.kind==="timetable"?<><small>Sample timetable · {previewDate}</small>{view.lessons.length?<DataTable caption="Sample timetable" columns={["Time","Subject","Class","Action"]} rows={view.lessons.map(x=>({key:x.id,cells:[timeLabel(x.start),subjectLabel(x.subjectId),classLabel(x.classId),<ActionButton key={x.id+"-open"} variant="outline" onClick={()=>open({kind:"teach",occurrenceId:x.id})}>Open lesson</ActionButton>]}))}/>:<StateView kind="empty" title="No lessons scheduled in this scope"/>}{next&&next.date!==previewDate&&<ActionButton variant="outline" onClick={()=>open({kind:"stage",index:1,occurrenceId:next.id})}>Prepare {next.date}</ActionButton>}</>:
    panel.kind==="teach"?lesson?<><strong>{subjectLabel(lesson.subjectId)} · {lesson.topic}</strong><small>{classLabel(lesson.classId)} · {lesson.date} {timeLabel(lesson.start)}</small><StatusPill tone={lesson.delivery==="taught"?"success":"neutral"}>{lesson.delivery}</StatusPill><ActionButton variant="outline" onClick={()=>open({kind:"stage",index:1,occurrenceId:lesson.id})}>View preparation</ActionButton>{lesson.delivery==="scheduled"&&lesson.date===previewDate?<ActionButton onClick={()=>dispatch({type:"startTeaching",id:lesson.id})}>Start sample lesson</ActionButton>:lesson.delivery==="teaching"?<ActionButton onClick={()=>{dispatch({type:"finishTeaching",id:lesson.id});setMessage("Sample lesson ended")}}>Finish sample lesson</ActionButton>:<p>{lesson.delivery==="taught"?"Sample delivery completed.":"Future lesson · preparation available."}</p>}<ActionButton variant="outline" onClick={()=>open({kind:"studio",occurrenceId:lesson.id})}>Open Live Studio</ActionButton></>:<StateView kind="empty" title="No selected dated lesson"/>:
    panel.kind==="notifications"?alerts.length?<>{alerts.map(a=><div className={s.panel} key={a.id}><strong>{a.label}</strong><small>{a.read?"Read":"Unread"} · Sample task</small><ActionButton variant="outline" onClick={()=>{dispatch({type:"readNotification",id:a.id});open({kind:a.kind==="mark"?"homework-mark":a.kind})}}>Open task</ActionButton></div>)}</>:<StateView kind="empty" title="No sample notifications"/>:<p>This tool remains in the existing Teacher App. Its redesigned workspace is not built yet.</p>}
    {message&&<p role="status" className={s.status}>{message}</p>}
   </div>;
 return <div className={s.shell} data-theme={theme} data-density={density} data-size={size} data-font={font} data-motion={motion} data-collapsed={collapsed} data-accent={accent} data-immersive={opening==="immersive"}>
  <header className={s.header}>
   <button className={s.railToggle+" "+s.iconButton} aria-label={collapsed?"Expand sidebar":"Collapse sidebar"} aria-expanded={!collapsed} onClick={()=>setCollapsed(v=>!v)}><PanelLeft size={21}/></button>
   <div className={s.brand}><Image className={s.lightLogo} src="/brand/vibeschool-wordmark.svg" alt="VibeSchool" width={620} height={160}/><Image className={s.darkLogo} src="/brand/vibeschool-wordmark-dark.svg" alt="VibeSchool" width={620} height={160}/><small>Teacher workspace</small></div>
   <button className={s.iconButton} aria-label="Search tools" onClick={()=>open({kind:"tools"})}><Search size={21}/></button>
   <button className={s.iconButton} aria-label="Appearance settings" onClick={()=>open({kind:"settings"})}><Settings size={21}/></button>
   <button className={s.iconButton} aria-label={"Notifications"+(unread?", "+unread+" unread":"")} onClick={()=>open({kind:"notifications"})}><Bell size={21}/>{unread>0&&<small aria-hidden="true" className={s.unreadCount}>{unread}</small>}</button>
   <button className={s.avatar} aria-label="Demo teacher profile" onClick={()=>open(toolPanel("/teacher/profile","Profile"))}>T</button>
  </header>
  <div className={s.workspace}>
  <nav className={s.nav} aria-label="Redesign navigation">{teacherTabs.map(t=><button key={t.id} aria-current={t.id===tab?"page":undefined} aria-label={t.label} title={t.label} onClick={()=>changeTab(t.id)}><t.icon size={22}/><span>{t.label}</span></button>)}</nav>
  <main ref={mainRef} tabIndex={-1} className={s.main} aria-label={isWorkspace?panelTitle:selectedTab.label}>
   {isWorkspace?<section className={s.fullWorkspace} data-opening={opening}>{panelContent}</section>:<>
   <div className={s.row}><h1>{selectedTab.label}</h1><span className={s.preview}>Redesign · mock data</span></div>
   {tab==="today"?<div className={s.layout}>
    <div className={s.stack}>
     <section className={s.hero} aria-label="Next lesson">
      <div className={s.row}><strong>Hello, teacher</strong><small>Sample · 25 Nov 2026</small></div><Accordion title={"Teaching context · "+(context==="independent"?"Independent":scope.classId==="all"?"All classes":classLabel(scope.classId))+(context==="school"&&scope.subjectId!=="all"?" · "+subjectLabel(scope.subjectId):"")}><div className={s.contextRow}><SelectField label="Teaching context" value={context} options={[{value:"school",label:"Sample school"},{value:"independent",label:"Independent"}]} onChange={v=>{setContext(v==="school"?"school":"independent");setScope(defaultScope);setAudience("")}}/>{context==="school"&&<><SelectField label="Class" value={scope.classId} options={[{value:"all",label:"All classes"},...sampleClasses.map(x=>({value:x.id,label:x.label}))]} onChange={classId=>setScope({classId,subjectId:"all"})}/><SelectField label="Subject" value={scope.subjectId} options={[{value:"all",label:"All subjects"},...sampleSubjects.filter(x=>scope.classId==="all"||state.assignments.some(a=>a.classId===scope.classId&&a.subjectId===x.id)).map(x=>({value:x.id,label:x.label}))]} onChange={subjectId=>setScope(old=>({...old,subjectId}))}/></>}</div></Accordion>
      {mode==="error"||mode==="offline"?<StateView kind={mode} title={mode==="error"?"Could not load sample lesson.":"Sample offline state"} description="Previously saved sample data remains local." action={{label:"Retry",run:()=>setMode("normal")}}/>:mode==="loading"?<StateView kind="loading" title="Loading sample lesson…" action={{label:"Show sample data",run:()=>setMode("normal")}}/>:!next?<><strong>No lesson scheduled</strong><ActionButton variant="outline" onClick={()=>open({kind:"timetable"})}>Timetable</ActionButton></>:<>
       <div className={s.lessonTitle}><small>{next.date!==previewDate?"Tomorrow":next.delivery==="teaching"?"Current lesson":"Next lesson"}</small><strong>{subjectLabel(next.subjectId)}</strong><time>{timeLabel(next.start)}</time></div><small>{classLabel(next.classId)} · {next.topic}</small>
       <div className={s.row}><small>Preparation</small><small>{completed}/5 done · {5-completed-unknown} pending{unknown?" · "+unknown+" unknown":""}</small></div><Progress value={completed} max={5} label="Lesson preparation"/>
       <div className={s.stages}>{stages.map((stage,i)=><button key={stage.label} data-done={done[i]==="done"} aria-label={stage.label+", "+(done[i]==="done"?"complete":done[i])} onClick={()=>open({kind:"stage",index:i,occurrenceId:next.id})}>{done[i]==="done"?<CheckCircle2 size={19}/>:<stage.icon size={19}/>}<span>{stage.label}</span><span className={s.bar}/></button>)}</div>
       <div className={s.actions}><ActionButton variant="primary" onClick={()=>open({kind:"stage",index:Math.max(0,nextStage),occurrenceId:next.id})}>{completed===5?"View preparation":"Continue preparation"}</ActionButton><ActionButton variant="outline" onClick={()=>open({kind:"teach",occurrenceId:next.id})}>{next.delivery==="teaching"?"Resume lesson":next.date!==previewDate?"Open lesson":"Teach now"}</ActionButton></div>
      </>}
     </section>
     <section className={s.panel} aria-label="VibeSchool Live">
      <div className={s.liveHead}><div className={s.liveIcon}><Video size={24}/></div><div><h2>VibeSchool Live</h2><small>{live?(live.status==="paused"?"Sample class paused":"Sample class in progress"):"Online classroom · mock"}</small></div><ActionButton variant="primary" className={s.inline} onClick={()=>open({kind:"live"})}><Radio size={16}/>{live?"Resume":"Go Live"}</ActionButton></div>
      <div className={s.liveControls}><select aria-label="Live class audience" disabled={!!live} value={audience} onChange={e=>setAudience(e.target.value)}>{[...sampleClasses.filter(()=>context==="school"||!!live).map(x=>({id:x.id,label:x.label})),{id:"tuition",label:"Invited learners"},{id:"open",label:"Public class"}].map(a=><option key={a.id} value={a.id}>{a.label}</option>)}</select><button className={s.inline} onClick={()=>open({kind:"studio"})}><Presentation size={16}/>Studio</button><button className={s.inline} onClick={()=>open({kind:"past"})}><History size={16}/>Past</button></div>
     </section>
     <section className={s.panel+" "+s.counts} aria-label="Sample lesson records">
      <button onClick={()=>open({kind:"timetable"})}><strong>{view.lessons.length}</strong><small>Lessons</small></button><button onClick={()=>open({kind:"homework-mark"})}><strong>{mark}</strong><small>To mark</small></button><button onClick={()=>open({kind:"attendance"})}><strong>{attendance}</strong><small>Attendance</small></button>
     </section>
    </div>
    <div className={s.stack}>
     <section className={s.panel} aria-label="Your workspace"><div className={s.row}><h2>Your workspace</h2><button aria-expanded={edit} className={s.inline} onClick={()=>{setEdit(!edit)}}><SlidersHorizontal size={18}/>{edit?"Done":"Edit"}</button></div>
      {edit?<><SearchField label="Find tools" placeholder="Find tools" value={query} onChange={setQuery}/><small>{pins.length}/11 shortcuts · preview session</small><div className={s.choices}>{visible.map(t=><label key={t.href}><input type="checkbox" checked={pins.includes(t.href)} disabled={!pins.includes(t.href)&&pins.length>=11} onChange={()=>togglePin(t.href)}/>{t.label}</label>)}</div>{!visible.length&&<p className={s.empty}>No matching tools</p>}<ReorderList items={pins.map(id=>({id,label:registry.find(t=>t.href===id)?.label??id}))} onChange={items=>setPins(items.map(i=>i.id))}/><ActionButton variant="outline" onClick={()=>setPins(initialPins)}>Reset shortcuts</ActionButton></>:<div className={s.tools}>{pins.map(href=>{const t=registry.find(x=>x.href===href);return t?<button key={href} onClick={()=>open(toolPanel(href,t.label))}><span className={s.toolIcon}><t.icon size={21}/></span>{short[href]??t.label}</button>:null})}<button onClick={()=>open({kind:"tools"})}><span className={s.toolIcon}><LayoutGrid size={21}/></span>All tools</button></div>}
     </section>
     <section className={s.panel}><h2>Action centre</h2><div className={s.queue}>{mark>0&&<button onClick={()=>open({kind:"homework-mark"})}><CheckCheck size={20}/><span><strong>Mark {mark} homework submissions</strong><small>{view.submissions[0].title}</small></span><ChevronRight size={17}/></button>}{attendance>0&&<button onClick={()=>open({kind:"attendance"})}><ClipboardCheck size={20}/><span><strong>Record attendance</strong><small>{attendance} dated lessons</small></span><ChevronRight size={17}/></button>}{next&&nextStage>=0&&mode==="normal"&&<button onClick={()=>open({kind:"stage",index:nextStage,occurrenceId:next.id})}><BookOpen size={20}/><span><strong>Continue preparation</strong><small>{stages[nextStage].label} · {subjectLabel(next.subjectId)}</small></span><ChevronRight size={17}/></button>}{!mark&&!attendance&&(!next||nextStage<0||mode!=="normal")&&<p className={s.empty}>No pending actions</p>}</div></section>
    </div>
   </div>:tab==="teach"?<section className={s.teachSurface}><div className={s.teachGroup}><h3>Teaching documents</h3><div className={s.teachDirectory}>{teacherTools.teach.filter(t=>["/teacher/subjecthub","/teacher/curriculum","/teacher/scheme"].includes(t.href)).map(t=><button key={t.href} onClick={()=>open(toolPanel(t.href,t.label))}><t.icon size={20}/><span>{t.label}</span><ChevronRight size={16}/></button>)}</div></div><div className={s.teachGroup}><h3>Teaching tools</h3><div className={s.teachDirectory}>{teacherTools.teach.filter(t=>!["/teacher/subjecthub","/teacher/curriculum","/teacher/scheme"].includes(t.href)).map(t=><button key={t.href} onClick={()=>open(toolPanel(t.href,t.label))}><t.icon size={20}/><span>{t.label}</span><ChevronRight size={16}/></button>)}</div><small>Remaining workspaces are being redesigned in subsequent phases.</small></div></section>:<section className={s.panel}><h2>{selectedTab.label}</h2><p className={s.muted}>Full workspace not built yet. Existing tools are listed for reference.</p>{tab==="me"&&<ActionButton variant="outline" onClick={()=>open({kind:"lab"})}>Design Lab · Shared components</ActionButton>}<div className={s.directory}>{teacherTools[tab].map(t=><button key={t.href} onClick={()=>open(toolPanel(t.href,t.label))}><t.icon size={20}/><span>{t.label}</span><ChevronRight size={16}/></button>)}</div></section>}
   </>}
  </main>
  </div>
  <dialog ref={dialog} className={s.dialog} aria-labelledby="redesign-panel-title" onCancel={e=>{e.preventDefault();close()}} onClick={e=>{if(e.target===e.currentTarget){const rect=e.currentTarget.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)close()}}}>
   {opening==="sheet"&&panel&&<><button className={s.sheetHandle} aria-label="Close sheet" onClick={()=>{if(swiped.current){swiped.current=false;return}close()}} onPointerDown={e=>{swiped.current=false;swipeStart.current=e.clientY;e.currentTarget.setPointerCapture(e.pointerId)}} onPointerUp={e=>{const start=swipeStart.current;swipeStart.current=null;if(start!==null&&e.clientY-start>48){e.preventDefault();swiped.current=true;close()}}} onPointerCancel={()=>{swipeStart.current=null}}><span/></button>{panelContent}</>}
  </dialog>
 </div>
}
