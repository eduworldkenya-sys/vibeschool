import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { availableLesson, createVideoSession, validLessonId, VideoError, videoRole, sameVideoOrigin } from '@/lib/vibetutor/video';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: {
    'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
  } });
}
async function handle(req: NextRequest, id: string, join: boolean) {
  try {
    if (!validLessonId(id)) throw new VideoError('Invalid lesson.', 400);
    if (join && !sameVideoOrigin(req.headers.get('origin'), req.headers.get('host'))) throw new VideoError('Open the lesson from VibeSchool.', 403);
    const authorization = req.headers.get('authorization') ?? '';
    if (!/^Bearer \S+$/.test(authorization)) throw new VideoError('Sign in to join this lesson.', 401);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) throw new VideoError('Lesson access is temporarily unavailable.', 503);
    // Use the participant JWT for every RPC. No privileged table access or service key.
    const db = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authorization } },
    });
    const { data: { user }, error } = await db.auth.getUser(authorization.slice(7));
    if (error || !user) throw new VideoError('Sign in to join this lesson.', 401);
    const { data: authority, error: authorityError } = await db.rpc('get_my_auth_access_state');
    if (authorityError) throw new VideoError('Could not check account access.', 503);
    const role = videoRole(authority);
    // Canonical RPC only returns lessons for accepted invitations belonging to this JWT.
    // Pending guardian approval and revoked invitations never grant a room/token.
    const { data: rows, error: lessonError } = await db.rpc('vibetutor_my_lessons');
    if (lessonError) throw new VideoError('Could not check lesson access.', 503);
    let lesson;
    try {
      lesson = availableLesson(rows, id);
    } catch (error) {
      // The authenticated account role remains known even when a lesson has
      // ended. Return it so the classroom can navigate to the correct OS.
      if (error instanceof VideoError) return json({ error: error.message, role, userId: user.id }, error.status);
      throw error;
    }
    if (!join) return json({ lesson, role, userId: user.id });
    const session = await createVideoSession(lesson, user.id, role, process.env.DAILY_API_KEY ?? '');
    return json({ ...session, lesson, role, userId: user.id });
  } catch (error) {
    // Provider responses and credentials must never enter logs or browser errors.
    return error instanceof VideoError ? json({ error: error.message }, error.status)
      : json({ error: 'Video is temporarily unavailable. Please retry.' }, 503);
  }
}
export const GET = (req: NextRequest, { params }: { params: { lessonId: string } }) => handle(req, params.lessonId, false);
export const POST = (req: NextRequest, { params }: { params: { lessonId: string } }) => handle(req, params.lessonId, true);
