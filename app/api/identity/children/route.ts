import { NextRequest, NextResponse } from 'next/server'
import { identityClient } from '@/lib/identity/server'
import { validSameOriginMutation } from '@/lib/identity/origin'
import { validateUsername } from '@/lib/identity/username'
const noStore = { 'Cache-Control': 'private, no-store' }

export async function POST(request: NextRequest) {
  if (!validSameOriginMutation(request)) return NextResponse.json({ error: 'Request origin rejected' }, { status: 403, headers: noStore })
  const db = await identityClient()
  const { data: { user }, error: authError } = await db.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Sign in required' }, { status: 401, headers: noStore })
  if (Number(request.headers.get('content-length') || 0) > 4096) return NextResponse.json({ error: 'Request too large' }, { status: 413, headers: noStore })
  const payload = await request.json().catch(() => null)
  const username = typeof payload?.username === 'string' ? validateUsername(payload.username) : null
  const name = typeof payload?.name === 'string' ? payload.name.trim() : ''
  const grade = typeof payload?.grade === 'string' ? payload.grade.trim() : ''
  const guardianConfirmed = payload?.guardianConfirmed === true
  if (!username || !name || name.length > 80 || grade.length > 60 || !guardianConfirmed) return NextResponse.json({ error: 'Enter valid learner details and confirm guardianship' }, { status: 400, headers: noStore })
  const { data, error } = await db.rpc('vs_create_managed_learner', {
    p_username: username, p_display_name: name, p_grade: grade || null, p_guardian_confirmed: true,
  })
  if (error) return NextResponse.json({ error: error.code === '23505' ? 'Username unavailable' : error.code === '42501' ? 'Verified adult guardian authorization required' : 'Could not add learner' }, { status: error.code === '23505' ? 409 : 403, headers: noStore })
  return NextResponse.json(data, { status: 201, headers: noStore })
}
