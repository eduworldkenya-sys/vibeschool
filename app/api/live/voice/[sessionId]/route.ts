import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { closeLiveVoiceRoom, issueLiveVoiceToken, LiveVoiceError, requireLiveVoicePilotUser, validateVoiceRoom, voiceUuid, type VoiceRoom } from '@/lib/live/voice'

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
async function handle(req:NextRequest,id:string,method:'POST'|'DELETE') {
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
    // Owner-authorized two-account pilot: no other authenticated classroom
    // member can obtain a Daily token, even when the UI flag is enabled.
    // Closing an already-ended media room remains possible after pilot expiry.
    requireLiveVoicePilotUser(user.id,
      process.env.VIBE_LIVE_VOICE_ACCESS_SCOPE,
      process.env.VIBE_LIVE_VOICE_PILOT_USER_IDS,
      process.env.VIBE_LIVE_VOICE_PILOT_UNTIL,
      Date.now(),method==='DELETE')
    const supplied=method==='POST'?await req.json().catch(()=>null):null
    const rawClassId=(supplied as {classId?:unknown}|null)?.classId
    if (method==='POST' && rawClassId!==null && rawClassId!==undefined && !voiceUuid(rawClassId))
      throw new LiveVoiceError('Invalid classroom context.',400)
    // A session UUID is not a permission. Always authorize through the same
    // Live RPC used by the whiteboard, roster and learner participation.
    const {data,error}=await db.rpc('vibe_live_command',{
      p_action:'get',p_class_id:method==='POST' ? rawClassId ?? null : null,
      p_session_id:id,p_version:null,p_payload:{},
    })
    if (error || !data || typeof data !== 'object' || data.id!==id)
      throw new LiveVoiceError('You are not authorized for this Live class.',403)
    const room=data as VoiceRoom
    const key=process.env.DAILY_API_KEY ?? ''
    if (!key) throw new LiveVoiceError('Voice provider not configured.',503)
    if (method==='DELETE') {
      if (!room.teacher || room.status!=='ended')
        throw new LiveVoiceError('Only a teacher can close an ended voice room.',403)
      await closeLiveVoiceRoom(id,key)
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
    const result=await issueLiveVoiceToken(room,user.id,learnerStudentId,key)
    return reply(result)
  } catch (e) {
    return e instanceof LiveVoiceError ? reply({error:e.message},e.status)
      : reply({error:'Voice connection unavailable. Retry.'},503)
  }
}
export const POST=(req:NextRequest,props:{params:Promise<{sessionId:string}>})=>
  props.params.then(({sessionId})=>handle(req,sessionId,'POST'))
export const DELETE=(req:NextRequest,props:{params:Promise<{sessionId:string}>})=>
  props.params.then(({sessionId})=>handle(req,sessionId,'DELETE'))
