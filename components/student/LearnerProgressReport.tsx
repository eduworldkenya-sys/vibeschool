"use client"

import {useEffect,useMemo,useState} from "react"
import {supabase} from "@/lib/supabase"
import {useStudent} from "@/lib/student-context"

type Score = {id:string;subject:string;marks:number;total_marks:number;exam_name?:string;academic_year?:number;term?:number;occurredAt?:string|null}
type Competency = {id:string;subjectName:string;performance:string}
type Props = {studentId:string;exams:Score[];grades:Score[];competencies:Competency[]}
type Module = "trend"|"subjects"|"composition"|"activity"|"goals"|"reflection"
const MODULES: {id:Module;name:string}[] = [
  {id:"trend",name:"Assessment trends"},{id:"subjects",name:"Subject comparison"},
  {id:"composition",name:"Evidence breakdown"},{id:"activity",name:"Learning activity"},
  {id:"goals",name:"My targets"},{id:"reflection",name:"My reflection"}
]
const panel:React.CSSProperties={background:"var(--vs-card)",border:"1px solid var(--vs-border)",borderRadius:16,padding:16}
const safePct=(m:number,t:number)=>t>0&&Number.isFinite(m)&&Number.isFinite(t)?Math.min(100,Math.max(0,m/t*100)):null
export default function LearnerProgressReport({studentId,exams,grades,competencies}:Props){
  const [visible,setVisible]=useState<Module[]>(MODULES.map(x=>x.id))
  const [format,setFormat]=useState<"both"|"visual"|"words">("both")
  const [subject,setSubject]=useState("All subjects")
  const [goal,setGoal]=useState(80)
  const [reflection,setReflection]=useState("")
  const [customise,setCustomise]=useState(false)
  const [ready,setReady]=useState(false)
  const {identity}=useStudent()
  const [taskDates,setTaskDates]=useState<string[]>([])
  useEffect(()=>{
    setReady(false)
    try {
      const raw=localStorage.getItem("vs:report-preferences:"+studentId)
      if(raw){
        const value=JSON.parse(raw)
        if(Array.isArray(value.visible))setVisible(MODULES.map(m=>m.id).filter(id=>value.visible.includes(id)))
        if(["both","visual","words"].includes(value.format))setFormat(value.format)
        if(typeof value.goal==="number"&&value.goal>=50&&value.goal<=100)setGoal(value.goal)
        if(typeof value.reflection==="string")setReflection(value.reflection.slice(0,2000))
      }
    }catch{}
    setReady(true)
  },[studentId])
  useEffect(()=>{if(!ready)return;try{localStorage.setItem("vs:report-preferences:"+studentId,JSON.stringify({visible,format,goal,reflection}))}catch{}},[studentId,ready,visible,format,goal,reflection])
  useEffect(()=>{
    if(!identity?.profileId){setTaskDates([]);return}
    let cancelled=false
    void supabase.from("student_personal_planner").select("completed_at").eq("owner_user_id",identity.profileId).not("completed_at","is",null).limit(500)
      .then(({data,error})=>{if(!cancelled)setTaskDates(error?[]:(data??[]).map(x=>x.completed_at).filter((x):x is string=>typeof x==="string"))})
    return ()=>{cancelled=true}
  },[identity?.profileId])
  const all=useMemo(()=>[...exams.map(x=>({...x,kind:"Exams"})),...grades.map(x=>({...x,kind:"Grades"}))],[exams,grades])
  const subjects=useMemo(()=>Array.from(new Set(all.map(x=>x.subject))).sort(),[all])
  const selected=all.filter(x=>subject==="All subjects"||x.subject===subject)
  const dated=selected.filter(x=>x.occurredAt && Number.isFinite(Date.parse(x.occurredAt))).sort((a,b)=>Date.parse(a.occurredAt!)-Date.parse(b.occurredAt!))
    .map(x=>({...x,pct:safePct(x.marks,x.total_marks)})).filter((x):x is typeof x & {pct:number}=>x.pct!==null)
  const activityDays=new Set(taskDates.map(x=>new Date(x).toLocaleDateString("en-CA")))
  const heatmapDays=Array.from({length:28},(_,i)=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-27+i);return {key:d.toLocaleDateString("en-CA"),label:d.toLocaleDateString("en-KE",{weekday:"short",day:"numeric",month:"short"})}})
  const scored=selected.map(x=>({...x,pct:safePct(x.marks,x.total_marks)})).filter((x):x is typeof x & {pct:number}=>x.pct!==null)
  const average=scored.length?Math.round(scored.reduce((s,x)=>s+x.pct,0)/scored.length):null
  const bySubject=subjects.map(name=>{
    const values=all.filter(x=>x.subject===name).map(x=>safePct(x.marks,x.total_marks)).filter((n):n is number=>n!==null)
    return {name,mean:values.length?Math.round(values.reduce((a,b)=>a+b,0)/values.length):null,count:values.length}
  }).filter(x=>x.mean!==null)
  const has=(id:Module)=>visible.includes(id)
  const visual=format!=="words",words=format!=="visual"
  const toggle=(id:Module)=>setVisible(prev=>prev.includes(id)?prev.filter(x=>x!==id):MODULES.map(m=>m.id).filter(v=>prev.includes(v)||v===id))
  const ordered=MODULES.filter(x=>has(x.id))
  const explanatory=(message:string)=>words?<p style={{fontSize:12,color:"var(--vs-muted)",lineHeight:1.65,margin:"8px 0 0"}}>{message}</p>:null
  return <section aria-label="Personal learning report" style={{display:"grid",gap:14}}>
    <div style={{...panel,display:"flex",gap:12,alignItems:"center",justifyContent:"space-between",flexWrap:"wrap"}}>
      <div><h2 style={{margin:0,fontSize:19}}>My complete report</h2><p style={{fontSize:12,color:"var(--vs-muted)",margin:"5px 0 0"}}>Released evidence only. Assessment scores are not a measure of intelligence or guaranteed mastery.</p></div>
      <button type="button" onClick={()=>setCustomise(v=>!v)} aria-expanded={customise} style={{padding:"11px 13px",borderRadius:10,border:"1px solid var(--vs-border)",background:"var(--vs-accent-soft)",color:"var(--vs-accent)",fontWeight:700,cursor:"pointer"}}>Customise report</button>
    </div>
    {customise&&<div style={panel}>
      <h3 style={{margin:"0 0 8px",fontSize:15}}>Choose what your report shows</h3>
      <div style={{display:"flex",flexWrap:"wrap",gap:12}}>
        {MODULES.map(m=><label key={m.id} style={{fontSize:13,display:"flex",gap:6,alignItems:"center",minHeight:38}}><input type="checkbox" checked={has(m.id)} onChange={()=>toggle(m.id)}/>{m.name}</label>)}
      </div>
      <label style={{display:"flex",alignItems:"center",gap:8,fontSize:13,marginTop:12}}>Explain my results using
        <select aria-label="Report presentation" value={format} onChange={e=>setFormat(e.target.value as typeof format)} style={{padding:9,border:"1px solid var(--vs-border)",borderRadius:9,background:"var(--vs-card)",color:"var(--vs-text)"}}>
          <option value="both">Words and visuals</option><option value="visual">Visuals</option><option value="words">Words</option>
        </select>
      </label>
    </div>}
    <label style={{display:"flex",gap:9,alignItems:"center",fontSize:13}}>Subject
      <select value={subject} onChange={e=>setSubject(e.target.value)} style={{minHeight:44,flex:1,maxWidth:280,padding:10,border:"1px solid var(--vs-border)",borderRadius:9,background:"var(--vs-card)",color:"var(--vs-text)"}}>
        <option>All subjects</option>{subjects.map(x=><option key={x}>{x}</option>)}
      </select>
    </label>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))",gap:10}}>
      <div style={panel}><div style={{fontSize:12,color:"var(--vs-muted)"}}>Average of displayed scores</div><strong style={{fontSize:26}}>{average===null?"—":average+"%"}</strong></div>
      <div style={panel}><div style={{fontSize:12,color:"var(--vs-muted)"}}>Scored records</div><strong style={{fontSize:26}}>{scored.length}</strong></div>
      <div style={panel}><div style={{fontSize:12,color:"var(--vs-muted)"}}>Competency observations</div><strong style={{fontSize:26}}>{subject==="All subjects"?competencies.length:competencies.filter(x=>x.subjectName===subject).length}</strong></div>
    </div>
    {ordered.map(({id,name})=><article key={id} style={panel}><h3 style={{fontSize:16,margin:"0 0 10px"}}>{name}</h3>
      {id==="trend"&&(dated.length<2?<p style={{fontSize:13,color:"var(--vs-muted)"}}>A dated trend appears after at least two released assessments. Undated school grades remain in the history below.</p>:<>
        {visual&&<svg role="img" aria-label="Dated released assessment scores" viewBox="0 0 640 190" preserveAspectRatio="xMidYMid meet" style={{width:"100%",height:"auto",maxHeight:230}}>
          {[0,25,50,75,100].map(level=><g key={level}><line x1="44" x2="620" y1={165-level*1.35} y2={165-level*1.35} stroke="currentColor" strokeOpacity=".15"/><text x="38" y={169-level*1.35} textAnchor="end" fontSize="11" fill="currentColor">{level}</text></g>)}
          <polyline fill="none" stroke="var(--vs-accent)" strokeWidth="3" strokeLinejoin="round" points={dated.slice(-12).map((x,i,a)=>(44+i*(576/Math.max(1,a.length-1)))+","+(165-x.pct*1.35)).join(" ")}/>
          {dated.slice(-12).map((x,i,a)=><g key={x.id+":"+i}><circle cx={44+i*(576/Math.max(1,a.length-1))} cy={165-x.pct*1.35} r="6" fill="var(--vs-accent)"><title>{x.exam_name||x.subject}: {Math.round(x.pct)}% · {new Date(x.occurredAt!).toLocaleDateString("en-KE")}</title></circle></g>)}
        </svg>}
        {words&&<div style={{display:"grid",gap:6}}>{dated.slice(-5).map(x=><div key={x.id} style={{fontSize:12,display:"flex",justifyContent:"space-between",gap:8}}><span>{x.exam_name||x.subject} · {new Date(x.occurredAt!).toLocaleDateString("en-KE")}</span><strong>{Math.round(x.pct)}%</strong></div>)}</div>}
        {explanatory("Each point is a released assessment with a verified release date. Differences in difficulty and topic coverage mean this is a score history, not a guaranteed mastery trend.")}
      </>)}
      {id==="subjects"&&(bySubject.length===0?<p style={{fontSize:13,color:"var(--vs-muted)"}}>Subject comparisons will appear once results have been released.</p>:bySubject.map(x=><div key={x.name} style={{marginBottom:12,fontSize:13}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:12}}><strong>{x.name}</strong><span>{x.mean}% · {x.count} record{x.count===1?"":"s"}</span></div>
        {visual&&<div style={{height:9,marginTop:6,background:"var(--vs-border)",borderRadius:12,overflow:"hidden"}}><div style={{width:x.mean+"%",height:"100%",background:"var(--vs-accent)"}}/></div>}
      </div>))}
      {id==="subjects"&&explanatory("The bars compare averages of available scored records, not mastered curriculum skills.")}
      {id==="composition"&&<>
        {visual&&all.length>0&&<div style={{display:"flex",alignItems:"center",gap:20,flexWrap:"wrap"}}>
          <div role="img" aria-label={exams.length+" exam records and "+grades.length+" grade records"} style={{width:128,height:128,borderRadius:"50%",background:`conic-gradient(#168b72 0% ${exams.length/all.length*100}%, #6383c5 ${exams.length/all.length*100}% 100%)`,display:"grid",placeItems:"center",flexShrink:0}}>
            <div style={{width:76,height:76,borderRadius:"50%",background:"var(--vs-card)",display:"grid",placeItems:"center",fontWeight:800}}>{all.length}</div>
          </div>
          <div style={{display:"grid",gap:8,fontSize:13}}><span><span style={{color:"#168b72"}}>●</span> Exam results: {exams.length}</span><span><span style={{color:"#6383c5"}}>●</span> Traditional grades: {grades.length}</span></div>
        </div>}
        {words&&<p style={{fontSize:13}}>Exam results: {exams.length} · Traditional grades: {grades.length} · Competency observations: {competencies.length}</p>}
        {all.length===0&&<p style={{fontSize:13,color:"var(--vs-muted)"}}>No released scored evidence yet.</p>}
        {explanatory("This shows proportions of assessment records, not how well you performed. Competency observations are separate because they are not scored grades.")}
      </>}
      {id==="activity"&&<>
        {visual&&<div style={{display:"grid",gridTemplateColumns:"repeat(7,minmax(0,1fr))",gap:5,maxWidth:440}}>{heatmapDays.map(day=><div key={day.key} title={day.label+(activityDays.has(day.key)?" · personal task completed":" · no completed personal task recorded")} style={{minHeight:32,borderRadius:6,background:activityDays.has(day.key)?"var(--vs-accent)":"var(--vs-border)"}}/>)}</div>}
        {words&&<p style={{fontSize:13}}>{heatmapDays.filter(day=>activityDays.has(day.key)).length} days with at least one completed personal task in the last 28 days.</p>}
        {explanatory("Only checked-off personal tasks from the last 28 days are represented. An empty cell is not proof that no learning happened; schoolwork and practice data are not yet connected to this heatmap.")}
      </>}
      {id==="goals"&&<div style={{display:"grid",gap:8}}>
        <label htmlFor="vs-goal" style={{fontSize:13,fontWeight:700}}>My next assessment target: {goal}%</label>
        <input id="vs-goal" type="range" min="50" max="100" step="5" value={goal} onChange={e=>setGoal(Number(e.target.value))}/>
        {average!==null&&<><div style={{height:12,background:"var(--vs-border)",borderRadius:12,overflow:"hidden"}}><div style={{height:"100%",width:Math.min(100,average/goal*100)+"%",background:"var(--vs-accent)"}}/></div><p style={{fontSize:13,margin:0}}>{average>=goal?"The current displayed average meets your target.":"The current displayed average is "+(goal-average)+" percentage points below your target."}</p></>}
        {explanatory("Targets are private learner preferences, not teacher-set grades. The average is descriptive only; use a comparable future assessment to check achievement.")}
      </div>}
      {id==="reflection"&&<div style={{display:"grid",gap:8}}>
        <label htmlFor="vs-reflection" style={{fontSize:13}}>What helped you learn? What will you try next?</label>
        <textarea id="vs-reflection" rows={3} maxLength={2000} value={reflection} onChange={e=>setReflection(e.target.value)} placeholder="One thing I understand now is…" style={{font:"inherit",padding:12,border:"1px solid var(--vs-border)",borderRadius:10,background:"var(--vs-card)",color:"var(--vs-text)"}}/>
        <p style={{fontSize:11,color:"var(--vs-muted)",margin:0}}>Saved on this device for this learner, not shared with teachers. Avoid putting sensitive personal details here.</p>
      </div>}
    </article>)}
    {visible.length===0&&<p style={panel}>All report sections are hidden. Choose Customise report to show them again.</p>}
  </section>
}
