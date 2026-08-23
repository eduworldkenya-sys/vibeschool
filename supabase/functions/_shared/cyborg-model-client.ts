import { receiptHash } from './cyborg-capability.ts'

const SUPABASE_URL=Deno.env.get('SUPABASE_URL')??''
const SERVICE_ROLE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??''
const ADMISSION_URL=Deno.env.get('CYBORG_ADMISSION_URL')??`${SUPABASE_URL}/functions/v1/cyborg-admission`
const GATEWAY_URL=Deno.env.get('CYBORG_LLM_GATEWAY_URL')??`${SUPABASE_URL}/functions/v1/cyborg-llm-gateway`

export type EdgeCyborgInput={
  callerServiceId:string
  actorKey:string
  externalChatId:string
  objective:string
  missionId?:string
  provider:'groq'|'anthropic'|string
  model:string
  maxTokens:number
  messages:unknown[]
  metadata?:Record<string,unknown>
  dataClassification?:'public'|'internal'|'confidential'|'restricted'
}
export type EdgeCyborgResult={missionId:string;missionRevision:string;chatId:string;invocationId:string;output:unknown;lineage:Record<string,unknown>}

export async function invokeCyborgEdgeModel(input:EdgeCyborgInput):Promise<EdgeCyborgResult>{
  if(!SUPABASE_URL||!SERVICE_ROLE) throw new Error('CYBORG_ADMISSION_SERVICE_IDENTITY_REQUIRED')
  const admissionResponse=await fetch(ADMISSION_URL,{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${SERVICE_ROLE}`,'x-cyborg-caller-id':input.callerServiceId},body:JSON.stringify({actorKey:input.actorKey,externalChatId:input.externalChatId,objective:input.objective,missionId:input.missionId,callerServiceId:input.callerServiceId,provider:input.provider,model:input.model,operation:'model.generate',maxTokens:input.maxTokens,riskClass:'read',dataClassification:input.dataClassification??'internal',authorityScope:[],toolScope:[]})})
  const admission=await admissionResponse.json().catch(()=>({})) as Record<string,unknown>
  if(!admissionResponse.ok) throw new Error(`CYBORG_ADMISSION_FAILED:${String(admission.error??admissionResponse.status)}`)
  const capability=typeof admission.capability==='string'?admission.capability:''
  const missionId=typeof admission.missionId==='string'?admission.missionId:''
  const missionRevision=typeof admission.missionRevision==='string'?admission.missionRevision:''
  const chatId=typeof admission.chatId==='string'?admission.chatId:''
  const invocationId=typeof admission.invocationId==='string'?admission.invocationId:''
  if(!capability||!missionId||!missionRevision||!chatId||!invocationId) throw new Error('CYBORG_ADMISSION_CONTRACT_INVALID')
  const gatewayResponse=await fetch(GATEWAY_URL,{method:'POST',headers:{'content-type':'application/json','authorization':`Cyborg ${capability}`,'x-cyborg-caller-id':input.callerServiceId},body:JSON.stringify({missionId,missionRevision,chatId,invocationId,callerServiceId:input.callerServiceId,provider:input.provider,model:input.model,operation:'model.generate',maxTokens:input.maxTokens,messages:input.messages,metadata:input.metadata??{}})})
  const payload=await gatewayResponse.json().catch(()=>({})) as Record<string,unknown>
  if(!gatewayResponse.ok) throw new Error(`CYBORG_GATEWAY_FAILED:${String(payload.error??gatewayResponse.status)}`)
  const lineage=payload.lineage&&typeof payload.lineage==='object'&&!Array.isArray(payload.lineage)?payload.lineage as Record<string,unknown>:null
  if(!lineage||lineage.lineageVerified!==true||lineage.policyDecision!=='ALLOW'||typeof lineage.receiptHash!=='string') throw new Error('CYBORG_LINEAGE_REQUIRED')
  const {receiptHash:stored,lineageVerified:_verified,...unsigned}=lineage
  if(await receiptHash(unsigned)!==stored) throw new Error('CYBORG_LINEAGE_HASH_MISMATCH')
  const envelope=payload.output&&typeof payload.output==='object'&&!Array.isArray(payload.output)?payload.output as Record<string,unknown>:null
  return {missionId,missionRevision,chatId,invocationId,output:envelope?.output,lineage}
}

export function groqText(output:unknown):string{
  if(!output||typeof output!=='object'||Array.isArray(output)) return ''
  const choices=Array.isArray((output as Record<string,unknown>).choices)?(output as Record<string,unknown>).choices as unknown[]:[]
  const first=choices[0]&&typeof choices[0]==='object'&&!Array.isArray(choices[0])?choices[0] as Record<string,unknown>:null
  const message=first?.message&&typeof first.message==='object'&&!Array.isArray(first.message)?first.message as Record<string,unknown>:null
  return typeof message?.content==='string'?message.content.trim():''
}
export function anthropicText(output:unknown):string{
  if(!output||typeof output!=='object'||Array.isArray(output)) return ''
  const content=Array.isArray((output as Record<string,unknown>).content)?(output as Record<string,unknown>).content as unknown[]:[]
  return content.flatMap(item=>item&&typeof item==='object'&&!Array.isArray(item)&&typeof (item as Record<string,unknown>).text==='string'?[(item as Record<string,unknown>).text as string]:[]).join('').trim()
}
