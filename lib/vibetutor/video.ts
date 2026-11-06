// Server-side video policy. Never import this module into a client component.
export type VideoLesson = { id: string; title: string; starts_at: string; ends_at: string; status: string };
export class VideoError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export const validLessonId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
export function sameVideoOrigin(origin: string | null, host: string | null): boolean {
  if (!origin || !host) return false;
  try {
    const url = new URL(origin);
    return url.origin === origin && url.host === host && ['https:', 'http:'].includes(url.protocol);
  } catch { return false; }
}
export function availableLesson(rows: unknown, id: string, now = Date.now()): VideoLesson {
  if (!validLessonId(id)) throw new VideoError('Invalid lesson.', 400);
  if (!Array.isArray(rows)) throw new VideoError('Could not check lesson access.', 503);
  const row = rows.find((r: unknown) => typeof r === 'object' && r !== null && 'id' in r && r.id === id);
  if (!row || typeof row.title !== 'string' || typeof row.starts_at !== 'string' || typeof row.ends_at !== 'string') {
    throw new VideoError('This lesson is unavailable for your account.', 403);
  }
  if (row.status !== 'scheduled') throw new VideoError('This lesson is no longer scheduled.', 403);
  const start = Date.parse(row.starts_at), end = Date.parse(row.ends_at);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 3 * 60 * 60 * 1000) {
    throw new VideoError('Invalid lesson time.', 403);
  }
  if (now < start - 15 * 60000) throw new VideoError('Join opens 15 minutes before the lesson.', 409);
  if (now >= end + 15 * 60000) throw new VideoError('This lesson has ended.', 410);
  return { id: row.id, title: row.title, starts_at: row.starts_at, ends_at: row.ends_at, status: row.status };
}
export function videoRole(value: unknown): 'teacher' | 'student' {
  if (!value || typeof value !== 'object' || !('role' in value) ||
      (value.role !== 'teacher' && value.role !== 'student') ||
      !('account_status' in value) || value.account_status !== 'active' ||
      !('is_anonymized' in value) || value.is_anonymized !== false) {
    throw new VideoError('An active tutor or student account is required.', 403);
  }
  return value.role;
}
export async function createVideoSession(lesson: VideoLesson, userId: string, role: 'teacher' | 'student', key: string, request: typeof fetch = fetch, now = Date.now()) {
  if (!key) throw new VideoError('Video lessons are not available yet.', 503);
  const name = 'vs-' + lesson.id;
  const expiry = Math.floor(Date.parse(lesson.ends_at) / 1000) + 15 * 60;
  const properties = {
    nbf: Math.floor(Date.parse(lesson.starts_at) / 1000) - 15 * 60,
    exp: expiry, eject_at_room_exp: true, max_participants: 2,
    enforce_unique_user_ids: true, enable_knocking: false, enable_recording: false,
    enable_prejoin_ui: true, enable_screenshare: true, enable_chat: false,
  };
  async function api(path: string, body?: unknown) {
    return request('https://api.daily.co/v1/' + path, {
      method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(12000),
    });
  }
  let response = await api('rooms/' + name);
  if (response.status === 404) {
    response = await api('rooms', { name, privacy: 'private', properties });
    // A simultaneous join may create the same room first. Read and validate it.
    if (response.status === 400 || response.status === 409) response = await api('rooms/' + name);
  }
  if (!response.ok) throw new VideoError('Could not open the classroom. Please retry.', 503);
  const room = await response.json();
  if (room.name !== name || room.privacy !== 'private' ||
      room.config?.exp !== expiry || room.config?.max_participants !== 2 ||
      room.config?.eject_at_room_exp !== true || room.config?.enable_knocking !== false ||
      room.config?.enforce_unique_user_ids !== true || ![false, ''].includes(room.config?.enable_recording) ||
      typeof room.url !== 'string' || !/^https:\/\/[a-z0-9-]+\.daily\.co\/vs-[0-9a-f-]+$/.test(room.url)) {
    throw new VideoError('Classroom privacy settings could not be verified.', 503);
  }
  const tokenResponse = await api('meeting-tokens', { properties: {
    room_name: name, user_id: userId, user_name: role === 'teacher' ? 'Tutor' : 'Student',
    is_owner: false, exp: Math.min(Math.floor(now / 1000) + 120, expiry),
    enable_recording: false, enable_recording_ui: false, start_cloud_recording: false,
    auto_start_transcription: false, enable_prejoin_ui: true,
  } });
  if (!tokenResponse.ok) throw new VideoError('Could not join the classroom. Please retry.', 503);
  const { token } = await tokenResponse.json();
  if (typeof token !== 'string' || !token) throw new VideoError('Could not join the classroom. Please retry.', 503);
  return { url: room.url as string, token };
}
