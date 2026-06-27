"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

const C = {
  bg:"#f4f4f5",surface:"#ffffff",border:"#e4e4e7",text:"#18181b",textSoft:"#52525b",textMuted:"#a1a1aa",
  accent:"#10b981",accentDim:"#d1fae5",navy:"#1e1b4b",navyMid:"#2d2a6e",
  error:"#dc2626",errorDim:"#fee2e2",warning:"#d97706",warningDim:"#fef3c7",
  info:"#0284c7",infoDim:"#e0f2fe",
};

interface Student { id:string;name:string;admission?:string;class_name?:string; }
interface Exam { id:string;name:string;term:number;academic_year:number;exam_type:string;pass_mark:number; }
interface Result { id:string;student_id:string;subject_id:string|null;marks:number;is_absent:boolean; }
interface Subject { id:string;name:string; }
interface Remarks { remarks:string|null;conduct:string|null; }
interface CbcAssessment { id:string;strand_id:string;sub_strand:string|null;assessment_type:string;performance:string;term:number; }
interface Strand { id:string;name:string; }
interface TermHistory { term:number;academic_year:number;exam_name:string;meanScore:number;grade:string;examId:string; }

function getGrade(m:number):string{ if(m>=80)return"EE";if(m>=60)return"ME";if(m>=40)return"AE";return"BE"; }
function gradePoints(g:string):number{ return({EE:4,ME:3,AE:2,BE:1} as Record<string,number>)[g]??0; }
function meanGradeFromArr(grades:string[]):string{
  if(!grades.length)return"—";
  const avg=grades.reduce((a,g)=>a+gradePoints(g),0)/grades.length;
  if(avg>=3.5)return"EE";if(avg>=2.5)return"ME";if(avg>=1.5)return"AE";return"BE";
}
function gradeColor(g:string):{bg:string;color:string}{
  if(g==="EE")return{bg:C.accentDim,color:"#065f46"};
  if(g==="ME")return{bg:C.infoDim,color:"#1e40af"};
  if(g==="AE")return{bg:C.warningDim,color:"#92400e"};
  return{bg:C.errorDim,color:"#991b1b"};
}

const PERF_OPTIONS=[
  {value:"exceeds_expectation",short:"EE",label:"Exceeds Expectation",bg:C.accentDim,color:"#065f46"},
  {value:"meets_expectation",short:"ME",label:"Meets Expectation",bg:C.infoDim,color:"#1e40af"},
  {value:"approaches_expectation",short:"AE",label:"Approaches Expectation",bg:C.warningDim,color:"#92400e"},
  {value:"below_expectation",short:"BE",label:"Below Expectation",bg:C.errorDim,color:"#991b1b"},
];
function perfMeta(v:string){return PERF_OPTIONS.find(p=>p.value===v)??PERF_OPTIONS[1];}
function aggregatePerf(perfs:string[]):string{
  if(!perfs.length)return"meets_expectation";
  const c:Record<string,number>={};
  for(const p of perfs)c[p]=(c[p]??0)+1;
  const order=["exceeds_expectation","meets_expectation","approaches_expectation","below_expectation"];
  let best=perfs[0],bestC=0;
  for(const lv of order){if((c[lv]??0)>bestC){bestC=c[lv];best=lv;}}
  return best;
}

function Skel({h=40}:{h?:number}){
  return <div style={{height:h,borderRadius:10,background:"linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)",backgroundSize:"200% 100%",animation:"shimmer 1.4s infinite"}} />;
}

function RadarChart({labels,values,max=100}:{labels:string[];values:number[];max?:number}){
  const n=labels.length;
  if(n<3)return null;
  const cx=110,cy=110,r=80;
  function pt(i:number,val:number):[number,number]{
    const angle=(Math.PI*2*i)/n-Math.PI/2;
    return[cx+r*(val/max)*Math.cos(angle),cy+r*(val/max)*Math.sin(angle)];
  }
  function ptOuter(i:number):[number,number]{
    const angle=(Math.PI*2*i)/n-Math.PI/2;
    return[cx+r*Math.cos(angle),cy+r*Math.sin(angle)];
  }
  const rings=[0.25,0.5,0.75,1.0];
  const dataPath=values.map((v,i)=>{const[x,y]=pt(i,v);return`${i===0?"M":"L"}${x.toFixed(1)},${y.toFixed(1)}`;}).join(" ")+" Z";
  return(
    <svg width="220" height="220" viewBox="0 0 220 220" style={{display:"block",margin:"0 auto"}}>
      {rings.map(ratio=>{
        const pts=Array.from({length:n},(_,i)=>{const angle=(Math.PI*2*i)/n-Math.PI/2;return`${(cx+r*ratio*Math.cos(angle)).toFixed(1)},${(cy+r*ratio*Math.sin(angle)).toFixed(1)}`;}).join(" ");
        return<polygon key={ratio} points={pts} fill="none" stroke="#e4e4e7" strokeWidth="1"/>;
      })}
      {Array.from({length:n},(_,i)=>{const[x,y]=ptOuter(i);return<line key={i} x1={cx} y1={cy} x2={x.toFixed(1)} y2={y.toFixed(1)} stroke="#e4e4e7" strokeWidth="1"/>;  })}
      <path d={dataPath} fill="rgba(16,185,129,0.15)" stroke="#10b981" strokeWidth="2" strokeLinejoin="round"/>
      {values.map((v,i)=>{const[x,y]=pt(i,v);return<circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r="4" fill="#10b981" stroke="#fff" strokeWidth="1.5"/>;  })}
      {labels.map((label,i)=>{
        const[x,y]=ptOuter(i);const dx=x-cx,dy=y-cy;
        const ox=dx===0?0:(dx>0?12:-12);const oy=dy<-5?-10:dy>5?10:0;
        const sl=label.length>9?label.slice(0,8)+"…":label;
        return<text key={i} x={(x+ox).toFixed(1)} y={(y+oy).toFixed(1)} textAnchor={dx<-5?"end":dx>5?"start":"middle"} fontSize="9" fontWeight="700" fill={C.textSoft} fontFamily="inherit">{sl}</text>;
      })}
    </svg>
  );
}

function Sparkline({data}:{data:number[]}){
  if(data.length<2)return null;
  const w=80,h=32,pad=4;
  const min=Math.min(...data),max=Math.max(...data);
  const range=max-min||1;
  const pts=data.map((v,i)=>{
    const x=pad+(i/(data.length-1))*(w-pad*2);
    const y=h-pad-((v-min)/range)*(h-pad*2);
    return`${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const trend=data[data.length-1]-data[0];
  return<svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}><polyline points={pts} fill="none" stroke={trend>=0?"#10b981":"#ef4444"} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/></svg>;
}

async function generateAIRemarks(
  studentName:string,results:Result[],subjects:Subject[],
  position:number|null,totalStudents:number,
  cbcData:CbcAssessment[],examName:string,term:number
):Promise<string>{
  const subjectLines=results.filter(r=>!r.is_absent).map(r=>{
    const name=subjects.find(s=>s.id===r.subject_id)?.name??"Unknown";
    return`${name}: ${r.marks}/100 (${getGrade(r.marks)})`;
  }).join(", ");
  const cbcLines=cbcData.length>0?`CBC assessments — ${cbcData.map(a=>perfMeta(a.performance).short).join(", ")}`:"";
  const posLine=position?`Class position: ${position} out of ${totalStudents}.`:"";
  const prompt=`You are a professional class teacher in Kenya writing a CBC report card remark.\nStudent: ${studentName}\nExam: ${examName}, Term ${term}\nResults: ${subjectLines||"No marks recorded"}\n${cbcLines}\n${posLine}\nWrite a professional, encouraging, specific remark in 2-3 sentences. Mention strongest subject by name. Note one area needing improvement if AE or BE. End with a motivational sentence. Use CBC language. Tone: warm, professional, Kenyan educational context. Output ONLY the remark text.`;
  const resp=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:1000,messages:[{role:"user",content:prompt}]})});
  const data=await resp.json();
  const text=(data.content??[]).map((b:{type:string;text?:string})=>b.type==="text"?b.text:"").join("").trim();
  return text||"This student has demonstrated consistent effort this term. Continued focus and practice will yield further improvement.";
}

function ReportCardInner(){
  const params=useParams();
  const searchParams=useSearchParams();
  const studentId=params.studentId as string;
  const examId=searchParams.get("examId");

  const[loading,setLoading]=useState(true);
  const[error,setError]=useState<string|null>(null);
  const[student,setStudent]=useState<Student|null>(null);
  const[exam,setExam]=useState<Exam|null>(null);
  const[results,setResults]=useState<Result[]>([]);
  const[subjects,setSubjects]=useState<Subject[]>([]);
  const[cbcData,setCbcData]=useState<CbcAssessment[]>([]);
  const[strands,setStrands]=useState<Strand[]>([]);
  const[remarks,setRemarks]=useState<Remarks>({remarks:null,conduct:null});
  const[position,setPosition]=useState<number|null>(null);
  const[totalStudents,setTotalStudents]=useState(0);
  const[schoolName,setSchoolName]=useState("");
  const[history,setHistory]=useState<TermHistory[]>([]);
  const[teacherId,setTeacherId]=useState<string|null>(null);
  const[schoolId,setSchoolId]=useState<string|null>(null);
  const[classId,setClassId]=useState<string|null>(null);
  const[activeMode,setActiveMode]=useState<"844"|"cbc">("844");
  const[activeTab,setActiveTab]=useState<"card"|"chart"|"history">("card");
  const[editRemarks,setEditRemarks]=useState(false);
  const[draftRemarks,setDraftRemarks]=useState("");
  const[draftConduct,setDraftConduct]=useState("");
  const[savingRem,setSavingRem]=useState(false);
  const[genLoading,setGenLoading]=useState(false);
  const[genError,setGenError]=useState<string|null>(null);

  useEffect(()=>{boot();},[studentId,examId]);

  async function boot(){
    setLoading(true);setError(null);
    const{data:{user}}=await supabase.auth.getUser();
    if(!user){setError("Not signed in");setLoading(false);return;}
    setTeacherId(user.id);
    const{data:profile}=await supabase.from("profiles").select("school_id").eq("id",user.id).maybeSingle();
    const sid=profile?.school_id??null;setSchoolId(sid);
    if(sid){const{data:school}=await supabase.from("schools").select("name").eq("id",sid).maybeSingle();setSchoolName(school?.name??"");}
    const{data:dbSt}=await supabase.from("students").select("id,name,admission_number").eq("id",studentId).maybeSingle();
    if(dbSt)setStudent({id:dbSt.id,name:dbSt.name,admission:dbSt.admission_number});
    else{const{data:ms}=await supabase.from("manual_students").select("id,name,class_name").eq("id",studentId).maybeSingle();if(ms)setStudent({id:ms.id,name:ms.name,class_name:ms.class_name});}
    if(!examId){setLoading(false);return;}
    const{data:examData}=await supabase.from("exams").select("*").eq("id",examId).maybeSingle();
    if(examData)setExam(examData as Exam);
    const{data:resultsData}=await supabase.from("exam_results").select("id,student_id,subject_id,marks,is_absent").eq("exam_id",examId).eq("student_id",studentId);
    const resArr=(resultsData??[]) as Result[];setResults(resArr);
    const{data:classRes}=await supabase.from("exam_results").select("class_id").eq("exam_id",examId).eq("student_id",studentId).maybeSingle();
    const cid=(classRes as{class_id:string}|null)?.class_id??null;setClassId(cid);
    if(cid){
      const{data:allCR}=await supabase.from("exam_results").select("student_id,marks,is_absent").eq("exam_id",examId).eq("class_id",cid);
      if(allCR?.length){
        const tots:Record<string,number>={};
        for(const r of allCR as{student_id:string;marks:number;is_absent:boolean}[]){if(!r.is_absent)tots[r.student_id]=(tots[r.student_id]??0)+r.marks;}
        const myT=tots[studentId]??0;const srt=Object.values(tots).sort((a,b)=>b-a);
        setPosition(srt.indexOf(myT)+1);setTotalStudents(Object.keys(tots).length);
      }
    }
    const subIds=Array.from(new Set(resArr.map(r=>r.subject_id).filter((x):x is string=>!!x)));
    if(subIds.length){const{data:subData}=await supabase.from("subjects").select("id,name").in("id",subIds);setSubjects((subData??[]) as Subject[]);}
    if(examData){
      const{data:cbcRows}=await supabase.from("cbc_assessments").select("id,strand_id,sub_strand,assessment_type,performance,term").eq("student_id",studentId).eq("term",(examData as Exam).term);
      const cbc=(cbcRows??[]) as CbcAssessment[];setCbcData(cbc);
      const strandIds=Array.from(new Set(cbc.map(r=>r.strand_id)));
      if(strandIds.length){const{data:strandsData}=await supabase.from("strands").select("id,name").in("id",strandIds);setStrands((strandsData??[]) as Strand[]);}
      if(cid){
        const{data:allExams}=await supabase.from("exams").select("id,name,term,academic_year,exam_type").eq("class_id",cid).order("academic_year",{ascending:true}).order("term",{ascending:true});
        if(allExams&&allExams.length>1){
          const histItems:TermHistory[]=[];
          for(const ex of allExams as Exam[]){
            if(ex.id===examId)continue;
            const{data:hr}=await supabase.from("exam_results").select("marks,is_absent").eq("exam_id",ex.id).eq("student_id",studentId);
            const valid=(hr??[]).filter((r:{is_absent:boolean})=>!r.is_absent);
            if(!valid.length)continue;
            const mean=valid.reduce((a:number,r:{marks:number})=>a+r.marks,0)/valid.length;
            histItems.push({term:ex.term,academic_year:ex.academic_year,exam_name:ex.name,meanScore:mean,grade:getGrade(mean),examId:ex.id});
          }
          const myValid=resArr.filter(r=>!r.is_absent);
          if(myValid.length){const myMean=myValid.reduce((a,r)=>a+r.marks,0)/myValid.length;histItems.push({term:(examData as Exam).term,academic_year:(examData as Exam).academic_year,exam_name:(examData as Exam).name,meanScore:myMean,grade:getGrade(myMean),examId:examId});}
          setHistory(histItems);
        }
      }
    }
    const{data:remData}=await supabase.from("report_card_remarks").select("remarks,conduct").eq("exam_id",examId).eq("student_id",studentId).maybeSingle();
    if(remData){setRemarks({remarks:remData.remarks,conduct:remData.conduct});setDraftRemarks(remData.remarks??"");setDraftConduct(remData.conduct??"");}
    setLoading(false);
  }

  async function saveRemarks(){
    if(!examId||!teacherId||!studentId)return;
    setSavingRem(true);
    const payload={exam_id:examId,student_id:studentId,class_teacher_id:teacherId,remarks:draftRemarks.trim()||null,conduct:draftConduct.trim()||null,school_id:schoolId,class_id:classId};
    await supabase.from("report_card_remarks").upsert(payload,{onConflict:"exam_id,student_id"});
    setRemarks({remarks:payload.remarks??null,conduct:payload.conduct??null});
    setEditRemarks(false);setSavingRem(false);
  }

  async function handleGenerateRemarks(){
    if(!student||!exam)return;
    setGenLoading(true);setGenError(null);
    try{
      const text=await generateAIRemarks(student.name,results,subjects,position,totalStudents,cbcData,exam.name,exam.term);
      setDraftRemarks(text);setEditRemarks(true);
    }catch{setGenError("AI generation failed. Please try again.");}
    setGenLoading(false);
  }

  function shareWhatsApp(){
    if(!student||!exam)return;
    const valid=results.filter(r=>!r.is_absent);
    const mean=valid.length?valid.reduce((a,r)=>a+r.marks,0)/valid.length:0;
    const grade=valid.length?getGrade(mean):"—";
    const posLine=position?`Position: ${position}/${totalStudents}`:"";
    const subLines=valid.map(r=>`  • ${subjects.find(s=>s.id===r.subject_id)?.name??"Subject"}: ${r.marks} (${getGrade(r.marks)})`).join("\n");
    const msg=`📋 *${schoolName||"VibeSchool"} — Report Card*\n\n*Student:* ${student.name}\n*Exam:* ${exam.name} · Term ${exam.term} · ${exam.academic_year}\n*Mean Score:* ${mean.toFixed(1)} · *Grade:* ${grade}\n${posLine?`*${posLine}*\n`:""}\n*Subjects:*\n${subLines||"  No results yet"}\n${remarks.remarks?`\n*Remarks:* ${remarks.remarks}\n`:""}\n_Powered by VibeSchool_`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,"_blank");
  }

  const validResults=results.filter(r=>!r.is_absent);
  const totalMarks=validResults.reduce((a,r)=>a+r.marks,0);
  const meanScore=validResults.length?totalMarks/validResults.length:0;
  const allGrades=validResults.map(r=>getGrade(r.marks));
  const overallGrade=allGrades.length?meanGradeFromArr(allGrades):null;
  const overallGC=overallGrade?gradeColor(overallGrade):null;
  function subjectName(id:string|null){if(!id)return"Unknown";return subjects.find(s=>s.id===id)?.name??"Unknown";}
  function strandName(id:string){return strands.find(s=>s.id===id)?.name??"Unknown";}

  return(
    <div style={{paddingBottom:100}}>
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}} @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}} @keyframes spin{to{transform:rotate(360deg)}} @media print{.no-print{display:none!important}body{background:#fff!important}}`}</style>
      {loading?(
        <div style={{display:"flex",flexDirection:"column" as const,gap:12,padding:"8px 0"}}><Skel h={100}/><Skel h={56}/><Skel h={56}/><Skel h={56}/></div>
      ):error?(
        <div style={{padding:24,color:C.error,fontSize:14}}>⚠️ {error}</div>
      ):!student?(
        <div style={{padding:24,color:C.textMuted,fontSize:14}}>Student not found.</div>
      ):(
        <div style={{animation:"fadeUp 0.25s ease"}}>
          {/* Hero */}
          <div style={{background:`linear-gradient(135deg,${C.navy} 0%,${C.navyMid} 100%)`,borderRadius:20,padding:"20px",marginBottom:14,color:"#fff"}}>
            <div style={{display:"flex",alignItems:"flex-start",gap:14}}>
              <div style={{width:52,height:52,borderRadius:16,flexShrink:0,background:"rgba(16,185,129,0.25)",border:"2px solid rgba(16,185,129,0.5)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:900,color:"#10b981"}}>
                {student.name.trim().split(" ").filter(Boolean).slice(0,2).map((w:string)=>w[0]).join("").toUpperCase()}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:10,color:"rgba(255,255,255,0.45)",fontWeight:700,letterSpacing:1.4,textTransform:"uppercase" as const}}>{schoolName||"VibeSchool"}</div>
                <div style={{fontSize:18,fontWeight:800,marginTop:2,lineHeight:1.2}}>{student.name}</div>
                {exam&&<div style={{fontSize:12,color:"rgba(255,255,255,0.6)",marginTop:4}}>{exam.name} · Term {exam.term} · {exam.academic_year}</div>}
                {(student.admission||student.class_name)&&<div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:2}}>{student.admission?`Adm: ${student.admission}`:student.class_name}</div>}
              </div>
              {overallGrade&&overallGC&&<div style={{padding:"6px 12px",borderRadius:12,flexShrink:0,background:overallGC.bg,color:overallGC.color,fontSize:16,fontWeight:900}}>{overallGrade}</div>}
            </div>
            <div style={{display:"flex",gap:12,marginTop:16}}>
              {[
                {label:"Mean",value:validResults.length?meanScore.toFixed(1):"—"},
                {label:"Total",value:validResults.length?totalMarks.toString():"—"},
                {label:"Subjects",value:validResults.length.toString()},
                ...(position!==null?[{label:"Position",value:`${position}/${totalStudents}`}]:[]),
              ].map(stat=>(
                <div key={stat.label} style={{flex:1,background:"rgba(255,255,255,0.08)",borderRadius:12,padding:"8px 10px",textAlign:"center" as const}}>
                  <div style={{fontSize:15,fontWeight:800,color:"#fff"}}>{stat.value}</div>
                  <div style={{fontSize:9,color:"rgba(255,255,255,0.45)",fontWeight:600,textTransform:"uppercase" as const,letterSpacing:0.8,marginTop:2}}>{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="no-print" style={{display:"flex",gap:8,marginBottom:14}}>
            <button onClick={shareWhatsApp} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"11px 0",borderRadius:14,border:"none",background:"#25D366",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              WhatsApp
            </button>
            <button onClick={()=>window.print()} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"11px 0",borderRadius:14,border:`1.5px solid ${C.border}`,background:"#fff",color:C.text,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>🖨️ Print</button>
          </div>

          {/* Sub-tab nav */}
          <div className="no-print" style={{display:"flex",gap:0,marginBottom:14,borderRadius:14,background:"#fff",border:`1px solid ${C.border}`,padding:4}}>
            {([{id:"card",label:"📄 Card"},{id:"chart",label:"📊 Chart"},{id:"history",label:"📈 History"}] as const).map(t=>(
              <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{flex:1,padding:"8px 0",borderRadius:10,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"inherit",background:activeTab===t.id?C.navy:"transparent",color:activeTab===t.id?"#fff":C.textMuted,transition:"all 0.18s"}}>{t.label}</button>
            ))}
          </div>

          {/* TAB: CARD */}
          {activeTab==="card"&&(
            <div style={{animation:"fadeUp 0.2s ease"}}>
              {/* Mode toggle */}
              <div className="no-print" style={{display:"flex",gap:0,marginBottom:14,borderRadius:14,background:"#fff",border:`1px solid ${C.border}`,padding:4}}>
                {(["844","cbc"] as const).map(m=>(
                  <button key={m} onClick={()=>setActiveMode(m)} style={{flex:1,padding:"8px 0",borderRadius:10,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"inherit",background:activeMode===m?C.accent:"transparent",color:activeMode===m?"#fff":C.textMuted,transition:"all 0.18s"}}>
                    {m==="844"?"📝 Marks (8-4-4)":"🌿 CBC Strands"}
                  </button>
                ))}
              </div>
              <div style={{background:"#fff",borderRadius:20,border:`1px solid ${C.border}`,overflow:"hidden",boxShadow:"0 2px 12px rgba(0,0,0,0.06)"}}>
                {/* School header */}
                <div style={{background:C.navy,padding:"16px 20px",textAlign:"center" as const}}>
                  {schoolName&&<div style={{fontSize:10,color:"rgba(255,255,255,0.45)",fontWeight:700,letterSpacing:2,textTransform:"uppercase" as const,marginBottom:4}}>{schoolName}</div>}
                  <div style={{fontSize:15,fontWeight:800,color:"#fff"}}>{activeMode==="844"?"ACADEMIC REPORT CARD":"CBC PERFORMANCE REPORT"}</div>
                  {exam&&<div style={{fontSize:11,color:"#10b981",marginTop:4}}>{exam.name} · Term {exam.term} · {exam.academic_year}</div>}
                </div>

                {/* 8-4-4 mode */}
                {activeMode==="844"&&(
                  <>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 54px 44px",padding:"8px 20px",background:C.bg,borderBottom:`1px solid ${C.border}`}}>
                      {["Subject","Marks","Grade"].map((h,i)=><span key={h} style={{fontSize:10,fontWeight:700,color:C.textMuted,textTransform:"uppercase" as const,textAlign:(i>0?"center":"left") as any}}>{h}</span>)}
                    </div>
                    {results.length===0?(
                      <div style={{padding:"28px",textAlign:"center" as const,color:C.textMuted,fontSize:13}}>No results recorded yet.</div>
                    ):results.map((r,idx)=>{
                      const grade=r.is_absent?null:getGrade(r.marks);const gc=grade?gradeColor(grade):null;
                      return(
                        <div key={r.id} style={{borderBottom:idx<results.length-1?`1px solid ${C.border}`:"none"}}>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 54px 44px",padding:"12px 20px",alignItems:"center"}}>
                            <span style={{fontSize:13,fontWeight:600,color:C.text}}>{subjectName(r.subject_id)}</span>
                            <span style={{fontSize:14,fontWeight:800,color:r.is_absent?C.textMuted:C.text,textAlign:"center" as const}}>{r.is_absent?"ABS":r.marks}</span>
                            <div style={{display:"flex",justifyContent:"center"}}>
                              {grade&&gc?<span style={{padding:"3px 8px",borderRadius:8,fontSize:11,fontWeight:800,background:gc.bg,color:gc.color}}>{grade}</span>:<span style={{fontSize:11,color:C.textMuted}}>—</span>}
                            </div>
                          </div>
                          {!r.is_absent&&(
                            <div style={{padding:"0 20px 10px"}}>
                              <div style={{height:4,borderRadius:4,background:C.border}}>
                                <div style={{height:4,borderRadius:4,width:`${r.marks}%`,background:r.marks>=80?C.accent:r.marks>=60?C.info:r.marks>=40?C.warning:C.error,transition:"width 0.5s ease"}}/>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {validResults.length>0&&(
                      <div style={{padding:"14px 20px",background:C.bg,borderTop:`2px solid ${C.border}`,display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                        {[{label:"Total",value:totalMarks.toFixed(0)},{label:"Mean",value:meanScore.toFixed(1)},{label:"Mean Grade",value:overallGrade??"—"}].map(s=>(
                          <div key={s.label} style={{textAlign:"center" as const}}>
                            <div style={{fontSize:10,color:C.textMuted,fontWeight:700,textTransform:"uppercase" as const,letterSpacing:0.8}}>{s.label}</div>
                            <div style={{fontSize:18,fontWeight:900,color:overallGC?.color??C.text,marginTop:4}}>{s.value}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {position!==null&&totalStudents>0&&(
                      <div style={{padding:"12px 20px",borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <span style={{fontSize:12,color:C.textSoft,fontWeight:600}}>Class Position</span>
                        <span style={{fontSize:16,fontWeight:900,color:C.text}}>{position}<span style={{fontSize:11,color:C.textMuted}}>/{totalStudents}</span></span>
                      </div>
                    )}
                  </>
                )}

                {/* CBC mode */}
                {activeMode==="cbc"&&(
                  <div>
                    {cbcData.length===0?(
                      <div style={{padding:"28px",textAlign:"center" as const,color:C.textMuted,fontSize:13}}>No CBC assessments for this term.</div>
                    ):(
                      <>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 70px 46px",padding:"8px 20px",background:C.bg,borderBottom:`1px solid ${C.border}`}}>
                          {["Strand","Type","Level"].map((h,i)=><span key={h} style={{fontSize:10,fontWeight:700,color:C.textMuted,textTransform:"uppercase" as const,textAlign:(i>0?"center":"left") as any}}>{h}</span>)}
                        </div>
                        {cbcData.map((a,idx)=>{const pm=perfMeta(a.performance);return(
                          <div key={a.id} style={{display:"grid",gridTemplateColumns:"1fr 70px 46px",padding:"12px 20px",borderBottom:idx<cbcData.length-1?`1px solid ${C.border}`:"none",alignItems:"center"}}>
                            <div><div style={{fontSize:13,fontWeight:600,color:C.text}}>{strandName(a.strand_id)}</div>{a.sub_strand&&<div style={{fontSize:10,color:C.textMuted,marginTop:2}}>{a.sub_strand}</div>}</div>
                            <span style={{fontSize:10,color:C.textSoft,textAlign:"center" as const}}>{a.assessment_type}</span>
                            <div style={{display:"flex",justifyContent:"center"}}><span style={{padding:"3px 7px",borderRadius:8,fontSize:11,fontWeight:800,background:pm.bg,color:pm.color}}>{pm.short}</span></div>
                          </div>
                        );})}
                        {(()=>{const agg=aggregatePerf(cbcData.map(a=>a.performance));const pm=perfMeta(agg);return(
                          <div style={{padding:"14px 20px",background:pm.bg,borderTop:`2px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                            <span style={{fontSize:13,fontWeight:700,color:pm.color}}>Overall Performance</span>
                            <span style={{fontSize:14,fontWeight:900,color:pm.color}}>{pm.label}</span>
                          </div>
                        );})()}
                      </>
                    )}
                  </div>
                )}

                {/* Remarks */}
                <div style={{padding:"16px 20px",borderTop:`2px solid ${C.border}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                    <div style={{fontSize:11,fontWeight:700,color:C.textSoft,textTransform:"uppercase" as const,letterSpacing:1}}>Class Teacher Remarks</div>
                    <div className="no-print" style={{display:"flex",gap:8}}>
                      <button onClick={handleGenerateRemarks} disabled={genLoading} style={{display:"flex",alignItems:"center",gap:5,padding:"5px 12px",borderRadius:10,border:"none",background:genLoading?C.border:`linear-gradient(135deg,${C.navy},${C.navyMid})`,color:"#fff",fontSize:11,fontWeight:700,cursor:genLoading?"not-allowed":"pointer",fontFamily:"inherit"}}>
                        {genLoading?<><div style={{width:10,height:10,borderRadius:"50%",border:"2px solid rgba(255,255,255,0.3)",borderTop:"2px solid #fff",animation:"spin 0.8s linear infinite"}}/>Generating…</>:"✦ AI Draft"}
                      </button>
                      <button onClick={()=>{setEditRemarks(e=>!e);setDraftRemarks(remarks.remarks??"");setDraftConduct(remarks.conduct??"");}} style={{padding:"5px 12px",borderRadius:10,border:`1.5px solid ${C.border}`,background:"#fff",color:C.textSoft,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                        {editRemarks?"Cancel":"✏️ Edit"}
                      </button>
                    </div>
                  </div>
                  {genError&&<div style={{fontSize:11,color:C.error,marginBottom:8}}>⚠️ {genError}</div>}
                  {editRemarks?(
                    <div style={{display:"flex",flexDirection:"column" as const,gap:10}}>
                      <textarea value={draftRemarks} onChange={e=>setDraftRemarks(e.target.value)} placeholder="Write or edit remarks…" rows={4} style={{width:"100%",padding:"10px 12px",borderRadius:12,border:`1.5px solid ${C.border}`,fontSize:13,resize:"vertical" as const,outline:"none",boxSizing:"border-box" as const,fontFamily:"inherit",color:C.text,lineHeight:1.6}}/>
                      <input value={draftConduct} onChange={e=>setDraftConduct(e.target.value)} placeholder="Conduct (e.g. Excellent, Good, Fair)" style={{width:"100%",padding:"10px 12px",borderRadius:12,border:`1.5px solid ${C.border}`,fontSize:13,outline:"none",boxSizing:"border-box" as const,fontFamily:"inherit",color:C.text}}/>
                      <button onClick={saveRemarks} disabled={savingRem} style={{padding:"12px 0",borderRadius:12,border:"none",cursor:savingRem?"not-allowed":"pointer",fontSize:14,fontWeight:700,fontFamily:"inherit",background:savingRem?C.border:C.accent,color:"#fff"}}>{savingRem?"Saving…":"Save Remarks"}</button>
                    </div>
                  ):(
                    <div>
                      <p style={{margin:0,fontSize:13,color:remarks.remarks?C.text:C.textMuted,fontStyle:remarks.remarks?"normal":"italic",lineHeight:1.7}}>{remarks.remarks??"No remarks yet. Tap '✦ AI Draft' to generate, or '✏️ Edit' to write manually."}</p>
                      {remarks.conduct&&<div style={{marginTop:8,display:"inline-flex",alignItems:"center",gap:6,padding:"4px 10px",borderRadius:8,background:C.bg,border:`1px solid ${C.border}`}}><span style={{fontSize:11,color:C.textMuted}}>Conduct:</span><span style={{fontSize:12,fontWeight:700,color:C.text}}>{remarks.conduct}</span></div>}
                    </div>
                  )}
                </div>

                {/* Signature lines */}
                <div style={{padding:"16px 20px 24px",borderTop:`1px solid ${C.border}`,display:"grid",gridTemplateColumns:"1fr 1fr",gap:24}}>
                  {["Class Teacher","Principal's"].map(label=>(
                    <div key={label}><div style={{height:1,background:C.text,marginBottom:6}}/><p style={{margin:0,fontSize:10,color:C.textMuted}}>{label} Signature</p></div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB: CHART */}
          {activeTab==="chart"&&(
            <div style={{animation:"fadeUp 0.2s ease"}}>
              <div style={{background:"#fff",borderRadius:20,border:`1px solid ${C.border}`,padding:"20px",marginBottom:14}}>
                <div style={{fontSize:11,fontWeight:700,color:C.textMuted,textTransform:"uppercase" as const,letterSpacing:1,marginBottom:14}}>Subject Performance Profile</div>
                {validResults.length<3?(
                  <div style={{textAlign:"center" as const,padding:32,color:C.textMuted,fontSize:13}}>Need at least 3 subjects to show radar chart.</div>
                ):(
                  <>
                    <RadarChart labels={validResults.map(r=>subjectName(r.subject_id))} values={validResults.map(r=>r.marks)} max={100}/>
                    <div style={{display:"flex",flexWrap:"wrap" as const,gap:8,marginTop:16,justifyContent:"center"}}>
                      {validResults.map(r=>{const g=getGrade(r.marks);const gc=gradeColor(g);return(
                        <div key={r.id} style={{display:"flex",alignItems:"center",gap:5,padding:"4px 10px",borderRadius:8,background:gc.bg}}>
                          <span style={{fontSize:11,fontWeight:600,color:gc.color}}>{subjectName(r.subject_id)}</span>
                          <span style={{fontSize:12,fontWeight:900,color:gc.color}}>{r.marks}</span>
                        </div>
                      );})}
                    </div>
                  </>
                )}
              </div>
              {validResults.length>0&&(()=>{
                const srt=[...validResults].sort((a,b)=>b.marks-a.marks);
                const best=srt[0];const worst=srt[srt.length-1];
                return(
                  <div style={{display:"flex",flexDirection:"column" as const,gap:10}}>
                    <div style={{background:C.accentDim,borderRadius:14,padding:"14px 16px",display:"flex",alignItems:"center",gap:12}}>
                      <span style={{fontSize:24}}>💪</span>
                      <div><div style={{fontSize:11,fontWeight:700,color:"#065f46",textTransform:"uppercase" as const,letterSpacing:0.8}}>Strongest Subject</div><div style={{fontSize:15,fontWeight:800,color:"#065f46",marginTop:2}}>{subjectName(best.subject_id)} — {best.marks}/100</div></div>
                    </div>
                    {worst.marks<60&&(
                      <div style={{background:C.warningDim,borderRadius:14,padding:"14px 16px",display:"flex",alignItems:"center",gap:12}}>
                        <span style={{fontSize:24}}>🎯</span>
                        <div><div style={{fontSize:11,fontWeight:700,color:"#92400e",textTransform:"uppercase" as const,letterSpacing:0.8}}>Needs Attention</div><div style={{fontSize:15,fontWeight:800,color:"#92400e",marginTop:2}}>{subjectName(worst.subject_id)} — {worst.marks}/100</div></div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB: HISTORY */}
          {activeTab==="history"&&(
            <div style={{animation:"fadeUp 0.2s ease"}}>
              <div style={{background:"#fff",borderRadius:20,border:`1px solid ${C.border}`,padding:"20px",marginBottom:14}}>
                <div style={{fontSize:11,fontWeight:700,color:C.textMuted,textTransform:"uppercase" as const,letterSpacing:1,marginBottom:14}}>Term-over-Term Trend</div>
                {history.length<2?(
                  <div style={{textAlign:"center" as const,padding:32,color:C.textMuted,fontSize:13}}>Not enough exam history yet.</div>
                ):(
                  <>
                    <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:20}}>
                      <Sparkline data={history.map(h=>h.meanScore)}/>
                      {(()=>{const first=history[0].meanScore,last=history[history.length-1].meanScore,diff=last-first;return(
                        <div><div style={{fontSize:22,fontWeight:900,color:diff>=0?C.accent:C.error}}>{diff>=0?"+":""}{diff.toFixed(1)}</div><div style={{fontSize:11,color:C.textMuted,marginTop:2}}>{diff>=0?"Overall improvement":"Needs intervention"}</div></div>
                      );})()}
                    </div>
                    <div style={{display:"flex",flexDirection:"column" as const,gap:10}}>
                      {history.map((h,idx)=>{
                        const gc=gradeColor(h.grade);const isCurrent=h.examId===examId;
                        return(
                          <div key={h.examId} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:14,background:isCurrent?C.accentDim:C.bg,border:`1.5px solid ${isCurrent?C.accent:C.border}`}}>
                            <div style={{width:36,height:36,borderRadius:10,flexShrink:0,background:gc.bg,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:13,fontWeight:900,color:gc.color}}>{h.grade}</span></div>
                            <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:C.text}}>{h.exam_name}</div><div style={{fontSize:11,color:C.textMuted,marginTop:1}}>Term {h.term} · {h.academic_year}</div></div>
                            <div style={{textAlign:"right" as const}}>
                              <div style={{fontSize:16,fontWeight:900,color:C.text}}>{h.meanScore.toFixed(1)}</div>
                              {idx>0&&(()=>{const delta=h.meanScore-history[idx-1].meanScore;return<div style={{fontSize:10,color:delta>=0?C.accent:C.error,fontWeight:700}}>{delta>=0?"▲":"▼"} {Math.abs(delta).toFixed(1)}</div>;})()}
                            </div>
                            {isCurrent&&<span style={{fontSize:9,fontWeight:800,color:C.accent,textTransform:"uppercase" as const,letterSpacing:0.8}}>Current</span>}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ReportCardPage(){
  return(
    <Suspense fallback={<div style={{padding:24,color:"#9ca3af",fontSize:13}}>Loading report card…</div>}>
      <ReportCardInner/>
    </Suspense>
  );
}
