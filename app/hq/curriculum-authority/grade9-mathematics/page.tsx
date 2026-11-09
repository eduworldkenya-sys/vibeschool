"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { hqSupabase } from "@/lib/hq/supabase"

type Readiness = {
  grade:string; subject:string; ready_for_curriculum_verified_exam:boolean
  issues:string[]; sources:number; approved_sources:number; snapshots:number
  promoted_snapshots:number; source_observations:number; hierarchy_bindings:number
  sub_strands:number; sub_strands_with_source:number; sub_strands_with_outcomes:number
  official_outcomes:number; verified_official_outcomes:number; approved_blueprints:number
  verified_bank_questions:number; existing_public_pilot_items:number
  existing_pilot_items_linked_to_verified_outcomes:number
}
const metrics: {key:keyof Readiness;label:string}[]=[
  {key:"approved_sources",label:"Approved KICD source records"},
  {key:"promoted_snapshots",label:"Promoted curriculum snapshots"},
  {key:"source_observations",label:"Source-grounded outcome observations"},
  {key:"hierarchy_bindings",label:"Verified hierarchy bindings"},
  {key:"sub_strands",label:"Existing sub-strands"},
  {key:"sub_strands_with_source",label:"Sub-strands with source reference"},
  {key:"sub_strands_with_outcomes",label:"Sub-strands with learning outcomes"},
  {key:"official_outcomes",label:"Official outcomes (active or verified)"},
  {key:"verified_official_outcomes",label:"Explicitly verified official outcomes"},
  {key:"approved_blueprints",label:"Approved assessment blueprints"},
  {key:"verified_bank_questions",label:"Approved question-bank items with verified outcomes"},
  {key:"existing_public_pilot_items",label:"Existing public pilot questions"},
  {key:"existing_pilot_items_linked_to_verified_outcomes",label:"Pilot questions linked to verified outcomes"},
]
const friendly:Record<string,string>={
  approved_source_missing:"Register and approve an authoritative KICD source.",
  promoted_snapshot_missing:"Import, reconcile and promote a curriculum snapshot.",
  hierarchy_bindings_missing:"Resolve strand and sub-strand matching before promotion.",
  verified_outcomes_missing:"Review and verify official learning outcomes with source evidence.",
  approved_blueprint_missing:"Approve a Grade 9 Mathematics examination blueprint.",
  approved_outcome_question_bank_missing:"Approve reusable questions linked to verified official outcomes.",
  unverified_existing_pilot_questions:"Reconcile or reclassify the existing pilot questions; do not overwrite results."
}
export default function Grade9MathematicsCurriculumReadiness(){
  const [report,setReport]=useState<Readiness|null>(null)
  const [error,setError]=useState("")
  const [loading,setLoading]=useState(true)
  useEffect(()=>{
    let live=true
    void (async()=>{
      try{
        const {data,error:problem}=await hqSupabase.rpc("hq_curriculum_exam_readiness" as never,
          {p_grade:"Grade 9",p_subject:"Mathematics"} as never)
        if(problem)throw problem
        if(live)setReport(data as Readiness)
      }catch(e){if(live)setError(e instanceof Error?e.message:"Could not inspect curriculum readiness.")}
      finally{if(live)setLoading(false)}
    })()
    return()=>{live=false}
  },[])
  return <main style={{background:"#f6f8fb",color:"#162b44",padding:"30px 16px 80px",minHeight:"100vh"}}>
    <div style={{maxWidth:980,margin:"0 auto",display:"grid",gap:20}}>
      <header>
        <Link href="/hq/curriculum-authority" style={{color:"#254d82",fontWeight:700}}>Back to Curriculum Authority</Link>
        <h1 style={{fontSize:"clamp(25px,4vw,36px)",margin:"16px 0 6px"}}>Grade 9 Mathematics — Curriculum Readiness</h1>
        <p style={{margin:0,color:"#546a80",lineHeight:1.6}}>Evidence from existing canonical curriculum and assessment records. A status report, not an approval or curriculum import.</p>
      </header>
      {loading&&<p role="status">Checking live curriculum evidence…</p>}
      {error&&<section role="alert" style={{padding:16,border:"1px solid #eaa",borderRadius:12}}>{error}</section>}
      {report&&<>
        <section style={{background:"white",border:"1px solid #d9e1eb",borderRadius:14,padding:20}}>
          <h2 style={{marginTop:0,color:report.ready_for_curriculum_verified_exam?"#13734f":"#ae5b14"}}>
            {report.ready_for_curriculum_verified_exam?"Curriculum preflight checks satisfied":"Not ready for curriculum-verified examinations"}
          </h2>
          <p style={{marginBottom:0}}>Original practice may remain available with provisional outcome links. Curriculum-verified exams require authoritative KICD sources, reviewed outcomes, a blueprint and approved mapped questions.</p>
        </section>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:10}}>
          {metrics.map(x=><article key={x.key} style={{background:"white",padding:16,borderRadius:12,border:"1px solid #d9e1eb"}}>
            <strong style={{fontSize:26}}>{report[x.key] as number}</strong>
            <p style={{fontSize:13,color:"#536980",margin:"8px 0 0"}}>{x.label}</p>
          </article>)}
        </div>
        <section style={{background:"white",border:"1px solid #d9e1eb",borderRadius:14,padding:20}}>
          <h2 style={{marginTop:0}}>Required work</h2>
          {report.issues.length===0?<p>No missing preflight evidence detected. Independently review curriculum quality before any certification claim.</p>:<ol style={{display:"grid",gap:10,paddingLeft:22}}>
            {report.issues.map(issue=><li key={issue}>{friendly[issue]??issue.replaceAll("_"," ")}</li>)}
          </ol>}
          <p style={{fontSize:13,color:"#64748b"}}>Only the approved curriculum-authority workflow should promote official content. This dashboard cannot alter authority records.</p>
          <Link href="/hq/curriculum-authority" style={{fontWeight:700,color:"#254d82"}}>Open curriculum source workflow</Link>
        </section>
      </>}
    </div>
  </main>
}
