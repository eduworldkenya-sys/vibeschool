import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdminSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase server credentials are not configured')
  return createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false
  return req.headers.get('authorization') === `Bearer ${cronSecret}`
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const adminSupabase = getAdminSupabase()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString().split('T')[0]

    const threeDaysOut = new Date(today)
    threeDaysOut.setDate(threeDaysOut.getDate() + 3)
    const oneDayAgo = new Date(today)
    oneDayAgo.setDate(oneDayAgo.getDate() - 1)

    const { data: rawInvoices, error: invErr } = await adminSupabase
      .from('finance_invoices')
      .select('id, student_id, school_id, due_date, status, paid_amount, total_amount, term, year')
      .is('deleted_at', null)
      .in('due_date', [threeDaysOut.toISOString().split('T')[0], oneDayAgo.toISOString().split('T')[0]])

    if (invErr) return NextResponse.json({ error: invErr.message }, { status: 500 })

    const excludedStatuses = new Set(['paid', 'waived', 'closed'])
    const invoices = (rawInvoices ?? []).filter((inv: any) => !excludedStatuses.has(inv.status))
    if (invoices.length === 0) {
      return NextResponse.json({ ok: true, reminders_sent: 0, message: 'No invoices due for reminder today' })
    }

    let totalReminders = 0
    const results: { invoice_id: string; student_id: string; reminded: boolean }[] = []
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    for (const inv of invoices) {
      const outstanding = (inv.total_amount ?? 0) - (inv.paid_amount ?? 0)
      if (outstanding <= 0) continue

      const { data: link } = await adminSupabase
        .from('parent_student_links')
        .select('parent_id')
        .eq('student_id', inv.student_id)
        .eq('school_id', inv.school_id)
        .eq('is_primary', true)
        .eq('receives_alerts', true)
        .maybeSingle()
      if (!link?.parent_id) continue

      const { data: existing } = await adminSupabase
        .from('notifications')
        .select('id')
        .eq('type', 'invoice_reminder')
        .eq('user_id', link.parent_id)
        .ilike('body', `%${inv.term} ${inv.year}%`)
        .gte('created_at', todayStart.toISOString())
      if (existing && existing.length > 0) continue

      const isOverdue = inv.due_date! < todayStr
      const msg = isOverdue
        ? `Your invoice for ${inv.term} ${inv.year} is overdue. Outstanding balance: KES ${outstanding.toLocaleString()}.`
        : `Your invoice for ${inv.term} ${inv.year} is due in 3 days. Outstanding balance: KES ${outstanding.toLocaleString()}.`

      const { error: insertErr } = await adminSupabase.from('notifications').insert({
        user_id: link.parent_id,
        school_id: inv.school_id,
        type: 'invoice_reminder',
        title: isOverdue ? 'Invoice Overdue' : 'Invoice Due Soon',
        body: msg,
        is_read: false,
      })

      if (!insertErr) {
        totalReminders += 1
        results.push({ invoice_id: inv.id, student_id: inv.student_id, reminded: true })
      }
    }

    return NextResponse.json({ ok: true, reminders_sent: totalReminders, details: results })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 })
  }
}
