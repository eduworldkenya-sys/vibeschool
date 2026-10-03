import type { Data, Learner } from '@/lib/class-workbook/model';
export type Event = {id:string;student_id:string;subject_id:string|null;event_kind:string;note:string|null;due_at:string|null;resolved_at:string|null;created_at:string;created_by:string};
export type Insight = {learner:Learner;attendance:number|null;missing:number;average:number|null;change:number|null;participation:number;followups:Event[];reasons:string[]};
/** Compare only released assessments of the same type and subject. Absence is not zero. */
export function insights(data:Data,events:Event[],subjectId:string,today:string):Insight[]{
 return data.learners.map(learner=>{
  const att=data.attendance.filter(a=>a.student_id===learner.id&&a.timetable_slot_id===null);
  const subjectName=data.subjects.find(s=>s.id===subjectId)?.name;
  const work=data.homework.filter(h=>(!subjectId||h.subject===subjectName)&&h.due_date&&h.due_date.slice(0,10)<today&&(!learner.joined_at||h.due_date.slice(0,10)>=learner.joined_at.slice(0,10))&&(!h.target_group_id||data.members.some(m=>m.group_id===h.target_group_id&&m.student_id===learner.id)));
  const missing=work.filter(h=>!data.submissions.some(s=>s.student_id===learner.id&&s.homework_id===h.id&&['submitted','received','marked','returned','resubmitted'].includes(s.status))).length;
  const scores=data.assessments.filter(a=>a.student_id===learner.id&&a.released_at&&a.percentage!==null&&Number.isFinite(a.percentage)&&(!subjectId||a.subject_id===subjectId)).sort((a,b)=>a.released_at!.localeCompare(b.released_at!)||a.assessment_id.localeCompare(b.assessment_id));
  const latest=scores.at(-1);const comparable=latest?scores.filter(a=>a.subject_id===latest.subject_id&&a.assessment_type===latest.assessment_type):[];
  const change=comparable.length>=2?Math.round((comparable.at(-1)!.percentage!-comparable.at(-2)!.percentage!)*10)/10:null;
  const attendance=att.length?Math.round(100*att.filter(a=>a.status==='present'||a.status==='late'||a.is_late).length/att.length):null;
  const own=events.filter(e=>e.student_id===learner.id&&(!subjectId||e.subject_id===subjectId));
  const recentStart=new Date(today+'T00:00:00+03:00').getTime()-7*86400000;
  const participation=own.filter(e=>e.event_kind==='participation'&&new Date(e.created_at).getTime()>=recentStart).length;
  const followups=own.filter(e=>e.event_kind==='followup'&&!e.resolved_at&&e.due_at&&e.due_at.slice(0,10)<=today);
  const average=scores.length?Math.round(scores.reduce((sum,a)=>sum+a.percentage!,0)/scores.length):null;
  const reasons=[attendance!==null&&attendance<80?`Attendance ${attendance}% across ${att.length} recorded days`:null,missing?`${missing} overdue item(s) without submitted work`:null,latest&&latest.percentage!<50?`Latest released assessment ${Math.round(latest.percentage!)}%`:null,followups.length?`${followups.length} follow-up(s) due`:null].filter((v):v is string=>Boolean(v));
  return {learner,attendance,missing,average,change,participation,followups,reasons};
 });
}
export function ask(rows:Insight[],query:string):{rows:Insight[];understood:boolean;explanation:string}{
 const q=query.toLowerCase().trim();let match:((row:Insight)=>boolean)|null=null;let explanation='Current saved evidence only.';
 if(!q)return {rows,understood:true,explanation};
 if(/^(who needs attention|needs attention|who needs help|show me learners i should check on)$/.test(q))match=r=>r.reasons.length>0;
 else if(/^(who is improving|who improved|most improved)$/.test(q)){match=r=>r.change!==null&&r.change>0;explanation='Change between the last two released assessments of the same type and subject.';}
 else if(/^(who is declining|who dropped)$/.test(q)){match=r=>r.change!==null&&r.change<0;explanation='Change between the last two released assessments of the same type and subject.';}
 else if(/^(who keeps missing homework|missing homework|missing work)$/.test(q))match=r=>r.missing>0;
 else if(/^(who have i not assessed|no assessment|not assessed recently)$/.test(q)){match=r=>r.average===null;explanation='No released assessment in the available records; this does not mean the learner has never been assessed.';}
 else if(/^(who have i not interacted with|no participation|quiet learners)$/.test(q)){match=r=>r.participation===0;explanation='No recorded participation in the last 7 days. An absent record does not prove a learner is quiet.';}
 else if(/^(follow-ups due|followups due)$/.test(q))match=r=>r.followups.length>0;
 else if(/^(attendance problems|frequent absence)$/.test(q))match=r=>r.attendance!==null&&r.attendance<80;
 return {rows:match?rows.filter(match).sort((a,b)=>q.includes('improv')?(b.change??0)-(a.change??0):a.learner.name.localeCompare(b.learner.name)):rows.filter(r=>`${r.learner.name} ${r.learner.admission_number??''}`.toLowerCase().includes(q)),understood:Boolean(match),explanation};
}
export function shuffled<T>(input:T[],random:()=>number=Math.random):T[]{const result=[...input];for(let i=result.length-1;i>0;i--){const v=random();if(v<0||v>=1)throw new Error('Invalid random sample.');const j=Math.floor(v*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;}
export function picker(pool:string[],seen:string[],random:()=>number=Math.random):string|null {const remaining=pool.filter(id=>!seen.includes(id));return remaining.length?shuffled(remaining,random)[0]:null;}
/** A seating layout is a private workbook sheet; it does not change enrolment. */
export function seatOrder(data:Data,cells:Record<string,Record<string,unknown>>):Learner[]{return [...data.learners].sort((a,b)=>{const x=cells[a.id]?.position,y=cells[b.id]?.position;return (typeof x==='number'?x:Infinity)-(typeof y==='number'?y:Infinity)||a.name.localeCompare(b.name);});}
export function summary(rows:Insight[]){const present=rows.filter(r=>r.attendance!==null),scored=rows.filter(r=>r.average!==null);return {learners:rows.length,assessed:scored.length,average:scored.length?Math.round(scored.reduce((s,r)=>s+r.average!,0)/scored.length):null,attendance:present.length?Math.round(present.reduce((s,r)=>s+r.attendance!,0)/present.length):null,missing:rows.reduce((s,r)=>s+r.missing,0)};}
/** Header names are optional. Names are never treated as an identity key. */
export function rosterRows(input:string[][]):{name:string;admission_number:string;error?:string}[]{
 if(input.length>1001)throw new Error('Import at most 1,000 learners at a time.');
 const rows=input.filter(r=>r.some(v=>v.trim()));if(/^(name|learner|student name|learner name)$/i.test(rows[0]?.[0]?.trim()??''))rows.shift();
 const admissions=new Set<string>();return rows.map((r,index)=>{const name=r[0]?.trim()??'',admission=r[1]?.trim()??'';let error:string|undefined;
 if(r.length>2&&r.slice(2).some(v=>v.trim()))error=`Row ${index+1}: use Name and optional Admission number only.`;
 else if(!name||name.length>200)error='Enter a name of 1–200 characters.';else if(admission.length>80)error='Admission number is too long.';
 else if(admission&&admissions.has(admission.toLowerCase()))error='Duplicate admission number in this import.';
 if(admission)admissions.add(admission.toLowerCase());return {name,admission_number:admission,error};});
}

/** One chronological projection over existing domain records, never a second event store. */
export function classTimeline(data:Data,events:Event[],subjectId:string,selected:string[]):Event[]{
 const names=new Map(data.subjects.map(s=>[s.name,s.id]));
 const rows:Event[]=[...events,
  ...data.attendance.filter(a=>a.timetable_slot_id===null).map((a,i)=>({id:`attendance-${a.student_id}-${a.date}-${i}`,student_id:a.student_id,subject_id:null,event_kind:'attendance',note:a.is_late?'Arrived late':a.status,due_at:null,resolved_at:null,created_at:a.date+'T12:00:00+03:00',created_by:''})),
  ...data.assessments.filter(a=>a.released_at).map(a=>({id:`assessment-${a.assessment_id}-${a.student_id}`,student_id:a.student_id,subject_id:a.subject_id,event_kind:'released assessment',note:`${a.assessment_title}: ${a.percentage===null?'No score recorded':Math.round(a.percentage)+'%'}`,due_at:null,resolved_at:null,created_at:a.released_at!,created_by:''})),
  ...data.submissions.flatMap(s=>{const homework=data.homework.find(h=>h.id===s.homework_id);const at=s.submitted_at??s.received_at;return homework&&at&&s.student_id?[{id:`homework-${s.homework_id}-${s.student_id}`,student_id:s.student_id,subject_id:names.get(homework.subject??'')??null,event_kind:'homework',note:`${homework.title}: ${s.status}`,due_at:null,resolved_at:null,created_at:at,created_by:''}]:[];}),
 ];
 return rows.filter(e=>(!subjectId||e.subject_id===subjectId||e.event_kind==='attendance')&&(!selected.length||selected.includes(e.student_id))).sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime()).slice(0,100);
}
