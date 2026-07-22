"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { nairobiDateStr } from "@/lib/time";

const C = {
  bg:"#f4f4f5",surface:"#ffffff",surface2:"#f9f9fb",border:"#e4e4e7",border2:"#d4d4d8",
  text:"#18181b",text2:"#52525b",text3:"#a1a1aa",
  emerald:"#059669",emeraldDim:"#d1fae5",
  indigo:"#4f46e5",indigoDim:"#ede9fe",
  amber:"#d97706",amberDim:"#fef3c7",
  red:"#dc2626",redDim:"#fee2e2",
  sky:"#0284c7",skyDim:"#e0f2fe",
  navy:"#1e1b4b",
} as const;

interface SubjectCard {
  id:string;name:string;classes:ClassRow[];lessonCount:number;assessCount:number;
  coveragePct:number|null;assessedPct:number|null;masteredPct:number|null;
  avgPerfPct:number|null;perfDist:Record<string,number>;attRate:number|null;
  strands:StrandRow[];
}
interface ClassRow {
  id:string;name:string;stream:string|null;studentCount:number;
  perfDist:Record<string,number>;attRate:number|null;
}
interface StrandRow {
  strand:string;total:number;assessed:number;mastered:number;
}
interface AtRiskStudent {
  id:string;name:string;className:string;classId:string;subjects:string[];beCount:number;attRate:number|null;
}
interface TermStat {
  totalLessons:number;totalAssess:number;subjectCount:number;studentCount:number;
  avgAttRate:number|null;tpadFinalScore:number|null;tpadStatus:string|null;
  tpadStandards:Record<string,number|null>;evidenceCount:number;
}
type Tab="overview"|"gradebook"|"atrisk"|"tpad";

const PERF_ORDER=["exceeds_expectation","meets_expectation","approaches_expectation","below_expectation"] as const;
const PERF_META:Record<string,{short:string;label:string;color:string;bg:string}>={
  exceeds_expectation:   {short:"EE",label:"Exceeds",   color:"#059669",bg:"#d1fae5"},
  meets_expectation:     {short:"ME",label:"Meets",     color:"#0284c7",bg:"#e0f2fe"},
  approaches_expectation:{short:"AE",label:"Approaches",color:"#d97706",bg:"#fef3c7"},
  below_expectation:     {short:"BE",label:"Below",     color:"#dc2626",bg:"#fee2e2"},
};
const TSC_STANDARDS:{key:string;label:string}[]=[
  {key:"standard_1_self",label:"Professional Knowledge & Practice"},
  {key:"standard_2_self",label:"Teaching & Learning"},
  {key:"standard_3_self",label:"Assessment for Learning"},
  {key:"standard_4_self",label:"Personal & Professional Development"},
  {key:"standard_5_self",label:"Relationship & Responsibilities"},
  {key:"standard_6_self",label:"Community & Partnerships"},
  {key:"standard_7_self",label:"Curriculum Design & Innovation"},
  {key:"standard_8_self",label:"Leadership & Management"},
];
function perfScore(p:string){return({exceeds_expectation:4,meets_expectation:3,approaches_expectation:2,below_expectation:1} as Record<string,number>)[p]??0;}
function barColor(pct:number){return pct>=70?"#059669":pct>=40?"#d97706":"#dc2626";}
function currentTerm():number{const m=new Date().getMonth()+1;if(m<=4)return 1;if(m<=8)return 2;if(m<=11)return 3;return 1;}
function termStart():string{const n=new Date();const y=n.getFullYear();const t=currentTerm();const starts:Record<number,[number,number]>={1:[0,6],2:[4,5],3:[8,1]};const[mo,day]=starts[t];return nairobiDateStr(new Date(y,mo,day));}

function Skel({h=56,radius=12}:{h?:number;radius?:number}){
  return(<div style={{height:h,borderRadius:radius,background:"linear-gradient(90deg,#e4e4e7 25%,#f4f4f5 50%,#e4e4e7 75%)",backgroundSize:"200% 100%",animation:"shimmer 1.4s infinite"}}/>);
}
function MiniBar({pct,color,h=5}:{pct:number;color:string;h?:number}){
  return(<div style={{width:"100%",height:h,borderRadius:4,background:C.border,overflow:"hidden"}}><div style={{width:pct+"%",height:"100%",borderRadius:4,background:color,transition:"width 0.5s ease"}}/></div>);
}
function PerfChip({perf,count}:{perf:string;count:number}){
  const m=PERF_META[perf];if(!m)return null;
  return(<div style={{display:"flex",alignItems:"center",gap:3,background:m.bg,borderRadius:8,padding:"3px 8px"}}><span style={{fontSize:11,fontWeight:900,color:m.color}}>{m.short}</span><span style={{fontSize:11,fontWeight:700,color:m.color}}>{count}</span></div>);
}
function PerfBar({dist,total}:{dist:Record<string,number>;total:number}){
  if(total===0)return<div style={{fontSize:11,color:C.text3}}>No assessments yet</div>;
  return(<div style={{display:"flex",gap:2,height:8,borderRadius:6,overflow:"hidden",width:"100%"}}>{PERF_ORDER.map(p=>{const pct=total>0?((dist[p]??0)/total)*100:0;if(pct===0)return null;return<div key={p} style={{width:pct+"%",background:PERF_META[p].color,transition:"width 0.4s"}}/>;})}</div>);
}
function EmptyAction({icon,title,sub,btnLabel,onPress}:{icon:string;title:string;sub:string;btnLabel:string;onPress:()=>void}){
  return(
    <div style={{background:C.surface,borderRadius:16,border:`1.5px dashed ${C.border2}`,padding:"32px 20px",textAlign:"center",boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
      <div style={{fontSize:36,marginBottom:10}}>{icon}</div>
      <div style={{fontSize:15,fontWeight:800,color:C.text,marginBottom:6}}>{title}</div>
      <div style={{fontSize:13,color:C.text3,marginBottom:14}}>{sub}</div>
      <button onClick={onPress} style={{padding:"10px 24px",borderRadius:12,background:C.indigo,color:"#fff",border:"none",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{btnLabel}</button>
    </div>
  );
}

export default function TeacherAcademicsPage(){
  const router=useRouter();
  const [tab,setTab]=useState<Tab>("overview");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [subjects,setSubjects]=useState<SubjectCard[]>([]);
  const [atRisk,setAtRisk]=useState<AtRiskStudent[]>([]);
  const [termStats,setTermStats]=useState<TermStat|null>(null);
  const [expanded,setExpanded]=useState<string|null>(null);
  const [teacherName,setTeacherName]=useState<string|null>(null);
  const [insight,setInsight]=useState<string|null>(null);
  const [insightLoading,setInsightLoading]=useState(false);

  function rulesInsight(subs:SubjectCard[],risk:AtRiskStudent[],stats:TermStat|null,name:string|null):string{
    const t=name?` ${name}`:"";
    if(!stats||stats.totalAssess===0)return `👋 Welcome${t}! Record your first CBC assessment to unlock insights.`;
    const weak=subs.filter(s=>s.masteredPct!==null&&s.masteredPct<40);
    const strong=subs.filter(s=>s.masteredPct!==null&&s.masteredPct>=70);
    const lowAtt=stats.avgAttRate!==null&&stats.avgAttRate<60;
    if(risk.length>3&&weak.length>0)return `⚠️ ${risk.length} students are below expectation in ${weak.map(s=>s.name).join(", ")}. Group them for targeted strand revision before end of term.`;
    if(weak.length>0&&lowAtt)return `📉 Low attendance (${stats.avgAttRate}%) may be driving weak mastery in ${weak[0].name}. Prioritise catch-up sessions.`;
    if(weak.length>0)return `📚 ${weak.map(s=>s.name).join(" and ")} need${weak.length===1?"s":""} attention — mastery below 40%. Consider re-teaching key strands.`;
    if(strong.length===subs.length&&subs.length>0)return `🎯 Excellent term${t}! All ${subs.length} subjects are on track. Keep documenting evidence for TPAD.`;
    if(risk.length>0)return `👀 ${risk.length} student${risk.length>1?"s are":" is"} at risk. Check their ClassHub profiles and assign peer learning partners.`;
    if(stats.totalLessons===0)return `📚 No lesson plans recorded yet this term${t}. Add plans to strengthen your TPAD evidence.`;
    return `✓ Term ${currentTerm()} looking good${t}. ${stats.totalAssess} assessments recorded across ${stats.subjectCount} subject${stats.subjectCount!==1?"s":""}.`;
  }

  async function fetchAIInsight(subs:SubjectCard[],risk:AtRiskStudent[],stats:TermStat,name:string|null){
    if(stats.totalAssess<5)return;
    setInsightLoading(true);
    try{
      const summary={term:currentTerm(),teacher:name??"Teacher",subjects:subs.map(s=>({name:s.name,mastery:s.masteredPct,assessed:s.assessCount,coverage:s.coveragePct})),atRisk:risk.length,avgAtt:stats.avgAttRate,lessons:stats.totalLessons};
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-haiku-4-5",max_tokens:120,system:"You are a CBC teaching coach. Give ONE specific, actionable insight in 1-2 sentences max. Be direct, warm, practical. No preamble. Use an emoji at the start.",messages:[{role:"user",content:`Term ${summary.term} data for ${summary.teacher}: ${JSON.stringify(summary.subjects)}. At-risk: ${summary.atRisk}. Avg attendance: ${summary.avgAtt}%. Lesson plans: ${summary.lessons}. Give one insight.`}]})}  );
      const d=await res.json();
      const text=d?.content?.[0]?.text?.trim();
      if(text)setInsight(text);
    }catch(e){console.error("AI insight",e);}
    finally{setInsightLoading(false);}
  }

  const boot=useCallback(async()=>{
    setLoading(true);setError(null);
    try{
      const{data:{user}}=await supabase.auth.getUser();
      if(!user){router.push("/?role=teacher");return;}
      const[teacherRes,memberRes,profileRes]=await Promise.all([
        supabase.from("teacher_profiles").select("school_id").eq("profile_id",user.id).maybeSingle(),
        supabase.from("school_members").select("school_id").eq("profile_id",user.id).maybeSingle(),
        supabase.from("profiles").select("school_id,full_name").eq("id",user.id).single(),
      ]);
      const schoolId=memberRes.data?.school_id??teacherRes.data?.school_id??profileRes.data?.school_id??null;
      const resolvedName=(profileRes.data as {full_name?:string}|null)?.full_name??null;
      setTeacherName(resolvedName);
      if(!schoolId){setError("School not found. Contact your admin.");setLoading(false);return;}
      const{data:tcRows}=await supabase.from("teacher_classes").select("class_id, subject_id").eq("teacher_id",user.id);
      const rows=(tcRows??[]) as{class_id:string;subject_id:string}[];
      const subjectIds=Array.from(new Set(rows.map(r=>r.subject_id).filter(Boolean)));
      const classIds=Array.from(new Set(rows.map(r=>r.class_id).filter(Boolean)));
      if(subjectIds.length===0){setLoading(false);return;}

      type SubRow={id:string;name:string;global_subject_id:string|null};

      const{
        data:subRows,
        error:subError,
      }=await supabase
        .from("subjects")
        .select("id, name, global_subject_id")
        .in("id",subjectIds);

      if(subError){
        throw new Error(`Failed to load assigned subjects: ${subError.message}`);
      }

      const subList=(subRows??[]) as SubRow[];
      const loadedSubjectIds=new Set(subList.map(subject=>subject.id));
      const missingSubjectIds=subjectIds.filter(subjectId=>!loadedSubjectIds.has(subjectId));

      if(missingSubjectIds.length>0){
        throw new Error(`Assigned subjects could not be resolved: ${missingSubjectIds.join(", ")}`);
      }

      const globalSubjectIds=Array.from(
        new Set(
          subList
            .map(subject=>subject.global_subject_id)
            .filter((id):id is string=>Boolean(id))
        )
      );

      const globalSubjectIdBySchoolId=new Map(
        subList.map(subject=>[subject.id,subject.global_subject_id])
      );

      const unlinkedSubjects=subList.filter(subject=>!subject.global_subject_id);

      if(unlinkedSubjects.length>0){
        console.error(
          "Academics: assigned subjects missing global identity",
          {subjectIds:unlinkedSubjects.map(subject=>subject.id)}
        );
      }

      const tStart=termStart();const tNum=currentTerm();const tYear=new Date().getFullYear();
      const[classRes,studentClsRes,lpRes,assRes,outcomeRes,attRes,tpadRes,evidRes]=await Promise.allSettled([
        supabase.from("classes").select("id, name, stream").in("id",classIds),
        classIds.length>0?supabase.from("student_classes").select("student_id, class_id").in("class_id",classIds).eq("is_current",true):Promise.resolve({data:[]}),
        supabase.from("lesson_plans").select("id, subject_id, status").eq("teacher_id",user.id).gte("created_at",tStart),
        schoolId
          ?supabase.from("cbc_assessments").select("id,student_id,subject_id,class_id,strand_id,performance,term,academic_year").eq("teacher_id",user.id).eq("school_id",schoolId).eq("term",tNum).eq("academic_year",tYear)
          :supabase.from("cbc_assessments").select("id,student_id,subject_id,class_id,strand_id,performance,term,academic_year").eq("teacher_id",user.id).eq("term",tNum).eq("academic_year",tYear),
        supabase.from("cbc_strands").select("id,subject_id,name").in("subject_id",globalSubjectIds),
        classIds.length>0?supabase.from("attendance").select("student_id,class_id,status").in("class_id",classIds).eq("teacher_id",user.id).gte("date",tStart):Promise.resolve({data:[]}),
        supabase.from("tpad_appraisals").select("final_score,status,standard_1_self,standard_2_self,standard_3_self,standard_4_self,standard_5_self,standard_6_self,standard_7_self,standard_8_self").eq("teacher_id",user.id).order("created_at",{ascending:false}).limit(1).maybeSingle(),
        supabase.from("tpad_evidence").select("id,standard").eq("teacher_id",user.id),
      ]);
      type ClsRow={id:string;name:string;stream:string|null};
      type SClsRow={student_id:string;class_id:string};
      type LPRow={id:string;subject_id:string;status:string};
      type AssRow={id:string;student_id:string;subject_id:string;class_id:string;strand_id:string|null;performance:string;term:number;academic_year:number};
      type OutRow={id:string;subject_id:string;name:string};
      type AttRow={student_id:string;class_id:string;status:string};
      const classList=(classRes.status==="fulfilled"?classRes.value.data??[]:(console.error("classRes",classRes),[])) as ClsRow[];
      const studentCls=(studentClsRes.status==="fulfilled"?studentClsRes.value.data??[]:[]) as SClsRow[];
      const lpData=(lpRes.status==="fulfilled"?lpRes.value.data??[]:(console.error("lpRes",lpRes),[])) as LPRow[];
      const assData=(assRes.status==="fulfilled"?assRes.value.data??[]:(console.error("assRes",assRes),[])) as AssRow[];
      const outcomeData=(outcomeRes.status==="fulfilled"?outcomeRes.value.data??[]:(console.error("outcomeRes",outcomeRes),[])) as OutRow[];
      const attData=(attRes.status==="fulfilled"?attRes.value.data??[]:(console.error("attRes",attRes),[])) as AttRow[];
      const tpadRow=(tpadRes.status==="fulfilled"?tpadRes.value.data:(console.error("tpadRes",tpadRes),null)) as Record<string,number|string|null>|null;
      const evidRows=(evidRes.status==="fulfilled"?evidRes.value.data??[]:(console.error("evidRes",evidRes),[])) as{id:string;standard:string}[];
      const classStudentIds:Record<string,Set<string>>={};
      for(const r of studentCls){if(!classStudentIds[r.class_id])classStudentIds[r.class_id]=new Set();classStudentIds[r.class_id].add(r.student_id);}
      const totalStudents=Object.values(classStudentIds).reduce((s,st)=>s+st.size,0);
      const attByClass:Record<string,{present:number;total:number}>={};
      for(const r of attData){if(!attByClass[r.class_id])attByClass[r.class_id]={present:0,total:0};attByClass[r.class_id].total++;if(r.status==="present")attByClass[r.class_id].present++;}
      const classAttRate=(cid:string):number|null=>{const b=attByClass[cid];if(!b||b.total===0)return null;return Math.round((b.present/b.total)*100);};
      const buildDist=(items:AssRow[]):Record<string,number>=>{const d:Record<string,number>={};for(const a of items)d[a.performance]=(d[a.performance]??0)+1;return d;};
      const subClassMap:Record<string,string[]>={};
      for(const r of rows){if(!subClassMap[r.subject_id])subClassMap[r.subject_id]=[];if(!subClassMap[r.subject_id].includes(r.class_id))subClassMap[r.subject_id].push(r.class_id);}
      const summaries:SubjectCard[]=subList.map(sub=>{
        const myCls=subClassMap[sub.id]??[];
        const subAss=assData.filter(a=>a.subject_id===sub.id);
        const globalSubjectId=globalSubjectIdBySchoolId.get(sub.id);
        const strandDefs=globalSubjectId?outcomeData.filter(o=>o.subject_id===globalSubjectId):[];
        const totalStudentsInSub=Array.from(new Set(rows.filter(r=>r.subject_id===sub.id).flatMap(r=>{const ids=classStudentIds[r.class_id];return ids?Array.from(ids):[];}))).length;
        const subMastered=subAss.filter(a=>a.performance==="meets_expectation"||a.performance==="exceeds_expectation");
        const covered=new Set(subAss.map(a=>a.student_id)).size;
        const assessed=covered;
        const mastered=new Set(subMastered.map(a=>a.student_id)).size;
        const perfSum=subAss.reduce((s,a)=>s+perfScore(a.performance),0);
        const avgPerf=subAss.length>0?Math.round((perfSum/(subAss.length*4))*100):null;
        const dist=buildDist(subAss);
        const classRows:ClassRow[]=classList.filter(c=>myCls.includes(c.id)).map(c=>{const cAss=subAss.filter(a=>a.class_id===c.id);return{id:c.id,name:c.name,stream:c.stream,studentCount:classStudentIds[c.id]?.size??0,perfDist:buildDist(cAss),attRate:classAttRate(c.id)};});
        const myAttRates=myCls.map(cid=>classAttRate(cid)).filter((r):r is number=>r!==null);
        const avgAtt=myAttRates.length>0?Math.round(myAttRates.reduce((a,b)=>a+b,0)/myAttRates.length):null;
        const strandMap:Record<string,StrandRow>={};
        for(const sd of strandDefs){strandMap[sd.id]={strand:sd.name,total:0,assessed:0,mastered:0};}
        for(const a of subAss){if(!a.strand_id||!strandMap[a.strand_id])continue;strandMap[a.strand_id].total++;if(a.performance==="meets_expectation"||a.performance==="exceeds_expectation"){strandMap[a.strand_id].mastered++;strandMap[a.strand_id].assessed++;}else if(a.performance==="approaches_expectation"){strandMap[a.strand_id].assessed++;}}
        return{id:sub.id,name:sub.name,classes:classRows,lessonCount:lpData.filter(l=>l.subject_id===sub.id).length,assessCount:subAss.length,coveragePct:totalStudentsInSub>0?Math.round((covered/totalStudentsInSub)*100):null,assessedPct:totalStudentsInSub>0?Math.round((assessed/totalStudentsInSub)*100):null,masteredPct:totalStudentsInSub>0?Math.round((mastered/totalStudentsInSub)*100):null,avgPerfPct:avgPerf,perfDist:dist,attRate:avgAtt,strands:Object.values(strandMap)};
      });
      setSubjects(summaries);
      const beStudentMap:Record<string,{subjectNames:string[];beStrands:Set<string>;beCount:number;classId:string}>={};
      for(const a of assData){if(a.performance!=="below_expectation")continue;if(!beStudentMap[a.student_id])beStudentMap[a.student_id]={subjectNames:[],beStrands:new Set(),beCount:0,classId:a.class_id};const strandKey=(a.strand_id??"")+"|"+(a.subject_id??"");if(!beStudentMap[a.student_id].beStrands.has(strandKey)){beStudentMap[a.student_id].beStrands.add(strandKey);beStudentMap[a.student_id].beCount++;}const sName=subList.find(s=>s.id===a.subject_id)?.name;if(sName&&!beStudentMap[a.student_id].subjectNames.includes(sName))beStudentMap[a.student_id].subjectNames.push(sName);}
      const beStudentIds=Object.keys(beStudentMap);
      const studentNames:Record<string,string>={};
      if(beStudentIds.length>0){const{data:studs}=await supabase.from("profiles").select("id, full_name").in("id",beStudentIds);for(const s of studs??[])studentNames[s.id]=s.full_name??s.id;}
      const atRiskList:AtRiskStudent[]=beStudentIds.map(sid=>{const info=beStudentMap[sid];const cls=classList.find(c=>c.id===info.classId);const clsName=cls?`${cls.name}${cls.stream?" "+cls.stream:""}`:"Unknown";return{id:sid,name:studentNames[sid]??"Student",className:clsName,classId:info.classId,subjects:info.subjectNames,beCount:info.beCount,attRate:classAttRate(info.classId)};}).sort((a,b)=>b.beCount-a.beCount).slice(0,20);
      setAtRisk(atRiskList);
      const allAttRates=classIds.map(cid=>classAttRate(cid)).filter((r):r is number=>r!==null);
      const avgAttRate=allAttRates.length>0?Math.round(allAttRates.reduce((a,b)=>a+b,0)/allAttRates.length):null;
      const tpadStandards:Record<string,number|null>={};
      for(const s of TSC_STANDARDS)tpadStandards[s.key]=tpadRow?((tpadRow[s.key] as number|null)??null):null;
      const finalStats={totalLessons:lpData.length,totalAssess:assData.length,subjectCount:subList.length,studentCount:totalStudents,avgAttRate,tpadFinalScore:tpadRow?(tpadRow.final_score as number|null):null,tpadStatus:tpadRow?(tpadRow.status as string|null):null,tpadStandards,evidenceCount:evidRows.length};
      setTermStats(finalStats);
      setInsight(rulesInsight(summaries,atRiskList,finalStats,resolvedName));
      if(finalStats.totalAssess>=5)fetchAIInsight(summaries,atRiskList,finalStats,resolvedName);
    }catch(e){console.error("Academics boot",e);setError("Failed to load. Tap to retry.");}finally{setLoading(false);}
  },[router]);

  useEffect(()=>{boot();},[boot]);

  const overallMastery=subjects.length>0&&subjects.some(s=>s.masteredPct!==null)?Math.round(subjects.filter(s=>s.masteredPct!==null).reduce((s,sub)=>s+(sub.masteredPct??0),0)/subjects.filter(s=>s.masteredPct!==null).length):null;
  const hasAnyAssessments=subjects.some(s=>s.assessCount>0);
  const totalAssessments=subjects.reduce((s,sub)=>s+sub.assessCount,0);
  const globalDist:Record<string,number>={};
  for(const sub of subjects)for(const[k,v]of Object.entries(sub.perfDist))globalDist[k]=(globalDist[k]??0)+v;

  return(
    <div style={{background:C.bg,minHeight:"100vh",paddingBottom:100,fontFamily:"'Plus Jakarta Sans',sans-serif",maxWidth:480,margin:"0 auto"}}>
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}`}</style>

      <div style={{background:"linear-gradient(135deg,#1e1b4b 0%,#312e81 60%,#4338ca 150%)",padding:"20px 16px 28px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-40,right:-40,width:140,height:140,borderRadius:"50%",background:"rgba(255,255,255,0.05)"}}/>
        <button onClick={()=>router.back()} style={{background:"rgba(255,255,255,0.12)",border:"none",borderRadius:8,padding:"5px 12px",fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer",fontFamily:"inherit",marginBottom:14}}>← Back</button>
        <div style={{fontSize:10,fontWeight:800,color:"rgba(255,255,255,0.5)",letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>My Academics</div>
        <div style={{fontSize:26,fontWeight:900,color:"#fff",letterSpacing:-0.5}}>Term {currentTerm()} Hub</div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:2}}><div style={{fontSize:12,color:"rgba(255,255,255,0.6)"}}>All subjects · All classes · One view</div><button onClick={boot} style={{background:"rgba(255,255,255,0.12)",border:"none",borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:700,color:"#fff",cursor:"pointer",fontFamily:"inherit"}}>↻ Refresh</button></div>
        {!loading&&termStats&&(
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6,marginTop:18}}>
            {[{label:"Subjects",value:termStats.subjectCount,color:"#a5b4fc"},{label:"Students",value:termStats.studentCount,color:"#bfdbfe"},{label:"Lessons",value:termStats.totalLessons,color:"#bbf7d0"},{label:"Assessed",value:termStats.totalAssess,color:"#fde68a"},{label:"Att%",value:termStats.avgAttRate!==null?termStats.avgAttRate+"%":"—",color:"#ddd6fe"}].map(s=>(
              <div key={s.label} style={{background:"rgba(255,255,255,0.1)",borderRadius:10,padding:"8px 4px",textAlign:"center"}}>
                <div style={{fontSize:16,fontWeight:900,color:s.color}}>{s.value}</div>
                <div style={{fontSize:8,color:"rgba(255,255,255,0.5)",fontWeight:700,lineHeight:1.3}}>{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{display:"flex",background:C.surface,borderBottom:`1px solid ${C.border}`,position:"sticky",top:0,zIndex:10}}>
        {([{key:"overview",label:"Overview"},{key:"gradebook",label:"Gradebook"},{key:"atrisk",label:`At Risk${atRisk.length>0?" ("+atRisk.length+")":""}`},{key:"tpad",label:"TPAD"}] as{key:Tab;label:string}[]).map(t=>(
          <button key={t.key} onClick={()=>setTab(t.key)} style={{flex:1,padding:"12px 2px",border:"none",background:"transparent",cursor:"pointer",fontFamily:"inherit",fontSize:10,fontWeight:800,color:tab===t.key?C.indigo:C.text3,borderBottom:`2px solid ${tab===t.key?C.indigo:"transparent"}`,transition:"color 0.15s,border-color 0.15s"}}>{t.label}</button>
        ))}
      </div>

      <div style={{padding:14}}>
        {error&&(
          <button onClick={boot} style={{width:"100%",background:C.redDim,border:`1px solid ${C.red}44`,borderRadius:12,padding:"12px",marginBottom:12,cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:700,color:C.red}}>{error}</button>
        )}

        {tab==="overview"&&(
          <div style={{animation:"fadeUp 0.25s ease"}}>
            {insight&&!loading&&(<div style={{background:"linear-gradient(135deg,#1e1b4b,#312e81)",borderRadius:14,padding:"13px 15px",marginBottom:12}}><div style={{fontSize:9,fontWeight:800,color:"#a5b4fc",letterSpacing:1.5,textTransform:"uppercase",marginBottom:4}}>{insightLoading?"✨ Upgrading...":"✨ Twin Insight"}</div><div style={{fontSize:13,fontWeight:600,color:"#e0e7ff",lineHeight:1.5}}>{insight}</div></div>)}
            {loading?<Skel h={130}/>:subjects.length>0?(
              <div style={{background:C.surface,borderRadius:16,border:`1px solid ${C.border}`,padding:16,marginBottom:12,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
                <div style={{fontSize:10,fontWeight:800,color:C.text3,letterSpacing:1.5,textTransform:"uppercase",marginBottom:14}}>Overall Mastery</div>
                <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:overallMastery!==null&&totalAssessments>0?14:0}}>
                  <div style={{width:68,height:68,borderRadius:"50%",flexShrink:0,background:overallMastery!==null?`conic-gradient(${barColor(overallMastery)} ${overallMastery*3.6}deg,${C.border} 0deg)`:`conic-gradient(${C.border} 360deg,${C.border} 0deg)`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <div style={{width:52,height:52,borderRadius:"50%",background:C.surface,display:"flex",alignItems:"center",justifyContent:"center",fontSize:overallMastery!==null?16:12,fontWeight:900,color:overallMastery!==null?barColor(overallMastery):C.text3}}>{overallMastery!==null?overallMastery+"%":"—"}</div>
                  </div>
                  <div style={{flex:1}}>
                    {overallMastery!==null?(
                      <><div style={{fontSize:17,fontWeight:900,color:C.text}}>{overallMastery>=70?"On Track 🎯":overallMastery>=40?"Needs Attention ⚠️":"Getting Started 📚"}</div><div style={{fontSize:12,color:C.text2,marginTop:3}}>Avg mastery across {subjects.length} subject{subjects.length!==1?"s":""}</div></>
                    ):(
                      <><div style={{fontSize:15,fontWeight:900,color:C.text}}>No strands assessed yet</div><div style={{fontSize:12,color:C.text2,marginTop:3}}>Record assessments to see mastery progress</div></>
                    )}
                    {termStats?.avgAttRate!==null&&termStats?.avgAttRate!==undefined&&(<div style={{fontSize:12,color:C.text2,marginTop:2}}>Avg attendance: <span style={{color:barColor(termStats.avgAttRate),fontWeight:700}}>{termStats.avgAttRate}%</span></div>)}
                  </div>
                </div>
                {totalAssessments>0&&(<><PerfBar dist={globalDist} total={totalAssessments}/><div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>{PERF_ORDER.map(p=>globalDist[p]?<PerfChip key={p} perf={p} count={globalDist[p]}/>:null)}</div></>)}
                {!hasAnyAssessments&&(
                  <div style={{marginTop:12,background:C.indigoDim,borderRadius:10,padding:"10px 12px"}}>
                    <div style={{fontSize:12,fontWeight:700,color:C.indigo}}>{`👋 Welcome${teacherName?" "+teacherName:""}! Start by recording your first assessment to unlock insights.`}</div>
                  </div>
                )}
              </div>
            ):null}
            {!loading&&atRisk.length>0&&(
              <button onClick={()=>setTab("atrisk")} style={{width:"100%",background:C.redDim,border:`1px solid ${C.red}44`,borderRadius:14,padding:"12px 14px",cursor:"pointer",fontFamily:"inherit",textAlign:"left",display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                <div><div style={{fontSize:13,fontWeight:800,color:C.red}}>⚠️ {atRisk.length} student{atRisk.length!==1?"s":""} below expectation</div><div style={{fontSize:11,color:"#ef4444",marginTop:2}}>Tap to view and take action</div></div>
                <div style={{fontSize:18,color:C.red}}>›</div>
              </button>
            )}
            <div style={{fontSize:10,fontWeight:800,color:C.text3,letterSpacing:1.5,textTransform:"uppercase",marginBottom:10}}>Subject Breakdown</div>
            {loading?(<div style={{display:"flex",flexDirection:"column",gap:10}}>{[1,2,3].map(i=><Skel key={i} h={100}/>)}</div>):subjects.length===0?(
              <EmptyAction icon="📚" title="No subjects assigned" sub="Go to SubjectHub to claim your subjects." btnLabel="Open SubjectHub" onPress={()=>router.push("/teacher/subjecthub")}/>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {subjects.map(sub=>{
                  const isOpen=expanded===sub.id;
                  const mp=sub.masteredPct;
                  const hColor=mp===null?C.text3:mp>=70?C.emerald:mp>=40?C.amber:C.red;
                  const hBg=mp===null?C.surface2:mp>=70?C.emeraldDim:mp>=40?C.amberDim:C.redDim;
                  const hLabel=mp===null?"No data":mp>=70?"On Track":mp>=40?"Watch":"Alert";
                  return(
                    <div key={sub.id} style={{background:C.surface,borderRadius:16,border:`1px solid ${isOpen?C.indigo+"55":C.border}`,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.06)",transition:"border-color 0.2s"}}>
                      <div onClick={()=>setExpanded(isOpen?null:sub.id)} style={{padding:15,cursor:"pointer"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                          <div style={{flex:1}}>
                            <div style={{fontSize:14,fontWeight:800,color:C.text}}>{sub.name}</div>
                            <div style={{fontSize:11,color:C.text3,marginTop:2}}>{sub.classes.length} class{sub.classes.length!==1?"es":""} · {sub.lessonCount} lessons · {sub.assessCount} assessed</div>
                          </div>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <div style={{fontSize:11,fontWeight:800,color:hColor,background:hBg,padding:"3px 10px",borderRadius:20}}>{hLabel}</div>
                            <div style={{fontSize:18,color:C.text3,transform:isOpen?"rotate(90deg)":"none",transition:"transform 0.2s"}}>›</div>
                          </div>
                        </div>
                        <div style={{display:"flex",flexDirection:"column",gap:6}}>
                          {[{label:"Coverage",pct:sub.coveragePct,color:C.sky},{label:"Assessed",pct:sub.assessedPct,color:C.indigo},{label:"Mastered",pct:sub.masteredPct,color:C.emerald}].map(({label,pct,color})=>(
                            <div key={label} style={{display:"flex",alignItems:"center",gap:8}}>
                              <div style={{fontSize:10,color:C.text3,fontWeight:600,width:56,flexShrink:0}}>{label}</div>
                              <div style={{flex:1}}><MiniBar pct={pct??0} color={pct!==null&&pct>0?color:C.border2}/></div>
                              <div style={{fontSize:10,fontWeight:800,color:pct!==null&&pct>0?color:C.text3,width:30,textAlign:"right"}}>{pct!==null?pct+"%":"—"}</div>
                            </div>
                          ))}
                        </div>
                        {sub.assessCount>0&&<div style={{marginTop:8}}><PerfBar dist={sub.perfDist} total={sub.assessCount}/></div>}
                      </div>
                      {isOpen&&(
                        <div style={{borderTop:`1px solid ${C.border}`,padding:"12px 15px",background:C.surface2}}>
                          {sub.strands.length>0&&(
                            <div style={{marginBottom:14}}>
                              <div style={{fontSize:10,fontWeight:800,color:C.text3,letterSpacing:1.2,textTransform:"uppercase",marginBottom:8}}>Strand Coverage</div>
                              {sub.strands.map(st=>{
                                const pct=st.total>0?Math.round((st.assessed/st.total)*100):0;
                                const stColor=pct>=70?C.emerald:pct>=30?C.amber:C.text3;
                                return(
                                  <div key={st.strand} style={{marginBottom:8}}>
                                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                                      <span style={{fontSize:11,fontWeight:700,color:C.text2,flex:1,marginRight:8}}>{st.strand}</span>
                                      <span style={{fontSize:10,fontWeight:800,color:stColor}}>{pct}%</span>
                                    </div>
                                    <MiniBar pct={pct} color={stColor} h={4}/>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {sub.classes.length>0&&(
                            <div style={{marginBottom:12}}>
                              <div style={{fontSize:10,fontWeight:800,color:C.text3,letterSpacing:1.2,textTransform:"uppercase",marginBottom:8}}>By Class</div>
                              {sub.classes.map(cls=>{
                                const clsTotal=Object.values(cls.perfDist).reduce((a,b)=>a+b,0);
                                return(
                                  <div key={cls.id} style={{background:C.surface,borderRadius:12,padding:"10px 12px",marginBottom:6,border:`1px solid ${C.border}`}}>
                                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                                      <span style={{fontSize:12,fontWeight:800,color:C.text}}>{cls.name}{cls.stream?" "+cls.stream:""}</span>
                                      <div style={{display:"flex",gap:4,alignItems:"center"}}>
                                        {cls.attRate!==null&&<span style={{fontSize:10,fontWeight:700,color:barColor(cls.attRate),background:cls.attRate>=70?C.emeraldDim:cls.attRate>=40?C.amberDim:C.redDim,borderRadius:8,padding:"2px 7px"}}>Att {cls.attRate}%</span>}
                                        <span style={{fontSize:10,color:C.text3}}>{cls.studentCount} students</span>
                                      </div>
                                    </div>
                                    {clsTotal>0?(<><PerfBar dist={cls.perfDist} total={clsTotal}/><div style={{display:"flex",gap:4,marginTop:6,flexWrap:"wrap"}}>{PERF_ORDER.map(p=>cls.perfDist[p]?<PerfChip key={p} perf={p} count={cls.perfDist[p]}/>:null)}</div></>):<div style={{fontSize:11,color:C.text3}}>No assessments yet</div>}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                            {[{label:"Lesson Plans",icon:"📖",route:"/teacher/lessonplan?subjectId="+sub.id},{label:"Progress Record",icon:"📝",route:"/teacher/progress"},{label:"Assessment",icon:"📊",route:"/teacher/assessment?subjectId="+sub.id},{label:"Scheme",icon:"📋",route:"/teacher/scheme?subjectId="+sub.id}].map(a=>(
                              <button key={a.label} onClick={()=>router.push(a.route)} style={{padding:"10px 12px",borderRadius:12,border:`1px solid ${C.border}`,background:C.surface,cursor:"pointer",fontFamily:"inherit",textAlign:"left",display:"flex",alignItems:"center",gap:8}}>
                                <span style={{fontSize:16}}>{a.icon}</span><span style={{fontSize:12,fontWeight:700,color:C.text2}}>{a.label}</span>
                              </button>
                            ))}
                          </div>
                          <button onClick={()=>router.push("/teacher/subjecthub")} style={{width:"100%",padding:10,borderRadius:12,border:"none",background:C.indigoDim,color:C.indigo,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Open in SubjectHub →</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {!loading&&subjects.length>0&&(
              <div style={{marginTop:16}}>
                <div style={{fontSize:10,fontWeight:800,color:C.text3,letterSpacing:1.5,textTransform:"uppercase",marginBottom:10}}>Quick Actions</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                  {[{label:"SubjectHub",icon:"🔬",route:"/teacher/subjecthub",bg:C.navy},{label:"Scheme",icon:"📋",route:"/teacher/scheme",bg:"#312e81"},{label:"Assessment",icon:"📊",route:"/teacher/assessment",bg:"#92400e"},{label:"Lesson Plans",icon:"📖",route:"/teacher/lessonplan",bg:"#4c1d95"},{label:"Progress Record",icon:"📝",route:"/teacher/progress",bg:"#064e3b"},{label:"TPAD",icon:"🏅",route:"/teacher/tpad",bg:"#1e3a5f"}].map(a=>(
                    <button key={a.label} onClick={()=>router.push(a.route)} style={{padding:"12px 4px",borderRadius:14,border:"none",background:a.bg,cursor:"pointer",fontFamily:"inherit",display:"flex",flexDirection:"column",alignItems:"center",gap:5,boxShadow:"0 2px 6px rgba(0,0,0,0.1)"}}>
                      <span style={{fontSize:22}}>{a.icon}</span><span style={{fontSize:10,fontWeight:800,color:"#fff",textAlign:"center",lineHeight:1.3}}>{a.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab==="gradebook"&&(
          <div style={{animation:"fadeUp 0.25s ease"}}>
            <div style={{fontSize:10,fontWeight:800,color:C.text3,letterSpacing:1.5,textTransform:"uppercase",marginBottom:14}}>CBC Performance Distribution</div>
            {loading?(<div style={{display:"flex",flexDirection:"column",gap:12}}>{[1,2,3].map(i=><Skel key={i} h={140}/>)}</div>):!hasAnyAssessments?(
              <EmptyAction icon="📊" title="No assessments recorded yet" sub="Record your first CBC assessment to see performance distribution across your classes." btnLabel="Record Assessment" onPress={()=>router.push("/teacher/assessment")}/>
            ):(
              subjects.map(sub=>{
                const subTotal=Object.values(sub.perfDist).reduce((a,b)=>a+b,0);
                return(
                  <div key={sub.id} style={{background:C.surface,borderRadius:16,border:`1px solid ${C.border}`,padding:15,marginBottom:12,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                      <div><div style={{fontSize:14,fontWeight:800,color:C.text}}>{sub.name}</div><div style={{fontSize:11,color:C.text3,marginTop:2}}>{sub.assessCount} assessments</div></div>
                      {sub.avgPerfPct!==null&&(<div style={{textAlign:"right"}}><div style={{fontSize:20,fontWeight:900,color:barColor(sub.avgPerfPct)}}>{sub.avgPerfPct}%</div><div style={{fontSize:9,color:C.text3,fontWeight:700}}>AVG PERF</div></div>)}
                    </div>
                    {subTotal>0?(<div style={{marginBottom:14}}><PerfBar dist={sub.perfDist} total={subTotal}/><div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>{PERF_ORDER.map(p=>sub.perfDist[p]?(<div key={p} style={{display:"flex",alignItems:"center",gap:4}}><PerfChip perf={p} count={sub.perfDist[p]}/><span style={{fontSize:10,color:C.text3}}>{Math.round((sub.perfDist[p]/subTotal)*100)}%</span></div>):null)}</div></div>):(<div style={{fontSize:12,color:C.text3,marginBottom:12}}>No assessments yet</div>)}
                    {sub.classes.map(cls=>{
                      const cTotal=Object.values(cls.perfDist).reduce((a,b)=>a+b,0);
                      const eeCount=cls.perfDist["exceeds_expectation"]??0;
                      const beCount=cls.perfDist["below_expectation"]??0;
                      return(
                        <div key={cls.id} style={{background:C.surface2,borderRadius:12,padding:"10px 12px",marginBottom:6,border:`1px solid ${C.border}`}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:cTotal>0?8:0}}>
                            <div><span style={{fontSize:13,fontWeight:800,color:C.text}}>{cls.name}{cls.stream?" "+cls.stream:""}</span><span style={{fontSize:11,color:C.text3,marginLeft:8}}>{cls.studentCount} students</span></div>
                            {cls.attRate!==null&&<span style={{fontSize:10,fontWeight:700,color:barColor(cls.attRate),background:cls.attRate>=70?C.emeraldDim:cls.attRate>=40?C.amberDim:C.redDim,borderRadius:8,padding:"2px 7px"}}>Att {cls.attRate}%</span>}
                          </div>
                          {cTotal>0?(<><PerfBar dist={cls.perfDist} total={cTotal}/><div style={{display:"flex",justifyContent:"space-between",marginTop:6}}><div style={{display:"flex",gap:4}}>{PERF_ORDER.map(p=>cls.perfDist[p]?<PerfChip key={p} perf={p} count={cls.perfDist[p]}/>:null)}</div><div style={{display:"flex",gap:6,alignItems:"center"}}>{eeCount>0&&<span style={{fontSize:10,color:C.emerald,fontWeight:700}}>🏆 {eeCount} excelling</span>}{beCount>0&&<span style={{fontSize:10,color:C.red,fontWeight:700}}>⚠️ {beCount} need help</span>}</div></div></>):<div style={{fontSize:11,color:C.text3}}>No assessments yet</div>}
                        </div>
                      );
                    })}
                    <button onClick={()=>router.push("/teacher/assessment?subjectId="+sub.id)} style={{marginTop:8,width:"100%",padding:"9px",borderRadius:12,border:"none",background:C.indigoDim,color:C.indigo,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Record Assessments →</button>
                  </div>
                );
              })
            )}
          </div>
        )}

        {tab==="atrisk"&&(
          <div style={{animation:"fadeUp 0.25s ease"}}>
            <div style={{background:C.redDim,borderRadius:14,border:`1px solid ${C.red}33`,padding:"12px 14px",marginBottom:14}}>
              <div style={{fontSize:13,fontWeight:800,color:C.red}}>Students Below Expectation</div>
              <div style={{fontSize:11,color:"#ef4444",marginTop:2}}>Based on CBC assessments this term. Take action early.</div>
            </div>
            {loading?(<div style={{display:"flex",flexDirection:"column",gap:10}}>{[1,2,3].map(i=><Skel key={i} h={80}/>)}</div>):!hasAnyAssessments?(
              <EmptyAction icon="📋" title="No assessments recorded yet" sub="Record CBC assessments first. At-risk students will appear here automatically." btnLabel="Record Assessment" onPress={()=>router.push("/teacher/assessment")}/>
            ):atRisk.length===0?(
              <div style={{background:C.surface,borderRadius:16,border:`1.5px dashed ${C.border2}`,padding:"40px 20px",textAlign:"center"}}>
                <div style={{fontSize:36,marginBottom:10}}>🎉</div>
                <div style={{fontSize:15,fontWeight:800,color:C.text,marginBottom:6}}>No students at risk</div>
                <div style={{fontSize:13,color:C.text3}}>All assessed students are meeting expectations or above.</div>
              </div>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {atRisk.map(s=>(
                  <div key={s.id} style={{background:C.surface,borderRadius:14,border:`1px solid ${C.border}`,padding:"13px 14px",boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                          <div style={{width:28,height:28,borderRadius:"50%",background:C.redDim,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:900,color:C.red,flexShrink:0}}>{s.name.charAt(0).toUpperCase()}</div>
                          <div><div style={{fontSize:13,fontWeight:800,color:C.text}}>{s.name}</div><div style={{fontSize:11,color:C.text3}}>{s.className}</div></div>
                        </div>
                        <div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:6}}>{s.subjects.map(sj=><span key={sj} style={{fontSize:10,fontWeight:700,color:C.red,background:C.redDim,padding:"2px 8px",borderRadius:8}}>{sj}</span>)}</div>
                      </div>
                      <div style={{textAlign:"right",flexShrink:0,marginLeft:12}}>
                        <div style={{fontSize:18,fontWeight:900,color:C.red}}>{s.beCount}</div>
                        <div style={{fontSize:9,color:C.text3,fontWeight:700}}>BE marks</div>
                        {s.attRate!==null&&<div style={{fontSize:10,fontWeight:700,color:barColor(s.attRate),marginTop:4}}>Att {s.attRate}%</div>}
                      </div>
                    </div>
                    <button onClick={()=>router.push("/teacher/classhub/"+s.classId)} style={{marginTop:10,width:"100%",padding:"8px",borderRadius:10,border:`1px solid ${C.border}`,background:C.surface2,color:C.text2,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>View in ClassHub →</button>
                  </div>
                ))}
                <div style={{background:C.indigoDim,borderRadius:14,border:`1px solid ${C.indigo}33`,padding:"12px 14px",marginTop:6}}>
                  <div style={{fontSize:12,fontWeight:800,color:C.indigo,marginBottom:6}}>💡 CBC Intervention Tips</div>
                  {["Group BE students for targeted strand revision","Assign peer learning partners (EE + BE pairings)","Re-assess after focused intervention sessions","Document intervention evidence for TPAD"].map((tip,i)=>(
                    <div key={i} style={{fontSize:11,color:"#4338ca",marginBottom:4,paddingLeft:12,borderLeft:`2px solid ${C.indigo}`}}>{tip}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab==="tpad"&&(
          <div style={{animation:"fadeUp 0.25s ease"}}>
            {loading?<Skel h={120}/>:termStats&&(
              <div style={{background:"linear-gradient(135deg,#1e1b4b,#312e81)",borderRadius:18,border:`1px solid ${C.indigo}44`,padding:18,marginBottom:14}}>
                <div style={{fontSize:10,fontWeight:800,color:"#a5b4fc",letterSpacing:1.5,textTransform:"uppercase",marginBottom:4}}>TPAD Score</div>
                <div style={{fontSize:48,fontWeight:900,color:"#818cf8",letterSpacing:-2}}>{termStats.tpadFinalScore!==null?termStats.tpadFinalScore:"—"}</div>
                <div style={{fontSize:12,color:"#c7d2fe",marginTop:2}}>{termStats.tpadStatus?`Status: ${termStats.tpadStatus}`:"No appraisal submitted yet"}</div>
                <div style={{display:"flex",gap:12,marginTop:12}}>
                  <div style={{background:"rgba(255,255,255,0.1)",borderRadius:10,padding:"8px 14px",textAlign:"center"}}>
                    <div style={{fontSize:18,fontWeight:900,color:"#a5b4fc"}}>{termStats.evidenceCount}</div>
                    <div style={{fontSize:9,color:"rgba(255,255,255,0.5)",fontWeight:700}}>Evidence items</div>
                  </div>
                  <div style={{background:"rgba(255,255,255,0.1)",borderRadius:10,padding:"8px 14px",textAlign:"center"}}>
                    <div style={{fontSize:18,fontWeight:900,color:"#bbf7d0"}}>{termStats.totalLessons}</div>
                    <div style={{fontSize:9,color:"rgba(255,255,255,0.5)",fontWeight:700}}>Lesson plans</div>
                  </div>
                  <div style={{background:"rgba(255,255,255,0.1)",borderRadius:10,padding:"8px 14px",textAlign:"center"}}>
                    <div style={{fontSize:18,fontWeight:900,color:"#fde68a"}}>{termStats.totalAssess}</div>
                    <div style={{fontSize:9,color:"rgba(255,255,255,0.5)",fontWeight:700}}>Assessments</div>
                  </div>
                </div>
              </div>
            )}
            <div style={{fontSize:10,fontWeight:800,color:C.text3,letterSpacing:1.5,textTransform:"uppercase",marginBottom:10}}>All 8 TSC Standards</div>
            {loading?(<div style={{display:"flex",flexDirection:"column",gap:8}}>{TSC_STANDARDS.map((_,i)=><Skel key={i} h={64}/>)}</div>):(
              <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14}}>
                {TSC_STANDARDS.map((std,i)=>{
                  const score=termStats?.tpadStandards[std.key]??null;
                  const pct=score!==null?Math.round((score/4)*100):0;
                  return(
                    <div key={std.key} style={{background:C.surface,borderRadius:14,border:`1px solid ${C.border}`,padding:"13px 14px",boxShadow:"0 1px 3px rgba(0,0,0,0.05)"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                        <div style={{flex:1,marginRight:8}}>
                          <div style={{fontSize:10,fontWeight:800,color:C.text3,marginBottom:2}}>Standard {i+1}{i>=4?" · Self only":""}</div>
                          <div style={{fontSize:12,fontWeight:700,color:C.text}}>{std.label}</div>
                        </div>
                        <div style={{textAlign:"right",flexShrink:0}}>
                          <div style={{fontSize:18,fontWeight:900,color:score!==null?barColor(pct):C.text3}}>{score!==null?score+"/4":"—"}</div>
                        </div>
                      </div>
                      <MiniBar pct={score!==null?pct:0} color={score!==null?barColor(pct):C.border2} h={5}/>
                    </div>
                  );
                })}
              </div>
            )}
            {!loading&&termStats&&termStats.tpadFinalScore===null&&(
              <div style={{background:C.amberDim,borderRadius:14,border:`1px solid ${C.amber}44`,padding:"12px 14px",marginBottom:12}}>
                <div style={{fontSize:12,fontWeight:800,color:C.amber,marginBottom:4}}>⚠️ No TPAD appraisal submitted yet</div>
                <div style={{fontSize:11,color:"#92400e"}}>Submit your self-appraisal on the TPAD dashboard to populate your scores here.</div>
              </div>
            )}
            <button onClick={()=>router.push("/teacher/tpad")} style={{width:"100%",padding:"13px",borderRadius:14,border:"none",background:C.indigoDim,color:C.indigo,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Open Full TPAD Dashboard →</button>
          </div>
        )}

      </div>
    </div>
  );
}
