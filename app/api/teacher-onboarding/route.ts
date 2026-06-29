import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { userId, schoolId } = await req.json()
  if (!userId || !schoolId) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  const { error: memberErr } = await admin
    .from('school_members')
    .upsert(
      { profile_id: userId, school_id: schoolId, role: 'teacher' },
      { onConflict: 'school_id,profile_id', ignoreDuplicates: true }
    )
  if (memberErr) return NextResponse.json({ error: memberErr.message }, { status: 500 })

  const { error: profileErr } = await admin
    .from('profiles')
    .update({ school_id: schoolId })
    .eq('id', userId)
  if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 500 })

  const { data: tp } = await admin
    .from('teacher_profiles')
    .select('profile_id')
    .eq('profile_id', userId)
    .maybeSingle()

  if (!tp) {
    await admin
      .from('teacher_profiles')
      .upsert(
        { profile_id: userId, school_id: schoolId },
        { onConflict: 'profile_id', ignoreDuplicates: true }
      )
  }

  return NextResponse.json({ ok: true })
}
