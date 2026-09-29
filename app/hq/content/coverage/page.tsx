"use client";

import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type CoverageRow = {
  grade: string | null;
  subject: string | null;
  total: number;
  covered: number;
  missing: number;
  unmapped: number;
  ambiguous: number;
  pilot_demand: number;
  pilot_covered: number;
  official_evidence_nodes: number;
};
type Coverage = {
  total_curriculum_nodes: number;
  fully_covered: number;
  missing: number;
  unmapped: number;
  ambiguous: number;
  coverage_percent: number;
  pilot_nodes: number;
  pilot_covered: number;
  pilot_coverage_percent: number;
  by_grade_subject: CoverageRow[];
};
type Matrix = { states: Record<string, number>; unauthorized_semantics?: string };
type Integrity = Record<string, number>;

type ReviewRow = {
  id: string;
  target_type: string;
  target_id: string;
  matching_method: string;
  confidence: number | null;
  state: string;
  created_at: string;
  learning_resources?: { title?: string | null } | null;
};

const C={bg:"#07111f",panel:"#0d1b2f",line:"rgba(255,255,255,.09)",text:"#f8fafc",muted:"rgba(255,255,255,.5)",green:"#34d399",amber:"#f59e0b",red:"#fb7185",blue:"#60a5fa"};
const stateOrder=["FULL","PARTIAL","MISSING","UNMAPPED","AMBIGUOUS","UNPUBLISHED","UNAUTHORIZED","BROKEN"];

export default function TeacherContentCoveragePage(){
  const router=useRouter();
  const [coverage,setCoverage]=useState<Coverage|null>(null);
  const [matrix,setMatrix]=useState<Matrix|null>(null);
  const [integrity,setIntegrity]=useState<Integrity|null>(null);
  const [reviews,setReviews]=useState<ReviewRow[]>([]);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);

  const load=useCallback(async()=>{
    setLoading(true); setError("");
    const [coverageRes,matrixRes,integrityRes,reviewRes]=await Promise.all([
      supabase.rpc("hq_teacher_content_coverage_snapshot"),
      supabase.rpc("hq_teacher_content_coverage_matrix"),
      supabase.rpc("hq_teacher_content_integrity_snapshot"),
      supabase.from("curriculum_resource_mapping_reviews")
        .select("id,target_type,target_id,matching_method,confidence,state,created_at,learning_resources(title)")
        .eq("state","PROPOSED").order("created_at",{ascending:true}).limit(100),
    ]);
    const firstError=coverageRes.error||matrixRes.error||integrityRes.error||reviewRes.error;
    if(firstError){
      setError(firstError.message||"Content coverage could not be loaded.");
    }else{
      setCoverage(coverageRes.data as Coverage);
      setMatrix(matrixRes.data as Matrix);
      setIntegrity(integrityRes.data as Integrity);
      setReviews((reviewRes.data||[]) as unknown as ReviewRow[]);
    }
    setLoading(false);
  },[]);

  useEffect(()=>{void load()},[load]);

  const integrityFailures=Object.values(integrity??{}).reduce((sum,value)=>sum+(Number(value)||0),0);

  return <main style={{minHeight:"100dvh",background:C.bg,color:C.text,fontFamily:"Inter,system-ui,sans-serif"}}>
    <header style={{position:"sticky",top:0,zIndex:20,background:"rgba(7,17,31,.96)",borderBottom:`1px solid ${C.line}`,padding:"14px 18px"}}>
      <div style={{maxWidth:1180,margin:"0 auto",display:"flex",alignItems:"center",gap:12}}>
        <div style={{flex:1}}><button onClick={()=>router.push("/hq/content")} style={linkButton}>← Content</button><h1 style={{fontSize:21,margin:"5px 0 0"}}>Teacher Content Coverage</h1><div style={{fontSize:11,color:C.muted}}>Verified curriculum truth → certified resources → teacher readiness. Fuzzy matches never count.</div></div>
        <button onClick={()=>void load()} style={button}>Refresh</button>
      </div>
    </header>
    <div style={{maxWidth:1180,margin:"0 auto",padding:18}}>
      {error&&<div style={{border:`1px solid ${C.red}55`,borderRadius:11,padding:11,color:"#fecdd3",marginBottom:14}}>{error}</div>}
      {loading?<div style={empty}>Loading verified coverage…</div>:<>
        <section style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))",gap:9,marginBottom:18}}>
          <Metric n={coverage?.total_curriculum_nodes??0} title="Canonical curriculum nodes" tone={C.blue}/>
          <Metric n={`${coverage?.pilot_coverage_percent??0}%`} title="Pilot-demand coverage" tone={(coverage?.pilot_coverage_percent??0)>=80?C.green:C.amber}/>
          <Metric n={`${coverage?.coverage_percent??0}%`} title="All-curriculum coverage" tone={(coverage?.coverage_percent??0)>=80?C.green:C.amber}/>
          <Metric n={coverage?.pilot_nodes??0} title="Pilot-demand nodes" tone={C.blue}/>
          <Metric n={reviews.length} title="Mapping reviews waiting" tone={reviews.length?C.amber:C.green}/>
          <Metric n={integrityFailures} title="Integrity findings" tone={integrityFailures?C.red:C.green}/>
        </section>

        <section style={panel}>
          <div style={panelHead}><strong>Coverage states</strong><span style={{color:C.muted,fontSize:10.5}}>Different failure modes stay distinct; no generic “missing content” bucket.</span></div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(125px,1fr))",gap:8,padding:12}}>
            {stateOrder.map(state=><Metric key={state} n={matrix?.states?.[state]??0} title={state} tone={state==="FULL"?C.green:state==="PARTIAL"?C.blue:state==="BROKEN"?C.red:C.amber}/>) }
          </div>
          {matrix?.unauthorized_semantics&&<div style={{padding:"0 14px 13px",fontSize:10.5,color:C.muted,lineHeight:1.5}}>{matrix.unauthorized_semantics}</div>}
        </section>

        <section style={{...panel,marginTop:16}}>
          <div style={panelHead}><strong>Coverage by pilot curriculum</strong><span style={{color:C.muted,fontSize:10.5}}>Only VERIFIED links + certified immutable resource versions count as covered.</span></div>
          {(coverage?.by_grade_subject??[]).length===0?<div style={empty}>No canonical curriculum nodes are available to score.</div>:(coverage?.by_grade_subject??[]).map((row,index)=>{
            const pilotPct=row.pilot_demand?Math.round(100*row.pilot_covered/row.pilot_demand):0;
            return <div key={`${row.grade}-${row.subject}`} style={{display:"grid",gridTemplateColumns:"minmax(180px,1fr) 100px 90px 90px",gap:10,padding:"12px 14px",borderTop:index?`1px solid ${C.line}`:0,alignItems:"center",fontSize:12}}>
              <div><strong>{[row.grade,row.subject].filter(Boolean).join(" · ")||"Unclassified"}</strong><div style={{fontSize:10,color:C.muted,marginTop:3}}>{row.pilot_demand} pilot · {row.unmapped} unmapped · {row.ambiguous} review</div><div style={{height:5,background:"rgba(255,255,255,.08)",borderRadius:999,marginTop:7,overflow:"hidden"}}><div style={{height:"100%",width:`${pilotPct}%`,background:pilotPct>=80?C.green:pilotPct>0?C.amber:C.red}}/></div></div>
              <span>{row.pilot_covered}/{row.pilot_demand} pilot</span><span style={{color:row.missing?C.red:C.green}}>{row.missing} missing</span><strong>{pilotPct}%</strong>
            </div>})}
        </section>

        <section style={{...panel,marginTop:16}}>
          <div style={panelHead}><strong>Production integrity checks</strong><span style={{color:C.muted,fontSize:10.5}}>Pilot-critical unexplained failures must reach zero before certification.</span></div>
          {Object.entries(integrity??{}).map(([key,value],index)=><div key={key} style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) auto",gap:10,padding:"10px 14px",borderTop:index?`1px solid ${C.line}`:0,fontSize:11.5}}><span>{key.replaceAll("_"," ")}</span><strong style={{color:Number(value)?C.red:C.green}}>{value}</strong></div>)}
        </section>

        <section style={{...panel,marginTop:16}}>
          <div style={panelHead}><strong>Ambiguous mapping review queue</strong><span style={{color:C.muted,fontSize:10.5}}>These do not affect teacher coverage until a human verifies them.</span></div>
          {reviews.length===0?<div style={empty}>No proposed ambiguous mappings are waiting.</div>:reviews.map((review,index)=><div key={review.id} style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) auto",gap:10,padding:"12px 14px",borderTop:index?`1px solid ${C.line}`:0,fontSize:12}}><div><strong>{review.learning_resources?.title||"Teaching resource"}</strong><div style={{color:C.muted,fontSize:10.5,marginTop:4}}>{review.target_type.replaceAll("_"," ")} · {review.matching_method.replaceAll("_"," ")} · proposed {new Date(review.created_at).toLocaleString("en-KE")}</div></div><span style={{color:C.amber,fontWeight:900}}>{review.confidence==null?"REVIEW":`${Math.round(Number(review.confidence)*100)}% · REVIEW`}</span></div>)}
        </section>
        <section style={{...panel,marginTop:16,padding:14}}><strong style={{fontSize:12}}>What should we produce next?</strong><p style={{fontSize:11.5,color:C.muted,lineHeight:1.6,margin:"7px 0 0"}}>Prioritize the grade/subject row with active teacher demand and the largest verified gap. Candidate or creator-claimed material remains outside verified coverage until curriculum alignment, rights and immutable resource certification are approved.</p></section>
      </>}
    </div>
  </main>;
}

function Metric({n,title,tone}:{n:number|string;title:string;tone:string}){return <div style={{...panel,padding:13}}><div style={{color:tone,fontSize:25,fontWeight:950}}>{n}</div><div style={{color:C.muted,fontSize:10.5,marginTop:4}}>{title}</div></div>}
const panel:CSSProperties={border:`1px solid ${C.line}`,borderRadius:15,background:C.panel,overflow:"hidden"};
const panelHead:CSSProperties={display:"flex",justifyContent:"space-between",gap:10,padding:"12px 14px",borderBottom:`1px solid ${C.line}`,fontSize:12};
const button:CSSProperties={border:`1px solid ${C.line}`,background:"rgba(255,255,255,.04)",color:C.text,borderRadius:9,padding:"9px 11px",fontSize:10.5,fontWeight:850,cursor:"pointer"};
const linkButton:CSSProperties={border:0,background:"transparent",padding:0,color:C.muted,fontSize:10.5,cursor:"pointer"};
const empty:CSSProperties={padding:18,color:C.muted,fontSize:11.5};
