import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Content-Type":"application/json"}
const respond=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors})
const GROQ_KEY=Deno.env.get("GROQ_API_KEY")??""
const TAVILY_KEY=Deno.env.get("TAVILY_API_KEY")??""
const MODEL=Deno.env.get("CURRICULUM_EDITORIAL_MODEL")??"llama-3.3-70b-versatile"

type AnyRow=Record<string,any>
const parseJson=(raw:string)=>{const m=raw.match(/<editorial_json>([\s\S]*?)<\/editorial_json>/i)?.[1]||raw; try{return JSON.parse(m.trim().replace(/^```json\s*/i,"").replace(/```$/,""))}catch{return null}}

Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS") return new Response("ok",{headers:cors})
 if(req.method!=="POST") return respond({error:"method_not_allowed"},405)
 try{
  const auth=req.headers.get("Authorization")
  if(!auth) return respond({error:"Unauthorized"},401)
  const url=Deno.env.get("SUPABASE_URL")!, anon=Deno.env.get("SUPABASE_ANON_KEY")!, service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const userDb=createClient(url,anon,{global:{headers:{Authorization:auth}}})
  const {data:{user},error:userErr}=await userDb.auth.getUser(); if(userErr||!user) return respond({error:"Unauthorized"},401)
  const {data:isOwner,error:ownerErr}=await userDb.rpc("is_platform_owner"); if(ownerErr||!isOwner) return respond({error:"HQ platform owner required"},403)
  const admin=createClient(url,service)
  const body=await req.json().catch(()=>({})) as AnyRow
  let action:AnyRow|null=null
  if(body.action_id){const {data,error}=await admin.from("curriculum_editorial_actions").select("*").eq("id",body.action_id).maybeSingle(); if(error)throw error; action=data}
  else {const {data,error}=await admin.from("curriculum_editorial_actions").select("*").eq("status","queued").order("priority",{ascending:false}).order("created_at").limit(1).maybeSingle(); if(error)throw error; action=data}
  if(!action) return respond({status:"no_work"})
  const {data:signal,error:sErr}=await admin.from("curriculum_content_health_signals").select("*").eq("id",action.health_signal_id).single(); if(sErr)throw sErr
  const {data:chapter,error:cErr}=await admin.from("vibe_chapters").select("id,publication_id,title,number,blocks,learning_outcomes,cbc_strand,curriculum_id").eq("id",action.chapter_id).single(); if(cErr)throw cErr
  const {data:blocks,error:bErr}=await admin.from("content_blocks").select("id,legacy_block_id,sequence,block_type,title,plain_text,is_assessable").eq("chapter_id",chapter.id).order("sequence"); if(bErr)throw bErr
  await admin.from("curriculum_editorial_actions").update({status:"in_progress",updated_at:new Date().toISOString()}).eq("id",action.id)

  let webContext=""; const researchNeeded=["fact_check","investigate","rights_review"].includes(action.action_type)
  if(researchNeeded&&TAVILY_KEY){
   const q=`${chapter.title} ${chapter.cbc_strand||""} ${action.rationale} Kenya curriculum authoritative source`
   const t=await fetch("https://api.tavily.com/search",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({api_key:TAVILY_KEY,query:q,max_results:5,include_answer:true})})
   if(t.ok){const td=await t.json(); webContext=(td.results||[]).map((r:AnyRow)=>`${r.url}\n${r.title}: ${r.content}`).join("\n\n").slice(0,12000)}
  }
  if(!GROQ_KEY) throw new Error("GROQ_API_KEY missing")
  const blockText=(blocks||[]).map((b:AnyRow)=>`BLOCK ${b.sequence} (${b.legacy_block_id||b.id}) [${b.block_type}]\n${b.plain_text||""}`).join("\n\n").slice(0,26000)
  const prompt=`You are the Vibeschool Senior Editorial Board for Kenyan curriculum publishing. You are reviewing a content-health signal, not blindly generating prose. Act like an experienced subject editor, classroom teacher, fact-checker and educational writer.

EDITORIAL ACTION: ${action.action_type}
PRIORITY: ${action.priority}
RATIONALE: ${action.rationale}
HEALTH SIGNAL: ${signal.signal_type}; severity=${signal.severity}; score=${signal.score}; evidence_count=${signal.evidence_count}
EVIDENCE: ${JSON.stringify(signal.evidence)}
CHAPTER: ${chapter.title}
CURRICULUM STRAND: ${chapter.cbc_strand||""}
LEARNING OUTCOMES: ${JSON.stringify(chapter.learning_outcomes||[])}

CURRENT CANONICAL BLOCKS:
${blockText}
${webContext?`\nCURRENT WEB EVIDENCE:\n${webContext}`:""}

Editorial constitution:
- Diagnose before editing. A weak learner signal can mean wording, sequencing, examples, assessment, prerequisites, or context; do not assume the chapter is wrong.
- Prefer the smallest change that materially improves learning.
- Preserve correct existing content.
- Use natural, precise, warm, intellectually serious prose. No generic chatbot tone, marketing language, filler, decorative Kenyan examples, or fake certainty.
- Kenyan context must be authentic and educationally useful.
- Distinguish established fact from emerging evidence.
- Never copy source wording; synthesize original learner-facing prose.
- If evidence does not justify a content change, return no_change.
- Select one exact existing block sequence when recommending replacement. If the action is better handled as an added example/activity or teacher/assessment derivative, say so and do not pretend it is a replacement.

Return ONLY:
<editorial_json>{"decision":"proposal|no_change","title":"...","diagnosis":"...","proposal_type":"correction|enrichment|new_content|assessment_update|teacher_guidance|review_candidate","curriculum_relevance":"C1|C2|C3|C4","target_sequence":1,"current_content":"exact current block text if replacing, otherwise empty","proposed_content":"finished original learner-facing draft or derivative brief","rationale":"...","confidence":0.0,"verification_status":"verified|insufficient_evidence|unverified","volatility":"low|medium|high"}</editorial_json>`
  const g=await fetch("https://api.groq.com/openai/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${GROQ_KEY}`},body:JSON.stringify({model:MODEL,messages:[{role:"user",content:prompt}],max_tokens:4200,temperature:0.2})})
  const gd=await g.json(); if(!g.ok) throw new Error(`groq_failed:${g.status}`)
  const out=parseJson(gd.choices?.[0]?.message?.content||"")
  if(!out) throw new Error("invalid_editorial_output")
  if(out.decision!=="proposal"){
   await admin.from("curriculum_editorial_actions").update({status:"completed",updated_at:new Date().toISOString()}).eq("id",action.id)
   await admin.from("curriculum_content_health_signals").update({status:"resolved",updated_at:new Date().toISOString()}).eq("id",signal.id)
   return respond({status:"no_change",action_id:action.id,diagnosis:out.diagnosis||out.rationale})
  }
  const seq=Number(out.target_sequence); const target=(blocks||[]).find((b:AnyRow)=>b.sequence===seq)
  const patch=target?{operation:"research_draft",auto_apply:false,sequence:seq,legacy_block_id:target.legacy_block_id||null,health_action_id:action.id}:{operation:"research_draft",auto_apply:false,health_action_id:action.id}
  const {data:proposal,error:pErr}=await admin.from("curriculum_intelligence_proposals").insert({publication_id:chapter.publication_id,chapter_id:chapter.id,proposal_type:out.proposal_type||"review_candidate",title:out.title||`Editorial review: ${chapter.title}`,claim:out.diagnosis||signal.signal_type,current_content:out.current_content||target?.plain_text||null,proposed_content:out.proposed_content||"",patch,rationale:out.rationale||action.rationale,curriculum_relevance:out.curriculum_relevance||"C4",confidence:Math.max(0,Math.min(1,Number(out.confidence)||0)),verification_status:out.verification_status||"unverified",volatility:out.volatility||"low",status:"pending_review",generated_by:`content_health_editorial:${MODEL}`}).select("id").single(); if(pErr)throw pErr
  await admin.from("curriculum_editorial_actions").update({status:"proposal_created",proposal_id:proposal.id,updated_at:new Date().toISOString()}).eq("id",action.id)
  await admin.from("curriculum_content_health_signals").update({status:"proposal_created",updated_at:new Date().toISOString()}).eq("id",signal.id)
  return respond({status:"proposal_created",action_id:action.id,proposal_id:proposal.id,diagnosis:out.diagnosis,target_sequence:target?.sequence||null})
 }catch(e){console.error(e);return respond({error:e instanceof Error?e.message:String(e)},500)}
})