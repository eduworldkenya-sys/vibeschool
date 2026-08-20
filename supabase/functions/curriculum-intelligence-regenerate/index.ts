import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers={"Content-Type":"application/json","Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
const WORKER="curriculum-intelligence-regenerate:v3-cors";
const SUPPORTED=new Set(["teacher_notes","teacher_guide","lesson_plan","assessment","homework","revision_practice","project_brief","vibelab_review","qa"]);

Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS") return new Response("ok",{headers});
 if(req.method!=="POST") return json({error:"method_not_allowed"},405);
 let admin:any=null; let claimedId:string|null=null;
 try{
  const auth=req.headers.get("Authorization"); if(!auth) return json({error:"unauthorized"},401);
  const url=Deno.env.get("SUPABASE_URL")!, anon=Deno.env.get("SUPABASE_ANON_KEY")!, service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const userDb=createClient(url,anon,{global:{headers:{Authorization:auth}}});
  const {data:{user}}=await userDb.auth.getUser(); if(!user) return json({error:"unauthorized"},401);
  const {data:isOwner}=await userDb.rpc("is_platform_owner"); if(!isOwner) return json({error:"hq_platform_owner_required"},403);
  admin=createClient(url,service);
  const body=await req.json().catch(()=>({})); const proposalId=body.proposal_id as string|undefined;
  let q=admin.from("curriculum_intelligence_regeneration_jobs").select("id,proposal_id,chapter_id,job_type,status,attempt_count,last_error").eq("status","queued").order("created_at",{ascending:true}).limit(1);
  if(proposalId) q=q.eq("proposal_id",proposalId);
  const {data:jobs,error:jErr}=await q; if(jErr) throw jErr; const job=jobs?.[0]; if(!job) return json({ok:true,status:"no_work"});
  claimedId=job.id;
  if(!SUPPORTED.has(job.job_type)) throw new Error(`unsupported_regeneration_job_type:${job.job_type}`);
  const nextAttempt=(job.attempt_count||0)+1;
  const {error:startErr}=await admin.from("curriculum_intelligence_regeneration_jobs").update({status:"running",started_at:new Date().toISOString(),attempt_count:nextAttempt,last_error:null,updated_at:new Date().toISOString()}).eq("id",job.id).eq("status","queued");
  if(startErr) throw startErr;
  const {data:ctx,error:ctxErr}=await admin.rpc("ce_get_teacher_derivation_context",{p_chapter_id:job.chapter_id}); if(ctxErr) throw ctxErr;
  const blocks=Array.isArray(ctx?.blocks)?ctx.blocks:[];
  const textBlocks=blocks.filter((b:any)=>String(b?.text??"").trim());
  const assessable=textBlocks.filter((b:any)=>b.is_assessable||b.block_type==="question");
  const title=ctx?.chapter_title||"Unit";
  let result:any={worker:WORKER,review_required:true};
  const save=async(type:string,titleText:string,bodyValue:any,audience:string,quality:any={})=>{
    const {data,error}=await admin.rpc("ce_save_content_derivative",{p_chapter_id:job.chapter_id,p_derivative_type:type,p_title:titleText,p_body:bodyValue,p_class_id:null,p_audience:audience,p_generator:WORKER,p_model:"deterministic-grounded-v3",p_quality:{source_grounded:true,regenerated_after_intelligence:true,human_review_required:true,...quality}}); if(error) throw error; return data;
  };
  switch(job.job_type){
   case "teacher_notes": result=await save("teacher_notes",`${title} teacher notes`,{title:`${title} teacher notes`,sections:textBlocks.slice(0,28).map((b:any)=>({heading:b.block_type,body:b.text,source_block_id:b.id})),teachingPrompts:["Check prior knowledge before introducing the updated explanation.","Use learner evidence to decide whether an additional example is needed."],sourceChapterId:job.chapter_id},"teacher"); break;
   case "teacher_guide": result=await save("teacher_guide",`${title} teacher guide`,{title:`${title} teacher guide`,objectives:ctx?.learning_outcomes??[],lessonFlow:textBlocks.slice(0,18).map((b:any,i:number)=>({step:i+1,focus:b.text,source_block_id:b.id})),assessmentChecks:assessable.slice(0,6).map((b:any)=>({prompt:b.text,source_block_id:b.id})),reviewRequired:true},"teacher"); break;
   case "lesson_plan": result=await save("lesson_plan",`${title} lesson plan`,{title:`${title} lesson plan`,learningOutcomes:ctx?.learning_outcomes??[],introduction:textBlocks[0]?.text??"",development:textBlocks.slice(1,7).map((b:any)=>({activity:b.text,source_block_id:b.id})),assessment:assessable.slice(0,4).map((b:any)=>({prompt:b.text,source_block_id:b.id})),reflectionPrompt:"Record what learners understood and what needs remediation.",reviewRequired:true},"teacher"); break;
   case "assessment": result={questions:assessable.slice(0,10).map((b:any,i:number)=>({n:i+1,prompt:b.text,source_block_id:b.id})),count:Math.min(10,assessable.length),review_required:true,grounded:true}; break;
   case "homework": result=await save("homework",`${title} practice`,{title:`${title} practice`,instructions:"Complete the grounded practice and show your reasoning.",questions:assessable.slice(0,8).map((b:any,i:number)=>({n:i+1,prompt:b.text,source_block_id:b.id})),reviewRequired:true},"learner",{delivery_requires_teacher_approval:true}); break;
   case "revision_practice": result=await save("revision_practice",`${title} revision practice`,{title:`${title} revision practice`,keyPoints:textBlocks.slice(0,8).map((b:any)=>({text:b.text,source_block_id:b.id})),questions:assessable.slice(0,10).map((b:any,i:number)=>({n:i+1,prompt:b.text,source_block_id:b.id})),reviewRequired:true},"learner"); break;
   case "project_brief": result=await save("project_brief",`${title} project brief`,{title:`${title} project brief`,purpose:(ctx?.learning_outcomes??[]).slice(0,3),sourceIdeas:textBlocks.slice(0,6).map((b:any)=>({text:b.text,source_block_id:b.id})),safetyNote:"Teacher review is required before assigning any practical activity.",reviewRequired:true},"teacher",{delivery_requires_teacher_approval:true}); break;
   case "vibelab_review": {const {data,error}=await admin.from("content_blocks").select("id,legacy_block_id,block_type,payload,plain_text").eq("chapter_id",job.chapter_id).eq("block_type","interactive"); if(error) throw error; result={interactive_count:(data??[]).length,interactives:data??[],review_required:true,action:(data??[]).length?"verify_simulation_against_updated_content":"consider_interactive_opportunity"}; break;}
   case "qa": {const issues:string[]=[]; if(!blocks.length) issues.push("no_blocks"); if(!(ctx?.learning_outcomes??[]).length) issues.push("no_learning_outcomes"); if((ctx?.word_count??0)<900) issues.push("thin_chapter"); result={pass:issues.length===0,issues,block_count:blocks.length,learning_outcomes:(ctx?.learning_outcomes??[]).length,review_required:issues.length>0}; break;}
  }
  const {error:doneErr}=await admin.from("curriculum_intelligence_regeneration_jobs").update({status:"completed",result,completed_at:new Date().toISOString(),last_error:null,updated_at:new Date().toISOString()}).eq("id",job.id); if(doneErr) throw doneErr;
  claimedId=null; return json({ok:true,status:"completed",job_id:job.id,job_type:job.job_type,result});
 }catch(e){const message=e instanceof Error?e.message:String(e); console.error(e); if(admin&&claimedId){try{const {data:j}=await admin.from("curriculum_intelligence_regeneration_jobs").select("attempt_count").eq("id",claimedId).single(); const attempts=j?.attempt_count??1; await admin.from("curriculum_intelligence_regeneration_jobs").update({status:attempts<3?"queued":"failed",last_error:message,started_at:null,completed_at:attempts<3?null:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",claimedId)}catch(err){console.error("regeneration_failure_record_failed",err)}} return json({error:message},500)}
});