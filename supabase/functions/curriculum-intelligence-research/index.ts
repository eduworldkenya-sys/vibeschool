import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers={"Content-Type":"application/json","Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
const GROQ_KEY=Deno.env.get("GROQ_API_KEY")??"";
const TAVILY_KEY=Deno.env.get("TAVILY_API_KEY")??"";
const MODEL=Deno.env.get("CURRICULUM_INTELLIGENCE_GROQ_MODEL")??"llama-3.3-70b-versatile";
const WORKER="curriculum-intelligence-research:v6-cors";

async function sha256(value:string){
  const bytes=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)));
  return Array.from(bytes).map(b=>b.toString(16).padStart(2,"0")).join("");
}
function host(url:string){try{return new URL(url).hostname.replace(/^www\./,"").toLowerCase()}catch{return ""}}
function tier(url:string){const h=host(url);if(/(^|\.)kicd\.ac\.ke$|(^|\.)knec\.ac\.ke$|\.go\.ke$|(^|\.)kenyalaw\.org$/.test(h))return 1;if(/(^|\.)who\.int$|(^|\.)fao\.org$|(^|\.)nasa\.gov$|(^|\.)mit\.edu$|(^|\.)nature\.com$|(^|\.)science\.org$|\.edu$|\.ac\.ke$/.test(h))return 2;return 3}
function sourceType(url:string,t:number){const h=host(url);if(t===1)return h.includes("kicd")||h.includes("knec")?"official":"government";if(t===2)return /nature\.com|science\.org/.test(h)?"primary_research":"institutional";return "web"}
function authority(t:number){return t===1?1:t===2?.92:.65}
function parseJson(raw:string){const txt=raw.match(/<json>([\s\S]*?)<\/json>/i)?.[1]??raw;try{return JSON.parse(txt.replace(/^```json\s*/i,"").replace(/```$/i,"").trim())}catch{return null}}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers});
  if(req.method!=="POST")return json({error:"method_not_allowed"},405);
  let db:any=null; let claimedJobId:string|null=null;
  try{
    if(!GROQ_KEY||!TAVILY_KEY)return json({error:"research_provider_not_configured"},500);
    const auth=req.headers.get("Authorization");if(!auth)return json({error:"unauthorized"},401);
    const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userDb=createClient(url,anon,{global:{headers:{Authorization:auth}}});
    const {data:{user}}=await userDb.auth.getUser();if(!user)return json({error:"unauthorized"},401);
    const {data:isOwner}=await userDb.rpc("is_platform_owner");if(!isOwner)return json({error:"hq_platform_owner_required"},403);
    db=createClient(url,service);
    const {data:job,error:claimErr}=await db.rpc("claim_next_research_job",{p_worker:WORKER});if(claimErr)throw claimErr;
    if(!job)return json({ok:true,status:"no_work"});
    claimedJobId=job.id;
    const {data:proposal,error:pErr}=await db.from("curriculum_intelligence_proposals").select("id,title,claim,current_content,proposed_content,rationale,curriculum_relevance,volatility,publication_id,chapter_id").eq("id",job.proposal_id).single();if(pErr)throw pErr;
    const allowed=Array.isArray(job.allowed_domains)?job.allowed_domains:[];
    const query=[job.research_question,proposal.title,"Kenya curriculum evidence"].filter(Boolean).join(" ");
    const search=await fetch("https://api.tavily.com/search",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({api_key:TAVILY_KEY,query,search_depth:"advanced",max_results:10,include_answer:false,include_raw_content:false,include_domains:allowed.length?allowed:undefined})});
    const searchData=await search.json();if(!search.ok)throw new Error(`tavily_search_failed:${search.status}`);
    const candidates=(searchData.results??[]).slice(0,10).map((s:any)=>({url:String(s.url??""),title:String(s.title??""),snippet:String(s.content??"").slice(0,1800)})).filter((s:any)=>s.url&&s.snippet);
    if(candidates.length===0)throw new Error("research_no_usable_sources");
    const evidenceText=candidates.map((s:any,i:number)=>`SOURCE ${i+1}\nURL: ${s.url}\nTITLE: ${s.title}\nEXCERPT: ${s.snippet}`).join("\n\n");
    const prompt=`You are an evidence adjudicator for a Kenyan educational publisher. Evaluate ONLY the supplied source excerpts against this claim. Never invent facts or source content.\nCLAIM: ${proposal.claim||job.research_question}\nCURRENT CONTENT: ${proposal.current_content||""}\nPROPOSED CONTENT: ${proposal.proposed_content||""}\nSOURCES:\n${evidenceText}\nReturn only <json>{"sources":[{"index":1,"stance":"supports|contradicts|neutral","excerpt":"short evidence-bearing excerpt or paraphrase from supplied snippet","reason":"brief reason"}],"synthesis":"brief evidence synthesis"}</json>. A source supports only if its excerpt materially supports the claim; contradiction must be explicit; otherwise neutral.`;
    const gr=await fetch("https://api.groq.com/openai/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${GROQ_KEY}`},body:JSON.stringify({model:MODEL,messages:[{role:"user",content:prompt}],temperature:0,max_tokens:2600})});
    const gd=await gr.json();if(!gr.ok)throw new Error(`groq_adjudication_failed:${gr.status}`);
    const adjudication=parseJson(gd.choices?.[0]?.message?.content??"");
    if(!adjudication||!Array.isArray(adjudication.sources))throw new Error("research_adjudication_invalid");
    const byIndex=new Map(adjudication.sources.map((x:any)=>[Number(x.index),x]));
    const rows=[];
    for(let i=0;i<candidates.length;i++){
      const c=candidates[i],a:any=byIndex.get(i+1)??{};const t=tier(c.url);const stance=a.stance==="supports"?"supports":a.stance==="contradicts"?"contradicts":"neutral";
      rows.push({proposal_id:proposal.id,url:c.url,title:c.title||null,publisher:host(c.url)||null,source_type:sourceType(c.url,t),authority_score:authority(t),supports_claim:stance==="supports",accessed_at:new Date().toISOString(),retrieved_at:new Date().toISOString(),content_hash:await sha256(c.snippet),source_tier:t,verification_method:"tavily_search+groq_excerpt_adjudication",claim_excerpt:String(a.excerpt||c.snippet).slice(0,1200),contradicts_claim:stance==="contradicts",evidence_summary:String(a.reason||c.snippet).slice(0,1200)});
    }
    await db.from("curriculum_intelligence_sources").delete().eq("proposal_id",proposal.id).eq("verification_method","tavily_search+groq_excerpt_adjudication");
    const {error:sErr}=await db.from("curriculum_intelligence_sources").insert(rows);if(sErr)throw sErr;
    const {data:result,error:fErr}=await db.rpc("finalize_research_job",{p_job_id:job.id,p_result:{worker:WORKER,model:MODEL,search_provider:"tavily",candidate_count:candidates.length,synthesis:String(adjudication.synthesis||"").slice(0,2000)}});if(fErr)throw fErr;
    claimedJobId=null;
    return json({ok:true,status:result?.status??"completed",jobId:job.id,proposalId:proposal.id,evidence:result});
  }catch(e){
    const message=e instanceof Error?e.message:String(e); console.error(e);
    if(db&&claimedJobId){try{await db.rpc("fail_research_job",{p_job_id:claimedJobId,p_error:message})}catch(failErr){console.error("fail_research_job_failed",failErr)}}
    return json({error:message},500);
  }
});