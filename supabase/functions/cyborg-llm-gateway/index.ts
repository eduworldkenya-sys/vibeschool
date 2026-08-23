import { hashModelRequest, hashValue, receiptHash, verifyCapability } from '../_shared/cyborg-capability.ts'
import { latestReceipt, recordBoundaryEvent, rpc } from '../_shared/cyborg-service.ts'

const SIGNING_KEY=Deno.env.get('CYBORG_CAPABILITY_SIGNING_KEY')??''
const GROQ_KEY=Deno.env.get('GROQ_API_KEY')??''
const ANTHROPIC_KEY=Deno.env.get('ANTHROPIC_API_KEY')??''
function json(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}})}
function capabilityFrom(req:Request){const auth=req.headers.get('authorization')??'';return auth.startsWith('Cyborg ')?auth.slice(7).trim():''}
function usageOf(output:unknown,provider:string):Record<string,number>{if(!output||typeof output!=='object'||Array.isArray(output))return{};const raw=(output as Record<string,unknown>).usage;if(!raw||typeof raw!=='object'||Array.isArray(raw))return{};const u=raw as Record<string,unknown>;if(provider==='groq')return{inputTokens:Number(u.prompt_tokens??0),outputTokens:Number(u.completion_tokens??0),totalTokens:Number(u.total_tokens??0)};const input=Number(u.input_tokens??0),out=Number(u.output_tokens??0);return{inputTokens:input,outputTokens:out,totalTokens:input+out}}
function providerOptions(metadata:Record<string,unknown>){const rawTemp=Number(metadata.temperature);const temperature=Number.isFinite(rawTemp)?Math.max(0,Math.min(1,rawTemp)):0.25;const jsonObject=metadata.responseFormat==='json_object';return{temperature,jsonObject}}
async function invokeProvider(provider:string,model:string,messages:unknown[],maxTokens:number,metadata:Record<string,unknown>){
  const options=providerOptions(metadata)
  if(provider==='groq'){
    if(!GROQ_KEY)throw new Error('CYBORG_PROVIDER_CREDENTIAL_REQUIRED:groq')
    const body:Record<string,unknown>={model,messages,max_tokens:maxTokens,temperature:options.temperature};if(options.jsonObject)body.response_format={type:'json_object'}
    const response=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${GROQ_KEY}`},body:JSON.stringify(body)})
    const output:unknown=await response.json().catch(()=>({}));if(!response.ok)throw new Error(`CYBORG_PROVIDER_ERROR:groq:${response.status}`);return{output,usage:usageOf(output,'groq')}
  }
  if(provider==='anthropic'){
    if(!ANTHROPIC_KEY)throw new Error('CYBORG_PROVIDER_CREDENTIAL_REQUIRED:anthropic')
    const response=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':ANTHROPIC_KEY,'anthropic-version':'2023-06-01'},body:JSON.stringify({model,max_tokens:maxTokens,temperature:options.temperature,messages})})
    const output:unknown=await response.json().catch(()=>({}));if(!response.ok)throw new Error(`CYBORG_PROVIDER_ERROR:anthropic:${response.status}`);return{output,usage:usageOf(output,'anthropic')}
  }
  throw new Error(`CYBORG_PROVIDER_NOT_REGISTERED:${provider}`)
}
Deno.serve(async(req)=>{let missionId:string|undefined,invocationId:string|undefined;try{
  if(req.method!=='POST')return json({error:'method_not_allowed'},405);const token=capabilityFrom(req);if(!token)throw new Error('CYBORG_CAPABILITY_REQUIRED');if(!SIGNING_KEY||SIGNING_KEY.length<32)throw new Error('CYBORG_CAPABILITY_SIGNING_KEY_REQUIRED')
  const body=await req.json() as Record<string,unknown>;missionId=typeof body.missionId==='string'?body.missionId:undefined;invocationId=typeof body.invocationId==='string'?body.invocationId:undefined
  const messages=Array.isArray(body.messages)?body.messages:[];if(!messages.length)throw new Error('CYBORG_MESSAGES_REQUIRED');const metadata=body.metadata&&typeof body.metadata==='object'&&!Array.isArray(body.metadata)?body.metadata as Record<string,unknown>:{};if(Array.isArray(metadata.tools)&&metadata.tools.length)throw new Error('CYBORG_TOOL_SCOPE_DENIED')
  const callerServiceId=typeof body.callerServiceId==='string'?body.callerServiceId:'',provider=typeof body.provider==='string'?body.provider:'',model=typeof body.model==='string'?body.model:'',operation=typeof body.operation==='string'?body.operation:'',maxTokens=Number(body.maxTokens)
  const requestHash=await hashModelRequest({callerServiceId,provider,model,operation,maxTokens,messages,metadata})
  const expected={missionId:missionId??'',missionRevision:typeof body.missionRevision==='string'?body.missionRevision:'',chatId:typeof body.chatId==='string'?body.chatId:'',invocationId:invocationId??'',callerServiceId,provider,model,operation,requestHash,maxTokens}
  if((req.headers.get('x-cyborg-caller-id')??'')!==callerServiceId)throw new Error('CYBORG_CAPABILITY_CALLER_MISMATCH')
  const claims=await verifyCapability(token,SIGNING_KEY,expected);const capabilityHash=await hashValue(token)
  await rpc('hq_cyborg_consume_capability',{p_nonce:claims.nonce,p_invocation_id:claims.invocationId,p_mission_id:claims.missionId,p_chat_session_id:claims.chatId,p_mission_revision:claims.missionRevision,p_caller_service_id:claims.callerServiceId,p_provider:claims.provider,p_model:claims.model,p_operation:claims.operation,p_requested_tokens:maxTokens,p_request_hash:requestHash,p_capability_hash:capabilityHash})
  const startedAt=new Date().toISOString(),previousReceiptHash=await latestReceipt(claims.missionId);let providerResult:{output:unknown;usage:Record<string,number>}
  try{providerResult=await invokeProvider(claims.provider,claims.model,messages,maxTokens,metadata)}catch(error){const code=error instanceof Error?error.message:String(error);await rpc('hq_cyborg_record_model_result',{p_invocation_id:claims.invocationId,p_response_hash:'',p_policy_decision_hash:'',p_previous_receipt_hash:previousReceiptHash??null,p_receipt_hash:'',p_usage:{},p_error_code:code});throw error}
  const completedAt=new Date().toISOString(),responseHash=await hashValue(JSON.stringify(providerResult.output)),policyDecisionHash=await hashValue('ALLOW')
  const unsigned={invocationId:claims.invocationId,missionId:claims.missionId,missionRevision:claims.missionRevision,chatId:claims.chatId,rootMissionId:claims.missionId,parentInvocationId:claims.parentInvocationId,callerServiceId:claims.callerServiceId,provider:claims.provider,model:claims.model,operation:claims.operation,requestHash,responseHash,capabilityHash,policyDecision:'ALLOW',policyDecisionHash,previousReceiptHash,startedAt,completedAt}
  const receipt=await receiptHash(unsigned);await rpc('hq_cyborg_record_model_result',{p_invocation_id:claims.invocationId,p_response_hash:responseHash,p_policy_decision_hash:policyDecisionHash,p_previous_receipt_hash:previousReceiptHash??null,p_receipt_hash:receipt,p_usage:providerResult.usage,p_error_code:null})
  return json({output:{provider:claims.provider,model:claims.model,output:providerResult.output,usage:providerResult.usage},lineage:{...unsigned,receiptHash:receipt,lineageVerified:true}})
}catch(error){const message=error instanceof Error?error.message:String(error);await recordBoundaryEvent(message.startsWith('CYBORG_')?message.split(':')[0]:'CYBORG_GATEWAY_FAILURE',message.includes('INVALID')?'critical':'high',missionId,invocationId,{message:message.slice(0,200)});const denied=['MISMATCH','DENIED','REPLAY','EXPIRED','SUSPENDED','INVALID','NOT_YET_VALID','BUDGET'].some(term=>message.includes(term));return json({error:message},message.includes('REQUIRED')?401:denied?403:502)}})
