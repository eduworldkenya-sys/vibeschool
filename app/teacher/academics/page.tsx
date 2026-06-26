"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { nairobiDateStr } from "@/lib/time";

const C = {
  bg:"#000000",surface:"#09090b",surface2:"#111113",border:"#1f1f23",border2:"#2a2a30",
  text:"#f4f4f5",text2:"#a1a1aa",text3:"#52525b",emerald:"#10b981",emeraldDim:"#064e3b",
  indigo:"#6366f1",indigoDim:"#1e1b4b",amber:"#f59e0b",amberDim:"#78350f",
  red:"#ef4444",redDim:"#7f1d1d",violet:"#8b5cf6",violetDim:"#4c1d95",
} as const;

interface SubjectCard {
  id:string;name:string;classes:ClassRow[];lessonCount:number;assessCount:number;
  coveragePct:number|null;assessedPct:number|null;masteredPct:number|null;
  avgPerfPct:number|null;perfDist:Record<string,number>;attRate:number|null;
}
interface ClassRow {
  id:string;name:string;stream:string|null;studentCount:number;
  perfDist:Record<string,number>;attRate:number|null;
}
interface AtRiskStudent {
  id:string;name:string;className:string;subjects:string[];beCount:number;attRate:number|null;
}
interface TermStat {
  totalLessons:number;totalAssess:number;subjectCount:number;studentCount:number;
  tpadScore:number;avgAttRate:number|null;
}
type Tab="overview"|"gradebook"|"atrisk"|"tpad";

const PERF_ORDER=["exceeds_expectation","meets_expectation","approaches_expectation","below_expectation"] as const;
const PERF_META:Record<string,{short:string;color:string;bg:string}>={
  exceeds_expectation:   {short:"EE",color:"#10b981",bg:"#064e3b"},
  meets_expectation:     {short:"ME",color:"#38bdf8",bg:"#0c4a6e"},
  approaches_expectation:{short:"AE",color:"#f59e0b",bg:"#78350f"},
  below_expectation:     {short:"BE",color:"#ef4444",bg:"#7f1d1d"},
};
function perfScore(p:string){return({exceeds_expectation:4,meets_expectation:3,approaches_expectation:2,below_expectation:1} as Record<string,number>)[p]??0;}
function barColor(pct:number){return pct>=70?"#10b981":pct>=40?"#f59e0b":"#ef4444";}
function termStart(){const n=new Date();return nairobiDateStr(new Date(n.getFullYear(),Math.floor(n.getMonth()/4)*4,1));}
function currentTerm(){return Math.floor(new Date().getMonth()/4)+1;}

function Skel({h=56}:{h?:number}){
  return <div style={{height:h,borderRadius:12,background:"linear-gradient(90deg,#1f1f23 25%,#2a2a30 50%,#1f1f23 75%)",backgroundSize:"200% 100%",animation:"shimmer 1.4s infinite"}}/>;
}
function MiniBar({pct,color,h=4}:{pct:number;color:string;h?:number}){
  return <div style={{width:"100%",height:h,borderRadius:4,background:"#2a2a30",overflow:"hidden"}}><div style={{width:pct+"%",height:"100%",borderRadius:4,background:color,transition:"width 0.5s ease"}}/></div>;
}
function PerfChip({perf,count}:{perf:string;count:number}){
  const m=PERF_META[perf];if(!m)return null;
  return <div style={{display:"flex",alignItems:"center",gap:4,background:m.bg,borderRadius:8,padding:"3px 8px"}}><span style={{fontSize:11,fontWeight:900,color:m.color}}>{m.short}</span><span style={{fontSize:11,fontWeight:700,color:m.color}}>{count}</span></div>;
}
function PerfBar({dist,total}:{dist:Record<string,number>;total:number}){
  if(total===0)return <div style={{fontSize:11,color:"#52525b"}}>No assessments yet</div>;
  return(
    <div style={{display:"flex",gap:2,height:8,borderRadius:6,overflow:"hidden",width:"100%"}}>
      {PERF_ORDER.map(p=>{
        const pct=((dist[p]??0)/total)*100;
        if(pct===0)return null;
        return <div key={p} style={{width:pct+"%",background:PERF_META[p].color}}/>;
      })}
    </div>
  );
}

export default function TeacherAcademicsPage(){
  const router=useRouter();
  const [tab,setTab]=useState<Tab>("overview");
  const [loading,setLoading]=useState(true);
  const [subjects,setSubjects]=useState<SubjectCard[]>([]);
  const [atRisk,setAtRisk]=useState<AtRiskStudent[]>([]);
  const [termStats,setTermStats]=useState<TermStat|null>(null);
  const [expanded,setExpanded]=useState<string|null>(null);
  const [tpadLines,setTpadLines]=useState<{label:string;count:number;pts:number}[]>([]);

  const boot=useCallback(async()=>{
    setLoading(true);
    try{
      const{data:{user}}=await supabase.auth.getUser();
      if(!user){router.push("/?role=teacher");return;}

      const[teacherRes,memberRes,profileRes]=await Promise.all([
        supabase.from("teacher_profiles").select("school_id").eq("profile_id",user.id).maybeSingle(),
        supabase.from("school_members").select("school_id").eq("profile_id",user.id).maybeSingle(),
        supabase.from("profiles").select("school_id").eq("id",user.id).single(),
      ]);
      const schoolId=memberRes.data?.school_id??teacherRes.data?.school_id??profileRes.data?.school_id??null;

      const{data:tcRows}=await supabase.from("teacher_classes").select("class_id, subject_id").eq("teacher_id",user.id);
      const rows=(tcRows??[]) as{class_id:string;subject_id:string}[];
      const subjectIds=Array.from(new Set(rows.map(r=>r.subject_id).filter(Boolean)));
      const classIds=Array.from(new Set(rows.map(r=>r.class_id).filter(Boolean)));
      if(subjectIds.length===0){setLoading(false);return;}

      const tStart=termStart();
      const tNum=currentTerm();
      const tYear=new Date().getFullYear();

      const[subRes,classRes,studentClsRes,lpRes,assRes,outcomeRes,attRes]=await Promise.all([
        supabase.from("subjects").select("id, name").in("id",subjectIds),
        supabase.from("classes").select("id, name, stream").in("id",classIds),
        classIds.length>0
          ?supabase.from("student_classes").select("student_id, class_id").in("class_id",classIds).eq("is_current",true)
          :Promise.resolve({data:[]}),
        supabase.from("lesson_plans").select("id, subject_id, status").eq("teacher_id",user.id).gte("created_at",tStart),
        schoolId
          ?supabase.from("cbc_assessments").select("id,student_id,subject_id,class_id,performance,term,academic_year").eq("teacher_id",user.id).eq("school_id",schoolId).eq("term",tNum).eq("academic_year",tYear)
          :supabase.from("cbc_assessments").select("id,student_id,subject_id,class_id,performance,term,academic_year").eq("teacher_id",user.id).eq("term",tNum).eq("academic_year",tYear),
        supabase.from("learner_outcomes").select("subject_id, status").in("subject_id",subjectIds),
        classIds.length>0
          ?supabase.from("attendance").select("student_id, class_id, status").in("class_id",classIds).eq("teacher_id",user.id).gte("date",tStart)
          :Promise.resolve({data:[]}),
      ]);

      type SubRow={id:string;name:string};
      type ClsRow={id:string;name:string;stream:string|null};
      type SClsRow={student_id:string;class_id:string};
      type LPRow={id:string;subject_id:string;status:string};
      type AssRow={id:string;student_id:string;subject_id:string;class_id:string;performance:string;term:number;academic_year:number};
      type OutRow={subject_id:string;status:string|null};
      type AttRow={student_id:string;class_id:string;status:string};

      const subList=(subRes.data??[]) as SubRow[];
      const classList=(classRes.data??[]) as ClsRow[];
      const studentCls=(studentClsRes.data??[]) as SClsRow[];
      const lpData=(lpRes.data??[]) as LPRow[];
      const assData=(assRes.data??[]) as AssRow[];
      const outcomeData=(outcomeRes.data??[]) as OutRow[];
      const attData=(attRes.data??[]) as AttRow[];

      const classStudentIds:Record<string,Set<string>>={};
      for(const r of studentCls){
        if(!classStudentIds[r.class_id])classStudentIds[r.class_id]=new Set();
        classStudentIds[r.class_id].add(r.student_id);
      }
      const totalStudents=Object.values(classStudentIds).reduce((s,st)=>s+st.size,0);

      const attByClass:Record<string,{present:number;total:number}>={};
      for(const r of attData){
        if(!attByClass[r.class_id])attByClass[r.class_id]={present:0,total:0};
        attByClass[r.class_id].total++;
        if(r.status==="present")attByClass[r.class_id].present++;
      }
      const classAttRate=(cid:string):number|null=>{const b=attByClass[cid];if(!b||b.total===0)return null;return Math.round((b.present/b.total)*100);};
      const buildDist=(items:AssRow[]):Record<string,number>=>{const d:Record<string,number>={};for(const a of items)d[a.performance]=(d[a.performance]??0)+1;return d;};
            const subClassMap:Record<string,string[]>={};
      for(const r of rows){
        if(!subClassMap[r.subject_id])subClassMap[r.subject_id]=[];
        if(!subClassMap[r.subject_id].includes(r.class_id))subClassMap[r.subject_id].push(r.class_id);
      }

      const summaries:SubjectCard[]=subList.map(sub=>{
        const myCls=subClassMap[sub.id]??[];
        const subAss=assData.filter(a=>a.subject_id===sub.id);
        const outcomes=outcomeData.filter(o=>o.subject_id===sub.id);
        const total=outcomes.length;
        const covered=outcomes.filter(o=>["assessed","mastered"].includes(o.status??"")).length;
        const assessed=outcomes.filter(o=>o.status==="assessed").length;
        const mastered=outcomes.filter(o=>o.status==="mastered").length;
        const perfSum=subAss.reduce((s,a)=>s+perfScore(a.performance),0);
        const avgPerf=subAss.length>0?Math.round((perfSum/(subAss.length*4))*100):null;
        const classRows:ClassRow[]=classList
          .filter(c=>myCls.includes(c.id))
          .map(c=>{
            const cAss=subAss.filter(a=>a.class_id===c.id);
            return{id:c.id,name:c.name,stream:c.stream,studentCount:classStudentIds[c.id]?.size??0,perfDist:buildDist(cAss),attRate:classAttRate(c.id)};
          });
        const myAttRates=myCls.map(cid=>classAttRate(cid)).filter((r):r is number=>r!==null);
        const avgAtt=myAttRates.length>0?Math.round(myAttRates.reduce((a,b)=>a+b,0)/myAttRates.length):null;
        return{
          id:sub.id,name:sub.name,classes:classRows,
          lessonCount:lpData.filter(l=>l.subject_id===sub.id).length,
          assessCount:subAss.length,
          coveragePct:total>0?Math.round((covered/total)*100):null,
          assessedPct:total>0?Math.round((assessed/total)*100):null,
          masteredPct:total>0?Math.round((mastered/total)*100):null,
          avgPerfPct:avgPerf,perfDist:buildDist(subAss),attRate:avgAtt,
        };
      });
      setSubjects(summaries);

      const beStudentMap:Record<string,{subjectNames:string[];beCount:number;classId:string}>={};
      for(const a of assData){
        if(a.performance!=="below_expectation")continue;
        if(!beStudentMap[a.student_id])beStudentMap[a.student_id]={subjectNames:[],beCount:0,classId:a.class_id};
        beStudentMap[a.student_id].beCount++;
        const sName=subList.find(s=>s.id===a.subject_id)?.name;
        if(sName&&!beStudentMap[a.student_id].subjectNames.includes(sName))beStudentMap[a.student_id].subjectNames.push(sName);
      }
      const beStudentIds=Object.keys(beStudentMap);
      const studentNames:Record<string,string>={};
      if(beStudentIds.length>0){
        const{data:studs}=await supabase.from("students").select("id, name").in("id",beStudentIds);
        for(const s of(studs??[]))studentNames[s.id]=s.name;
      }
      const atRiskList:AtRiskStudent[]=beStudentIds
        .map(sid=>{
          const info=beStudentMap[sid];
          const cls=classList.find(c=>c.id===info.classId);
          const clsName=cls?cls.name+(cls.stream?" "+cls.stream:""):"Unknown";
          return{id:sid,name:studentNames[sid]??"Student",className:clsName,subjects:info.subjectNames,beCount:info.beCount,attRate:classAttRate(info.classId)};
        })
        .sort((a,b)=>b.beCount-a.beCount)
        .slice(0,20);
      setAtRisk(atRiskList);

      const allAttRates=classIds.map(cid=>classAttRate(cid)).filter((r):r is number=>r!==null);
      const avgAttRate=allAttRates.length>0?Math.round(allAttRates.reduce((a,b)=>a+b,0)/allAttRates.length):null;
      setTpadLines([
        {label:"Lesson Plans",count:lpData.length,pts:15},
        {label:"Assessments",count:assData.length,pts:8},
        {label:"Lesson Notes",count:0,pts:10},
        {label:"Schemes of Work",count:0,pts:20},
      ]);
      setTermStats({totalLessons:lpData.length,totalAssess:assData.length,subjectCount:subList.length,studentCount:totalStudents,tpadScore:(lpData.length*15)+(assData.length*8),avgAttRate});
    }catch(e){console.error("TeacherAcademics boot",e);}
    finally{setLoading(false);}
  },[router]);

  useEffect(()=>{boot();},[boot]);

  const overallMastery=subjects.length>0?Math.round(subjects.reduce((s,sub)=>s+(sub.masteredPct??0),0)/subjects.length):0;
  const totalAssessments=subjects.reduce((s,sub)=>s+sub.assessCount,0);
  const globalDist:Record<string,number>={};
  for(const sub of subjects)for(const[k,v]of Object.entries(sub.perfDist))globalDist[k]=(globalDist[k]??0)+v;

  return(
    <div style={{background:"#000000",minHeight:"100vh",paddingBottom:100,fontFamily:"'Plus Jakarta Sans',sans-serif",maxWidth:480,margin:"0 auto"}}>
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}`}</style>

      <div style={{background:"linear-gradient(135deg,#064e3b 0%,#065f46 50%,#10b981 150%)",padding:"20px 16px 24px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-50,right:-50,width:160,height:160,borderRadius:"50%",background:"rgba(255,255,255,0.05)"}}/>
        <button onClick={()=>router.back()} style={{background:"rgba(255,255,255,0.12)",border:"none",borderRadius:8,padding:"5px 12px",fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer",fontFamily:"inherit",marginBottom:14}}>← Back</button>
        <div style={{fontSize:10,fontWeight:800,color:"rgba(255,255,255,0.5)",letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>My Academics</div>
        <div style={{fontSize:24,fontWeight:900,color:"#fff",letterSpacing:-0.5}}>Term {currentTerm()} Hub</div>
        <div style={{fontSize:12,color:"rgba(255,255,255,0.65)",marginTop:2}}>All subjects · All classes · One view</div>
        {!loading&&termStats&&(
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6,marginTop:18}}>
            {[
              {label:"Subjects",value:termStats.subjectCount,color:"#5eead4"},
              {label:"Students",value:termStats.studentCount,color:"#a5f3fc"},
              {label:"Lessons",value:termStats.totalLessons,color:"#86efac"},
              {label:"Assessed",value:termStats.totalAssess,color:"#fde68a"},
              {label:"Att %",value:termStats.avgAttRate!==null?termStats.avgAttRate+"%":"—",color:"#c4b5fd"},
            ].map(s=>(
              <div key={s.label} style={{background:"rgba(255,255,255,0.1)",borderRadius:10,padding:"8px 4px",textAlign:"center"}}>
                <div style={{fontSize:16,fontWeight:900,color:s.color}}>{s.value}</div>
                <div style={{fontSize:8,color:"rgba(255,255,255,0.55)",fontWeight:700,lineHeight:1.3}}>{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{display:"flex",background:"#09090b",borderBottom:"1px solid #1f1f23",position:"sticky",top:0,zIndex:10}}>
        {([
          {key:"overview" as Tab,label:"Overview"},
          {key:"gradebook" as Tab,label:"Gradebook"},
          {key:"atrisk" as Tab,label:"At Risk"+(atRisk.length>0?" ("+atRisk.length+")":"")},
          {key:"tpad" as Tab,label:"TPAD"},
        ]).map(t=>(
          <button key={t.key} onClick={()=>setTab(t.key)} style={{flex:1,padding:"11px 2px",border:"none",background:"transparent",cursor:"pointer",fontFamily:"inherit",fontSize:10,fontWeight:800,color:tab===t.key?"#10b981":"#52525b",borderBottom:"2px solid "+(tab===t.key?"#10b981":"transparent"),transition:"color 0.15s"}}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{padding:14}}>

        {tab==="overview"&&(
          <div style={{animation:"fadeUp 0.25s ease"}}>
            {loading?<Skel h={130}/>:subjects.length>0&&(
              <div style={{background:"#09090b",borderRadius:18,border:"1px solid #1f1f23",padding:16,marginBottom:12}}>
                <div style={{fontSize:10,fontWeight:800,color:"#52525b",letterSpacing:1.5,textTransform:"uppercase",marginBottom:14}}>Overall Mastery</div>
                <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:14}}>
                  <div style={{width:68,height:68,borderRadius:"50%",flexShrink:0,background:"conic-gradient("+barColor(overallMastery)+" "+(overallMastery*3.6)+"deg,#2a2a30 0deg)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <div style={{width:52,height:52,borderRadius:"50%",background:"#09090b",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:900,color:barColor(overallMastery)}}>{overallMastery}%</div>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:17,fontWeight:900,color:"#f4f4f5"}}>{overallMastery>=70?"On Track 🎯":overallMastery>=40?"Needs Attention ⚠️":"Behind 🔴"}</div>
                    <div style={{fontSize:12,color:"#a1a1aa",marginTop:3}}>Avg mastery across {subjects.length} subject{subjects.length!==1?"s":""}</div>
                    {termStats&&termStats.avgAttRate!==null&&(
                      <div style={{fontSize:12,color:"#a1a1aa",marginTop:2}}>Avg attendance: <span style={{color:barColor(termStats.avgAttRate),fontWeight:700}}>{termStats.avgAttRate}%</span></div>
                    )}
                  </div>
                </div>
                {totalAssessments>0&&(
                  <>
                    <PerfBar dist={globalDist} total={totalAssessments}/>
                    <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
                      {PERF_ORDER.map(p=>globalDist[p]?<PerfChip key={p} perf={p} count={globalDist[p]}/>:null)}
                    </div>
                  </>
                )}
              </div>
            )}

            {!loading&&atRisk.length>0&&(
              <button onClick={()=>setTab("atrisk")} style={{width:"100%",background:"#7f1d1d",border:"1px solid #ef4444",borderRadius:14,padding:"12px 14px",cursor:"pointer",fontFamily:"inherit",textAlign:"left",display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                <div>
                  <div style={{fontSize:13,fontWeight:800,color:"#fca5a5"}}>⚠️ {atRisk.length} student{atRisk.length!==1?"s":""} below expectation</div>
                  <div style={{fontSize:11,color:"#f87171",marginTop:2}}>Tap to view and take action</div>
                </div>
                <div style={{fontSize:18,color:"#f87171"}}>›</div>
              </button>
            )}

            <div style={{fontSize:10,fontWeight:800,color:"#52525b",letterSpacing:1.5,textTransform:"uppercase",marginBottom:10}}>Subject Breakdown</div>

            {loading?(
              <div style={{display:"flex",flexDirection:"column",gap:10}}>{[1,2,3].map(i=><Skel key={i} h={100}/>)}</div>
            ):subjects.length===0?(
              <div style={{background:"#09090b",borderRadius:16,border:"1.5px dashed #2a2a30",padding:"40px 20px",textAlign:"center"}}>
                <div style={{fontSize:36,marginBottom:10}}>📚</div>
                <div style={{fontSize:15,fontWeight:800,color:"#f4f4f5",marginBottom:6}}>No subjects assigned</div>
                <div style={{fontSize:13,color:"#52525b"}}>Go to SubjectHub to claim your subjects.</div>
                <button onClick={()=>router.push("/teacher/subjecthub")} style={{marginTop:14,padding:"10px 24px",borderRadius:12,background:"#10b981",color:"#fff",border:"none",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Open SubjectHub</button>
              </div>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {subjects.map(sub=>{
                  const isOpen=expanded===sub.id;
                  const mp=sub.masteredPct;
                  const hColor=mp===null?"#52525b":mp>=70?"#10b981":mp>=40?"#f59e0b":"#ef4444";
                  const hBg=mp===null?"#111113":mp>=70?"#064e3b":mp>=40?"#78350f":"#7f1d1d";
                  const hLabel=mp===null?"No data":mp>=70?"On Track":mp>=40?"Watch":"Alert";
                  return(
                    <div key={sub.id} style={{background:"#09090b",borderRadius:16,border:"1px solid "+(isOpen?"#10b98144":"#1f1f23"),overflow:"hidden"}}>
                      <div onClick={()=>setExpanded(isOpen?null:sub.id)} style={{padding:15,cursor:"pointer"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                          <div style={{flex:1}}>
                            <div style={{fontSize:14,fontWeight:800,color:"#f4f4f5"}}>{sub.name}</div>
                            <div style={{fontSize:11,color:"#52525b",marginTop:2}}>{sub.classes.length} class{sub.classes.length!==1?"es":""} · {sub.lessonCount} lessons · {sub.assessCount} assessed</div>
                          </div>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <div style={{fontSize:11,fontWeight:800,color:hColor,background:hBg,padding:"3px 10px",borderRadius:20}}>{hLabel}</div>
                            <div style={{fontSize:18,color:"#52525b",transform:isOpen?"rotate(90deg)":"none",transition:"transform 0.2s"}}>›</div>
                          </div>
                        </div>
                        <div style={{display:"flex",flexDirection:"column",gap:5}}>
                          {[
                            {label:"Coverage",pct:sub.coveragePct,color:"#075985"},
                            {label:"Assessed",pct:sub.assessedPct,color:"#6366f1"},
                            {label:"Mastered",pct:sub.masteredPct,color:"#10b981"},
                          ].map(({label,pct,color})=>(
                            <div key={label} style={{display:"flex",alignItems:"center",gap:8}}>
                              <div style={{fontSize:10,color:"#52525b",fontWeight:600,width:56,flexShrink:0}}>{label}</div>
                              <div style={{flex:1}}><MiniBar pct={pct??0} color={pct!==null?color:"#2a2a30"}/></div>
                              <div style={{fontSize:10,fontWeight:800,color:pct!==null?color:"#52525b",width:30,textAlign:"right"}}>{pct!==null?pct+"%":"—"}</div>
                            </div>
                          ))}
                        </div>
                        {sub.assessCount>0&&<div style={{marginTop:8}}><PerfBar dist={sub.perfDist} total={sub.assessCount}/></div>}
                      </div>
                      {isOpen&&(
                        <div style={{borderTop:"1px solid #1f1f23",padding:"12px 15px"}}>
                          {sub.classes.length>0&&(
                            <div style={{marginBottom:12}}>
                              <div style={{fontSize:10,fontWeight:800,color:"#52525b",letterSpacing:1.2,textTransform:"uppercase",marginBottom:8}}>By Class</div>
                              {sub.classes.map(cls=>{
                                const ct=Object.values(cls.perfDist).reduce((a,b)=>a+b,0);
                                return(
                                  <div key={cls.id} style={{background:"#111113",borderRadius:12,padding:"10px 12px",marginBottom:6}}>
                                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:ct>0?6:0}}>
                                      <span style={{fontSize:12,fontWeight:800,color:"#f4f4f5"}}>{cls.name}{cls.stream?" "+cls.stream:""}</span>
                                      <div style={{display:"flex",gap:4,alignItems:"center"}}>
                                        {cls.attRate!==null&&<span style={{fontSize:10,fontWeight:700,color:barColor(cls.attRate),background:cls.attRate>=70?"#064e3b":cls.attRate>=40?"#78350f":"#7f1d1d",borderRadius:8,padding:"2px 7px"}}>Att {cls.attRate}%</span>}
                                        <span style={{fontSize:10,color:"#52525b"}}>{cls.studentCount} students</span>
                                      </div>
                                    </div>
                                    {ct>0?(<><PerfBar dist={cls.perfDist} total={ct}/><div style={{display:"flex",gap:4,marginTop:6,flexWrap:"wrap"}}>{PERF_ORDER.map(p=>cls.perfDist[p]?<PerfChip key={p} perf={p} count={cls.perfDist[p]}/>:null)}</div></>):<div style={{fontSize:11,color:"#52525b"}}>No assessments yet</div>}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                            {[
                              {label:"Lesson Plans",icon:"📖",route:"/teacher/lessonplan?subjectId="+sub.id},
                              {label:"Lesson Notes",icon:"📝",route:"/teacher/lessonnotes"},
                              {label:"Assessment",icon:"📊",route:"/teacher/assessment?subjectId="+sub.id},
                              {label:"Scheme",icon:"📋",route:"/teacher/scheme?subjectId="+sub.id},
                            ].map(a=>(
                              <button key={a.label} onClick={()=>router.push(a.route)} style={{padding:"10px 12px",borderRadius:12,border:"1px solid #2a2a30",background:"#111113",cursor:"pointer",fontFamily:"inherit",textAlign:"left",display:"flex",alignItems:"center",gap:8}}>
                                <span style={{fontSize:16}}>{a.icon}</span>
                                <span style={{fontSize:12,fontWeight:700,color:"#a1a1aa"}}>{a.label}</span>
                              </button>
                            ))}
                          </div>
                          <button onClick={()=>router.push("/teacher/subjecthub")} style={{marginTop:10,width:"100%",padding:10,borderRadius:12,border:"none",background:"#064e3b",color:"#10b981",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Open in SubjectHub →</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {!loading&&subjects.length>0&&(
              <div style={{marginTop:16}}>
                <div style={{fontSize:10,fontWeight:800,color:"#52525b",letterSpacing:1.5,textTransform:"uppercase",marginBottom:10}}>Quick Actions</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                  {[
                    {label:"SubjectHub",icon:"🔬",route:"/teacher/subjecthub",bg:"#075985"},
                    {label:"Scheme",icon:"📋",route:"/teacher/scheme",bg:"#1e1b4b"},
                    {label:"Assessment",icon:"📊",route:"/teacher/assessment",bg:"#78350f"},
                    {label:"Lesson Plans",icon:"📖",route:"/teacher/lessonplan",bg:"#4c1d95"},
                    {label:"Lesson Notes",icon:"📝",route:"/teacher/lessonnotes",bg:"#064e3b"},
                    {label:"TPAD",icon:"🏅",route:"/teacher/tpad",bg:"#1e1b4b"},
                  ].map(a=>(
                    <button key={a.label} onClick={()=>router.push(a.route)} style={{padding:"12px 4px",borderRadius:14,border:"none",background:a.bg,cursor:"pointer",fontFamily:"inherit",display:"flex",flexDirection:"column",alignItems:"center",gap:5}}>
                      <span style={{fontSize:22}}>{a.icon}</span>
                      <span style={{fontSize:10,fontWeight:800,color:"#fff",textAlign:"center",lineHeight:1.3}}>{a.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab==="gradebook"&&(
          <div style={{animation:"fadeUp 0.25s ease"}}>
            <div style={{fontSize:10,fontWeight:800,color:"#52525b",letterSpacing:1.5,textTransform:"uppercase",marginBottom:14}}>CBC Performance Distribution</div>
            {loading?(
              <div style={{display:"flex",flexDirection:"column",gap:12}}>{[1,2,3].map(i=><Skel key={i} h={140}/>)}</div>
            ):subjects.length===0?(
              <div style={{textAlign:"center",padding:"40px 0",color:"#52525b"}}>No subjects yet</div>
            ):(
              subjects.map(sub=>{
                const subTotal=Object.values(sub.perfDist).reduce((a,b)=>a+b,0);
                return(
                  <div key={sub.id} style={{background:"#09090b",borderRadius:16,border:"1px solid #1f1f23",padding:15,marginBottom:12}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                      <div>
                        <div style={{fontSize:14,fontWeight:800,color:"#f4f4f5"}}>{sub.name}</div>
                        <div style={{fontSize:11,color:"#52525b",marginTop:2}}>{sub.assessCount} total assessments</div>
                      </div>
                      {sub.avgPerfPct!==null&&(
                        <div style={{textAlign:"right"}}>
                          <div style={{fontSize:20,fontWeight:900,color:barColor(sub.avgPerfPct)}}>{sub.avgPerfPct}%</div>
                          <div style={{fontSize:9,color:"#52525b",fontWeight:700}}>AVG PERF</div>
                        </div>
                      )}
                    </div>
                    {subTotal>0?(
                      <div style={{marginBottom:14}}>
                        <PerfBar dist={sub.perfDist} total={subTotal}/>
                        <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
                          {PERF_ORDER.map(p=>sub.perfDist[p]?(
                            <div key={p} style={{display:"flex",alignItems:"center",gap:4}}>
                              <PerfChip perf={p} count={sub.perfDist[p]}/>
                              <span style={{fontSize:10,color:"#52525b"}}>{Math.round((sub.perfDist[p]/subTotal)*100)}%</span>
                            </div>
                          ):null)}
                        </div>
                      </div>
                    ):(
                      <div style={{fontSize:12,color:"#52525b",marginBottom:12}}>No assessments recorded yet</div>
                    )}
                    {sub.classes.map(cls=>{
                      const ct=Object.values(cls.perfDist).reduce((a,b)=>a+b,0);
                      const ee=cls.perfDist["exceeds_expectation"]??0;
                      const be=cls.perfDist["below_expectation"]??0;
                      return(
                        <div key={cls.id} style={{background:"#111113",borderRadius:12,padding:"10px 12px",marginBottom:6}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:ct>0?8:0}}>
                            <div>
                              <span style={{fontSize:13,fontWeight:800,color:"#f4f4f5"}}>{cls.name}{cls.stream?" "+cls.stream:""}</span>
                              <span style={{fontSize:11,color:"#52525b",marginLeft:8}}>{cls.studentCount} students</span>
                            </div>
                            {cls.attRate!==null&&<span style={{fontSize:10,fontWeight:700,color:barColor(cls.attRate),background:cls.attRate>=70?"#064e3b":cls.attRate>=40?"#78350f":"#7f1d1d",borderRadius:8,padding:"2px 7px"}}>Att {cls.attRate}%</span>}
                          </div>
                          {ct>0?(
                            <>
                              <PerfBar dist={cls.perfDist} total={ct}/>
                              <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
                                <div style={{display:"flex",gap:4}}>{PERF_ORDER.map(p=>cls.perfDist[p]?<PerfChip key={p} perf={p} count={cls.perfDist[p]}/>:null)}</div>
                                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                                  {ee>0&&<span style={{fontSize:10,color:"#10b981",fontWeight:700}}>🏆 {ee} excelling</span>}
                                  {be>0&&<span style={{fontSize:10,color:"#ef4444",fontWeight:700}}>⚠️ {be} need help</span>}
                                </div>
                              </div>
                            </>
                          ):<div style={{fontSize:11,color:"#52525b"}}>No assessments yet</div>}
                        </div>
                      );
                    })}
                    <button onClick={()=>router.push("/teacher/assessment?subjectId="+sub.id)} style={{marginTop:8,width:"100%",padding:"9px",borderRadius:12,border:"none",background:"#1e1b4b",color:"#6366f1",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Record Assessments →</button>
                  </div>
                );
              })
            )}
          </div>
        )}

        {tab==="atrisk"&&(
          <div style={{animation:"fadeUp 0.25s ease"}}>
            <div style={{background:"#7f1d1d",borderRadius:14,border:"1px solid #ef4444",padding:"12px 14px",marginBottom:14}}>
              <div style={{fontSize:13,fontWeight:800,color:"#fca5a5"}}>Students Below Expectation</div>
              <div style={{fontSize:11,color:"#f87171",marginTop:2}}>Based on CBC assessments this term. Take action early.</div>
            </div>
            {loading?(
              <div style={{display:"flex",flexDirection:"column",gap:10}}>{[1,2,3].map(i=><Skel key={i} h={80}/>)}</div>
            ):atRisk.length===0?(
              <div style={{background:"#09090b",borderRadius:16,border:"1.5px dashed #2a2a30",padding:"40px 20px",textAlign:"center"}}>
                <div style={{fontSize:36,marginBottom:10}}>🎉</div>
                <div style={{fontSize:15,fontWeight:800,color:"#f4f4f5",marginBottom:6}}>No students at risk</div>
                <div style={{fontSize:13,color:"#52525b"}}>All assessed students are meeting expectations or above.</div>
              </div>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {atRisk.map(s=>(
                  <div key={s.id} style={{background:"#09090b",borderRadius:14,border:"1px solid #1f1f23",padding:"13px 14px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                          <div style={{width:28,height:28,borderRadius:"50%",background:"#7f1d1d",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:900,color:"#ef4444",flexShrink:0}}>{s.name.charAt(0).toUpperCase()}</div>
                          <div>
                            <div style={{fontSize:13,fontWeight:800,color:"#f4f4f5"}}>{s.name}</div>
                            <div style={{fontSize:11,color:"#52525b"}}>{s.className}</div>
                          </div>
                        </div>
                        <div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:6}}>
                          {s.subjects.map(sj=><span key={sj} style={{fontSize:10,fontWeight:700,color:"#ef4444",background:"#7f1d1d",padding:"2px 8px",borderRadius:8}}>{sj}</span>)}
                        </div>
                      </div>
                      <div style={{textAlign:"right",flexShrink:0,marginLeft:12}}>
                        <div style={{fontSize:18,fontWeight:900,color:"#ef4444"}}>{s.beCount}</div>
                        <div style={{fontSize:9,color:"#52525b",fontWeight:700}}>BE marks</div>
                        {s.attRate!==null&&<div style={{fontSize:10,fontWeight:700,color:barColor(s.attRate),marginTop:4}}>Att {s.attRate}%</div>}
                      </div>
                    </div>
                    <button onClick={()=>router.push("/teacher/classhub")} style={{marginTop:10,width:"100%",padding:"8px",borderRadius:10,border:"1px solid #2a2a30",background:"#111113",color:"#a1a1aa",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>View in ClassHub →</button>
                  </div>
                ))}
              </div>
            )}
            {!loading&&atRisk.length>0&&(
              <div style={{background:"#1e1b4b",borderRadius:14,border:"1px solid #6366f144",padding:"12px 14px",marginTop:14}}>
                <div style={{fontSize:12,fontWeight:800,color:"#a5b4fc",marginBottom:6}}>💡 CBC Intervention Tips</div>
                {["Group BE students for targeted strand revision","Assign peer learning partners (EE + BE pairings)","Re-assess after focused intervention sessions","Document intervention evidence for TPAD"].map((tip,i)=>(
                  <div key={i} style={{fontSize:11,color:"#c7d2fe",marginBottom:4,paddingLeft:12,borderLeft:"2px solid #6366f1"}}>{tip}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab==="tpad"&&(
          <div style={{animation:"fadeUp 0.25s ease"}}>
            {loading?<Skel h={120}/>:termStats&&(
              <div style={{background:"linear-gradient(135deg,#1e1b4b,#2e1065)",borderRadius:18,border:"1px solid #6366f144",padding:18,marginBottom:14}}>
                <div style={{fontSize:10,fontWeight:800,color:"#a5b4fc",letterSpacing:1.5,textTransform:"uppercase",marginBottom:4}}>TPAD Impact Score</div>
                <div style={{fontSize:48,fontWeight:900,color:"#818cf8",letterSpacing:-2}}>{termStats.tpadScore}</div>
                <div style={{fontSize:12,color:"#c7d2fe",marginTop:2}}>Evidence points this term — ready for TSC countersigning</div>
                <div style={{marginTop:14}}>
                  <MiniBar pct={Math.min((termStats.tpadScore/500)*100,100)} color="#6366f1" h={6}/>
                  <div style={{fontSize:10,color:"#a5b4fc",marginTop:4}}>Target: 500 pts per term</div>
                </div>
              </div>
            )}
            <div style={{fontSize:10,fontWeight:800,color:"#52525b",letterSpacing:1.5,textTransform:"uppercase",marginBottom:10}}>Evidence Breakdown</div>
            {loading?(
              <div style={{display:"flex",flexDirection:"column",gap:8}}>{[1,2,3,4].map(i=><Skel key={i} h={64}/>)}</div>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14}}>
                {tpadLines.map(line=>(
                  <div key={line.label} style={{background:"#09090b",borderRadius:14,border:"1px solid #1f1f23",padding:"13px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:800,color:"#f4f4f5"}}>{line.label}</div>
                      <div style={{fontSize:11,color:"#52525b",marginTop:2}}>{line.pts} pts each</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:20,fontWeight:900,color:line.count>0?"#10b981":"#52525b"}}>{line.count}</div>
                      <div style={{fontSize:10,color:"#52525b"}}>{line.count*line.pts} pts earned</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{fontSize:10,fontWeight:800,color:"#52525b",letterSpacing:1.5,textTransform:"uppercase",marginBottom:10}}>TSC Standards Readiness</div>
            {[
              {std:"Standard 1",label:"Professional Knowledge",pct:termStats?Math.min(termStats.totalLessons*10,100):0},
              {std:"Standard 2",label:"Teaching & Learning",pct:termStats?Math.min(termStats.totalAssess*8,100):0},
              {std:"Standard 3",label:"Assessment for Learning",pct:Math.min(overallMastery,100)},
              {std:"Standard 4",label:"Professional Development",pct:0},
            ].map(s=>(
              <div key={s.std} style={{background:"#09090b",borderRadius:14,border:"1px solid #1f1f23",padding:"12px 14px",marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <div>
                    <div style={{fontSize:12,fontWeight:800,color:"#f4f4f5"}}>{s.std}</div>
                    <div style={{fontSize:11,color:"#52525b"}}>{s.label}</div>
                  </div>
                  <div style={{fontSize:16,fontWeight:900,color:barColor(s.pct)}}>{s.pct}%</div>
                </div>
                <MiniBar pct={s.pct} color={barColor(s.pct)} h={5}/>
              </div>
            ))}
            <button onClick={()=>router.push("/teacher/tpad")} style={{width:"100%",padding:"13px",borderRadius:14,border:"none",background:"#1e1b4b",color:"#6366f1",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginTop:4}}>Open Full TPAD Dashboard →</button>
          </div>
        )}

      </div>
    </div>
  );
}
