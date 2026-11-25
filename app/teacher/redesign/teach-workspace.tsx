"use client";
import {useState,type Dispatch} from "react";
import {BookOpen,ChevronRight,Plus,CalendarDays,ClipboardList,GraduationCap,Printer} from "lucide-react";
import {ActionButton,SearchField,SelectField,TextField,CheckField,StateView,StatusPill} from "./ui";
import {Accordion,AdaptiveOverlay} from "./controls";
import {classLabel,subjectLabel,sampleClasses,sampleSubjects,todayView,type PreviewState,type PreviewAction,type Scope} from "./preview-state";
import {curriculumUnits,suggestedUnits,validPair,sampleTerms,sampleWeeks,sampleCurrentTerm,sampleCurrentWeek,type SchemeItem,type SchemeStatus,type CurriculumUnit} from "./teach-data";
import type {Panel,TeachingPanel} from "./destination";
import s from "./redesign.module.css";

export type TeachView={term:number;week:number;subjectQuery:string;curriculumQuery:string;schemeQuery:string;filter:"all"|"saved"|"suggested"|"unplanned"};
export const initialTeachView:TeachView={term:sampleCurrentTerm,week:sampleCurrentWeek,subjectQuery:"",curriculumQuery:"",schemeQuery:"",filter:"all"};
type Props={panel:TeachingPanel;state:PreviewState;dispatch:Dispatch<PreviewAction>;scope:Scope;view:TeachView;onView:(patch:Partial<TeachView>)=>void;open:(p:Panel)=>void;choose:(scope:Scope)=>void};
const labels:Record<SchemeStatus,string>={planned:"Planned",teaching:"Teaching",done:"Done",cancelled:"Cancelled"};
const match=(q:string,...parts:string[])=>q.trim().toLowerCase().split(/\s+/).every(word=>parts.join(" ").toLowerCase().includes(word));
function SchemeRecord({item,state,dispatch,open}:{item:SchemeItem;state:PreviewState;dispatch:Dispatch<PreviewAction>;open:(p:Panel)=>void}){
 const [reflection,setReflection]=useState(item.reflection);
 const [plan,setPlan]=useState(item.planDraft);
 const [status,setStatus]=useState<SchemeStatus|null>(null);
 const [feedback,setFeedback]=useState("");
 const unit=curriculumUnits.find(x=>x.id===item.unitId);
 const linked=state.occurrences.find(x=>x.id===item.occurrenceId);
 return <div className={s.teachRecord}>
  <div className={s.row}><strong>{item.topic}</strong><StatusPill tone={item.status==="done"?"success":"neutral"}>{labels[item.status]}</StatusPill></div>
  <small>{item.strand||"Teacher-created"} · {linked?linked.date+" "+linked.start:"Not linked to a dated lesson"}{item.planDraft?" · Draft saved":""}</small>
  <Accordion title="Lesson details">
   {unit&&<><small>{unit.strand} / {unit.subStrand}</small><ul className={s.teachOutcomes}>{unit.outcomes.filter(o=>item.outcomeIds.includes(o.id)).map(o=><li key={o.id}>{o.text}</li>)}</ul><ActionButton variant="ghost" onClick={()=>open({kind:"curriculum",classId:item.classId,subjectId:item.subjectId,unitId:unit.id})}>View linked curriculum <ChevronRight size={16}/></ActionButton></>}
   {linked?<ActionButton onClick={()=>open({kind:"stage",index:1,occurrenceId:linked.id})}>Prepare dated lesson</ActionButton>:<><TextField label="Unscheduled lesson draft" multiline value={plan} onChange={setPlan}/><ActionButton variant="outline" disabled={!plan.trim()} onClick={()=>{dispatch({type:"schemePlanDraft",id:item.id,text:plan});setFeedback("Sample draft saved; no lesson scheduled.")}}>Save draft</ActionButton></>}
   <TextField label="Teaching reflection" multiline value={reflection} onChange={setReflection}/><ActionButton variant="outline" onClick={()=>{dispatch({type:"schemeReflection",id:item.id,text:reflection});setFeedback("Sample reflection saved.")}}>Save reflection</ActionButton>
   {linked?<small>Teaching status follows the linked dated occurrence.</small>:<SelectField label="Change scheme status" value={item.status} options={Object.entries(labels).map(([value,label])=>({value,label}))} onChange={v=>{if(v!==item.status)setStatus(v as SchemeStatus)}}/>}
   {feedback&&<p role="status" className={s.status}>{feedback}</p>}
  </Accordion>
  <AdaptiveOverlay open={status!==null} onClose={()=>setStatus(null)} title="Change scheme status" mode="center"><p>Change this sample scheme item to {status?labels[status]:""}? This does not record dated lesson delivery.</p><div className={s.actions}><ActionButton variant="outline" onClick={()=>setStatus(null)}>Cancel</ActionButton><ActionButton onClick={()=>{if(status)dispatch({type:"schemeStatus",id:item.id,status});setStatus(null)}}>Confirm</ActionButton></div></AdaptiveOverlay>
 </div>;
}
function UnitEditor({unit,state,view,dispatch,open}:{unit:CurriculumUnit;state:PreviewState;view:TeachView;dispatch:Dispatch<PreviewAction>;open:(p:Panel)=>void}){
 const [selected,setSelected]=useState(unit.outcomes.map(o=>o.id));
 const saved=state.scheme.find(x=>x.classId===unit.classId&&x.subjectId===unit.subjectId&&x.term===view.term&&x.unitId===unit.id);
 return <div className={s.teachRecord}><div className={s.row}><strong>{unit.subStrand}</strong><small>{saved?"In scheme":"Not in scheme"}</small></div>
  <Accordion title={"Learning outcomes ("+unit.outcomes.length+")"}>
   {unit.outcomes.map(o=><CheckField key={o.id} label={o.text} checked={saved?saved.outcomeIds.includes(o.id):selected.includes(o.id)} disabled={!!saved} onChange={e=>setSelected(old=>e.target.checked?[...old,o.id]:old.filter(id=>id!==o.id))}/>)}
   <small>Illustrative outcomes only; not official curriculum source text.</small>
   {saved?<ActionButton variant="outline" onClick={()=>open({kind:"scheme",classId:unit.classId,subjectId:unit.subjectId,unitId:unit.id})}>Open linked scheme</ActionButton>:<ActionButton disabled={!selected.length} onClick={()=>dispatch({type:"saveSchemeUnit",scope:{classId:unit.classId,subjectId:unit.subjectId},unitId:unit.id,outcomeIds:selected,term:view.term,week:view.week})}>Add to Term {view.term}, Week {view.week}</ActionButton>}
  </Accordion>
 </div>
}
export default function TeachWorkspace({panel,state,dispatch,scope,view,onView,open,choose}:Props){
 const [add,setAdd]=useState(false);
 const [newClass,setNewClass]=useState(sampleClasses[0].id);
 const [newSubject,setNewSubject]=useState(sampleSubjects[0].id);
 const [remove,setRemove]=useState<Scope|null>(null);
 const [topic,setTopic]=useState(""),[strand,setStrand]=useState("");
 const [feedback,setFeedback]=useState("");
 const assignments=state.assignments;
 const pairValid=validPair(scope,assignments);
 const scoped=assignments.filter(a=>a.classId===scope.classId);
 const activeUnits=curriculumUnits.filter(u=>u.classId===scope.classId&&u.subjectId===scope.subjectId);
 const items=state.scheme.filter(x=>x.classId===scope.classId&&x.subjectId===scope.subjectId&&x.term===view.term);
 const suggestions=suggestedUnits(state.scheme,scope,view.term);
 const next=todayView(state,scope).next;
 const openContext=(kind:TeachingPanel["kind"],pair=scope,unitId?:string)=>open({kind,classId:pair.classId,subjectId:pair.subjectId,...(unitId?{unitId}:{})});
 const selectedUnit=panel.unitId?activeUnits.find(x=>x.id===panel.unitId):undefined;
 const filterUnit=(u:CurriculumUnit)=>match(view.curriculumQuery,u.strand,u.subStrand,...u.outcomes.map(x=>x.text))&&(!selectedUnit||u.id===selectedUnit.id);
 const filtered=activeUnits.filter(filterUnit);
 const schemeItems=items.filter(x=>(!panel.unitId||x.unitId===panel.unitId)&&match(view.schemeQuery,x.topic,x.strand)&& (view.filter!=="unplanned"||x.occurrenceId===null));
 const shownSuggestions=suggestions.filter(x=>(!panel.unitId||x.id===panel.unitId)&&match(view.schemeQuery,x.subStrand,x.strand));
 const hasDependencies=(pair:Scope)=>state.occurrences.some(x=>x.classId===pair.classId&&x.subjectId===pair.subjectId)||state.scheme.some(x=>x.classId===pair.classId&&x.subjectId===pair.subjectId)||state.submissions.some(x=>x.classId===pair.classId&&x.subjectId===pair.subjectId);
 if(panel.kind==="subjects")return <section className={s.teachSurface} aria-label="Subject hub">
  <div className={s.row}><small>{assignments.length} sample class assignments</small><ActionButton icon={<Plus size={16}/>} onClick={()=>{setAdd(true);setFeedback("")}}>Add subject</ActionButton></div>
  <SearchField label="Find subjects" value={view.subjectQuery} onChange={subjectQuery=>onView({subjectQuery})} placeholder="Search subject or class"/>
  {sampleSubjects.filter(sub=>assignments.some(a=>a.subjectId===sub.id&&match(view.subjectQuery,sub.label,classLabel(a.classId)))).map(sub=><section key={sub.id} className={s.teachGroup}><h3>{sub.label}</h3>{assignments.filter(a=>a.subjectId===sub.id&&match(view.subjectQuery,sub.label,classLabel(a.classId))).map(a=><div className={s.teachRecord} key={a.classId+":"+a.subjectId}><div className={s.row}><strong>{classLabel(a.classId)}</strong><ActionButton size="compact" variant="ghost" onClick={()=>setRemove(a)}>Remove</ActionButton></div><div className={s.teachLinks}><ActionButton variant="ghost" onClick={()=>openContext("curriculum",a)} icon={<BookOpen size={18}/>}>Curriculum</ActionButton><ActionButton variant="ghost" onClick={()=>openContext("scheme",a)} icon={<ClipboardList size={18}/>}>Scheme</ActionButton><ActionButton variant="ghost" onClick={()=>{const row=todayView(state,a).next;choose(a);open(row?{kind:"stage",index:1,occurrenceId:row.id}:{kind:"timetable"})}}>Lesson plan</ActionButton></div></div>)}</section>)}
  {!assignments.some(a=>match(view.subjectQuery,subjectLabel(a.subjectId),classLabel(a.classId)))&&<StateView kind="empty" title="No matching subjects"/>}
  <AdaptiveOverlay open={add} onClose={()=>setAdd(false)} title="Add sample subject"><SelectField label="Class" value={newClass} options={sampleClasses.map(x=>({value:x.id,label:x.label}))} onChange={setNewClass}/><SelectField label="Subject" value={newSubject} options={sampleSubjects.map(x=>({value:x.id,label:x.label}))} onChange={setNewSubject}/>{validPair({classId:newClass,subjectId:newSubject},assignments)&&<small>Already assigned to this class.</small>}<ActionButton disabled={validPair({classId:newClass,subjectId:newSubject},assignments)} onClick={()=>{dispatch({type:"addAssignment",scope:{classId:newClass,subjectId:newSubject}});setAdd(false);setFeedback("Sample subject assigned.")}}>Add assignment</ActionButton></AdaptiveOverlay>
  <AdaptiveOverlay open={remove!==null} onClose={()=>setRemove(null)} title="Remove sample assignment" mode="center">{remove&&<><p>{subjectLabel(remove.subjectId)} · {classLabel(remove.classId)}</p>{hasDependencies(remove)?<p>This sample assignment has linked teaching records. They remain preserved; remove or reassign them through the corresponding workflow first.</p>:<ActionButton variant="danger" onClick={()=>{dispatch({type:"removeAssignment",scope:remove});setRemove(null);setFeedback("Sample assignment removed.")}}>Remove assignment</ActionButton>}<ActionButton variant="outline" onClick={()=>setRemove(null)}>Close</ActionButton></>}</AdaptiveOverlay>
  {feedback&&<p role="status">{feedback}</p>}
 </section>;
 return <section className={s.teachSurface} aria-label={panel.kind==="curriculum"?"Curriculum map":"Scheme of work"}>
  <div className={s.teachFilters}><SelectField label="Class" value={scope.classId} options={sampleClasses.filter(x=>assignments.some(a=>a.classId===x.id)).map(x=>({value:x.id,label:x.label}))} onChange={classId=>{const a=assignments.find(x=>x.classId===classId);if(a)choose(a)}}/><SelectField label="Subject" value={scope.subjectId} options={scoped.map(a=>({value:a.subjectId,label:subjectLabel(a.subjectId)}))} onChange={subjectId=>choose({classId:scope.classId,subjectId})}/><SelectField label="Term" value={String(view.term)} options={sampleTerms.map(x=>({value:String(x),label:"Term "+x}))} onChange={v=>onView({term:Number(v)})}/><SelectField label="Week" value={String(view.week)} options={sampleWeeks.map(x=>({value:String(x),label:"Week "+x}))} onChange={v=>onView({week:Number(v)})}/></div>
  <div className={s.teachLinks}><ActionButton variant="ghost" onClick={()=>openContext("subjects")} icon={<GraduationCap size={18}/>}>Subjects</ActionButton><ActionButton variant="ghost" onClick={()=>openContext(panel.kind==="curriculum"?"scheme":"curriculum")} icon={panel.kind==="curriculum"?<ClipboardList size={18}/>:<BookOpen size={18}/>}>{panel.kind==="curriculum"?"Scheme of work":"Curriculum map"}</ActionButton><ActionButton variant="ghost" onClick={()=>onView({term:sampleCurrentTerm,week:sampleCurrentWeek})} icon={<CalendarDays size={18}/>}>Current week</ActionButton></div>
  {!pairValid?<StateView kind="empty" title="Choose an assigned subject" action={{label:"Open subjects",run:()=>open({kind:"subjects"})}}/>:panel.kind==="curriculum"?<>
   <div className={s.row}><strong>{subjectLabel(scope.subjectId)}</strong><small>{activeUnits.length} sample sub-strands</small></div>
   <SearchField label="Search curriculum" value={view.curriculumQuery} onChange={curriculumQuery=>onView({curriculumQuery})} placeholder="Find strand, topic or outcome"/>
   {selectedUnit&&<ActionButton variant="ghost" onClick={()=>openContext("curriculum")}>Show all sub-strands</ActionButton>}
   {Array.from(new Set(filtered.map(u=>u.strand))).map(strandName=><section key={strandName} className={s.teachGroup}><h3>{strandName}</h3>{filtered.filter(u=>u.strand===strandName).map(u=><UnitEditor key={u.id+":"+view.term} unit={u} state={state} view={view} dispatch={dispatch} open={open}/>)}</section>)}
   {!filtered.length&&<StateView kind="empty" title="No matching sample curriculum"/>}
  </>:<>
   <div className={s.row}><strong>{subjectLabel(scope.subjectId)} · Term {view.term}</strong><ActionButton size="compact" variant="ghost" icon={<Printer size={16}/>} onClick={()=>window.print()}>Print</ActionButton></div>
   <div className={s.teachSummary}><span><strong>{items.length}</strong> saved</span><span><strong>{suggestions.length}</strong> suggested</span><span><strong>{items.filter(x=>!x.occurrenceId).length}</strong> unscheduled</span></div>
   <Accordion title="About this scheme"><p>Sample VibeSchool teaching sequence only. Term and week are illustrative, not an official KICD timetable or the actual school calendar. Saved scheme records do not imply completed preparation.</p></Accordion>
   <SearchField label="Search scheme" value={view.schemeQuery} onChange={schemeQuery=>onView({schemeQuery})} placeholder="Search lesson or strand"/>
   <SelectField label="Show" value={view.filter} options={[{value:"all",label:"All"},{value:"saved",label:"Saved"},{value:"suggested",label:"Suggested"},{value:"unplanned",label:"Unscheduled"}]} onChange={v=>onView({filter:v as TeachView["filter"]})}/>
   {selectedUnit&&<ActionButton variant="ghost" onClick={()=>openContext("scheme")}>Show all scheme items</ActionButton>}
   {next&&<div className={s.row}><small>Next dated lesson · {next.topic}</small><ActionButton variant="outline" onClick={()=>open({kind:"stage",index:1,occurrenceId:next.id})}>Prepare lesson</ActionButton></div>}
   {view.filter!=="suggested"&&<div className={s.teachGroup}><h3>Weekly sequence</h3>{sampleWeeks.filter(w=>w===view.week||schemeItems.some(x=>x.week===w)).map(w=><Accordion key={w} title={"Week "+w+" · "+schemeItems.filter(x=>x.week===w).length+" saved"}>{schemeItems.filter(x=>x.week===w).length?schemeItems.filter(x=>x.week===w).map(item=><SchemeRecord key={item.id} item={item} state={state} dispatch={dispatch} open={open}/>):<StateView kind="empty" title="No saved lessons in this week"/>}<ActionButton variant="ghost" onClick={()=>onView({week:w})}>Select Week {w}</ActionButton></Accordion>)}</div>}
   {(view.filter==="all"||view.filter==="suggested")&&<section className={s.teachGroup}><h3>Suggested lessons · Week {view.week}</h3>{shownSuggestions.map(u=><UnitEditor key={u.id+":"+view.term} unit={u} state={state} view={view} dispatch={dispatch} open={open}/>)}{!shownSuggestions.length&&<small>No matching suggestions.</small>}</section>}
   <Accordion title="Add teacher-created lesson"><TextField label="Lesson focus" value={topic} onChange={setTopic} required/><TextField label="Strand (optional)" value={strand} onChange={setStrand}/><ActionButton disabled={!topic.trim()} onClick={()=>{dispatch({type:"addSchemeItem",scope,topic,strand,term:view.term,week:view.week});setTopic("");setStrand("");setFeedback("Sample lesson saved to Week "+view.week)}}>Add to Week {view.week}</ActionButton>{feedback&&<p role="status">{feedback}</p>}</Accordion>
  </>}
  <small>Redesign · mock data. No production curriculum or teaching records are modified.</small>
 </section>
}
