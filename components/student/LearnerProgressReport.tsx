"use client"

import {useEffect,useMemo,useState} from "react"

type Score = {id:string;subject:string;marks:number;total_marks:number;exam_name?:string;academic_year?:number;term?:number}
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
  const all=useMemo(()=>[...exams.map(x=>({...x,kind:"Exams"})),...grades.map(x=>({...x,kind:"Grades"}))],[exams,grades])
  const subjects=useMemo(()=>Array.from(new Set(all.map(x=>x.subject))).sort(),[all])
  const selected=all.filter(x=>subject==="All subjects"||x.subject===subject)
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
      {id==="trend"&&(scored.length<2?<p style={{fontSize:13,color:"var(--vs-muted)"}}>At least two comparable dated assessments are needed for a reliable trend.</p>:<>
        {visual&&<div style={{display:"flex",alignItems:"end",gap:5,height:125,borderBottom:"1px solid var(--vs-border)"}}>{scored.slice(0,16).map((item,i)=><div key={item.id+":"+i} title={item.subject+": "+Math.round(item.pct)+"%"} style={{flex:1,maxWidth:45,height:item.pct+"%",background:"var(--vs-accent)",borderRadius:"5px 5px 0 0"}}/>)}</div>}
        {explanatory("These are recorded results in feed order, not a verified time-series. Select a result in the assessment history below for its details. Do not treat different exams as directly comparable without checking difficulty and coverage.")}
      </>)}
      {id==="subjects"&&(bySubject.length===0?<p style={{fontSize:13,color:"var(--vs-muted)"}}>Subject comparisons will appear once results have been released.</p>:bySubject.map(x=><div key={x.name} style={{marginBottom:12,fontSize:13}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:12}}><strong>{x.name}</strong><span>{x.mean}% · {x.count} record{x.count===1?"":"s"}</span></div>
        {visual&&<div style={{height:9,marginTop:6,background:"var(--vs-border)",borderRadius:12,overflow:"hidden"}}><div style={{width:x.mean+"%",height:"100%",background:"var(--vs-accent)"}}/></div>}
      </div>))}
      {id==="subjects"&&explanatory("The bars compare averages of available scored records, not mastered curriculum skills.")}
      {id==="composition"&&<>
        {visual&&<div aria-label="Distribution of evidence types" style={{display:"flex",height:18,overflow:"hidden",borderRadius:12,background:"var(--vs-border)"}}>
          {all.length>0&&<><div title={"Exam results: "+exams.length} style={{width:exams.length/all.length*100+"%",background:"#168b72"}}/><div title={"Traditional grades: "+grades.length} style={{width:grades.length/all.length*100+"%",background:"#6383c5"}}/></>}
        </div>}
        <p style={{fontSize:13}}>Exam results: {exams.length} · Traditional grades: {grades.length} · Competency observations: {competencies.length}</p>
        {explanatory("This shows the distribution of records, not how well you performed.")}
      </>}
      {id==="activity"&&<><p style={{fontSize:13,color:"var(--vs-muted)"}}>A learning heatmap requires dated completed activities from Tasks, Learn and Practice. This report does not invent study days from exam marks.</p>{explanatory("When dated activity evidence is connected, show a calendar of actual work completed, with an accessible text alternative.")}</>}
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
