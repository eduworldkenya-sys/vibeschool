import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })
  const { searchParams } = new URL(req.url)
  const schoolId = searchParams.get('school_id')
  if (!schoolId) return NextResponse.json({ error: 'Missing school_id' }, { status: 400 })

  const { data, error } = await supabase
    .from('report_schedules')
    .select('*')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ schedules: data })
}

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { report_type, frequency, filters, recipients, school_id } = body

  if (!report_type || !frequency || !school_id) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // TODO: wire email provider (Resend/SendGrid) here when available
  // For now: save schedule to DB only
  const nextRun = computeNextRun(frequency)

  const { data, error } = await supabase
    .from('report_schedules')
    .insert({
      school_id,
      created_by: user.id,
      report_type,
      frequency,
      filters: filters ?? {},
      recipients: recipients ?? [],
      is_active: true,
      next_run_at: nextRun,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ schedule: data })
}

export async function PATCH(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, is_active } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { error } = await supabase
    .from('report_schedules')
    .update({ is_active, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('created_by', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { error } = await supabase
    .from('report_schedules')
    .delete()
    .eq('id', id)
    .eq('created_by', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

function computeNextRun(frequency: string): string {
  const now = new Date()
  if (frequency === 'daily') {
    now.setDate(now.getDate() + 1)
    now.setHours(7, 0, 0, 0)
  } else if (frequency === 'weekly') {
    now.setDate(now.getDate() + (7 - now.getDay()))
    now.setHours(7, 0, 0, 0)
  } else {
    // end_of_term — placeholder, to be computed from academic_terms
    now.setMonth(now.getMonth() + 3)
    now.setHours(7, 0, 0, 0)
  }
  return now.toISOString()
}
