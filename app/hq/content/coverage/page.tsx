"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type CoverageRow = { grade: string | null; subject: string | null; total: number; covered: number; missing: number };
type Coverage = { total_curriculum_nodes: number; fully_covered: number; missing: number; coverage_percent: number; by_grade_subject: CoverageRow[] };

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

export default function TeacherContentCoveragePage(){
  const router=useRouter();
  const [coverage,setCoverage]=useState<Coverage|null>(null);
  const [reviews,setReviews]=useState<ReviewRow[]>([]);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);

  const load=useCallback(async()=>{
    setLoading(true); setError("");
    const [coverageRes,reviewRes]=await Promise.all([
      supabase.rpc("hq_teacher_content_coverage_snapshot"),
      supabase.from("curriculum_resource_mapping_reviews")
        .select("id,target_type,target_id,matching_method,confidence,state,created_at,learning_resources(title)")
        .eq("state","PROPOSED").order("created_at",{ascending:true}).limit(100),
    ]);
    if(coverageRes.error||reviewRes.error){
      setError(coverageRes.error?.message||reviewRes.error?.message||"Content coverage could not be loaded.");
    }else{
      setCoverage(coverageRes.data as Coverage);
      setReviews((reviewRes.data||[]) as unknown as ReviewRow[]);
    }
    setLoading(false);
  },[]);

  useEffect(()=>{void load()},[load]);

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
        <section style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:9,marginBottom:18}}>
          <Metric n={coverage?.total_curriculum_nodes??0} title="Official active outcomes" tone={C.blue}/>
          <Metric n={coverage?.fully_covered??0} title="Verified covered" tone={C.green}/>
          <Metric n={coverage?.missing??0} title="Verified gaps" tone={(coverage?.missing??0)>0?C.red:C.green}/>
          <Metric n={`${coverage?.coverage_percent??0}%`} title="Verified coverage" tone={(coverage?.coverage_percent??0)>=80?C.green:C.amber}/>
          <Metric n={reviews.length} title="Mapping reviews waiting" tone={reviews.length?C.amber:C.green}/>
        </section>
        <section style={panel}>
          <div style={panelHead}><strong>Coverage by pilot curriculum</strong><span style={{color:C.muted,fontSize:10.5}}>Only official active outcomes + VERIFIED links + certified resource versions count.</span></div>
          {(coverage?.by_grade_subject??[]).length===0?<div style={empty}>No official active curriculum nodes are available to score.</div>:(coverage?.by_grade_subject??[]).map((row,index)=>{
            const pct=row.total?Math.round(100*row.covered/row.total):0;
            return <div key={`${row.grade}-${row.subject}`} style={{display:"grid",gridTemplateColumns:"minmax(180px,1fr) 90px 90px 90px",gap:10,padding:"12px 14px",borderTop:index?`1px solid ${C.line}`:0,alignItems:"center",fontSize:12}}>
              <div><strong>{[row.grade,row.subject].filter(Boolean).join(" · ")||"Unclassified"}</strong><div style={{height:5,background:"rgba(255,255,255,.08)",borderRadius:999,marginTop:7,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:pct>=80?C.green:pct>0?C.amber:C.red}}/></div></div>
              <span>{row.covered} covered</span><span style={{color:row.missing?C.red:C.green}}>{row.missing} missing</span><strong>{pct}%</strong>
            </div>})}
        </section>
        <section style={{...panel,marginTop:16}}>
          <div style={panelHead}><strong>Ambiguous mapping review queue</strong><span style={{color:C.muted,fontSize:10.5}}>These do not affect teacher coverage until a human verifies them.</span></div>
          {reviews.length===0?<div style={empty}>No proposed ambiguous mappings are waiting.</div>:reviews.map((review,index)=><div key={review.id} style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) auto",gap:10,padding:"12px 14px",borderTop:index?`1px solid ${C.line}`:0,fontSize:12}}><div><strong>{review.learning_resources?.title||"Teaching resource"}</strong><div style={{color:C.muted,fontSize:10.5,marginTop:4}}>{review.target_type.replaceAll("_"," ")} · {review.matching_method.replaceAll("_"," ")} · proposed {new Date(review.created_at).toLocaleString("en-KE")}</div></div><span style={{color:C.amber,fontWeight:900}}>{review.confidence==null?"REVIEW":`${Math.round(Number(review.confidence)*100)}% · REVIEW`}</span></div>)}
        </section>
        <section style={{...panel,marginTop:16,padding:14}}><strong style={{fontSize:12}}>What should we produce next?</strong><p style={{fontSize:11.5,color:C.muted,lineHeight:1.6,margin:"7px 0 0"}}>Prioritize the grade/subject row with active teacher demand and the largest verified gap. Candidate or creator-claimed material remains outside the denominator until curriculum alignment and resource certification are approved.</p></section>
      </>}
    </div>
  </main>;
}

function Metric({n,title,tone}:{n:number|string;title:string;tone:string}){return <div style={{...panel,padding:13}}><div style={{color:tone,fontSize:25,fontWeight:950}}>{n}</div><div style={{color:C.muted,fontSize:10.5,marginTop:4}}>{title}</div></div>}
const panel:React.CSSProperties={border:`1px solid ${C.line}`,borderRadius:15,background:C.panel,overflow:"hidden"};
const panelHead:React.CSSProperties={display:"flex",justifyContent:"space-between",gap:10,padding:"12px 14px",borderBottom:`1px solid ${C.line}`,fontSize:12};
const button:React.CSSProperties={border:`1px solid ${C.line}`,background:"rgba(255,255,255,.04)",color:C.text,borderRadius:9,padding:"9px 11px",fontSize:10.5,fontWeight:850,cursor:"pointer"};
const linkButton:React.CSSProperties={border:0,background:"transparent",padding:0,color:C.muted,fontSize:10.5,cursor:"pointer"};
const empty:React.CSSProperties={padding:18,color:C.muted,fontSize:11.5};
