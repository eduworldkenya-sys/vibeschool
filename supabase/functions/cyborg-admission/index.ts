import { CYBORG_POLICY_VERSION, CapabilityClaims, hashValue, signCapability } from '../_shared/cyborg-capability.ts'
import { getCyborgCallerPolicy } from '../_shared/cyborg-caller-policy.ts'
import { localRpc, requireServiceCaller, rpc } from '../_shared/cyborg-service.ts'

const SIGNING_KEY=Deno.env.get('CYBORG_CAPABILITY_SIGNING_KEY')??''
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const WORKER_MODEL_CALLERS=new Set(['edge.content-authoring-worker','edge.content-semantic-verifier'])
const CHEMISTRY_STAGE_CALLERS=new Set(['edge.content-critic-worker','edge.content-repair-worker','edge.chemistry-stage-executor'])
function json(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}})}
function strings(value:unknown){return Array.isArray(value)&&value.every(v=>typeof v==='string')?value as string[]:[]}
function record(value:unknown){return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null}
Deno.serve(async(req)=>{try{
  if(req.method!=='POST')return json({error:'method_not_allowed'},405)
  const body=await req.json() as Record<string,unknown>,caller=typeof body.callerServiceId==='string'?body.callerServiceId:'';requireServiceCaller(req,caller)
  if(!SIGNING_KEY||SIGNING_KEY.length<32)throw new Error('CYBORG_CAPABILITY_SIGNING_KEY_REQUIRED')
  const policy=getCyborgCallerPolicy(caller);if(!policy)throw new Error('CYBORG_CALLER_NOT_REGISTERED')
  const provider=typeof body.provider==='string'?body.provider:'',model=typeof body.model==='string'?body.model:'',operation=typeof body.operation==='string'?body.operation:'model.generate',requestHash=typeof body.requestHash==='string'?body.requestHash:'',maxTokens=Number(body.maxTokens)
  if(provider!==policy.provider)throw new Error('CYBORG_CAPABILITY_PROVIDER_MISMATCH');if(!policy.models.includes(model))throw new Error('CYBORG_CAPABILITY_MODEL_MISMATCH');if(operation!=='model.generate')throw new Error('CYBORG_CAPABILITY_OPERATION_MISMATCH');if(!requestHash)throw new Error('CYBORG_REQUEST_HASH_REQUIRED');if(!Number.isInteger(maxTokens)||maxTokens<1||maxTokens>policy.maxTokens)throw new Error('CYBORG_CAPABILITY_TOKEN_BUDGET_EXCEEDED')
  const riskClass=typeof body.riskClass==='string'?body.riskClass:'read';if(riskClass==='owner_only'||riskClass==='production_mutation')throw new Error('CYBORG_OWNER_APPROVAL_REQUIRED')
  const authorityScope=strings(body.authorityScope),toolScope=strings(body.toolScope);if(authorityScope.length||toolScope.length)throw new Error('CYBORG_SCOPE_ESCALATION_DENIED')

  const sourceRaw=record(body.sourceAuthority)
  const suppliedKind=typeof sourceRaw?.kind==='string'?sourceRaw.kind:''
  const suppliedRef=typeof sourceRaw?.ref==='string'?sourceRaw.ref.trim():''
  const suppliedToken=typeof sourceRaw?.token==='string'?sourceRaw.token.trim():''
  let sourceAuthorityKind:'service'|'worker_model_invocation'|'chemistry_stage_attempt'='service'
  let sourceAuthorityRef=''
  let sourceAuthorityToken:string|null=null

  if(WORKER_MODEL_CALLERS.has(caller)){
    if(suppliedKind!=='worker_model_invocation'||!UUID.test(suppliedRef))throw new Error('CYBORG_WORKER_SOURCE_AUTHORITY_REQUIRED')
    if(suppliedToken)throw new Error('CYBORG_WORKER_MODEL_TOKEN_DENIED')
    sourceAuthorityKind='worker_model_invocation';sourceAuthorityRef=suppliedRef
  }else if(CHEMISTRY_STAGE_CALLERS.has(caller)){
    const lease=record(body.stageLease),attemptId=typeof lease?.attemptId==='string'?lease.attemptId:'',leaseToken=typeof lease?.leaseToken==='string'?lease.leaseToken:''
    if(!UUID.test(attemptId)||!UUID.test(leaseToken))throw new Error('CHEMISTRY_CYBORG_STAGE_LEASE_REQUIRED')
    // Stage leases are project-local execution authority. Never resolve them against an optional remote Cyborg control-plane database.
    await localRpc('chemistry_assert_cyborg_stage_lease',{p_attempt_id:attemptId,p_lease_token:leaseToken,p_caller_service_id:caller})
    sourceAuthorityKind='chemistry_stage_attempt';sourceAuthorityRef=attemptId;sourceAuthorityToken=leaseToken
  }else if(sourceRaw&&(suppliedKind!=='service'||suppliedRef||suppliedToken))throw new Error('CYBORG_SOURCE_AUTHORITY_KIND_DENIED')

  const actorKey=typeof body.actorKey==='string'?body.actorKey.trim().slice(0,240):'',externalChatId=typeof body.externalChatId==='string'?body.externalChatId.trim().slice(0,240):'',objective=typeof body.objective==='string'?body.objective.trim().slice(0,4000):''
  if(!actorKey||!externalChatId||!objective)throw new Error('CYBORG_MISSION_CONTRACT_REQUIRED')
  const supplied=typeof body.missionId==='string'&&UUID.test(body.missionId)?body.missionId:null,baseRevision=Deno.env.get('DENO_DEPLOYMENT_ID')??'cyborg-admission-runtime'
  const admitted=await rpc<Array<{mission_id:string;chat_session_id:string;mission_revision:string;mission_state:string}>>('hq_cyborg_admit_chat_mission',{p_actor_key:actorKey,p_external_chat_id:externalChatId,p_supplied_mission_id:supplied,p_objective:objective,p_base_revision:baseRevision})
  const row=admitted?.[0];if(!row?.mission_id||!row?.chat_session_id)throw new Error('CYBORG_ADMISSION_CONTRACT_INVALID')
  const now=Math.floor(Date.now()/1000),invocationId=crypto.randomUUID(),nonce=crypto.randomUUID()
  if(sourceAuthorityKind==='service')sourceAuthorityRef=invocationId
  const claims:CapabilityClaims={version:'cyb1',missionId:row.mission_id,missionRevision:row.mission_revision,chatId:row.chat_session_id,invocationId,callerServiceId:caller,provider,model,operation,requestHash,riskClass:riskClass as CapabilityClaims['riskClass'],authorityScope:[],maxTokens,toolScope:[],dataClassification:(typeof body.dataClassification==='string'?body.dataClassification:'internal') as CapabilityClaims['dataClassification'],policyVersion:CYBORG_POLICY_VERSION,issuedAt:now,notBefore:now-2,expiresAt:now+60,nonce}
  const capability=await signCapability(claims,SIGNING_KEY),tokenHash=await hashValue(capability)
  await rpc('hq_cyborg_register_capability',{p_nonce:nonce,p_invocation_id:invocationId,p_mission_id:claims.missionId,p_chat_session_id:claims.chatId,p_mission_revision:claims.missionRevision,p_caller_service_id:caller,p_provider:provider,p_model:model,p_operation:operation,p_request_hash:requestHash,p_source_authority_kind:sourceAuthorityKind,p_source_authority_ref:sourceAuthorityRef,p_source_authority_token:sourceAuthorityToken,p_risk_class:riskClass,p_authority_scope:[],p_tool_scope:[],p_data_classification:claims.dataClassification,p_policy_version:CYBORG_POLICY_VERSION,p_max_tokens:maxTokens,p_token_hash:tokenHash,p_issued_at:new Date(claims.issuedAt*1000).toISOString(),p_not_before:new Date(claims.notBefore*1000).toISOString(),p_expires_at:new Date(claims.expiresAt*1000).toISOString()})
  return json({capability,missionId:claims.missionId,missionRevision:claims.missionRevision,chatId:claims.chatId,invocationId,expiresAt:claims.expiresAt,policyVersion:CYBORG_POLICY_VERSION})
}catch(error){const message=error instanceof Error?error.message:String(error);return json({error:message},message.includes('IDENTITY')?401:message.includes('MISMATCH')||message.includes('DENIED')||message.includes('APPROVAL')||message.includes('LEASE')||message.includes('STAGE')||message.includes('AUTHORITY')||message.includes('REQUIRED')?403:409)}})
