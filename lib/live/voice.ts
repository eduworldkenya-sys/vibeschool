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
function voiceSettings(exp: number) {
  return {
    exp, eject_at_room_exp: true, max_participants: 80,
    enforce_unique_user_ids: true, enable_knocking: false,
    enable_recording: false, enable_chat: false, enable_screenshare: false,
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
    config.enable_knocking === false && [false,''].includes(config.enable_recording as false | '') &&
    config.enable_screenshare === false && config.enable_chat === false
}
export async function issueLiveVoiceToken(
  room: VoiceRoom, userId: string, learnerStudentId: string | null, key: string,
  request: DailyRequest = fetch, now = Date.now()
): Promise<{url:string;token:string;role:'teacher'|'learner';participantId:string}> {
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
    if ([400,409].includes(response.status)) response = await api('rooms/' + roomName)
  }
  if (!response.ok) throw new LiveVoiceError('Could not start voice. Retry.',503)
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
    is_owner:role === 'teacher',
    exp:Math.min(Math.floor(now/1000)+120,expiry),
    start_audio_off:true,start_video_off:true,
    enable_recording:false,enable_recording_ui:false,start_cloud_recording:false,
    enable_prejoin_ui:false,enable_screenshare:false,
    permissions:{canSend,canAdmin,canReceive:{base:{audio:true,video:false,screenAudio:false,screenVideo:false,customAudio:{'*':false},customVideo:{'*':false}}}},
  }})
  if (!tokenResponse.ok) throw new LiveVoiceError('Could not authorize voice.',503)
  const responseData = await tokenResponse.json().catch(()=>null) as {token?:unknown}|null
  if (typeof responseData?.token !== 'string' || !responseData.token) throw new LiveVoiceError('Invalid audio authorization.',503)
  return { url:providerRoom.url, token:responseData.token, role, participantId }
}
export async function closeLiveVoiceRoom(sessionId: string,key: string,request:DailyRequest=fetch) {
  if (!voiceUuid(sessionId) || !key) throw new LiveVoiceError('Invalid voice-room closure.',400)
  const response = await request(API+'rooms/'+dailyVoiceName(sessionId),{
    method:'DELETE',headers:{Authorization:'Bearer '+key},cache:'no-store',redirect:'error',
    signal:AbortSignal.timeout(12000),
  })
  if (!response.ok && response.status!==404) throw new LiveVoiceError('Could not close media room.',503)
}
