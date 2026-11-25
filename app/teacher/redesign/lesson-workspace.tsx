"use client";
import {useState,type Dispatch} from "react";
import {ArrowLeft,ArrowRight,BookOpen,CheckCircle2,ClipboardList,NotebookPen} from "lucide-react";
import {ActionButton,SearchField,SelectField,TextField,CheckField,StateView,StatusPill} from "./ui";
import {Accordion,ContextTabs} from "./controls";
import {classLabel,subjectLabel,sampleClasses,sampleSubjects,matchesScope,sampleResources,type PreviewState,type PreviewAction,type Occurrence,type Scope} from "./preview-state";
import {curriculumUnits} from "./teach-data";
import {initialPlanSections,planLabels,planReview,previewWeekStart,moveWeek,inPreviewWeek} from "./lesson-data";
import {LESSON_PLAN_SECTION_KEYS,parseGeneratedLessonPlan} from "@/lib/teaching/lessonPlanCodec";
import type {Panel} from "./destination";
import s from "./redesign.module.css";

export type LessonLibraryView={week:string;query:string;scope:Scope;readiness:string;notesView:string};
export const initialLessonLibraryView:LessonLibraryView={week:previewWeekStart,query:"",scope:{classId:"all",subjectId:"all"},readiness:"all",notesView:"browse"};
type Shared={state:PreviewState;dispatch:Dispatch<PreviewAction>;open:(p:Panel)=>void};
const statusFor=(state:PreviewState,row:Occurrence)=>!state.plans[row.id]?"no_plan":planReview(state.plans[row.id].sections).ready?"ready":"needs_review";
const stateLabels:Record<string,string>={ready:"Ready",needs_review:"Review",no_plan:"No plan"};
export function LessonLibrary({kind,state,dispatch,open,view,onView}:{kind:"plans"|"notes-library";view:LessonLibraryView;onView:(patch:Partial<LessonLibraryView>)=>void}&Shared){
 const rows=state.occurrences.filter(x=>matchesScope(x,view.scope)&&inPreviewWeek(x.date,view.week)).sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start));
 const found=rows.filter(x=>(x.topic+" "+subjectLabel(x.subjectId)+" "+classLabel(x.classId)).toLowerCase().includes(view.query.trim().toLowerCase())&&(kind!=="plans"||view.readiness==="all"||statusFor(state,x)===view.readiness));
 const noteRows=found.filter(x=>view.notesView==="prepared"?!!state.plans[x.id]:view.notesView==="mine"?!!x.notes.trim():true);
 const ahead=state.scheme.filter(x=>!x.occurrenceId&&matchesScope(x,view.scope));
 const [showAhead,setShowAhead]=useState(false);
 return <section className={s.teachSurface}>
  <div className={s.row}><small>Week of {view.week}</small><div className={s.teachLinks}><ActionButton variant="ghost" iconOnly aria-label="Previous week" icon={<ArrowLeft size={18}/>} onClick={()=>onView({week:moveWeek(view.week,-1)})}/><ActionButton variant="ghost" onClick={()=>onView({week:previewWeekStart})}>This week</ActionButton><ActionButton variant="ghost" iconOnly aria-label="Next week" icon={<ArrowRight size={18}/>} onClick={()=>onView({week:moveWeek(view.week,1)})}/></div></div>
  <div className={s.teachFilters}><SelectField label="Class" value={view.scope.classId} options={[{value:"all",label:"All classes"},...sampleClasses.map(x=>({value:x.id,label:x.label}))]} onChange={classId=>onView({scope:{classId,subjectId:"all"}})}/><SelectField label="Subject" value={view.scope.subjectId} options={[{value:"all",label:"All subjects"},...sampleSubjects.filter(x=>state.assignments.some(a=>a.subjectId===x.id&&(view.scope.classId==="all"||a.classId===view.scope.classId))).map(x=>({value:x.id,label:x.label}))]} onChange={subjectId=>onView({scope:{...view.scope,subjectId}})}/></div>
  <SearchField label={kind==="plans"?"Find lesson plans":"Find lesson notes"} value={view.query} onChange={query=>onView({query})} placeholder="Search topic or subject"/>
  {kind==="plans"?<>
   <div className={s.teachSummary}>{["ready","needs_review","no_plan"].map(k=><ActionButton key={k} variant="ghost" aria-pressed={view.readiness===k} onClick={()=>onView({readiness:view.readiness===k?"all":k})}><strong>{rows.filter(x=>statusFor(state,x)===k).length}</strong> {stateLabels[k]}</ActionButton>)}</div>
   <div className={s.row}><h3>Dated lessons</h3><ActionButton variant="outline" onClick={()=>setShowAhead(v=>!v)}>Prepare ahead</ActionButton></div>
   {showAhead&&<div className={s.teachGroup}><small>Unscheduled scheme lessons · no timetable occurrence is created.</small>{ahead.map(x=><div key={x.id} className={s.teachRecord}><strong>{x.topic}</strong><small>{classLabel(x.classId)} · {subjectLabel(x.subjectId)} · Week {x.week}</small><TextField label="Unscheduled lesson draft" multiline value={x.planDraft} onChange={text=>dispatch({type:"schemePlanDraft",id:x.id,text})}/><small>Draft retained in this preview session.</small></div>)}{!ahead.length&&<StateView kind="empty" title="No unscheduled sample scheme lessons" action={{label:"Open scheme",run:()=>open({kind:"scheme"})}}/>}</div>}
   {found.map(x=><div className={s.teachRecord} key={x.id}><div className={s.row}><strong>{x.topic}</strong><StatusPill tone={statusFor(state,x)==="ready"?"success":"neutral"}>{stateLabels[statusFor(state,x)]}</StatusPill></div><small>{x.date} · {x.start}–{x.end} · {subjectLabel(x.subjectId)} · {classLabel(x.classId)}</small><div className={s.teachLinks}><ActionButton variant="outline" onClick={()=>open({kind:"stage",index:1,occurrenceId:x.id})}>{statusFor(state,x)==="no_plan"?"Create plan":statusFor(state,x)==="needs_review"?"Review plan":"Open plan"}</ActionButton><ActionButton variant="ghost" onClick={()=>open({kind:"stage",index:2,occurrenceId:x.id})}>Notes</ActionButton></div></div>)}
   {!found.length&&<StateView kind="empty" title="No matching dated lessons"/>}
  </>:<ContextTabs label="Lesson Notes sections" value={view.notesView} onChange={notesView=>onView({notesView})} options={[{value:"browse",label:"Browse"},{value:"mine",label:"My notes"},{value:"prepared",label:"Prepared"}]}><div className={s.teachGroup}><small>Sample notes only. No certified catalogue or released content is asserted.</small>{noteRows.map(x=><div className={s.teachRecord} key={x.id}><strong>{x.topic}</strong><small>{subjectLabel(x.subjectId)} · {classLabel(x.classId)} · {x.date}</small><p>{x.notes||"No saved personal notes"}</p><ActionButton variant="outline" onClick={()=>open({kind:"stage",index:2,occurrenceId:x.id})}>Open notes</ActionButton></div>)}{!noteRows.length&&<StateView kind="empty" title="No matching sample notes"/>}</div></ContextTabs>}
 </section>
}
export function PlanEditor({row,state,dispatch,open,back}:{row:Occurrence;back:()=>void}&Shared){
 const [feedback,setFeedback]=useState("");
 const scheme=state.scheme.find(x=>x.id===row.schemeId&&x.occurrenceId===row.id);
 const unit=curriculumUnits.find(x=>x.id===scheme?.unitId);
 const saved=state.plans[row.id];
 const sections=state.planEdits[row.id]??saved?.sections??initialPlanSections(row,scheme);
 const review=planReview(sections);
 const valid=!!parseGeneratedLessonPlan(sections);
 return <section className={s.teachSurface}>
  <div className={s.row}><strong>{row.topic}</strong><StatusPill tone={review.ready?"success":"warning"}>{review.ready?"Ready":saved?"Needs review":"New plan"}</StatusPill></div>
  <small>{classLabel(row.classId)} · {subjectLabel(row.subjectId)} · {row.date} {row.start}–{row.end}</small>
  <div className={s.teachLinks}><ActionButton variant="ghost" icon={<ClipboardList size={18}/>} onClick={()=>open({kind:"plans"})}>Lesson plans</ActionButton><ActionButton variant="ghost" icon={<NotebookPen size={18}/>} onClick={()=>open({kind:"stage",index:2,occurrenceId:row.id})}>Notes</ActionButton><ActionButton variant="ghost" onClick={()=>open({kind:"scheme",classId:row.classId,subjectId:row.subjectId,...(unit?{unitId:unit.id}:{})})}>Scheme</ActionButton></div>
  <Accordion title={scheme?"Linked curriculum outcomes":"No linked scheme"} defaultOpen={!saved}>{unit?<ul className={s.teachOutcomes}>{unit.outcomes.filter(o=>scheme?.outcomeIds.includes(o.id)).map(o=><li key={o.id}>{o.text}</li>)}</ul>:<small>No authoritative curriculum outcome is inferred.</small>}<small>Illustrative sample curriculum only.</small></Accordion>
  <div className={s.teachGroup}>{LESSON_PLAN_SECTION_KEYS.map((key,i)=><Accordion key={key} title={(i+1)+". "+planLabels[key]+(sections[key].trim()?" · Entered":" · Empty")} defaultOpen={i===0}><TextField label={planLabels[key]} multiline value={sections[key]} onChange={text=>{dispatch({type:"editPlan",id:row.id,key,text});setFeedback("")}}/></Accordion>)}</div>
  <Accordion title={review.ready?"Readiness checks passed":"Review required ("+review.reasons.length+")"} defaultOpen={!review.ready}>{review.ready?<p>Canonical sample readiness checks passed.</p>:<ul className={s.teachOutcomes}>{review.reasons.map(reason=><li key={reason}>{reason}</li>)}</ul>}</Accordion>
  <div className={s.teachLinks}><ActionButton disabled={!valid} onClick={()=>{dispatch({type:"savePlan",id:row.id});setFeedback(review.ready?"Sample plan saved · Ready":"Sample plan saved · Needs review")}}>Save plan</ActionButton><ActionButton disabled={!valid} variant="outline" onClick={()=>{dispatch({type:"savePlan",id:row.id});back()}}>Save and return</ActionButton><ActionButton variant="ghost" disabled={!state.planEdits[row.id]} onClick={()=>{dispatch({type:"discardPlanEdits",id:row.id});setFeedback("Unsaved changes discarded")}}>Discard edits</ActionButton></div>
  {feedback&&<p role="status">{feedback}</p>}
  <ActionButton variant="outline" onClick={()=>open({kind:"teach",occurrenceId:row.id})}>Open teaching workspace</ActionButton>
  <small>Sample plan only. This editor does not generate official lesson content or publish to learners.</small>
 </section>
}
export function NotesEditor({row,state,dispatch,open,back}:{row:Occurrence;back:()=>void}&Shared){
 const draft=state.drafts[row.id],notes=draft?.notes??row.notes,checked=draft?.checks[2]??row.preparation[2]==="done";
 const plan=state.plans[row.id];
 const [feedback,setFeedback]=useState("");
 return <section className={s.teachSurface}>
  <div className={s.row}><strong>{row.topic}</strong><small>{row.preparation[2]==="done"?"Notes complete":"Notes pending"}</small></div>
  <small>{classLabel(row.classId)} · {subjectLabel(row.subjectId)} · {row.date} {row.start}</small>
  <div className={s.teachLinks}><ActionButton variant="ghost" icon={<BookOpen size={18}/>} onClick={()=>open({kind:"notes-library"})}>Notes library</ActionButton><ActionButton variant="ghost" icon={<ClipboardList size={18}/>} onClick={()=>open({kind:"stage",index:1,occurrenceId:row.id})}>Lesson plan</ActionButton><ActionButton variant="ghost" onClick={()=>open({kind:"stage",index:3,occurrenceId:row.id})}>Resources</ActionButton></div>
  <TextField label="Teacher notes" multiline value={notes} onChange={text=>{dispatch({type:"draft",id:row.id,notes:text});setFeedback("")}}/>
  <CheckField label="Sample preparation complete" checked={checked} onChange={e=>dispatch({type:"draft",id:row.id,index:2,checked:e.target.checked})}/>
  <div className={s.teachLinks}><ActionButton disabled={checked&&!notes.trim()} onClick={()=>{dispatch({type:"savePreparation",id:row.id,index:2});setFeedback("Sample notes saved")}}>Save notes</ActionButton><ActionButton variant="outline" disabled={checked&&!notes.trim()} onClick={()=>{dispatch({type:"savePreparation",id:row.id,index:2});back()}}>Save and return</ActionButton></div>
  {feedback&&<p role="status">{feedback}</p>}
  <Accordion title="Lesson plan reference">{plan?LESSON_PLAN_SECTION_KEYS.filter(key=>plan.sections[key].trim()).map(key=><div className={s.teachRecord} key={key}><strong>{planLabels[key]}</strong><p className={s.lessonProse}>{plan.sections[key]}</p></div>):<StateView kind="empty" title="No saved plan" action={{label:"Create plan",run:()=>open({kind:"stage",index:1,occurrenceId:row.id})}}/>}</Accordion>
  <Accordion title="Linked sample resources">{sampleResources.filter(x=>row.resourceIds.includes(x.id)).map(x=><p key={x.id}>{x.title}</p>)}{!row.resourceIds.length&&<small>No linked sample resources.</small>}</Accordion>
  <div className={s.teachLinks}><ActionButton onClick={()=>open({kind:"teach",occurrenceId:row.id})}>Teach lesson</ActionButton><ActionButton variant="outline" onClick={()=>open({kind:"studio",occurrenceId:row.id})}>Live Studio</ActionButton></div>
  <small>Personal sample notes are separate from released learner notes.</small>
 </section>
}
