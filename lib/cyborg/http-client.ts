import { hashCyborgModelRequest } from './capability';
import { CyborgAdmittedResponse, CyborgInvocationLineage, assertCyborgResponseAdmission } from './lineage';

export interface CyborgBoundaryInvocationInput {
  actorKey:string; externalChatId:string; objective:string; missionId?:string; callerServiceId:string; provider:string; model:string; operation?:string; maxTokens:number; messages:unknown[];
  metadata?:Record<string,unknown>; riskClass?:'read'|'local_mutation'|'remote_mutation'|'production_mutation'|'owner_only'; dataClassification?:'public'|'internal'|'confidential'|'restricted'; authorityScope?:string[]; toolScope?:string[];
}
export interface CyborgBoundaryInvocationResult { missionId:string; missionRevision:string; chatId:string; invocationId:string; provider:string; model:string; output:unknown; usage?:Record<string,number>; lineage:CyborgInvocationLineage }
function boundaryUrls(){const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/,'');const admission=process.env.CYBORG_ADMISSION_URL||(supabaseUrl?`${supabaseUrl}/functions/v1/cyborg-admission`:'');const gateway=process.env.CYBORG_LLM_GATEWAY_URL||(supabaseUrl?`${supabaseUrl}/functions/v1/cyborg-llm-gateway`:'');if(!admission||!gateway)throw new Error('CYBORG_BOUNDARY_URL_REQUIRED');return{admission,gateway}}
export async function invokeCyborgBoundary(input:CyborgBoundaryInvocationInput):Promise<CyborgBoundaryInvocationResult>{
  const serviceRole=process.env.SUPABASE_SERVICE_ROLE_KEY??'';if(!serviceRole)throw new Error('CYBORG_ADMISSION_SERVICE_IDENTITY_REQUIRED')
  const urls=boundaryUrls();const operation=input.operation??'model.generate';const metadata=input.metadata??{}
  const requestHash=await hashCyborgModelRequest({callerServiceId:input.callerServiceId,provider:input.provider,model:input.model,operation,maxTokens:input.maxTokens,messages:input.messages,metadata})
  const admissionResponse=await fetch(urls.admission,{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${serviceRole}`,'x-cyborg-caller-id':input.callerServiceId},body:JSON.stringify({actorKey:input.actorKey,externalChatId:input.externalChatId,objective:input.objective,missionId:input.missionId,callerServiceId:input.callerServiceId,provider:input.provider,model:input.model,operation,requestHash,maxTokens:input.maxTokens,riskClass:input.riskClass??'read',dataClassification:input.dataClassification??'internal',authorityScope:input.authorityScope??[],toolScope:input.toolScope??[]})})
  const admission=await admissionResponse.json().catch(()=>({})) as Record<string,unknown>;if(!admissionResponse.ok)throw new Error(`CYBORG_ADMISSION_FAILED:${String(admission.error??admissionResponse.status)}`)
  const capability=typeof admission.capability==='string'?admission.capability:'';const missionId=typeof admission.missionId==='string'?admission.missionId:'';const missionRevision=typeof admission.missionRevision==='string'?admission.missionRevision:'';const chatId=typeof admission.chatId==='string'?admission.chatId:'';const invocationId=typeof admission.invocationId==='string'?admission.invocationId:''
  if(!capability||!missionId||!missionRevision||!chatId||!invocationId)throw new Error('CYBORG_ADMISSION_CONTRACT_INVALID')
  const gatewayResponse=await fetch(urls.gateway,{method:'POST',headers:{'content-type':'application/json','authorization':`Cyborg ${capability}`,'x-cyborg-caller-id':input.callerServiceId},body:JSON.stringify({missionId,missionRevision,chatId,invocationId,callerServiceId:input.callerServiceId,provider:input.provider,model:input.model,operation,maxTokens:input.maxTokens,messages:input.messages,metadata})})
  const raw=await gatewayResponse.json().catch(()=>({})) as Record<string,unknown>;if(!gatewayResponse.ok)throw new Error(`CYBORG_GATEWAY_FAILED:${String(raw.error??gatewayResponse.status)}`)
  if(!raw.output||typeof raw.output!=='object'||Array.isArray(raw.output)||!raw.lineage||typeof raw.lineage!=='object'||Array.isArray(raw.lineage))throw new Error('CYBORG_GATEWAY_RESPONSE_INVALID')
  const outputRow=raw.output as Record<string,unknown>,provider=typeof outputRow.provider==='string'?outputRow.provider:'',model=typeof outputRow.model==='string'?outputRow.model:''
  if(!provider||!model)throw new Error('CYBORG_GATEWAY_RESPONSE_INVALID')
  const usage=outputRow.usage&&typeof outputRow.usage==='object'&&!Array.isArray(outputRow.usage)?outputRow.usage as Record<string,number>:undefined
  const admitted=await assertCyborgResponseAdmission({output:{provider,model,output:outputRow.output,usage},lineage:raw.lineage as CyborgInvocationLineage} satisfies CyborgAdmittedResponse<{provider:string;model:string;output:unknown;usage?:Record<string,number>}>)
  return{missionId,missionRevision,chatId,invocationId,provider:admitted.output.provider,model:admitted.output.model,output:admitted.output.output,usage:admitted.output.usage,lineage:admitted.lineage}
}
