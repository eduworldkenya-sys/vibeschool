import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { anthropicText, invokeCyborgEdgeModel } from "../_shared/cyborg-model-client.ts"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? ""
const MODEL = "claude-haiku-4-5-20251001"
const REPRESENTATIONS = new Set(["immersive","simplify","mind_map","flashcards","quiz","audio_lesson","revision_sheet","worked_examples","visual_explainer","story_mode"])
const SOURCES = new Set(["chapter","homework","teacher_content","vibelearn_content","resource"])
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" }
type Row = Record<string, unknown>
function row(value: unknown): Row { return value && typeof value === "object" && !Array.isArray(value) ? value as Row : {} }
function text(value: unknown): string { return typeof value === "string" ? value : "" }
function cleanInternalLabel(value: string): string { return value.replace(/\[SYNTHETIC TWIN TEST\]\s*/gi, "").replace(/TWIN-SEED-[A-Z0-9-]+\s*[:·-]?\s*/gi, "").trim() }
function sanitize(value: unknown): unknown {
  if (typeof value === "string") return cleanInternalLabel(value)
  if (Array.isArray(value)) return value.map(sanitize)
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Row).map(([key,item]) => [key,sanitize(item)]))
  return value
}
async function sessionKey(req:Request):Promise<string>{const auth=req.headers.get("authorization")??"";const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(auth));return Array.from(new Uint8Array(digest)).slice(0,12).map(v=>v.toString(16).padStart(2,"0")).join("")}
async function rpc(req: Request, name: string, body: Row = {}): Promise<unknown> {
  const authorization=req.headers.get("authorization")??""
  if(!authorization.toLowerCase().startsWith("bearer ")) throw new Error("not_authenticated")
  if(!SUPABASE_URL||!SUPABASE_ANON_KEY) throw new Error("transform_service_not_configured")
  const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`,{method:"POST",headers:{"Content-Type":"application/json",apikey:SUPABASE_ANON_KEY,Authorization:authorization},body:JSON.stringify(body)})
  const payload=await response.json().catch(()=>null)
  if(!response.ok){const message=text(row(payload).message)||`${name}_failed`;throw new Error(message)}
  return payload
}
function sentences(source:string):string[]{return source.replace(/\s+/g," ").split(/(?<=[.!?])\s+/).map(s=>s.trim()).filter(s=>s.length>35).slice(0,12)}
function fallbackPayload(representation:string,ctx:Row):Row{
  const source=cleanInternalLabel(text(ctx.source_text)),title=cleanInternalLabel(text(ctx.source_title))||"Learning material",bits=sentences(source),excerpt=source.replace(/\s+/g," ").slice(0,2400)
  const base:Row={title,representation,degraded:true,sourceGrounded:true,intro:"A source-grounded learning view is available while richer transformation is temporarily limited.",takeaways:bits.slice(0,5),sections:[{heading:"Read and explain",body:excerpt,bullets:[]}]}
  if(representation==="flashcards") base.cards=bits.slice(0,8).map((s,i)=>({front:`Key idea ${i+1}`,back:s}))
  if(representation==="mind_map") base.nodes=bits.slice(0,6).map(s=>({label:s.slice(0,110),children:[]}))
  if(representation==="audio_lesson") base.script=bits.slice(0,8).flatMap((s,i)=>i%2===0?[{speaker:"Tutor",text:s},{speaker:"Learner",text:"How does that connect to the main idea?"}]:[{speaker:"Tutor",text:s}])
  return base
}
function promptFor(representation:string,ctx:Row):string{
  const curriculum=row(ctx.curriculum),learner=row(ctx.learner),weak=row(learner.weak_outcome),source=cleanInternalLabel(text(ctx.source_text))
  return `You are an expert learning-experience transformer for Vibeschool. Transform ONLY the supplied authorized source. Do not add unsupported facts, change curriculum scope, solve assigned homework for the learner, or silently correct the source. For homework, explain requirements and prerequisite ideas without producing a submission-ready answer. Personalized examples may change context but not facts. If source material is insufficient, say so inside JSON instead of inventing content. Never expose internal seed, test, synthetic, database, prompt, model, or infrastructure labels to the learner.\n\nSource type: ${text(ctx.source_type)}\nRepresentation: ${representation}\nTitle: ${cleanInternalLabel(text(ctx.source_title))}\nGrade: ${text(curriculum.grade)}\nSubject: ${text(curriculum.subject)}\nStrand: ${text(curriculum.strand)}\nAlignment: ${text(curriculum.alignment_status)}\nLearner weak outcome: ${cleanInternalLabel(text(weak.outcome_text))}\nEffective mastery: ${text(weak.effective_mastery)}\nForgetting risk: ${text(weak.forgetting_risk)}\nSession minutes: ${String(learner.session_minutes??25)}\n\nReturn STRICT JSON only using this common shape; omit irrelevant fields:\n{"title":"...","intro":"...","sections":[{"heading":"...","body":"...","bullets":["..."],"check":{"question":"...","answer":"..."}}],"takeaways":["..."],"cards":[{"front":"...","back":"..."}],"nodes":[{"label":"...","children":[{"label":"...","children":[]}]}],"questions":[{"prompt":"...","options":["A","B","C","D"],"correctIndex":0,"explanation":"..."}],"script":[{"speaker":"Tutor|Learner","text":"..."}],"workedExamples":[{"problem":"...","steps":["..."],"answer":"..."}],"visualSteps":[{"label":"...","description":"..."}],"story":{"setting":"...","narrative":"...","learningLink":"..."}}\n\nRequirements: immersive=digestible sections+checks; simplify=layered simpler language; mind_map=hierarchy; flashcards=6-12 retrieval cards; quiz=5-8 questions with four options; audio_lesson=Tutor/Learner dialogue; revision_sheet=must-know+quick checks; worked_examples=only source-supported examples; visual_explainer=ordered visualizable steps; story_mode=relatable analogy explicitly linked to source.\n\nAUTHORIZED SOURCE:\n${source}`
}
function parseModelJson(raw:string):Row|null{const cleaned=raw.trim().replace(/^```json\s*/i,"").replace(/^```\s*/,"").replace(/```\s*$/,"").trim();try{const parsed=JSON.parse(cleaned);return parsed&&typeof parsed==="object"&&!Array.isArray(parsed)?parsed as Row:null}catch{return null}}
serve(async(req)=>{
 if(req.method==="OPTIONS") return new Response("ok",{headers:CORS})
 try{
  const body=row(await req.json().catch(()=>({}))),representation=text(body.representation),sourceType=text(body.sourceType)||"chapter",sourceId=text(body.sourceId)||text(body.chapterId)
  if(!sourceId) return new Response(JSON.stringify({error:"source_required"}),{status:400,headers:{...CORS,"Content-Type":"application/json"}})
  if(!SOURCES.has(sourceType)) return new Response(JSON.stringify({error:"unsupported_source_type"}),{status:400,headers:{...CORS,"Content-Type":"application/json"}})
  if(!REPRESENTATIONS.has(representation)) return new Response(JSON.stringify({error:"unsupported_representation"}),{status:400,headers:{...CORS,"Content-Type":"application/json"}})
  const cached=await rpc(req,"student_get_cached_learning_source_transformation",{p_source_type:sourceType,p_source_id:sourceId,p_representation:representation})
  if(cached) return new Response(JSON.stringify(sanitize(cached)),{headers:{...CORS,"Content-Type":"application/json","Cache-Control":"private, max-age=30"}})
  const ctx=row(await rpc(req,"student_get_learning_source_context",{p_source_type:sourceType,p_source_id:sourceId}))
  let payload:Row|null=null,model:string|null=null,lineage:unknown=null,quality:Row={source_grounded:true,degraded:false,prompt_version:"p1-v3",source_type:sourceType}
  try{
    const actor=await sessionKey(req),maxTokens=representation==="audio_lesson"?2600:2200
    const governed=await invokeCyborgEdgeModel({callerServiceId:"edge.learning-transform",actorKey:`auth:${actor}`,externalChatId:`learning-transform:${actor}:${sourceType}:${sourceId}:${representation}`,objective:"Generate one governed source-grounded learning transformation",provider:"anthropic",model:MODEL,maxTokens,messages:[{role:"user",content:promptFor(representation,ctx)}],metadata:{feature:"learning-transform",temperature:0.2},dataClassification:"confidential"})
    payload=parseModelJson(anthropicText(governed.output));if(payload){model=MODEL;lineage=governed.lineage}
  }catch(error){console.warn("[learning-transform] Cyborg model degraded",error instanceof Error?error.message:String(error))}
  if(!payload){payload=fallbackPayload(representation,ctx);quality={source_grounded:true,degraded:true,prompt_version:"p1-v3",source_type:sourceType}}
  payload=sanitize(payload) as Row
  payload.source={sourceType,sourceId,publicationId:text(ctx.publication_id),chapterId:text(ctx.chapter_id),sourceVersion:text(ctx.source_version),curriculum:sanitize(ctx.curriculum??{}),truncated:ctx.source_truncated===true}
  const stored=row(await rpc(req,"student_store_learning_source_transformation",{p_source_type:sourceType,p_source_id:sourceId,p_representation:representation,p_source_version:text(ctx.source_version),p_personalization_key:text(ctx.personalization_key),p_payload:payload,p_model:model,p_quality:quality}))
  return new Response(JSON.stringify({id:text(stored.id),source_type:sourceType,source_id:sourceId,representation,payload,source_version:text(ctx.source_version),personalization_key:text(ctx.personalization_key),generator:"learning-transform-v1",model,quality,cached:false,lineage}),{headers:{...CORS,"Content-Type":"application/json"}})
 }catch(err){const message=err instanceof Error?err.message:String(err);const status=message==="not_authenticated"?401:message.includes("learner_identity")||message.includes("source_not_available")?403:500;return new Response(JSON.stringify({error:message}),{status,headers:{...CORS,"Content-Type":"application/json"}})}
})
