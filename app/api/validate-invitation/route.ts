import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { code, commit } = await req.json()

  if (!code || typeof code !== 'string') {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 })
  }

  const trimmed = code.trim()

  if (!/^\d{6}$/.test(trimmed)) {
    return NextResponse.json(
      { error: 'Code must be exactly 6 digits' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase.rpc('fn_invitation_attempt', {
    p_code:    trimmed,
    p_success: commit === true,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}