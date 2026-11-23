import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { closeLiveVoiceRoom, issueLiveVoiceToken, LiveVoiceError, requireLiveVoiceAccessUser, validateVoiceRoom, voiceUuid, type VoiceRoom } from '@/lib/live/voice'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const reply = (value: unknown, status = 200) => NextResponse.json(value, {
  status,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}
})
function sameOrigin(req:NextRequest) {
  const origin = req.headers.get('origin'), host = req.headers.get('host')
  if (!origin || !host) return false
  try {const u=new URL(origin);return origin===u.origin && u.protocol==='https:' && u.host===host}
  catch{return false}
}
const voiceStages=new Set(['joining','signaling','media','connected','unknown'])
const voiceCodes=new Set([
  'ejected','nbf-room','nbf-token','exp-room','exp-token','no-room',
  'meeting-full','end-of-life','not-allowed','connection-error',
  'join-exception','unexpected-leave','device-error','unknown'
])
const voiceHints=new Set(['token','access','capacity','device','room','transport','timeout','unknown'])
// Failure telemetry is deliberately closed vocabulary: no room ID, user ID,
// request body, error message, provider URL, token or browser error text.
function voiceFailureCategory(error:unknown):'scope'|'scope_expired'|'identity'|'class_authorization'|'room_inactive'|'provider'|'configuration'|'other' {
  if (!(error instanceof LiveVoiceError)) return 'other'
  switch(error.message) {
    case 'Classroom voice is limited to pilot accounts.':
    case 'Classroom voice is not commissioned.': return 'scope'
    case 'Classroom voice pilot has expired.': return 'scope_expired'
    case 'Sign in to use voice.':
    case 'Unverified voice participant.':
    case 'Your learner identity could not be verified for voice.': return 'identity'
    case 'You are not authorized for this Live class.':
    case 'Could not verify classroom access.': return 'class_authorization'
    case 'Audio is available only during an active lesson.': return 'room_inactive'
    case 'Voice is not active yet.':
    case 'Voice provider not configured.':
    case 'Voice authorization unavailable.': return 'configuration'
    default: return error.message.startsWith('Daily ') ||
      error.message.startsWith('Voice provider ') ||
      error.message.startsWith('Voice-room ')
        ? 'provider' : 'other'
  }
}
function parseVoiceDiagnostic(value:unknown) {
  if(!value || typeof value!=='object' || Array.isArray(value))throw new LiveVoiceError('Invalid voice diagnostic.',400)
  const obj=value as Record<string,unknown>
  if(Object.keys(obj).some(k=>!['stage','code','hint'].includes(k)) ||
     !voiceStages.has(obj.stage as string) || !voiceCodes.has(obj.code as string) ||
     !voiceHints.has(obj.hint as string))
    throw new LiveVoiceError('Invalid voice diagnostic.',400)
  return {stage:obj.stage as string,code:obj.code as string,hint:obj.hint as string}
}
async function handle(req:NextRequest,id:string,method:'POST'|'DELETE'|'PATCH') {
  try {
    // No activation from a browser build or a checked-in default. Both
    // switches require explicit production commissioning.
    if (process.env.VIBE_LIVE_VOICE_SERVER_ENABLED !== 'true' ||
        process.env.NEXT_PUBLIC_VIBE_LIVE_VOICE_ENABLED !== 'true')
      throw new LiveVoiceError('Voice is not active yet.',503)
    if (!voiceUuid(id)) throw new LiveVoiceError('Invalid Live session.',400)
    if (!sameOrigin(req)) throw new LiveVoiceError('Open voice from VibeSchool Live.',403)
    const authorization=req.headers.get('authorization') ?? ''
    if (!/^Bearer \S+$/.test(authorization)) throw new LiveVoiceError('Sign in to use voice.',401)
    const url=process.env.NEXT_PUBLIC_SUPABASE_URL,anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url||!anon) throw new LiveVoiceError('Voice authorization unavailable.',503)
    const db=createClient(url,anon,{
      auth:{persistSession:false,autoRefreshToken:false},
      global:{headers:{Authorization:authorization}},
    })
    const {data:{user},error:userError}=await db.auth.getUser(authorization.slice(7))
    if (userError||!user) throw new LiveVoiceError('Sign in to use voice.',401)
    // The rollout scope is independent of real JWT + canonical Live admission.
    // Neither a shared URL nor the 'all' scope bypasses classroom membership.
    const accessScope = requireLiveVoiceAccessUser(user.id,
      process.env.VIBE_LIVE_VOICE_ACCESS_SCOPE,
      process.env.VIBE_LIVE_VOICE_PILOT_USER_IDS,
      process.env.VIBE_LIVE_VOICE_PILOT_UNTIL,
      Date.now(),method==='DELETE')
    // PATCH is a bounded authenticated diagnostic, never a token request.
    const raw=method==='PATCH' ? await req.text() : null
    if(raw!==null && raw.length>450)throw new LiveVoiceError('Invalid voice diagnostic.',400)
    const supplied=method==='DELETE'?null:method==='PATCH'
      ? (()=>{try{return JSON.parse(raw??'')}catch{return null}})()
      : await req.json().catch(()=>null)
    const rawClassId=(supplied as {classId?:unknown}|null)?.classId
    if (method!=='DELETE' && rawClassId!==null && rawClassId!==undefined && !voiceUuid(rawClassId))
      throw new LiveVoiceError('Invalid classroom context.',400)
    // A session UUID is not a permission. Always authorize through the same
    // Live RPC used by the whiteboard, roster and learner participation.
    const {data,error}=await db.rpc('vibe_live_command',{
      p_action:'get',p_class_id:method==='DELETE'?null:rawClassId ?? null,
      p_session_id:id,p_version:null,p_payload:{},
    })
    if (error || !data || typeof data !== 'object' || data.id!==id)
      throw new LiveVoiceError('You are not authorized for this Live class.',403)
    const room=data as VoiceRoom
    if(method==='PATCH'){
      // Reuse the token route's JWT, same-origin, rollout and canonical Live
      // RPC checks. Log only closed enum values. No room, user or token fields.
      validateVoiceRoom(room,id)
      const diagnostic=parseVoiceDiagnostic((supplied as {diagnostic?:unknown}|null)?.diagnostic)
      console.error('vibeschool_live_voice_client_failure',diagnostic)
      return reply({accepted:true},202)
    }
    const key=process.env.DAILY_API_KEY ?? ''
    if (!key) throw new LiveVoiceError('Voice provider not configured.',503)
    if (method==='DELETE') {
      if (!room.teacher || room.status!=='ended')
        throw new LiveVoiceError('Only a teacher can close an ended voice room.',403)
      // Close both room generations at class end so a migrated pilot user
      // is not left transmitting on a legacy private audio room.
      if (accessScope === 'all') {
        const results = await Promise.allSettled([
          closeLiveVoiceRoom(id,key,fetch,'all'),
          closeLiveVoiceRoom(id,key,fetch,'pilot'),
        ])
        if (results.some(result => result.status === 'rejected'))
          throw new LiveVoiceError('Could not close every voice room.',503)
      } else await closeLiveVoiceRoom(id,key)
      return reply({closed:true})
    }
    validateVoiceRoom(room,id)
    let learnerStudentId:string|null=null
    if (!room.teacher) {
      // Resolve only the authenticated user's own learner identity. Never
      // accept a profile/student ID chosen by the browser.
      const {data:students,error:studentError}=await db.from('students').select('id')
        .eq('profile_id',user.id).is('deleted_at',null).limit(2)
      if (studentError || !Array.isArray(students) || students.length!==1 || !voiceUuid(students[0]?.id))
        throw new LiveVoiceError('Your learner identity could not be verified for voice.',403)
      learnerStudentId=students[0].id
    }
    const result=await issueLiveVoiceToken(room,user.id,learnerStudentId,key,fetch,Date.now(),accessScope)
    return reply(result)
  } catch (e) {
    // Diagnostics for denials before Daily has initialized. PATCH cannot log
    // these cases because it is guarded by the very same access checks.
    if (method === 'POST') console.error('vibeschool_live_voice_request_failure', {
      category: voiceFailureCategory(e),
      status: e instanceof LiveVoiceError ? e.status : 503,
    })
    return e instanceof LiveVoiceError ? reply({error:e.message},e.status)
      : reply({error:'Voice connection unavailable. Retry.'},503)
  }
}
export const POST=(req:NextRequest,props:{params:Promise<{sessionId:string}>})=>
  props.params.then(({sessionId})=>handle(req,sessionId,'POST'))
export const DELETE=(req:NextRequest,props:{params:Promise<{sessionId:string}>})=>
  props.params.then(({sessionId})=>handle(req,sessionId,'DELETE'))

export const PATCH=(req:NextRequest,props:{params:Promise<{sessionId:string}>})=>
  props.params.then(({sessionId})=>handle(req,sessionId,'PATCH'))
