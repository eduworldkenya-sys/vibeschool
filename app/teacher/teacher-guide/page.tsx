"use client";

export const dynamic = "force-dynamic";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loadLessonWorkspace, type LessonWorkspaceBootResult } from "@/lib/teaching/lessonWorkspace";
import { parseLessonPlanBody, type LessonPlanSections } from "@/lib/teaching/lessonPlanCodec";

const card: React.CSSProperties = { background:"#fff", border:"1px solid #e2e8f0", borderRadius:16, padding:16 };
const action: React.CSSProperties = { border:0, borderRadius:12, padding:"11px 14px", fontWeight:800, cursor:"pointer", background:"#1e1b4b", color:"#fff" };
const secondary: React.CSSProperties = { ...action, background:"#fff", color:"#334155", border:"1px solid #cbd5e1" };

function nonEmpty(value: string | null | undefined) { return value?.trim() || null; }

function Section({ title, children }: { title:string; children:React.ReactNode }) {
  return <section style={card}><h2 style={{fontSize:15,margin:"0 0 9px",color:"#0f172a"}}>{title}</h2>{children}</section>;
}

function TextBlock({ value, empty }: { value:string | null | undefined; empty:string }) {
  return <div style={{whiteSpace:"pre-wrap",fontSize:13,lineHeight:1.65,color:value?.trim()?"#334155":"#94a3b8"}}>{value?.trim() || empty}</div>;
}

function TeacherGuideInner() {
  const params=useSearchParams();
  const router=useRouter();
  const timetableSlotId=params.get("timetableSlotId") || "";
  const occurrenceDate=params.get("date") || "";
  const classId=params.get("classId") || "";
  const subjectId=params.get("subjectId") || "";
  const subjectName=params.get("subject") || params.get("subjectName") || "";
  const schemeId=params.get("schemeId");
  const [workspace,setWorkspace]=useState<LessonWorkspaceBootResult|null>(null);
  const [loading,setLoading]=useState(Boolean(occurrenceDate && classId && subjectId));
  const [error,setError]=useState<string|null>(null);

  useEffect(()=>{
    let cancelled=false;
    async function run(){
      if(!occurrenceDate || !classId || !subjectId){
        setLoading(false);
        return;
      }
      setLoading(true); setError(null);
      try {
        const result=await loadLessonWorkspace({timetableSlotId,occurrenceDate,classId,subjectId,subjectName,requestedSchemeId:schemeId});
        if(!cancelled) setWorkspace(result);
      } catch(e) {
        if(!cancelled) setError(e instanceof Error?e.message:"Teacher Guide could not load this lesson.");
      } finally { if(!cancelled) setLoading(false); }
    }
    void run();
    return ()=>{cancelled=true};
  },[timetableSlotId,occurrenceDate,classId,subjectId,subjectName,schemeId]);

  const sections=useMemo<LessonPlanSections|null>(()=>{
    const body=workspace?.existingPlan?.body;
    return typeof body==="string"?parseLessonPlanBody(body):null;
  },[workspace?.existingPlan?.body]);

  const source=workspace?.sourceBundle?.scheme ?? workspace?.source ?? null;
  const certified=workspace?.sourceBundle?.certifiedContent ?? [];
  const context=workspace?.sourceBundle?.classContext;
  const canonical=workspace?.canonicalIdentity;

  const query=useMemo(()=>{
    const q=new URLSearchParams();
    if(classId) q.set("classId",classId);
    if(subjectId) q.set("subjectId",subjectId);
    if(timetableSlotId) q.set("timetableSlotId",timetableSlotId);
    if(occurrenceDate) q.set("date",occurrenceDate);
    if(schemeId) q.set("schemeId",schemeId);
    return q.toString();
  },[classId,subjectId,timetableSlotId,occurrenceDate,schemeId]);

  if(loading) return <div role="status" style={{padding:24,color:"#475569",fontWeight:700}}>Opening the canonical Teacher Guide…</div>;

  if(!occurrenceDate || !classId || !subjectId) return (
    <div style={{maxWidth:760,margin:"0 auto",padding:18}}>
      <div style={{...card,borderColor:"#c7d2fe"}}>
        <div style={{fontSize:11,fontWeight:900,color:"#4f46e5",textTransform:"uppercase"}}>Teacher Guide</div>
        <h1 style={{fontSize:24,margin:"6px 0"}}>Open a guide from your teaching context</h1>
        <p style={{fontSize:13,lineHeight:1.6,color:"#64748b"}}>Teacher Guide does not invent a class, subject, curriculum position or lesson. Open it from a scheduled lesson, Scheme or Lesson Plan so VibeSchool can preserve the authoritative teaching context.</p>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button style={action} onClick={()=>router.push("/teacher/teach-today")}>Choose a lesson</button><button style={secondary} onClick={()=>router.push("/teacher/subjecthub")}>Open Subjects</button><button style={secondary} onClick={()=>router.push("/teacher/scheme")}>Open Scheme</button></div>
      </div>
    </div>
  );

  if(error || !workspace) return <div style={{maxWidth:760,margin:"0 auto",padding:18}}><div style={{...card,borderColor:"#fecaca"}}><h1 style={{fontSize:20}}>Teacher Guide needs attention</h1><p style={{fontSize:13,color:"#991b1b"}}>{error || "No authorized teaching context was returned."}</p><button style={secondary} onClick={()=>window.location.reload()}>Retry</button></div></div>;

  return (
    <div style={{maxWidth:760,margin:"0 auto",padding:"16px 14px 100px",display:"grid",gap:12}}>
      <header style={{...card,background:"#1e1b4b",color:"#fff",border:0}}>
        <div style={{fontSize:10,fontWeight:900,textTransform:"uppercase",opacity:.7}}>Canonical Teacher Guide · no AI required</div>
        <h1 style={{fontSize:24,margin:"6px 0"}}>{source?.topic || source?.subStrand || subjectName || "Lesson guide"}</h1>
        <div style={{fontSize:12,opacity:.78}}>{subjectName || "Subject"} · {context?.grade || workspace.context.grade || "Class"} · {context?.schoolName || "Active school"}</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:14}}>
          <button style={{...action,background:"#10b981"}} onClick={()=>router.push(`/teacher/lessonplan?${query}`)}>{workspace.existingPlan?"Open Lesson Plan":"Prepare Lesson Plan"}</button>
          {workspace.existingPlan && <button style={{...secondary,border:0}} onClick={()=>router.push(`/teacher/lesson-notes?planId=${workspace.existingPlan?.id}&${query}`)}>Lesson Notes / Teach</button>}
        </div>
      </header>

      {(workspace.sourceError || workspace.sourceBundleError || workspace.occurrenceError) && <div style={{...card,background:"#fff7ed",borderColor:"#fdba74",fontSize:12,color:"#9a3412"}}>{workspace.sourceError || workspace.sourceBundleError || workspace.occurrenceError}</div>}

      <Section title="Curriculum position">
        <TextBlock value={[source?.strand && `Strand: ${source.strand}`,source?.subStrand && `Sub-strand: ${source.subStrand}`,source?.week != null && `Week: ${source.week}`,source?.term != null && `Term: ${source.term}`].filter(Boolean).join("\n")} empty="No Scheme/curriculum position has been resolved for this teaching occurrence." />
      </Section>

      <Section title="Learning outcomes & inquiry">
        <TextBlock value={nonEmpty(source?.objectives)} empty="No canonical objectives are available for this lesson yet." />
        {source?.keyInquiryQuestion && <div style={{marginTop:12,padding:12,borderRadius:12,background:"#eef2ff",fontSize:13}}><strong>Key inquiry question</strong><br/>{source.keyInquiryQuestion}</div>}
      </Section>

      <Section title="How to teach it">
        <TextBlock value={nonEmpty(source?.learningExperiences) || nonEmpty(sections?.development)} empty="No approved learning experience or prepared Lesson Plan development is available. Teacher Guide will not fabricate one." />
      </Section>

      <Section title="Explanation, examples & classroom prompts">
        <TextBlock value={nonEmpty(sections?.introduction) || nonEmpty(sections?.development)} empty="Prepare the canonical Lesson Plan or attach certified teaching content to expose approved explanations, examples and prompts." />
      </Section>

      <Section title="Check understanding & expected evidence">
        <TextBlock value={nonEmpty(source?.assessmentMethods) || nonEmpty(sections?.assessmentHook)} empty="No canonical assessment guidance is linked yet." />
      </Section>

      <Section title="Misconceptions, remediation & differentiation">
        <TextBlock value={nonEmpty(sections?.differentiation)} empty="No validated differentiation/remediation guidance is available yet. Nothing is invented here." />
      </Section>

      <Section title="Resources">
        <TextBlock value={nonEmpty(source?.learningResources) || nonEmpty(source?.resources) || nonEmpty(sections?.resources)} empty="No Scheme or Lesson Plan resources are linked." />
        {certified.length>0 && <div style={{display:"grid",gap:8,marginTop:12}}>{certified.map(asset=><div key={asset.resourceVersionId} style={{padding:11,border:"1px solid #d1fae5",borderRadius:12}}><div style={{fontWeight:800,fontSize:13}}>{asset.title}</div><div style={{fontSize:11,color:"#64748b"}}>{asset.assetKind || "learning resource"} · certified {new Date(asset.certifiedAt).toLocaleDateString()}</div></div>)}</div>}
      </Section>

      <Section title="Homework & follow-through">
        <TextBlock value={nonEmpty(sections?.homework)} empty="No prepared homework is attached to the canonical Lesson Plan yet." />
      </Section>

      <Section title="Authority & provenance">
        <div style={{fontSize:12,lineHeight:1.7,color:"#475569"}}>
          <div>School scoped: <strong>{workspace.context.schoolId?"Yes":"No"}</strong></div>
          <div>Scheme linked: <strong>{source?.schemeId?"Yes":"No"}</strong></div>
          <div>Certified resources: <strong>{certified.length}</strong></div>
          <div>Canonical content identity: <strong>{canonical?"Verified":"Not complete"}</strong></div>
          <div style={{marginTop:7,color:"#64748b"}}>Teacher Guide is read-only composition. Curriculum, Scheme, Lesson Plan, resources and teaching occurrence remain their existing authorities.</div>
        </div>
      </Section>
    </div>
  );
}

export default function TeacherGuidePage(){
  return <Suspense fallback={<div style={{padding:24}}>Opening Teacher Guide…</div>}><TeacherGuideInner/></Suspense>;
}
