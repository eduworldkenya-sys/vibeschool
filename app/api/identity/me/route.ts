import { NextRequest, NextResponse } from 'next/server'
import { identityClient } from '@/lib/identity/server'
import { validSameOriginMutation } from '@/lib/identity/origin'
import { validateUsername } from '@/lib/identity/username'

const noStore = { 'Cache-Control': 'private, no-store' }

export async function GET() {
  const db = await identityClient()
  const { data: { user }, error: authError } = await db.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Sign in required' }, { status: 401, headers: noStore })
  const { data, error } = await db.rpc('vs_list_my_identities')
  if (error) return NextResponse.json({ error: 'Identity unavailable' }, { status: 503, headers: noStore })
  return NextResponse.json(data, { headers: noStore })
}

export async function POST(request: NextRequest) {
  if (!validSameOriginMutation(request)) return NextResponse.json({ error: 'Request origin rejected' }, { status: 403, headers: noStore })
  const db = await identityClient()
  const { data: { user }, error: authError } = await db.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Sign in required' }, { status: 401, headers: noStore })
  const body = await request.json().catch(() => null)
  const username = typeof body?.username === 'string' ? validateUsername(body.username) : null
  if (!username) return NextResponse.json({ error: 'Choose 3–24 letters, digits or underscores, starting with a letter.' }, { status: 400, headers: noStore })
  const { data, error } = await db.rpc('vs_claim_my_username', { p_username: username })
  if (error) return NextResponse.json({ error: error.code === '23505' ? 'Username unavailable' : 'Could not create username', code: error.code }, { status: error.code === '23505' ? 409 : 400, headers: noStore })
  return NextResponse.json(data, { headers: noStore })
}
