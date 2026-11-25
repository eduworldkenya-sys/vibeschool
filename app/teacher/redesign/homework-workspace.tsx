"use client";
import {useState,type Dispatch} from "react";
import {ChevronRight} from "lucide-react";
import {ActionButton,SearchField,SelectField,RecordList,StateView,Progress} from "./ui";
import {ContextTabs} from "./controls";
import {classLabel,subjectLabel,sampleClasses,sampleSubjects,sampleLearners,matchesScope,type Scope,type PreviewState,type PreviewAction} from "./preview-state";
import s from "./redesign.module.css";

export type HomeworkTab="pending"|"marked"|"assignments"|"results";
export function HomeworkWorkspace({state,scope,dispatch,onMarked}:{state:PreviewState;scope:Scope;dispatch:Dispatch<PreviewAction>;onMarked:()=>void}){
 const [tab,setTab]=useState<HomeworkTab>("pending");
 const [query,setQuery]=useState("");
 const [filter,setFilter]=useState<Scope>({classId:"all",subjectId:"all"});
 const available=state.submissions.filter(x=>matchesScope(x,scope));
 const filtered=available.filter(x=>matchesScope(x,filter));
 const pending=filtered.filter(x=>x.status==="pending").length,marked=filtered.length-pending;
 const matches=(x:typeof filtered[number])=>(x.title+" "+(sampleLearners.find(l=>l.id===x.learnerId)?.label??"")+" "+classLabel(x.classId)+" "+subjectLabel(x.subjectId)).toLowerCase().includes(query.trim().toLowerCase());
 const searched=filtered.filter(matches);
 const rows=searched.filter(x=>tab==="pending"?x.status==="pending":tab==="marked"?x.status==="marked":true);
 const groupKey=(x:typeof filtered[number])=>x.homeworkId+":"+x.classId+":"+x.subjectId;
 const groups=Array.from(new Set(rows.map(groupKey))).map(id=>({id,rows:rows.filter(x=>groupKey(x)===id)}));
 const options=[{value:"pending",label:"To mark "+pending},{value:"marked",label:"Marked "+marked},{value:"assignments",label:"Assignments"},{value:"results",label:"Results"}];
 const selectTab=(next:string)=>setTab(next as HomeworkTab);
 return <section className={s.collectionSurface} aria-label="Homework marking queue">
  <ContextTabs label="Homework sections" options={options} value={tab} onChange={selectTab}>
   <div className={s.workspaceTabContent}>
    <div className={s.compactToolbar}>
     <SelectField label="Class" value={filter.classId} options={[{value:"all",label:scope.classId==="all"?"All classes":classLabel(scope.classId)},...sampleClasses.filter(x=>scope.classId==="all"&&available.some(a=>a.classId===x.id)).map(x=>({value:x.id,label:x.label}))]} onChange={classId=>setFilter({classId,subjectId:"all"})}/>
     <SelectField label="Subject" value={filter.subjectId} options={[{value:"all",label:scope.subjectId==="all"?"All subjects":subjectLabel(scope.subjectId)},...sampleSubjects.filter(x=>scope.subjectId==="all"&&available.some(a=>a.subjectId===x.id&&(filter.classId==="all"||a.classId===filter.classId))).map(x=>({value:x.id,label:x.label}))]} onChange={subjectId=>setFilter(old=>({...old,subjectId}))}/>
     <SearchField label="Find homework submissions" value={query} onChange={setQuery} placeholder="Find learner or homework"/>
    </div>
    {tab==="results"&&<div className={s.teachSummary}><span><strong>{searched.filter(x=>x.status==="marked").length}/{searched.length}</strong> marked</span><span><strong>{searched.filter(x=>x.status==="pending").length}</strong> outstanding</span><small>Marking progress only · No scores recorded in this preview.</small></div>}
    {groups.map(group=>{const first=group.rows[0];const complete=group.rows.filter(x=>x.status==="marked").length;return <section key={group.id} className={s.recordGroup}>
     <div className={s.recordGroupHeader}><div><h3>{first.title}</h3><small>{subjectLabel(first.subjectId)} · {classLabel(first.classId)}</small></div><small>{tab==="pending"?group.rows.length+" pending":tab==="marked"?group.rows.length+" marked":group.rows.length+" submissions"}</small></div>
     {tab==="pending"||tab==="marked"?<RecordList label={first.title+" submissions"} rows={group.rows.map(x=>({id:x.id,title:sampleLearners.find(l=>l.id===x.learnerId)?.label??"Sample learner",meta:tab==="pending"?"Awaiting marking":"Marked",action:tab==="pending"?<ActionButton variant="ghost" size="compact" aria-label="Mark sample submission" onClick={()=>{dispatch({type:"markSubmission",id:x.id});onMarked()}}>Mark <ChevronRight size={16}/></ActionButton>:undefined}))}/>:tab==="assignments"?<RecordList label={first.title+" assignment summary"} rows={[{id:group.id,title:complete+" marked · "+(group.rows.length-complete)+" pending",action:<ActionButton variant="ghost" size="compact" onClick={()=>{setQuery(first.title);setFilter({classId:first.classId,subjectId:first.subjectId});setTab("pending")}}>Open queue <ChevronRight size={16}/></ActionButton>}]} />:<div className={s.recordLine}><div className={s.recordText}><strong>{complete} of {group.rows.length} marked</strong><Progress value={complete} max={group.rows.length} label={first.title+" marking progress"}/></div><small>{Math.round(complete/group.rows.length*100)}%</small></div>}
    </section>})}
    {!groups.length&&<StateView kind="empty" title={query?"No matching submissions":tab==="pending"?"No pending homework submissions":tab==="marked"?"No marked submissions":"No sample submissions"} action={query?{label:"Clear search",run:()=>setQuery("")}:undefined}/>}
    <small>Sample workspace · Full marking and assignment editors are a later phase.</small>
   </div>
  </ContextTabs>
 </section>
}
