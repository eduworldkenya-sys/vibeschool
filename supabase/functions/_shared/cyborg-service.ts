const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

export function requireServiceConfiguration() { if(!SUPABASE_URL||!SERVICE_ROLE) throw new Error('CYBORG_SERVICE_CONFIGURATION_REQUIRED') }
export function requireServiceCaller(req:Request, callerId:string) {
  requireServiceConfiguration()
  const auth=req.headers.get('authorization')??''
  if(auth!==`Bearer ${SERVICE_ROLE}`) throw new Error('CYBORG_SERVICE_IDENTITY_REQUIRED')
  if((req.headers.get('x-cyborg-caller-id')??'')!==callerId) throw new Error('CYBORG_CALLER_IDENTITY_MISMATCH')
}
export async function rpc<T=unknown>(name:string, body:Record<string,unknown>):Promise<T> {
  requireServiceConfiguration()
  const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`,{method:'POST',headers:{'content-type':'application/json','apikey':SERVICE_ROLE,'authorization':`Bearer ${SERVICE_ROLE}`},body:JSON.stringify(body)})
  const payload=await response.json().catch(()=>null)
  if(!response.ok){ const message=payload&&typeof payload==='object'&&'message'in payload?String((payload as Record<string,unknown>).message):`${name}:${response.status}`; throw new Error(message) }
  return payload as T
}
export async function latestReceipt(missionId:string):Promise<string|undefined> {
  requireServiceConfiguration()
  const url=`${SUPABASE_URL}/rest/v1/hq_cyborg_model_responses?select=receipt_hash&mission_id=eq.${encodeURIComponent(missionId)}&order=created_at.desc&limit=1`
  const response=await fetch(url,{headers:{'apikey':SERVICE_ROLE,'authorization':`Bearer ${SERVICE_ROLE}`}})
  if(!response.ok) return undefined
  const rows=await response.json().catch(()=>[]) as Array<{receipt_hash?:string}>
  return typeof rows?.[0]?.receipt_hash==='string'?rows[0].receipt_hash:undefined
}
export async function recordBoundaryEvent(code:string,severity:'info'|'warning'|'high'|'critical',missionId?:string,invocationId?:string,details:Record<string,unknown>={}) {
  try { await rpc('hq_cyborg_record_boundary_event',{p_event_code:code,p_severity:severity,p_mission_id:missionId??null,p_invocation_id:invocationId??null,p_details:details}) } catch { /* evidence logging must never authorize a failed call */ }
}
