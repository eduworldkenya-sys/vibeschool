// Server-only Daily audio transport for the existing canonical Live classroom.
// No client may supply host identity, grant permissions or construct provider tokens.
export class LiveVoiceError extends Error {
  constructor(message: string, public status = 403) { super(message) }
}
export type VoiceRoom = {
  id: string; title: string; mode: 'school' | 'tuition' | 'homeschool' | 'open'
  teacher: boolean; status: 'active' | 'paused' | 'ended'; expiresAt: string
  participants?: Array<{ studentId: string; needsHelp: boolean }>
}
export const voiceUuid = (v: unknown): v is string =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
export const dailyVoiceName = (id: string) => 'vs-live-' + id
// Pilot admission is a separate, fail-closed boundary on top of canonical
// Live session authorization. No client-supplied ID can bypass it.
export function requireLiveVoicePilotUser(
  userId: string, scope: string | undefined, permittedIds: string | undefined,
  expiresAt: string | undefined, now = Date.now(), roomClosure = false
): void {
  if (scope !== 'pilot') throw new LiveVoiceError('Classroom voice is not commissioned.', 503)
  const ids = (permittedIds ?? '').split(',').map(id => id.trim()).filter(Boolean)
  if (!voiceUuid(userId) || !ids.length || ids.some(id => !voiceUuid(id)) || !ids.includes(userId)) {
    throw new LiveVoiceError('Classroom voice is limited to pilot accounts.', 403)
  }
  // Allow an authorized pilot teacher to clean up an ended room after timeout.
  if (!roomClosure) {
    const deadline = Date.parse(expiresAt ?? '')
    if (!Number.isFinite(deadline) || now >= deadline) {
      throw new LiveVoiceError('Classroom voice pilot has expired.', 503)
    }
  }
}
export function validateVoiceRoom(value: unknown, id: string, now = Date.now()): VoiceRoom {
  if (!voiceUuid(id) || !value || typeof value !== 'object') throw new LiveVoiceError('Invalid classroom.', 400)
  const room = value as Partial<VoiceRoom>
  if (room.id !== id || !['school','tuition','homeschool','open'].includes(room.mode ?? '') ||
      typeof room.teacher !== 'boolean' || !['active','paused','ended'].includes(room.status ?? '') ||
      typeof room.expiresAt !== 'string' || !Number.isFinite(Date.parse(room.expiresAt))) {
    throw new LiveVoiceError('Could not verify classroom access.', 403)
  }
  if (room.status !== 'active' || Date.parse(room.expiresAt) <= now + 10000) {
    throw new LiveVoiceError('Audio is available only during an active lesson.', 409)
  }
  return room as VoiceRoom
}
type DailyRequest = typeof fetch
const API = 'https://api.daily.co/v1/'
// The upstream API can reject an account credential or room properties.
// Do not print keys, meeting tokens, body, participant IDs or provider URLs.
// Only the operation name and HTTP status are logged for support.
// The Daily response "info" describes WHY creation failed. Log ONLY bounded,
// literal, allowlisted categories/field names. Never emit the raw response body,
// token, URL, user input, room name or unbounded provider message to logs.
export async function rejectDailyResponse(stage: 'room-lookup' | 'room-create' | 'room-token', response: Response): Promise<never> {
  const status = response.status
  const body: unknown = await response.json().catch(() => null)
  const provider = body && typeof body === 'object' && !Array.isArray(body)
    ? body as Record<string, unknown> : {}
  const code = typeof provider.error === 'string' && [
    'invalid-request-error', 'not-found', 'unauthorized', 'forbidden',
    'rate-limit-exceeded', 'invalid-token',
  ].includes(provider.error) ? provider.error : 'unknown'
  const info = typeof provider.info === 'string' ? provider.info.slice(0, 2000).toLowerCase() : ''
  const knownFields = [
    'enforce_unique_user_ids', 'eject_at_room_exp', 'max_participants',
    'enable_knocking', 'enable_screenshare', 'enable_chat',
    'enable_prejoin_ui', 'start_audio_off', 'start_video_off',
    'exp', 'privacy', 'name', 'properties',
  ]
  const field = knownFields.find(f => new RegExp('(^|[^a-z0-9_])' + f + '([^a-z0-9_]|$)').test(info)) ?? 'unspecified'
  const category =
    /\b(quota|capacity|maximum number|too many|limit reached|upgrade|plan)\b/.test(info) ? 'quota_or_plan'
      : /\b(invalid|unknown|unsupported|not recognized|not allowed)\b/.test(info) ? 'invalid_setting'
      : /\b(expi(red|ry|ration)|timestamp|date|too far)\b/.test(info) ? 'expiry'
      : /\b(already exists|duplicate|conflict)\b/.test(info) ? 'conflict'
      : /\b(missing|required)\b/.test(info) ? 'missing_field'
      : 'unspecified'
  console.error('vibeschool_live_voice_daily_failure', {stage, status, code, field, category})
  if (status === 401 || status === 403)
    throw new LiveVoiceError('Daily account authorization failed. Check the configured provider key.', 503)
  if (status === 400 || status === 422)
    throw new LiveVoiceError('Daily rejected the classroom audio settings. Provider configuration needs repair.', 503)
  if (status === 429)
    throw new LiveVoiceError('Daily has temporarily limited audio requests. Retry shortly.', 503)
  throw new LiveVoiceError('Daily voice service did not start. Retry.', 503)
}
function voiceSettings(exp: number) {
  return {
    exp, eject_at_room_exp: true, max_participants: 80,
    enforce_unique_user_ids: true, enable_knocking: false,
    enable_chat: false, enable_screenshare: false,
    enable_prejoin_ui: false, start_audio_off: true, start_video_off: true,
  }
}
function validProviderRoom(value: unknown, name: string, exp: number): value is { url: string } {
  if (!value || typeof value !== 'object') return false
  const room = value as Record<string, unknown>
  const config = room.config as Record<string, unknown> | undefined
  return room.name === name && room.privacy === 'private' &&
    typeof room.url === 'string' &&
    /^https:\/\/[a-z0-9-]+\.daily\.co\/vs-live-[0-9a-f-]+$/i.test(room.url) &&
    !!config && config.exp === exp && config.eject_at_room_exp === true &&
    config.max_participants === 80 && config.enforce_unique_user_ids === true &&
    config.enable_knocking === false && (config.enable_recording == null || config.enable_recording === false || config.enable_recording === '') &&
    config.enable_screenshare === false && config.enable_chat === false &&
    config.start_audio_off === true &&
    config.start_video_off === true && config.enable_prejoin_ui === false
}
export async function issueLiveVoiceToken(
  room: VoiceRoom, userId: string, learnerStudentId: string | null, key: string,
  request: DailyRequest = fetch, now = Date.now()
): Promise<{url:string;token:string;role:'teacher'|'learner';participantId:string;expiresAt:number}> {
  if (!key) throw new LiveVoiceError('Voice is not configured.', 503)
  if (!voiceUuid(userId) || (!room.teacher && !voiceUuid(learnerStudentId))) throw new LiveVoiceError('Unverified participant identity.', 403)
  const validated = validateVoiceRoom(room, room.id, now)
  const role = validated.teacher ? 'teacher' : 'learner'
  const participantId = validated.teacher ? userId : learnerStudentId!
  const roomName = dailyVoiceName(validated.id)
  const expiry = Math.floor(Date.parse(validated.expiresAt) / 1000)
  const properties = voiceSettings(expiry)
  const api = async (path: string, body?: unknown, method?: string) => {
    try {
      return await request(API + path, {
        method: method ?? (body === undefined ? 'GET' : 'POST'),
        headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : {body:JSON.stringify(body)}),
        redirect:'error',cache:'no-store',signal:AbortSignal.timeout(12000),
      })
    } catch { throw new LiveVoiceError('Voice provider temporarily unavailable.',503) }
  }
  let response = await api('rooms/' + roomName)
  if (response.status === 404) {
    response = await api('rooms',{ name:roomName, privacy:'private',properties })
    // Only an actual concurrent-create conflict warrants re-reading the room.
    // An HTTP 400 means invalid settings, never a successful racing create.
    if (response.status === 409) response = await api('rooms/' + roomName)
    if (!response.ok) await rejectDailyResponse('room-create', response)
  } else if (!response.ok) {
    await rejectDailyResponse('room-lookup', response)
  }
  let providerRoom: unknown
  try { providerRoom = await response.json() } catch { throw new LiveVoiceError('Invalid voice provider response.',503) }
  if (!validProviderRoom(providerRoom,roomName,expiry)) throw new LiveVoiceError('Voice-room privacy verification failed.',503)
  // A privileged teacher token can moderate, but learners are media-server
  // receive-only. A teacher can grant audio to ONE learner after a raised hand.
  const canSend = role === 'teacher' ? ['audio'] : false
  const canAdmin = role === 'teacher' ? ['participants'] : false
  const tokenResponse = await api('meeting-tokens',{properties:{
    room_name:roomName,user_id:participantId,
    user_name:role === 'teacher' ? 'Teacher' : 'Learner',
    is_owner:false, // only participant admin; never a full owner with recording/transcription powers
    exp:Math.min(Math.floor(now/1000)+120,expiry),
    eject_at_token_exp:true, // server ejects even if teacher, browser or watchdog is offline
    start_audio_off:true,start_video_off:true,
    enable_recording_ui:false,start_cloud_recording:false,
    enable_prejoin_ui:false,enable_screenshare:false,
    permissions:{canSend,canAdmin,canReceive:{base:{audio:true,video:false,screenAudio:false,screenVideo:false,customAudio:{'*':false},customVideo:{'*':false}}}},
  }})
  if (!tokenResponse.ok) await rejectDailyResponse('room-token',tokenResponse)
  const responseData = await tokenResponse.json().catch(()=>null) as {token?:unknown}|null
  if (typeof responseData?.token !== 'string' || !responseData.token) throw new LiveVoiceError('Invalid audio authorization.',503)
  return { url:providerRoom.url, token:responseData.token, role, participantId,
    expiresAt:Math.min(Math.floor(now/1000)+120,expiry) }
}
export async function closeLiveVoiceRoom(sessionId: string,key: string,request:DailyRequest=fetch) {
  if (!voiceUuid(sessionId) || !key) throw new LiveVoiceError('Invalid voice-room closure.',400)
  const response = await request(API+'rooms/'+dailyVoiceName(sessionId),{
    method:'DELETE',headers:{Authorization:'Bearer '+key},cache:'no-store',redirect:'error',
    signal:AbortSignal.timeout(12000),
  })
  if (!response.ok && response.status!==404) throw new LiveVoiceError('Could not close media room.',503)
}
